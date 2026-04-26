import { useState, useCallback, useEffect, FormEvent } from 'react';
import {
  Shield,
  ArrowRight,
  UserPlus,
  LogIn,
  LockKeyhole,
} from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { FileUploader } from './components/FileUploader';
import { PreviewModal } from './components/PreviewModal';
import { UploadProgress, UploadingFile } from './components/UploadProgress';
import { SecurityStatusCard } from './components/SecurityStatusCard';
import { WatermarkCustomizer, WatermarkSettings } from './components/WatermarkCustomizer';
import { SecurityRiskPreview, RiskAnalysis } from './components/SecurityRiskPreview';
import {
  ApiError,
  downloadImage,
  loginUser,
  signUpUser,
  uploadImage,
  watermarkImage,
  listImages,
  deleteImage,
  shareImage,
  revokeImage,
} from '../services/api';
import { hashFile } from '../utils/crypto';
import { embedInvisibleWatermark } from '../utils/watermark';

interface Photo {
  id: string;
  name: string;
  url: string;
  watermarked: boolean;
  size: string;
  uploadedAt: Date;
}

interface EnhancedPhoto extends Photo {
  owner?: string;
  shared?: boolean;
  shareUrl?: string;
  viewCount?: number;
  visibleWatermarkEnabled?: boolean;
  invisibleWatermarkEnabled?: boolean;
  watermarkText?: string;
  watermarkPosition?: 'corner' | 'center' | 'tiled' | 'custom';
  watermarkOpacity?: number;
  watermarkSize?: number;
  protectionStatus?: string[];
  hashFingerprint?: string;
}

interface StoredAccount {
  fullName: string;
  username: string;
  password: string;
}

interface ActivityRecord {
  id: string;
  time: string;
  action: string;
  details: string;
  severity: 'info' | 'warning' | 'critical';
}

interface AppSettings {
  darkMode: boolean;
}

type AuthScreen = 'welcome' | 'signup' | 'signin' | 'dashboard';

const ACCOUNT_STORAGE_KEY = 'photoguard-account';
const SESSION_STORAGE_KEY = 'photoguard-session';
const AUTH_TOKEN_STORAGE_KEY = 'photoguard-auth-token';

function readStoredAccount(): StoredAccount | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(ACCOUNT_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredAccount;
  } catch {
    return null;
  }
}

function readStoredSession(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(SESSION_STORAGE_KEY);
}

function getInitialScreen(): AuthScreen {
  const session = readStoredSession();
  if (session) return 'dashboard';
  const account = readStoredAccount();
  if (account) return 'signin';
  return 'welcome';
}

function createLocalWatermarkedUrl(photoUrl: string, settings: WatermarkSettings) {
  return new Promise<string>((resolve, reject) => {
    const img = new Image();
    img.src = photoUrl;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Unable to prepare image canvas.'));
        return;
      }

      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      const text = settings.text || '© PROTECTED';
      const fontSize = settings.size;
      ctx.font = `${fontSize}px ${settings.fontFamily}`;
      ctx.fillStyle = `rgba(255, 255, 255, ${settings.opacity / 100})`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      if (settings.type === 'visible' && settings.position === 'tiled') {
        for (let y = fontSize; y < img.height; y += fontSize * 3) {
          for (let x = fontSize; x < img.width; x += fontSize * 4) {
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(-Math.PI / 6);
            ctx.fillText(text, 0, 0);
            ctx.restore();
          }
        }
      } else if (settings.type === 'visible' && settings.position === 'corner') {
        ctx.save();
        ctx.translate(img.width - fontSize, fontSize);
        ctx.fillText(text, 0, 0);
        ctx.restore();
      } else if (settings.type === 'visible' && settings.position === 'custom') {
        const x = (img.width * (settings.customX || 50)) / 100;
        const y = (img.height * (settings.customY || 50)) / 100;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(-Math.PI / 6);
        ctx.fillText(text, 0, 0);
        ctx.restore();
      } else if (settings.type === 'visible') {
        ctx.save();
        ctx.translate(img.width / 2, img.height / 2);
        ctx.rotate(-Math.PI / 6);
        ctx.fillText(text, 0, 0);
        ctx.restore();
      }

      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('Unable to load image for watermarking.'));
  });
}

export default function App() {
  const [photos, setPhotos] = useState<EnhancedPhoto[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [activeView, setActiveView] = useState('upload');
  const [previewPhoto, setPreviewPhoto] = useState<EnhancedPhoto | null>(null);
  const [showWatermarkCustomizer, setShowWatermarkCustomizer] = useState<string | null>(null);
  const [riskAnalysis, setRiskAnalysis] = useState<{ analysis: RiskAnalysis; fileName: string } | null>(null);
  const [activityLog, setActivityLog] = useState<ActivityRecord[]>([]);
  const [settings, setSettings] = useState<AppSettings>({ darkMode: false });
  const [authScreen, setAuthScreen] = useState<AuthScreen>(getInitialScreen);
  const [account, setAccount] = useState<StoredAccount | null>(readStoredAccount);
  const [currentUsername, setCurrentUsername] = useState<string | null>(readStoredSession);
  const [authError, setAuthError] = useState('');
  const [authNotice, setAuthNotice] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [vaultLoading, setVaultLoading] = useState(false);
  const [signUpForm, setSignUpForm] = useState({
    fullName: '',
    username: '',
    password: '',
    confirmPassword: '',
  });
  const [signInForm, setSignInForm] = useState({
    username: readStoredAccount()?.username ?? '',
    password: '',
  });

  // Restore vault when the app opens with an already-active session (page refresh case).
  useEffect(() => {
    const session = readStoredSession();
    if (session) {
      loadVaultFromBackend(session);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally runs once on mount only

  const addActivity = useCallback((action: string, details: string, severity: ActivityRecord['severity'] = 'info') => {
    const timestamp = new Date();
    setActivityLog(prev => [
      {
        id: `${timestamp.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
        time: timestamp.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
        action,
        details,
        severity,
      },
      ...prev,
    ]);
  }, []);

  // Load the user's existing vault from the backend after login.
  const loadVaultFromBackend = useCallback(async (username: string) => {
    setVaultLoading(true);
    try {
      const remoteImages = await listImages(username);
      if (remoteImages.length > 0) {
        const loaded: EnhancedPhoto[] = remoteImages.map(img => ({
          id: img.id ?? img.imageId ?? Math.random().toString(36).slice(2),
          name: img.name ?? img.filename ?? 'Untitled',
          url: img.url ?? img.imageUrl ?? img.fileUrl ?? '',
          watermarked: img.watermarked ?? false,
          size: img.size ?? '—',
          uploadedAt: img.uploadedAt ? new Date(img.uploadedAt) : new Date(),
          owner: img.owner ?? username,
          shared: img.shared ?? false,
          shareUrl: img.shareUrl,
          viewCount: 0,
          visibleWatermarkEnabled: false,
          invisibleWatermarkEnabled: true,
          watermarkText: `© ${username}`,
          watermarkPosition: 'center',
          watermarkOpacity: 50,
          watermarkSize: 40,
          protectionStatus: img.watermarked ? ['Watermarked'] : ['Preview Ready'],
          hashFingerprint: img.hashFingerprint,
        }));
        setPhotos(loaded);
        addActivity('Vault loaded', `${loaded.length} file(s) restored from the backend.`);
      }
    } catch {
      addActivity('Vault load skipped', 'Could not reach backend — starting with an empty vault.', 'warning');
    } finally {
      setVaultLoading(false);
    }
  }, [addActivity]);

  // Upload: invisible watermark → SHA-256 proof-of-creation → POST /upload
  const handleFilesAdded = useCallback((files: File[]) => {
    const uploading: UploadingFile[] = files.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      progress: 0,
      size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
    }));

    setUploadingFiles(prev => [...prev, ...uploading]);

    uploading.forEach(async (upload, index) => {
      const file = files[index];
      const interval = setInterval(() => {
        setUploadingFiles(prev =>
          prev.map(u => u.id === upload.id ? { ...u, progress: Math.round(Math.min(90, u.progress + Math.random() * 20)) } : u)
        );
      }, 200);

      const ownerName = currentUsername ?? account?.fullName ?? account?.username ?? 'PhotoGuard';

      // Step 1: embed invisible ownership watermark
      const watermarkedFile = await embedInvisibleWatermark(file, ownerName);

      // Step 2: SHA-256 fingerprint for proof of creation
      const fingerprint = await hashFile(watermarkedFile);
      addActivity(
        'Proof of creation',
        `${file.name} — SHA-256: ${fingerprint.slice(0, 16)}…`,
        'info'
      );

      try {
        // Step 3: POST /upload
        const uploadedImage = await uploadImage(watermarkedFile, ownerName);

        clearInterval(interval);
        setUploadingFiles(prev => prev.map(u => u.id === upload.id ? { ...u, progress: 100 } : u));
        setUploadingFiles(prev => prev.filter(u => u.id !== upload.id));

        const newPhoto: EnhancedPhoto = {
          id: uploadedImage.id ?? uploadedImage.imageId ?? upload.id,
          name: uploadedImage.name ?? uploadedImage.filename ?? file.name,
          url: uploadedImage.url ?? uploadedImage.imageUrl ?? uploadedImage.fileUrl ?? URL.createObjectURL(watermarkedFile),
          watermarked: false,
          size: uploadedImage.size ?? upload.size,
          uploadedAt: uploadedImage.uploadedAt ? new Date(uploadedImage.uploadedAt) : new Date(),
          owner: uploadedImage.owner ?? ownerName,
          shared: false,
          viewCount: 0,
          visibleWatermarkEnabled: false,
          invisibleWatermarkEnabled: true,
          watermarkText: `© ${ownerName}`,
          watermarkPosition: 'center',
          watermarkOpacity: 50,
          watermarkSize: 40,
          protectionStatus: ['Invisible Watermark Applied', 'Uploaded'],
          hashFingerprint: fingerprint,
        };

        setPhotos(prev => [...prev, newPhoto]);
        setActiveView('upload');
        addActivity('File uploaded', `${file.name} stored on the backend with an invisible watermark.`);

        const analysis = analyzeRisk(newPhoto);
        if (analysis.level !== 'low') setRiskAnalysis({ analysis, fileName: newPhoto.name });
      } catch {
        // Demo fallback: keep the watermarked image in browser memory
        clearInterval(interval);
        setUploadingFiles(prev => prev.filter(u => u.id !== upload.id));

        const newPhoto: EnhancedPhoto = {
          id: upload.id,
          name: file.name,
          url: URL.createObjectURL(watermarkedFile),
          watermarked: false,
          size: upload.size,
          uploadedAt: new Date(),
          owner: ownerName,
          shared: false,
          viewCount: 0,
          visibleWatermarkEnabled: false,
          invisibleWatermarkEnabled: true,
          watermarkText: `© ${ownerName}`,
          watermarkPosition: 'center',
          watermarkOpacity: 50,
          watermarkSize: 40,
          protectionStatus: ['Invisible Watermark Applied', 'Local Only'],
          hashFingerprint: fingerprint,
        };

        setPhotos(prev => [...prev, newPhoto]);
        setActiveView('upload');
        addActivity(
          'Local upload fallback',
          `${file.name} stayed in the browser (invisible watermark + hash still applied).`,
          'warning'
        );

        const analysis = analyzeRisk(newPhoto);
        if (analysis.level !== 'low') setRiskAnalysis({ analysis, fileName: newPhoto.name });
      }
    });
  }, [account, addActivity, currentUsername]);

  const analyzeRisk = (photo: EnhancedPhoto): RiskAnalysis => {
    const issues: string[] = [];
    let score = 100;

    if (!photo.watermarked) {
      issues.push('No visible watermark protection applied');
      score -= 25;
    }
    if (photo.shared) {
      issues.push('Public sharing is enabled');
      score -= 15;
    }

    const level: 'low' | 'medium' | 'high' =
      score >= 70 ? 'low' : score >= 40 ? 'medium' : 'high';

    const recommendations: RiskAnalysis['recommendations'] = [];

    if (!photo.watermarked) {
      recommendations.push({
        icon: Shield,
        title: 'Add Visible Watermark',
        description: 'Apply a visible watermark via the backend for maximum protection.',
        action: () => {
          setRiskAnalysis(null);
          setShowWatermarkCustomizer(photo.id);
        },
        actionLabel: 'Add Watermark',
      });
    }

    return { level, score, issues, recommendations };
  };

  // Watermark: POST /watermark → update photo state
  const applyWatermark = useCallback(async (id: string, wSettings: WatermarkSettings) => {
    const photo = photos.find(p => p.id === id);
    if (!photo) return;

    setShowWatermarkCustomizer(null);

    const updateProtectedPhoto = (watermarkedUrl: string, activityMessage: string, severity: ActivityRecord['severity'] = 'info') => {
      setPhotos(prev => prev.map(p =>
        p.id === id
          ? {
              ...p,
              url: watermarkedUrl,
              watermarked: true,
              visibleWatermarkEnabled: wSettings.type === 'visible',
              invisibleWatermarkEnabled: wSettings.type === 'invisible' || p.invisibleWatermarkEnabled,
              watermarkText: wSettings.text,
              watermarkPosition: wSettings.position,
              watermarkOpacity: wSettings.opacity,
              watermarkSize: wSettings.size,
              protectionStatus: [
                ...(p.protectionStatus ?? []),
                wSettings.type === 'visible' ? 'Visible Watermark' : 'Invisible Watermark',
              ],
            }
          : p
      ));
      setActiveView('vault');
      addActivity('Watermark applied', activityMessage, severity);
    };

    try {
      // POST /watermark
      const watermarkedImage = await watermarkImage(id, wSettings);
      const watermarkedUrl =
        watermarkedImage.watermarkedUrl ??
        watermarkedImage.url ??
        watermarkedImage.imageUrl ??
        photo.url;
      updateProtectedPhoto(watermarkedUrl, `${photo.name} protected by the backend watermark service.`);
    } catch {
      // Fallback: canvas watermark in the browser
      const watermarkedUrl = await createLocalWatermarkedUrl(photo.url, wSettings);
      updateProtectedPhoto(
        watermarkedUrl,
        `${photo.name} watermarked in the browser (backend watermark API unavailable).`,
        'warning'
      );
    }
  }, [addActivity, photos]);

  const handleWatermark = useCallback((id: string) => {
    setShowWatermarkCustomizer(id);
  }, []);

  const updatePhoto = useCallback((id: string, updates: Partial<EnhancedPhoto>) => {
    setPhotos(prev => prev.map(photo => photo.id === id ? { ...photo, ...updates } : photo));
  }, []);

  // Download: GET /image/:id/download (falls back to local URL)
  const handleDownload = useCallback(async (id: string) => {
    const photo = photos.find(p => p.id === id);
    if (!photo) return;

    let downloadUrl = photo.url;

    try {
      // GET /image/:id/download
      const blob = await downloadImage(id);
      downloadUrl = URL.createObjectURL(blob);
    } catch {
      addActivity('Local download fallback', `${photo.name} downloaded from browser memory (backend unavailable).`, 'warning');
    }

    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = photo.watermarked ? `watermarked-${photo.name}` : photo.name;
    link.click();

    if (downloadUrl !== photo.url) URL.revokeObjectURL(downloadUrl);

    setPhotos(prev => prev.map(p => p.id === id ? { ...p, viewCount: (p.viewCount || 0) + 1 } : p));
    addActivity('File downloaded', `${photo.name} downloaded from the vault.`);
  }, [addActivity, photos]);

  // Delete: DELETE /image/:id then remove from state
  const handleDelete = useCallback(async (id: string) => {
    const photo = photos.find(p => p.id === id);

    try {
      // DELETE /image/:id
      await deleteImage(id);
      addActivity('File deleted', `${photo?.name ?? id} removed from the backend.`, 'warning');
    } catch {
      addActivity('Local delete', `${photo?.name ?? id} removed from local state (backend unavailable).`, 'warning');
    }

    setPhotos(prev => prev.filter(p => p.id !== id));
  }, [addActivity, photos]);

  const handlePreview = useCallback((id: string) => {
    const photo = photos.find(p => p.id === id);
    if (photo) setPreviewPhoto(photo);
  }, [photos]);

  const handleCancelUpload = useCallback((id: string) => {
    setUploadingFiles(prev => prev.filter(u => u.id !== id));
  }, []);

  // Share: POST /image/:id/share → copy link to clipboard
  const handleShare = useCallback(async (id: string) => {
    const photo = photos.find(p => p.id === id);
    if (!photo) return;

    try {
      // POST /image/:id/share
      const link = await shareImage(id);
      updatePhoto(id, { shared: true, shareUrl: link });

      if (link) {
        await navigator.clipboard.writeText(link).catch(() => {});
        addActivity('File shared', `${photo.name} — share link copied to clipboard: ${link}`);
      } else {
        updatePhoto(id, { shared: true });
        addActivity('File shared', `${photo.name} is now publicly shared.`);
      }
    } catch {
      // Fallback: mark shared locally
      updatePhoto(id, { shared: true });
      addActivity('Local share', `${photo.name} marked as shared in local state (backend unavailable).`, 'warning');
    }
  }, [addActivity, photos, updatePhoto]);

  // Revoke: POST /image/:id/revoke → clear share state
  const handleRevokeAccess = useCallback(async (id: string) => {
    const photo = photos.find(p => p.id === id);
    if (!photo) return;

    try {
      // POST /image/:id/revoke
      await revokeImage(id);
      addActivity('Access revoked', `${photo.name} share links revoked on the backend.`, 'warning');
    } catch {
      addActivity('Local revoke', `${photo.name} share links cleared locally (backend unavailable).`, 'warning');
    }

    updatePhoto(id, { shared: false, shareUrl: undefined });
  }, [addActivity, photos, updatePhoto]);

  const persistAccount = useCallback((nextAccount: StoredAccount) => {
    window.localStorage.setItem(ACCOUNT_STORAGE_KEY, JSON.stringify(nextAccount));
    setAccount(nextAccount);
  }, []);

  const persistSession = useCallback((username: string, token?: string) => {
    window.localStorage.setItem(SESSION_STORAGE_KEY, username);
    if (token) window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
    setCurrentUsername(username);
  }, []);

  const clearSession = useCallback(() => {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    setCurrentUsername(null);
  }, []);

  // Sign-up: POST /auth/signup
  const handleCreateAccount = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthError('');
    setAuthNotice('');

    const fullName = signUpForm.fullName.trim();
    const username = signUpForm.username.trim();
    const password = signUpForm.password;

    if (!fullName || !username || !password) {
      setAuthError('Please complete every sign-up field.');
      return;
    }
    if (password.length < 6) {
      setAuthError('Use a password with at least 6 characters.');
      return;
    }
    if (signUpForm.confirmPassword !== password) {
      setAuthError('Your password confirmation does not match.');
      return;
    }

    setAuthLoading(true);

    try {
      // POST /auth/signup
      const signedUpUser = await signUpUser({ fullName, username, password });
      const backendUsername = signedUpUser.user?.username ?? signedUpUser.username ?? username;
      const backendFullName = signedUpUser.user?.fullName ?? signedUpUser.fullName ?? fullName;

      persistAccount({ fullName: backendFullName, username: backendUsername, password: '' });
      clearSession();
      setSignInForm({ username: backendUsername, password: '' });
      setAuthNotice('Account created. Please sign in.');
      setAuthScreen('signin');
    } catch (error) {
      if (error instanceof ApiError && error.status) {
        setAuthError(error.message);
        return;
      }

      // Demo fallback
      const nextAccount = { fullName, username, password };
      persistAccount(nextAccount);
      clearSession();
      setSignInForm({ username, password: '' });
      setAuthNotice('Local demo account created. Connect your backend later to persist this.');
      setAuthScreen('signin');
    } finally {
      setAuthLoading(false);
      setSignUpForm({ fullName: '', username: '', password: '', confirmPassword: '' });
    }
  }, [clearSession, persistAccount, signUpForm]);

  // Login: POST /auth/login → load vault via GET /images
  const handleAuthenticate = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthError('');
    setAuthNotice('');

    const username = signInForm.username.trim();
    const password = signInForm.password;

    if (!username || !password) {
      setAuthError('Enter your username and password.');
      return;
    }

    setAuthLoading(true);

    try {
      // POST /auth/login
      const loggedInUser = await loginUser({ username, password });
      const backendUsername = loggedInUser.user?.username ?? loggedInUser.username ?? username;
      const backendFullName = loggedInUser.user?.fullName ?? loggedInUser.fullName ?? account?.fullName ?? backendUsername;
      const token = loggedInUser.token ?? loggedInUser.accessToken;

      persistAccount({ fullName: backendFullName, username: backendUsername, password: '' });
      persistSession(backendUsername, token);
      setSignInForm({ username: backendUsername, password: '' });
      setAuthScreen('dashboard');

      // GET /images — restore vault files from backend
      await loadVaultFromBackend(backendUsername);
    } catch (error) {
      if (error instanceof ApiError && error.status) {
        setAuthError(error.message);
        return;
      }

      // Demo fallback: authenticate against local browser account
      if (!account) {
        setAuthError('Create an account first.');
        setAuthScreen('signup');
        return;
      }
      if (username !== account.username || password !== account.password) {
        setAuthError('That username or password is incorrect.');
        return;
      }

      persistSession(account.username);
      setSignInForm({ username: account.username, password: '' });
      setAuthScreen('dashboard');

      // Still attempt vault load even in fallback mode
      await loadVaultFromBackend(account.username);
    } finally {
      setAuthLoading(false);
    }
  }, [account, loadVaultFromBackend, persistAccount, persistSession, signInForm]);

  const handleLogout = useCallback(() => {
    clearSession();
    setPhotos([]);
    setActivityLog([]);
    setAuthNotice('You have been signed out.');
    setAuthError('');
    setSignInForm({ username: account?.username ?? '', password: '' });
    setAuthScreen(account ? 'signin' : 'welcome');
  }, [account, clearSession]);

  if (authScreen !== 'dashboard') {
    const isSignup = authScreen === 'signup';
    const knownAccount = account?.username;

    return (
      <div className="min-h-screen bg-[#0f172a] text-white">
        <section className="flex min-h-screen w-full flex-col justify-between px-6 py-8 sm:px-8 lg:px-12 lg:py-10">
          <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col">
            <div className="mb-10 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/12">
                <Shield className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl text-white">PhotoGuard</h1>
                <p className="text-sm text-white/65">Secure image operations</p>
              </div>
            </div>

            <div className="grid flex-1 gap-10 lg:grid-cols-[minmax(0,1.1fr)_420px] lg:items-center">
              <div className="max-w-3xl">
                <p className="mb-3 text-sm uppercase tracking-[0.18em] text-cyan-200/80">
                  Protected media workspace
                </p>
                <h2 className="mb-4 text-4xl font-medium leading-tight text-white sm:text-5xl lg:text-6xl">
                  Protect your photo workflow
                </h2>
                <p className="max-w-2xl text-lg leading-8 text-slate-300">
                  Every upload receives an invisible ownership watermark and a SHA-256 proof-of-creation fingerprint before it ever leaves your browser.
                </p>
              </div>

              <div className="w-full rounded-3xl border border-white/12 bg-white/8 p-6 shadow-[0_20px_80px_rgba(0,0,0,0.22)] backdrop-blur-sm sm:p-8">
                {authScreen === 'welcome' ? (
                  <div>
                    <div className="mb-6">
                      <p className="mb-2 text-sm text-slate-300">Welcome</p>
                      <h3 className="mb-2 text-3xl text-white">Protect your photo workflow</h3>
                      <p className="text-sm leading-6 text-slate-300">
                        Start with a simple onboarding step before entering the dashboard.
                      </p>
                    </div>

                    <button
                      onClick={() => { setAuthError(''); setAuthNotice(''); setAuthScreen('signup'); }}
                      className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-4 text-slate-950 transition hover:bg-slate-100"
                    >
                      Get Started
                      <ArrowRight className="h-4 w-4" />
                    </button>

                    {knownAccount && (
                      <button
                        onClick={() => {
                          setAuthError('');
                          setAuthNotice('');
                          setSignInForm(prev => ({ ...prev, username: knownAccount }));
                          setAuthScreen('signin');
                        }}
                        className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/6 px-4 text-white transition hover:bg-white/12"
                      >
                        <LogIn className="h-4 w-4" />
                        Sign In
                      </button>
                    )}
                  </div>
                ) : (
                  <div>
                    <div className="mb-6">
                      <p className="mb-2 text-sm text-slate-300">
                        {isSignup ? 'Create account' : 'Authenticate'}
                      </p>
                      <h3 className="mb-2 text-3xl text-white">
                        {isSignup ? 'Sign up first' : 'Sign in with username and password'}
                      </h3>
                      <p className="text-sm leading-6 text-slate-300">
                        {isSignup
                          ? 'When your backend is connected, this creates a database user.'
                          : 'When your backend is connected, this authenticates against your database.'}
                      </p>
                    </div>

                    {authError && (
                      <div className="mb-4 rounded-2xl border border-red-400/30 bg-red-500/12 px-4 py-3 text-sm text-red-100">
                        {authError}
                      </div>
                    )}

                    {authNotice && (
                      <div className="mb-4 rounded-2xl border border-emerald-400/30 bg-emerald-500/12 px-4 py-3 text-sm text-emerald-100">
                        {authNotice}
                      </div>
                    )}

                    {isSignup ? (
                      <form className="space-y-4" onSubmit={handleCreateAccount}>
                        <label className="block">
                          <span className="mb-2 block text-sm text-white">Full name</span>
                          <input
                            type="text"
                            value={signUpForm.fullName}
                            onChange={(e) => setSignUpForm(prev => ({ ...prev, fullName: e.target.value }))}
                            className="h-12 w-full rounded-xl border border-white/12 bg-white/8 px-4 text-white placeholder:text-slate-400"
                            placeholder="Alex Morgan"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-2 block text-sm text-white">Username</span>
                          <input
                            type="text"
                            value={signUpForm.username}
                            onChange={(e) => setSignUpForm(prev => ({ ...prev, username: e.target.value }))}
                            className="h-12 w-full rounded-xl border border-white/12 bg-white/8 px-4 text-white placeholder:text-slate-400"
                            placeholder="alexm"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-2 block text-white text-sm">Password</span>
                          <input
                            type="password"
                            value={signUpForm.password}
                            onChange={(e) => setSignUpForm(prev => ({ ...prev, password: e.target.value }))}
                            className="h-12 w-full rounded-xl border border-white/12 bg-white/8 px-4 text-white placeholder:text-slate-400"
                            placeholder="Minimum 6 characters"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-2 block text-sm text-white">Confirm password</span>
                          <input
                            type="password"
                            value={signUpForm.confirmPassword}
                            onChange={(e) => setSignUpForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                            className="h-12 w-full rounded-xl border border-white/12 bg-white/8 px-4 text-white placeholder:text-slate-400"
                            placeholder="Retype password"
                          />
                        </label>
                        <button
                          type="submit"
                          disabled={authLoading}
                          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-4 text-slate-950 transition hover:bg-slate-100"
                        >
                          <UserPlus className="h-4 w-4" />
                          {authLoading ? 'Creating Account...' : 'Create Account'}
                        </button>
                      </form>
                    ) : (
                      <form className="space-y-4" onSubmit={handleAuthenticate}>
                        <label className="block">
                          <span className="mb-2 block text-sm text-white">Username</span>
                          <input
                            type="text"
                            value={signInForm.username}
                            onChange={(e) => setSignInForm(prev => ({ ...prev, username: e.target.value }))}
                            className="h-12 w-full rounded-xl border border-white/12 bg-white/8 px-4 text-white placeholder:text-slate-400"
                            placeholder="Enter username"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-2 block text-sm text-white">Password</span>
                          <input
                            type="password"
                            value={signInForm.password}
                            onChange={(e) => setSignInForm(prev => ({ ...prev, password: e.target.value }))}
                            className="h-12 w-full rounded-xl border border-white/12 bg-white/8 px-4 text-white placeholder:text-slate-400"
                            placeholder="Enter password"
                          />
                        </label>
                        <button
                          type="submit"
                          disabled={authLoading}
                          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-4 text-slate-950 transition hover:bg-slate-100"
                        >
                          <LogIn className="h-4 w-4" />
                          {authLoading ? 'Signing In...' : 'Sign In'}
                        </button>
                      </form>
                    )}

                    <div className="mt-6 flex items-center justify-between text-sm">
                      <button
                        onClick={() => {
                          setAuthError('');
                          setAuthNotice('');
                          setAuthScreen(isSignup ? 'welcome' : 'signup');
                        }}
                        className="text-slate-300 transition hover:text-white"
                      >
                        {isSignup ? 'Back' : 'Need an account?'}
                      </button>

                      {!isSignup && (
                        <button
                          onClick={() => { setAuthError(''); setAuthNotice(''); setAuthScreen('welcome'); }}
                          className="text-slate-300 transition hover:text-white"
                        >
                          Return home
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className={`size-full flex bg-background ${settings.darkMode ? 'dark' : ''}`}>
      <Sidebar
        activeView={activeView}
        onViewChange={setActiveView}
        photoCount={photos.length}
      />

      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-8">
          <div className="mb-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-sm text-secondary-foreground">
                  <LockKeyhole className="h-4 w-4" />
                  Signed in as {currentUsername ?? account?.username ?? 'user'}
                </div>
                <h2 className="text-foreground mb-2">
                  {{
                    upload: 'Upload / Protect',
                    vault: 'My Files / Vault',
                    settings: 'Settings',
                  }[activeView] ?? 'Upload / Protect'}
                </h2>
                <p className="text-muted-foreground">
                  {{
                    upload: 'Upload a file — it gets an invisible ownership watermark and a SHA-256 fingerprint before it reaches the server.',
                    vault: 'Review every protected file with share, download, and revoke actions.',
                    settings: 'Set the workspace theme for your demo.',
                  }[activeView] ?? ''}
                </p>
              </div>

              <div className="flex items-center gap-3">
                {vaultLoading && (
                  <span className="text-sm text-muted-foreground animate-pulse">Loading vault…</span>
                )}
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 rounded bg-primary text-primary-foreground transition hover:opacity-90"
                >
                  Log Out
                </button>
              </div>
            </div>
          </div>

          {activeView === 'upload' && (
            <div className="space-y-6">
              <FileUploader onFilesAdded={handleFilesAdded} />

              <div className="rounded-lg border border-border bg-card p-6">
                <h3 className="text-foreground mb-4">Protected Files</h3>
                {photos.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {photos.map((photo) => (
                      <SecurityStatusCard
                        key={`upload-${photo.id}`}
                        photo={photo}
                        onWatermark={handleWatermark}
                        onDownload={handleDownload}
                        onDelete={handleDelete}
                        onPreview={handlePreview}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Protected photos will appear here once you upload them.
                  </p>
                )}
              </div>

              <div className="rounded-lg border border-border bg-card p-6">
                <h3 className="text-foreground mb-4">Audit Events</h3>
                <div className="space-y-3">
                  {activityLog.length > 0 ? activityLog.map(item => (
                    <div key={item.id} className="rounded-lg border border-border px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm text-foreground">{item.time} — {item.action}</p>
                        <span className={`text-xs ${
                          item.severity === 'critical' ? 'text-red-500' :
                          item.severity === 'warning' ? 'text-yellow-500' :
                          'text-muted-foreground'
                        }`}>{item.severity}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 break-all">{item.details}</p>
                    </div>
                  )) : (
                    <p className="text-sm text-muted-foreground">
                      Audit events will appear here after files are uploaded, protected, shared, or downloaded.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeView === 'vault' && (
            <div className="space-y-6">
              {photos.length > 0 ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {photos.map((photo) => (
                      <SecurityStatusCard
                        key={photo.id}
                        photo={photo}
                        onWatermark={handleWatermark}
                        onDownload={handleDownload}
                        onDelete={handleDelete}
                        onPreview={handlePreview}
                      />
                    ))}
                  </div>

                  <div className="rounded-lg border border-border bg-card overflow-hidden">
                    <div className="grid grid-cols-[1.4fr_repeat(5,minmax(0,1fr))] gap-4 px-5 py-3 border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                      <span>File</span>
                      <span>Upload Date</span>
                      <span>Protection</span>
                      <span>Watermark</span>
                      <span>Owner</span>
                      <span>Actions</span>
                    </div>
                    {photos.map(photo => (
                      <div key={`${photo.id}-row`} className="border-b border-border last:border-b-0 px-5 py-4">
                        <div className="grid grid-cols-[1.4fr_repeat(5,minmax(0,1fr))] gap-4 items-start">
                          <div className="flex items-center gap-3 min-w-0">
                            <img src={photo.url} alt={photo.name} className="w-12 h-12 rounded object-cover bg-muted" />
                            <div className="min-w-0">
                              <p className="text-sm text-foreground truncate">{photo.name}</p>
                              <p className="text-xs text-muted-foreground">{photo.size}</p>
                              {photo.hashFingerprint && (
                                <p className="text-xs text-muted-foreground font-mono" title={photo.hashFingerprint}>
                                  SHA: {photo.hashFingerprint.slice(0, 10)}…
                                </p>
                              )}
                            </div>
                          </div>
                          <span className="text-sm text-muted-foreground">{photo.uploadedAt.toLocaleDateString()}</span>
                          <span className="text-sm text-foreground">{photo.protectionStatus?.slice(-1)[0] ?? 'Draft'}</span>
                          <span className="text-sm text-muted-foreground">
                            {photo.visibleWatermarkEnabled && photo.invisibleWatermarkEnabled ? 'Visible + Invisible' :
                              photo.visibleWatermarkEnabled ? 'Visible' :
                              photo.invisibleWatermarkEnabled ? 'Invisible' : 'None'}
                          </span>
                          <span className="text-sm text-muted-foreground">{photo.owner}</span>
                          <div className="flex flex-wrap gap-2">
                            <button onClick={() => handleDownload(photo.id)} className="px-3 py-1 rounded bg-secondary text-secondary-foreground text-xs">Download</button>
                            {photo.shared ? (
                              <button onClick={() => handleRevokeAccess(photo.id)} className="px-3 py-1 rounded bg-destructive/15 text-destructive text-xs">Revoke</button>
                            ) : (
                              <button onClick={() => handleShare(photo.id)} className="px-3 py-1 rounded bg-secondary text-secondary-foreground text-xs">Share</button>
                            )}
                          </div>
                        </div>
                        {photo.shareUrl && (
                          <p className="mt-2 text-xs text-muted-foreground break-all">
                            Share link: <span className="font-mono">{photo.shareUrl}</span>
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="rounded-lg border border-border bg-card p-8 text-muted-foreground">
                  No files in the vault yet. Protect a file first.
                </div>
              )}
            </div>
          )}

          {activeView === 'settings' && (
            <div className="space-y-6">
              <div className="rounded-lg border border-border bg-card p-6">
                <h3 className="text-foreground mb-4">Workspace Settings</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="rounded-lg border border-border p-4 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-foreground">Dark / light mode</p>
                      <p className="text-xs text-muted-foreground">Switch the dashboard theme.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.darkMode}
                      onChange={(e) => setSettings(prev => ({ ...prev, darkMode: e.target.checked }))}
                    />
                  </label>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-6">
                <h3 className="text-foreground mb-2">Backend</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  All API calls proxy through Vite to <code className="font-mono text-xs">localhost:3000</code> in development.
                  Set <code className="font-mono text-xs">VITE_API_BASE_URL</code> to target a deployed backend.
                </p>
                <p className="text-sm text-muted-foreground">
                  Endpoints in use: <code className="font-mono text-xs">POST /auth/signup</code> · <code className="font-mono text-xs">POST /auth/login</code> · <code className="font-mono text-xs">GET /images</code> · <code className="font-mono text-xs">POST /upload</code> · <code className="font-mono text-xs">POST /watermark</code> · <code className="font-mono text-xs">GET /image/:id/download</code> · <code className="font-mono text-xs">DELETE /image/:id</code> · <code className="font-mono text-xs">POST /image/:id/share</code> · <code className="font-mono text-xs">POST /image/:id/revoke</code> · <code className="font-mono text-xs">GET /image/:id/proof</code>
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <UploadProgress uploads={uploadingFiles} onCancel={handleCancelUpload} />
      <PreviewModal
        photo={previewPhoto}
        onClose={() => setPreviewPhoto(null)}
        onWatermark={handleWatermark}
      />

      {showWatermarkCustomizer && (
        <WatermarkCustomizer
          photoUrl={photos.find(p => p.id === showWatermarkCustomizer)?.url}
          onApply={(wSettings) => applyWatermark(showWatermarkCustomizer, wSettings)}
          onClose={() => setShowWatermarkCustomizer(null)}
        />
      )}

      {riskAnalysis && (
        <SecurityRiskPreview
          analysis={riskAnalysis.analysis}
          fileName={riskAnalysis.fileName}
          onClose={() => setRiskAnalysis(null)}
        />
      )}
    </div>
  );
}
