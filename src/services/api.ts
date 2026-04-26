import { WatermarkSettings } from '../app/components/WatermarkCustomizer';

// Backend connection settings:
// 1. During local development, this defaults to http://localhost:3000.
// 2. To use another backend URL, create a .env file and set VITE_API_BASE_URL.
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');

// Keep endpoint paths here so they are easy to find and rename later.
// If your backend route names change, update these three values first.
const API_ENDPOINTS = {
  signup: '/auth/signup',
  login: '/auth/login',
  upload: '/upload',
  watermark: '/watermark',
  download: (imageId: string) => `/image/${encodeURIComponent(imageId)}/download`,
};

export class ApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

type AuthUser = {
  id?: string;
  fullName?: string;
  username?: string;
  email?: string;
};

type AuthResponse = {
  token?: string;
  accessToken?: string;
  user?: AuthUser;
  id?: string;
  fullName?: string;
  username?: string;
  email?: string;
};

// What the frontend accepts back from POST /upload.
// Your backend does not need to send every field, but it should send an id and URL.
type UploadResponse = {
  id?: string;
  imageId?: string;
  url?: string;
  imageUrl?: string;
  fileUrl?: string;
  name?: string;
  filename?: string;
  size?: string;
  uploadedAt?: string;
  owner?: string;
};

// What the frontend accepts back from POST /watermark.
// The protected image URL can be named watermarkedUrl, url, or imageUrl.
type WatermarkResponse = {
  id?: string;
  imageId?: string;
  url?: string;
  imageUrl?: string;
  watermarkedUrl?: string;
  status?: string;
};

function apiUrl(path: string) {
  return `${API_BASE_URL}${path}`;
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const message = await response.text();
    throw new ApiError(message || `Request failed with status ${response.status}`, response.status);
  }

  return response.json() as Promise<T>;
}

// BACKEND: POST /auth/signup
// Sends the new user's sign-up data so AWS/backend can save it in the database.
export async function signUpUser(input: { fullName: string; username: string; password: string }) {
  const response = await fetch(apiUrl(API_ENDPOINTS.signup), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  return parseJsonResponse<AuthResponse>(response);
}

// BACKEND: POST /auth/login
// Sends username/password and expects a user plus optional token back.
export async function loginUser(input: { username: string; password: string }) {
  const response = await fetch(apiUrl(API_ENDPOINTS.login), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  return parseJsonResponse<AuthResponse>(response);
}

// BACKEND: POST /upload
// Sends the selected image file as FormData.
export async function uploadImage(file: File, owner: string) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('owner', owner);

  const response = await fetch(apiUrl(API_ENDPOINTS.upload), {
    method: 'POST',
    body: formData,
  });

  return parseJsonResponse<UploadResponse>(response);
}

// BACKEND: POST /watermark
// Sends the image id plus the user's visible/invisible watermark settings.
export async function watermarkImage(imageId: string, settings: WatermarkSettings) {
  const response = await fetch(apiUrl(API_ENDPOINTS.watermark), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      imageId,
      settings,
    }),
  });

  return parseJsonResponse<WatermarkResponse>(response);
}

// BACKEND: GET /image/:id/download
// Expects the backend to return the actual file as a Blob.
export async function downloadImage(imageId: string) {
  const response = await fetch(apiUrl(API_ENDPOINTS.download(imageId)));

  if (!response.ok) {
    const message = await response.text();
    throw new ApiError(message || `Download failed with status ${response.status}`, response.status);
  }

  return response.blob();
}
