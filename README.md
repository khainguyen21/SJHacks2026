
# PhotoGuard Frontend

This is the frontend for the PhotoGuard demo.

## Running The App

Run this once to install packages:

```bash
npm i
```

Run this to start the frontend:

```bash
npm run dev
```

## Backend Connection

The frontend is ready for these backend endpoints:

```txt
POST /auth/signup
POST /auth/login
POST /upload
POST /watermark
GET /image/:id/download
```

The backend connection code is in:

[src/services/api.ts](src/services/api.ts)

Search for `BACKEND` in the code to find the important integration points.

## Backend URL

By default, the frontend tries to talk to:

```txt
http://localhost:3000
```

When you build your backend, create a `.env` file in this project root:

```bash
VITE_API_BASE_URL=http://localhost:3000
```

If your backend runs on another port, change the number:

```bash
VITE_API_BASE_URL=http://localhost:8000
```

After changing `.env`, restart the frontend dev server.

## Where The Endpoints Are Used

### 1. Sign Up

Frontend callback:

[src/app/App.tsx](src/app/App.tsx)

Search:

```txt
BACKEND INTEGRATION: Sign-up starts here.
```

API function:

```ts
signUpUser({ fullName, username, password })
```

Backend route:

```txt
POST /auth/signup
```

The frontend sends:

```json
{
  "fullName": "Gavin",
  "username": "gavin",
  "password": "password123"
}
```

Good backend response:

```json
{
  "user": {
    "id": "user-123",
    "fullName": "Gavin",
    "username": "gavin"
  }
}
```

Your AWS backend should save this user in your database. Do not store raw passwords in the database. Hash them on the backend.

### 2. Login

Frontend callback:

[src/app/App.tsx](src/app/App.tsx)

Search:

```txt
BACKEND INTEGRATION: Login starts here.
```

API function:

```ts
loginUser({ username, password })
```

Backend route:

```txt
POST /auth/login
```

The frontend sends:

```json
{
  "username": "gavin",
  "password": "password123"
}
```

Good backend response:

```json
{
  "token": "jwt-or-session-token",
  "user": {
    "id": "user-123",
    "fullName": "Gavin",
    "username": "gavin"
  }
}
```

### 3. Upload Image

Frontend callback:

[src/app/App.tsx](src/app/App.tsx)

Search:

```txt
BACKEND INTEGRATION: Upload starts here.
```

API function:

```ts
uploadImage(file, ownerName)
```

Backend route:

```txt
POST /upload
```

The frontend sends:

```ts
FormData {
  file: File,
  owner: string
}
```

Good backend response:

```json
{
  "id": "image-123",
  "url": "https://your-backend.com/files/image-123.png",
  "name": "photo.png",
  "size": "2.4 MB",
  "uploadedAt": "2026-04-25T12:00:00Z",
  "owner": "gavin"
}
```

### 4. Apply Watermark

Frontend callback:

[src/app/App.tsx](src/app/App.tsx)

Search:

```txt
BACKEND INTEGRATION: Watermarking starts here.
```

API function:

```ts
watermarkImage(id, settings)
```

Backend route:

```txt
POST /watermark
```

The frontend sends:

```json
{
  "imageId": "image-123",
  "settings": {
    "type": "visible",
    "text": "© Gavin",
    "position": "center",
    "opacity": 50,
    "size": 40
  }
}
```

Good backend response:

```json
{
  "watermarkedUrl": "https://your-backend.com/files/image-123-watermarked.png"
}
```

### 5. Download Image

Frontend callback:

[src/app/App.tsx](src/app/App.tsx)

Search:

```txt
BACKEND INTEGRATION: Download starts here.
```

API function:

```ts
downloadImage(id)
```

Backend route:

```txt
GET /image/:id/download
```

The backend should return the actual image file, not JSON.

## Changing Endpoint Names

If your backend uses different route names, update this file:

[src/services/api.ts](src/services/api.ts)

Look for:

```ts
const API_ENDPOINTS = {
  signup: '/auth/signup',
  login: '/auth/login',
  upload: '/upload',
  watermark: '/watermark',
  download: (imageId: string) => `/image/${encodeURIComponent(imageId)}/download`,
};
```

For example, if your backend uses `/api/upload`, change:

```ts
upload: '/upload',
```

to:

```ts
upload: '/api/upload',
```

## Demo Fallbacks

The app still works without a backend right now.

If the backend is not running:

- Uploads stay in browser memory.
- Visible watermarking happens in the browser.
- Downloads use the browser's local image URL.
- Sign-up and login use one local browser account.

That fallback code is only there so the demo does not break while the backend is still unfinished.
