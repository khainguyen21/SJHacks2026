import { useState, useCallback, FormEvent } from 'react';
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
import { ApiError, downloadImage, loginUser, signUpUser, uploadImage, watermarkImage } from '../services/api';

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
  viewCount?: number;
  visibleWatermarkEnabled?: boolean;
  invisibleWatermarkEnabled?: boolean;
  watermarkText?: string;
  watermarkPosition?: 'corner' | 'center' | 'tiled' | 'custom';
  watermarkOpacity?: number;
  watermarkSize?: number;
  protectionStatus?: string[];
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
  const [settings, setSettings] = useState<AppSettings>({
    darkMode: false,
  });
  const [authScreen, setAuthScreen] = useState<AuthScreen>(getInitialScreen);
  const [account, setAccount] = useState<StoredAccount | null>(readStoredAccount);
  const [currentUsername, setCurrentUsername] = useState<string | null>(readStoredSession);
  const [authError, setAuthError] = useState('');
  const [authNotice, setAuthNotice] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
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

  // BACKEND INTEGRATION: Upload starts here.
  // FileUploader sends files into this callback, then this function calls POST /upload.
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
          prev.map(u =>
            u.id === upload.id
              ? { ...u, progress: Math.min(100, u.progress + Math.random() * 30) }
              : u
          )
        );
      }, 200);

      try {
        const ownerName = currentUsername ?? account?.fullName ?? account?.username ?? 'Gavin';

        // BACKEND: POST /upload happens in uploadImage().
        const uploadedImage = await uploadImage(file, ownerName);

        clearInterval(interval);
        setUploadingFiles(prev =>
          prev.map(u =>
            u.id === upload.id ? { ...u, progress: 100 } : u
          )
        );
        setUploadingFiles(prev => prev.filter(u => u.id !== upload.id));

        const newPhoto: EnhancedPhoto = {
          id: uploadedImage.id ?? uploadedImage.imageId ?? upload.id,
          name: uploadedImage.name ?? uploadedImage.filename ?? file.name,
          url: uploadedImage.url ?? uploadedImage.imageUrl ?? uploadedImage.fileUrl ?? URL.createObjectURL(file),
          watermarked: false,
          size: uploadedImage.size ?? upload.size,
          uploadedAt: uploadedImage.uploadedAt ? new Date(uploadedImage.uploadedAt) : new Date(),
          owner: uploadedImage.owner ?? ownerName,
          shared: false,
          viewCount: 0,
          visibleWatermarkEnabled: false,
          invisibleWatermarkEnabled: false,
          watermarkText: `© ${ownerName}`,
          watermarkPosition: 'center',
          watermarkOpacity: 50,
          watermarkSize: 40,
          protectionStatus: ['Preview Ready'],
        };

        setPhotos(prev => [...prev, newPhoto]);
        setActiveView('upload');
        addActivity('File uploaded', `${file.name} added to the protection queue.`);

        const analysis = analyzeRisk(newPhoto);
        if (analysis.level !== 'low') {
          setRiskAnalysis({ analysis, fileName: newPhoto.name });
        }
      } catch (error) {
        // Demo fallback: if no backend is running yet, keep the image in browser memory.
        clearInterval(interval);
        setUploadingFiles(prev => prev.filter(u => u.id !== upload.id));

        const ownerName = currentUsername ?? account?.fullName ?? account?.username ?? 'Gavin';
        const newPhoto: EnhancedPhoto = {
          id: upload.id,
          name: file.name,
          url: URL.createObjectURL(file),
          watermarked: false,
          size: upload.size,
          uploadedAt: new Date(),
          owner: ownerName,
          shared: false,
          viewCount: 0,
          visibleWatermarkEnabled: false,
          invisibleWatermarkEnabled: false,
          watermarkText: `© ${ownerName}`,
          watermarkPosition: 'center',
          watermarkOpacity: 50,
          watermarkSize: 40,
          protectionStatus: ['Preview Ready'],
        };

        setPhotos(prev => [...prev, newPhoto]);
        setActiveView('upload');
        addActivity('Local upload fallback', `${file.name} stayed in the browser because the upload API was unavailable.`, 'warning');

        const analysis = analyzeRisk(newPhoto);
        if (analysis.level !== 'low') {
          setRiskAnalysis({ analysis, fileName: newPhoto.name });
        }
      }
    });
  }, [account, addActivity, currentUsername]);

  const analyzeRisk = (photo: EnhancedPhoto): RiskAnalysis => {
    const issues: string[] = [];
    let score = 100;

    if (!photo.watermarked) {
      issues.push('No watermark protection applied');
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
        title: 'Add Invisible Watermark',
        description: 'Protect your image with a visible or invisible watermark that survives cropping and editing.',
        action: () => {
          setRiskAnalysis(null);
          setShowWatermarkCustomizer(photo.id);
        },
        actionLabel: 'Add Watermark',
      });
    }

    return { level, score, issues, recommendations };
  };

  // BACKEND INTEGRATION: Watermarking starts here.
  // The Apply Watermark button sends settings into this callback, then this function calls POST /watermark.
  const applyWatermark = useCallback(async (id: string, settings: WatermarkSettings) => {
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
              visibleWatermarkEnabled: settings.type === 'visible',
              invisibleWatermarkEnabled: settings.type === 'invisible',
              watermarkText: settings.text,
              watermarkPosition: settings.position,
              watermarkOpacity: settings.opacity,
              watermarkSize: settings.size,
            }
          : p
      ));

      setActiveView('vault');
      addActivity('Watermark applied', activityMessage, severity);
    };

    try {
      // BACKEND: POST /watermark happens in watermarkImage().
      const watermarkedImage = await watermarkImage(id, settings);
      const watermarkedUrl =
        watermarkedImage.watermarkedUrl ??
        watermarkedImage.url ??
        watermarkedImage.imageUrl ??
        photo.url;

      updateProtectedPhoto(watermarkedUrl, `${photo.name} was protected by the backend and sent to Protected Files.`);
    } catch (error) {
      // Demo fallback: if no backend is running yet, create a visible watermark in the browser.
      const watermarkedUrl = await createLocalWatermarkedUrl(photo.url, settings);
      updateProtectedPhoto(
        watermarkedUrl,
        `${photo.name} was protected in the browser because the watermark API was unavailable.`,
        'warning'
      );
    }
  }, [addActivity, photos]);

  const handleWatermark = useCallback((id: string) => {
    setShowWatermarkCustomizer(id);
  }, []);

  const updatePhoto = useCallback((id: string, updates: Partial<EnhancedPhoto>) => {
    setPhotos(prev => prev.map(photo =>
      photo.id === id ? { ...photo, ...updates } : photo
    ));
  }, []);

  // BACKEND INTEGRATION: Download starts here.
  // Download buttons call this callback, then this function calls GET /image/:id/download.
  const handleDownload = useCallback(async (id: string) => {
    const photo = photos.find(p => p.id === id);
    if (photo) {
      let downloadUrl = photo.url;

      try {
        // BACKEND: GET /image/:id/download happens in downloadImage().
        const blob = await downloadImage(id);
        downloadUrl = URL.createObjectURL(blob);
      } catch (error) {
        // Demo fallback: if no backend is running yet, download the browser's local image URL.
        addActivity('Local download fallback', `${photo.name} downloaded from the browser because the download API was unavailable.`, 'warning');
      }

      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = photo.watermarked ? `watermarked-${photo.name}` : photo.name;
      link.click();

      if (downloadUrl !== photo.url) {
        URL.revokeObjectURL(downloadUrl);
      }

      setPhotos(prev => prev.map(p =>
        p.id === id ? { ...p, viewCount: (p.viewCount || 0) + 1 } : p
      ));
      addActivity('File downloaded', `${photo.name} was downloaded from the vault.`);
    }
  }, [addActivity, photos]);

  const handleDelete = useCallback((id: string) => {
    setPhotos(prev => prev.filter(p => p.id !== id));
    addActivity('File removed', `File ${id} was deleted from the vault.`, 'warning');
  }, [addActivity]);

  const handlePreview = useCallback((id: string) => {
    const photo = photos.find(p => p.id === id);
    if (photo) {
      setPreviewPhoto(photo);
    }
  }, [photos]);

  const handleCancelUpload = useCallback((id: string) => {
    setUploadingFiles(prev => prev.filter(u => u.id !== id));
  }, []);

  const handleShare = useCallback((id: string) => {
    const photo = photos.find(p => p.id === id);
    if (!photo) return;

    updatePhoto(id, { shared: true });
    addActivity('File shared', `${photo.name} was shared from the vault.`);
  }, [addActivity, photos, updatePhoto]);

  const handleRevokeAccess = useCallback((id: string) => {
    const photo = photos.find(p => p.id === id);
    if (!photo) return;

    updatePhoto(id, { shared: false });
    addActivity('Access revoked', `${photo.name} links were revoked.`, 'warning');
  }, [addActivity, photos, updatePhoto]);

  const persistAccount = useCallback((nextAccount: StoredAccount) => {
    window.localStorage.setItem(ACCOUNT_STORAGE_KEY, JSON.stringify(nextAccount));
    setAccount(nextAccount);
  }, []);

  const persistSession = useCallback((username: string, token?: string) => {
    window.localStorage.setItem(SESSION_STORAGE_KEY, username);
    if (token) {
      window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
    }
    setCurrentUsername(username);
  }, []);

  const clearSession = useCallback(() => {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    setCurrentUsername(null);
  }, []);

  // BACKEND INTEGRATION: Sign-up starts here.
  // The Create Account form calls this, then this function calls POST /auth/signup.
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
      // BACKEND: POST /auth/signup happens in signUpUser().
      const signedUpUser = await signUpUser({ fullName, username, password });
      const backendUsername = signedUpUser.user?.username ?? signedUpUser.username ?? username;
      const backendFullName = signedUpUser.user?.fullName ?? signedUpUser.fullName ?? fullName;

      persistAccount({ fullName: backendFullName, username: backendUsername, password: '' });
      clearSession();
      setSignInForm({ username: backendUsername, password: '' });
      setAuthNotice('Account created in the backend. Please sign in with your username and password.');
      setAuthScreen('signin');
    } catch (error) {
      if (error instanceof ApiError && error.status) {
        setAuthError(error.message);
        return;
      }

      // Demo fallback: if no backend is running yet, store one local browser account.
      const nextAccount = { fullName, username, password };
      persistAccount(nextAccount);
      clearSession();
      setSignInForm({ username, password: '' });
      setAuthNotice('Local demo account created. Connect your AWS backend later to store this in the database.');
      setAuthScreen('signin');
    } finally {
      setAuthLoading(false);
      setSignUpForm({
        fullName: '',
        username: '',
        password: '',
        confirmPassword: '',
      });
    }
  }, [clearSession, persistAccount, signUpForm]);

  // BACKEND INTEGRATION: Login starts here.
  // The Sign In form calls this, then this function calls POST /auth/login.
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
      // BACKEND: POST /auth/login happens in loginUser().
      const loggedInUser = await loginUser({ username, password });
      const backendUsername = loggedInUser.user?.username ?? loggedInUser.username ?? username;
      const backendFullName = loggedInUser.user?.fullName ?? loggedInUser.fullName ?? account?.fullName ?? backendUsername;
      const token = loggedInUser.token ?? loggedInUser.accessToken;

      persistAccount({ fullName: backendFullName, username: backendUsername, password: '' });
      persistSession(backendUsername, token);
      setSignInForm({ username: backendUsername, password: '' });
      setAuthScreen('dashboard');
    } catch (error) {
      if (error instanceof ApiError && error.status) {
        setAuthError(error.message);
        return;
      }

      // Demo fallback: if no backend is running yet, authenticate against the local browser account.
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
    } finally {
      setAuthLoading(false);
    }
  }, [account, persistAccount, persistSession, signInForm]);

  const handleLogout = useCallback(() => {
    clearSession();
    setAuthNotice('You have been signed out.');
    setAuthError('');
    setSignInForm({
      username: account?.username ?? '',
      password: '',
    });
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
                  Start with a simple onboarding step before entering the dashboard.
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
                      onClick={() => {
                        setAuthError('');
                        setAuthNotice('');
                        setAuthScreen('signup');
                      }}
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
                          ? 'When your AWS backend is connected, this will create a database user.'
                          : 'When your AWS backend is connected, this will authenticate against your database.'}
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
                            onChange={(event) => setSignUpForm(prev => ({ ...prev, fullName: event.target.value }))}
                            className="h-12 w-full rounded-xl border border-white/12 bg-white/8 px-4 text-white placeholder:text-slate-400"
                            placeholder="Alex Morgan"
                          />
                        </label>

                        <label className="block">
                          <span className="mb-2 block text-sm text-white">Username</span>
                          <input
                            type="text"
                            value={signUpForm.username}
                            onChange={(event) => setSignUpForm(prev => ({ ...prev, username: event.target.value }))}
                            className="h-12 w-full rounded-xl border border-white/12 bg-white/8 px-4 text-white placeholder:text-slate-400"
                            placeholder="alexm"
                          />
                        </label>

                        <label className="block">
                          <span className="mb-2 block text-sm text-white">Password</span>
                          <input
                            type="password"
                            value={signUpForm.password}
                            onChange={(event) => setSignUpForm(prev => ({ ...prev, password: event.target.value }))}
                            className="h-12 w-full rounded-xl border border-white/12 bg-white/8 px-4 text-white placeholder:text-slate-400"
                            placeholder="Minimum 6 characters"
                          />
                        </label>

                        <label className="block">
                          <span className="mb-2 block text-sm text-white">Confirm password</span>
                          <input
                            type="password"
                            value={signUpForm.confirmPassword}
                            onChange={(event) => setSignUpForm(prev => ({ ...prev, confirmPassword: event.target.value }))}
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
                            onChange={(event) => setSignInForm(prev => ({ ...prev, username: event.target.value }))}
                            className="h-12 w-full rounded-xl border border-white/12 bg-white/8 px-4 text-white placeholder:text-slate-400"
                            placeholder="Enter username"
                          />
                        </label>

                        <label className="block">
                          <span className="mb-2 block text-sm text-white">Password</span>
                          <input
                            type="password"
                            value={signInForm.password}
                            onChange={(event) => setSignInForm(prev => ({ ...prev, password: event.target.value }))}
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
                          onClick={() => {
                            setAuthError('');
                            setAuthNotice('');
                            setAuthScreen('welcome');
                          }}
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
                    upload: 'Upload a file, choose visible or invisible watermark protection, then review protected files and audit events below.',
                    vault: 'Review every protected file with share, download, and revoke actions.',
                    settings: 'Set the workspace theme for your demo.',
                  }[activeView] ?? 'Upload a file, choose visible or invisible watermark protection, then review protected files and audit events below.'}
                </p>
              </div>

              <div className="flex items-center gap-3">
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
                    Protected photos and videos will appear here once you upload and protect them.
                  </p>
                )}
              </div>

              <div className="rounded-lg border border-border bg-card p-6">
                <h3 className="text-foreground mb-4">Audit Events</h3>
                <div className="space-y-3">
                  {activityLog.length > 0 ? activityLog.map(item => (
                    <div key={item.id} className="rounded-lg border border-border px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm text-foreground">{item.time} - {item.action}</p>
                        <span className="text-xs text-muted-foreground">{item.severity}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{item.details}</p>
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
                    <div className="grid grid-cols-[1.4fr_repeat(4,minmax(0,1fr))] gap-4 px-5 py-3 border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                      <span>File</span>
                      <span>Upload Date</span>
                      <span>Protection Status</span>
                      <span>Watermark Type</span>
                      <span>Owner</span>
                    </div>
                    {photos.map(photo => (
                      <div key={`${photo.id}-row`} className="border-b border-border last:border-b-0 px-5 py-4">
                        <div className="grid grid-cols-[1.4fr_repeat(4,minmax(0,1fr))] gap-4 items-start mb-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <img src={photo.url} alt={photo.name} className="w-12 h-12 rounded object-cover bg-muted" />
                            <div className="min-w-0">
                              <p className="text-sm text-foreground truncate">{photo.name}</p>
                              <p className="text-xs text-muted-foreground">{photo.size}</p>
                            </div>
                          </div>
                          <span className="text-sm text-muted-foreground">{photo.uploadedAt.toLocaleDateString()}</span>
                          <span className="text-sm text-foreground">{photo.protectionStatus?.slice(-1)[0] ?? 'Draft'}</span>
                          <span className="text-sm text-muted-foreground">
                            {photo.visibleWatermarkEnabled && photo.invisibleWatermarkEnabled
                              ? 'Visible + Invisible'
                              : photo.visibleWatermarkEnabled
                                ? 'Visible'
                                : photo.invisibleWatermarkEnabled
                                  ? 'Invisible'
                                  : 'None'}
                          </span>
                          <span className="text-sm text-muted-foreground">{photo.owner}</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button onClick={() => handleDownload(photo.id)} className="px-3 py-2 rounded bg-secondary text-secondary-foreground text-sm">Download</button>
                          <button onClick={() => handleShare(photo.id)} className="px-3 py-2 rounded bg-secondary text-secondary-foreground text-sm">Share</button>
                          <button onClick={() => handleRevokeAccess(photo.id)} className="px-3 py-2 rounded bg-secondary text-secondary-foreground text-sm">Revoke Access</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="rounded-lg border border-border bg-card p-8 text-muted-foreground">
                  No files in the vault yet. Protect a file first to populate this view.
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
                    <div><p className="text-sm text-foreground">Dark / light mode</p><p className="text-xs text-muted-foreground">Switch the dashboard theme for demos.</p></div>
                    <input type="checkbox" checked={settings.darkMode} onChange={(e) => setSettings(prev => ({ ...prev, darkMode: e.target.checked }))} />
                  </label>
                </div>
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
          onApply={(settings) => applyWatermark(showWatermarkCustomizer, settings)}
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
