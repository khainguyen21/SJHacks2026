import { WatermarkSettings } from '../app/components/WatermarkCustomizer';

// In development Vite proxies /auth, /upload, /watermark, /image, /images to localhost:3000.
// For other environments set VITE_API_BASE_URL to the deployed backend origin.
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

const API_ENDPOINTS = {
  signup: '/auth/signup',
  login: '/auth/login',
  upload: '/upload',
  watermark: '/watermark',
  images: '/images',
  image: (imageId: string) => `/image/${encodeURIComponent(imageId)}`,
  download: (imageId: string) => `/image/${encodeURIComponent(imageId)}/download`,
  share: (imageId: string) => `/image/${encodeURIComponent(imageId)}/share`,
  revoke: (imageId: string) => `/image/${encodeURIComponent(imageId)}/revoke`,
  proof: (imageId: string) => `/image/${encodeURIComponent(imageId)}/proof`,
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

export type RemoteImage = {
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
  watermarked?: boolean;
  shared?: boolean;
  shareUrl?: string;
  hashFingerprint?: string;
};

type ListImagesResponse = {
  images?: RemoteImage[];
  files?: RemoteImage[];
  data?: RemoteImage[];
};

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

type WatermarkResponse = {
  id?: string;
  imageId?: string;
  url?: string;
  imageUrl?: string;
  watermarkedUrl?: string;
  status?: string;
};

type ShareResponse = {
  shareUrl?: string;
  url?: string;
  link?: string;
  shareLink?: string;
};

type ProofResponse = {
  hash?: string;
  fingerprint?: string;
  sha256?: string;
  createdAt?: string;
  timestamp?: string;
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

// POST /auth/signup
export async function signUpUser(input: { fullName: string; username: string; password: string }) {
  const response = await fetch(apiUrl(API_ENDPOINTS.signup), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return parseJsonResponse<AuthResponse>(response);
}

// POST /auth/login
export async function loginUser(input: { username: string; password: string }) {
  const response = await fetch(apiUrl(API_ENDPOINTS.login), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return parseJsonResponse<AuthResponse>(response);
}

// GET /images?owner=<username>  — load the user's vault on login
export async function listImages(owner: string): Promise<RemoteImage[]> {
  const url = `${apiUrl(API_ENDPOINTS.images)}?owner=${encodeURIComponent(owner)}`;
  const response = await fetch(url);
  const body = await parseJsonResponse<ListImagesResponse>(response);
  return body.images ?? body.files ?? body.data ?? [];
}

// POST /upload
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

// POST /watermark
export async function watermarkImage(imageId: string, settings: WatermarkSettings) {
  const response = await fetch(apiUrl(API_ENDPOINTS.watermark), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageId, settings }),
  });
  return parseJsonResponse<WatermarkResponse>(response);
}

// GET /image/:id/download
export async function downloadImage(imageId: string) {
  const response = await fetch(apiUrl(API_ENDPOINTS.download(imageId)));
  if (!response.ok) {
    const message = await response.text();
    throw new ApiError(message || `Download failed with status ${response.status}`, response.status);
  }
  return response.blob();
}

// DELETE /image/:id
export async function deleteImage(imageId: string): Promise<void> {
  const response = await fetch(apiUrl(API_ENDPOINTS.image(imageId)), {
    method: 'DELETE',
  });
  if (!response.ok) {
    const message = await response.text();
    throw new ApiError(message || `Delete failed with status ${response.status}`, response.status);
  }
}

// POST /image/:id/share  — returns a publicly shareable link
export async function shareImage(imageId: string): Promise<string> {
  const response = await fetch(apiUrl(API_ENDPOINTS.share(imageId)), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const body = await parseJsonResponse<ShareResponse>(response);
  return body.shareUrl ?? body.url ?? body.link ?? body.shareLink ?? '';
}

// POST /image/:id/revoke  — revokes any existing share link
export async function revokeImage(imageId: string): Promise<void> {
  const response = await fetch(apiUrl(API_ENDPOINTS.revoke(imageId)), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) {
    const message = await response.text();
    throw new ApiError(message || `Revoke failed with status ${response.status}`, response.status);
  }
}

// GET /image/:id/proof  — retrieve the stored SHA-256 fingerprint and creation timestamp
export async function getProofOfCreation(imageId: string): Promise<{ hash: string; createdAt: string }> {
  const response = await fetch(apiUrl(API_ENDPOINTS.proof(imageId)));
  const body = await parseJsonResponse<ProofResponse>(response);
  return {
    hash: body.hash ?? body.fingerprint ?? body.sha256 ?? '',
    createdAt: body.createdAt ?? body.timestamp ?? '',
  };
}
