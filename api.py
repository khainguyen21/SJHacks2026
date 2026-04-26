import asyncio
from fastapi import FastAPI, Depends, HTTPException
import argparse
from pydantic import BaseModel
import boto3
import tempfile
from uuid import uuid4
import os
from DCT import *
app = FastAPI()

def get_s3_client():
    return boto3.client("s3")

BUCKET_NAME = "IMAGE_STORAGE"

class WatermarkRequest(BaseModel):
    key: str
    image_id: str
    watermark_text: str

@app.get ("/Image/{ID}/Download")
async def Download(ID: str, S3_client = Depends(get_s3_client)):
    try:
        url = S3_client.generate_presigned_url(
            ClientError="get_object",
            Params={
                "Bucket":BUCKET_NAME,
                "key": f"images/{ID}.jpg"
            },
            ExpiresIn=300
        )
        return {"download_url": url}
    
    except Exception as e:
        return {"error": str(e)}

@app.post ("/Upload")
async def Upload(S3_client = Depends(get_s3_client)):
    try:
        image_id = str(uuid4())
        key=f"uploads/{image_id}.jpg"
        url = S3_client.generate_presigned_post(
            Bucket=BUCKET_NAME,
            Key=key,
            Fields={
                "Content-Type": "image/jpg"
            }
        )
        return {
            "image_id": image_id,
            "key": key,
            "upload":url,
        }
    except Exception as e:
        return {"error": str(e)}
    
@app.post ("/Watermark")
async def Watermark(request: WatermarkRequest, S3_client = Depends(get_s3_client)):
    try:
        output_id = str(uuid4())
        output_key = f"watermarked/{output_id}.png"

        with tempfile.TemporaryDirectory() as temp_dir:
            input_path = os.path.join(temp_dir, "input.png")
            output_path = os.path.join(temp_dir, "output.png")
        S3_client.download_file(
            BUCKET_NAME,
            request.key,
            input_path
        )

        embed_watermark(input_path=input_path, 
                        output_path=output_path,
                        watermark_text=request.watermark_text)
        S3_client.upload_file(
            output_path,
            BUCKET_NAME,
            output_key,
            ExtraArgs={"ContentType": "image/jpg"}
        )
        return {
            "original_image_id": request.image_id,
            "original_key": request.key,
            "watermarked_image_id": output_id,
            "watermarked_key": output_key
        }

    except Exception as e:  
        raise HTTPException(status_code=500, detail=str(e))
