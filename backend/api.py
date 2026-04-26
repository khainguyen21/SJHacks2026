"""
PhotoGuard FastAPI backend — local file storage (no AWS required).

Run:
    cd backend
    uvicorn api:app --port 3000 --reload
"""

import os
import uuid
import datetime
import shutil
import tempfile
from pathlib import Path
from typing import Optional

import cv2
import numpy as np
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from DCT import embed_watermark

# ---------------------------------------------------------------------------
# App + CORS
# ---------------------------------------------------------------------------

app = FastAPI(title="PhotoGuard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Local storage
# ---------------------------------------------------------------------------

BASE_DIR = Path(__file__).parent
UPLOAD_DIR = BASE_DIR / "uploads"
WATERMARK_DIR = BASE_DIR / "watermarked"
UPLOAD_DIR.mkdir(exist_ok=True)
WATERMARK_DIR.mkdir(exist_ok=True)

# Serve stored files directly so the browser can display them
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")
app.mount("/watermarked", StaticFiles(directory=str(WATERMARK_DIR)), name="watermarked")

BASE_URL = "http://localhost:3000"

# ---------------------------------------------------------------------------
# In-memory auth (fine for a demo — resets when the server restarts)
# ---------------------------------------------------------------------------

_users: dict[str, dict] = {}
_tokens: dict[str, str] = {}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _find_file(image_id: str) -> Optional[Path]:
    """Return the Path of a stored image, searching uploads then watermarked."""
    for directory in [UPLOAD_DIR, WATERMARK_DIR]:
        for f in directory.rglob(f"{image_id}.*"):
            return f
    return None


def _file_url(path: Path) -> str:
    """Convert a local Path to a URL the browser can reach."""
    rel = path.relative_to(BASE_DIR)
    return f"{BASE_URL}/{rel.as_posix()}"


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

class SignUpBody(BaseModel):
    fullName: Optional[str] = None
    username: str
    password: str


class LoginBody(BaseModel):
    username: str
    password: str


@app.post("/auth/signup")
async def signup(body: SignUpBody):
    if body.username in _users:
        raise HTTPException(status_code=409, detail="Username already taken.")
    _users[body.username] = {
        "password": body.password,
        "fullName": body.fullName or body.username,
    }
    return {"username": body.username, "fullName": _users[body.username]["fullName"]}


@app.post("/auth/login")
async def login(body: LoginBody):
    user = _users.get(body.username)
    if not user or user["password"] != body.password:
        raise HTTPException(status_code=401, detail="Invalid username or password.")
    token = str(uuid.uuid4())
    _tokens[token] = body.username
    return {"username": body.username, "fullName": user["fullName"], "token": token}


# ---------------------------------------------------------------------------
# List images
# ---------------------------------------------------------------------------

@app.get("/images")
async def list_images(owner: str):
    owner_dir = UPLOAD_DIR / owner
    if not owner_dir.exists():
        return {"images": []}

    images = []
    for f in sorted(owner_dir.iterdir()):
        if not f.is_file():
            continue
        image_id = f.stem
        stat = f.stat()
        images.append({
            "id": image_id,
            "imageId": image_id,
            "url": _file_url(f),
            "name": f.name,
            "size": f"{stat.st_size // 1024} KB",
            "uploadedAt": datetime.datetime.fromtimestamp(stat.st_mtime).isoformat(),
            "owner": owner,
            "watermarked": False,
        })
    return {"images": images}


# ---------------------------------------------------------------------------
# Upload
# ---------------------------------------------------------------------------

@app.post("/upload")
async def upload(file: UploadFile = File(...), owner: str = Form("user")):
    image_id = str(uuid.uuid4())
    ext = (file.filename or "image.jpg").rsplit(".", 1)[-1].lower()

    owner_dir = UPLOAD_DIR / owner
    owner_dir.mkdir(exist_ok=True)

    dest = owner_dir / f"{image_id}.{ext}"
    data = await file.read()
    dest.write_bytes(data)

    return {
        "id": image_id,
        "imageId": image_id,
        "url": _file_url(dest),
        "name": file.filename,
        "size": f"{len(data) // 1024} KB",
        "uploadedAt": datetime.datetime.utcnow().isoformat(),
        "owner": owner,
    }


# ---------------------------------------------------------------------------
# Watermark
# ---------------------------------------------------------------------------

class WatermarkSettings(BaseModel):
    type: str = "invisible"
    text: Optional[str] = "© PROTECTED"
    fontFamily: Optional[str] = "Arial"
    position: Optional[str] = "center"
    opacity: Optional[int] = 50
    size: Optional[int] = 40
    customX: Optional[float] = 50
    customY: Optional[float] = 50


class WatermarkRequest(BaseModel):
    imageId: str
    settings: WatermarkSettings


@app.post("/watermark")
async def watermark(request: WatermarkRequest):
    src = _find_file(request.imageId)
    if not src:
        raise HTTPException(status_code=404, detail="Image not found.")

    output_id = str(uuid.uuid4())
    output_path = WATERMARK_DIR / f"{output_id}.png"

    try:
        if request.settings.type == "invisible":
            embed_watermark(
                input_path=str(src),
                output_path=str(output_path),
                watermark_text=request.settings.text or "© PROTECTED",
            )
        else:
            img = cv2.imread(str(src))
            if img is None:
                raise HTTPException(status_code=422, detail="Could not decode image.")
            h, w = img.shape[:2]
            text = request.settings.text or "© PROTECTED"
            font_scale = max(0.5, (request.settings.size or 40) / 30)
            alpha = (request.settings.opacity or 50) / 100
            overlay = img.copy()

            if request.settings.position == "tiled":
                step_x, step_y = w // 3, h // 3
                for tx in range(step_x // 2, w, step_x):
                    for ty in range(step_y // 2, h, step_y):
                        cv2.putText(overlay, text, (tx, ty),
                                    cv2.FONT_HERSHEY_SIMPLEX, font_scale,
                                    (255, 255, 255), 2, cv2.LINE_AA)
            else:
                pos = {
                    "corner": (max(10, w - 250), 40),
                    "center": (w // 2, h // 2),
                    "custom": (
                        int(w * (request.settings.customX or 50) / 100),
                        int(h * (request.settings.customY or 50) / 100),
                    ),
                }.get(request.settings.position or "center", (w // 2, h // 2))
                cv2.putText(overlay, text, pos,
                            cv2.FONT_HERSHEY_SIMPLEX, font_scale,
                            (255, 255, 255), 2, cv2.LINE_AA)

            cv2.addWeighted(overlay, alpha, img, 1 - alpha, 0, img)
            cv2.imwrite(str(output_path), img)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {
        "imageId": output_id,
        "watermarkedUrl": _file_url(output_path),
        "url": _file_url(output_path),
    }


# ---------------------------------------------------------------------------
# Download
# ---------------------------------------------------------------------------

@app.get("/image/{image_id}/download")
async def download(image_id: str):
    path = _find_file(image_id)
    if not path:
        raise HTTPException(status_code=404, detail="Image not found.")
    return FileResponse(
        path=str(path),
        filename=path.name,
        media_type="application/octet-stream",
    )


# ---------------------------------------------------------------------------
# Delete
# ---------------------------------------------------------------------------

@app.delete("/image/{image_id}")
async def delete_image(image_id: str):
    path = _find_file(image_id)
    if not path:
        raise HTTPException(status_code=404, detail="Image not found.")
    path.unlink()
    return {"status": "deleted"}


# ---------------------------------------------------------------------------
# Share  (returns a direct local URL — works on the same machine)
# ---------------------------------------------------------------------------

@app.post("/image/{image_id}/share")
async def share_image(image_id: str):
    path = _find_file(image_id)
    if not path:
        raise HTTPException(status_code=404, detail="Image not found.")
    return {"shareUrl": _file_url(path)}


# ---------------------------------------------------------------------------
# Revoke
# ---------------------------------------------------------------------------

@app.post("/image/{image_id}/revoke")
async def revoke_image(image_id: str):
    return {"status": "revoked", "imageId": image_id}


# ---------------------------------------------------------------------------
# Proof of creation
# ---------------------------------------------------------------------------

@app.get("/image/{image_id}/proof")
async def proof_of_creation(image_id: str):
    path = _find_file(image_id)
    if not path:
        raise HTTPException(status_code=404, detail="Image not found.")
    stat = path.stat()
    return {
        "hash": "",
        "createdAt": datetime.datetime.fromtimestamp(stat.st_mtime).isoformat(),
    }
