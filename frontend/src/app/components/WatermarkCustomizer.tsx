import { Eye, Droplets, X, Move } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

export interface WatermarkSettings {
  type: 'visible' | 'invisible';
  text?: string;
  fontFamily: 'Arial' | 'Georgia' | 'Courier New' | 'Times New Roman' | 'Verdana';
  position: 'corner' | 'center' | 'tiled' | 'custom';
  opacity: number;
  size: number;
  customX?: number;
  customY?: number;
}

interface WatermarkCustomizerProps {
  photoUrl?: string;
  onApply: (settings: WatermarkSettings) => void;
  onClose: () => void;
}

export function WatermarkCustomizer({ photoUrl, onApply, onClose }: WatermarkCustomizerProps) {
  const [settings, setSettings] = useState<WatermarkSettings>({
    type: 'visible',
    text: '© PROTECTED',
    fontFamily: 'Arial',
    position: 'center',
    opacity: 50,
    size: 40,
    customX: 50,
    customY: 50,
  });

  const [isDragging, setIsDragging] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const watermarkTypes = [
    { id: 'visible', label: 'Visible', icon: Eye },
    { id: 'invisible', label: 'Invisible', icon: Droplets },
  ];

  const handleMouseDown = () => {
    if (settings.position !== 'custom' && settings.position !== 'tiled') {
      setSettings(prev => ({ ...prev, position: 'custom' }));
    }
    setIsDragging(true);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !previewRef.current) return;

    const rect = previewRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    setSettings(prev => ({
      ...prev,
      customX: Math.max(0, Math.min(100, x)),
      customY: Math.max(0, Math.min(100, y)),
    }));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging]);

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 overflow-auto" onClick={onClose}>
      <div className="relative max-w-2xl w-full bg-card rounded-lg overflow-hidden my-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-foreground mb-1">Customize Watermark</h2>
            <p className="text-sm text-muted-foreground">Choose visible or invisible protection for this file.</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-accent rounded"
            aria-label="Close customizer"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <label className="block text-foreground mb-3">Watermark Type</label>
            <div className="grid grid-cols-2 gap-3">
              {watermarkTypes.map(type => {
                const Icon = type.icon;
                const isSelected = settings.type === type.id;
                return (
                  <button
                    key={type.id}
                    onClick={() => setSettings(prev => ({ ...prev, type: type.id as WatermarkSettings['type'] }))}
                    className={`flex items-center justify-center gap-2 p-4 rounded-lg border-2 transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span className={`text-sm ${isSelected ? 'text-primary' : 'text-foreground'}`}>{type.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {settings.type === 'visible' ? (
            <>
              <div>
                <label className="block text-foreground mb-2">Watermark Text</label>
                <input
                  type="text"
                  value={settings.text}
                  onChange={(e) => setSettings(prev => ({ ...prev, text: e.target.value }))}
                  className="w-full px-4 py-2 bg-input-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Enter your watermark text"
                />
              </div>

              <div>
                <label className="block text-foreground mb-2">Font</label>
                <select
                  value={settings.fontFamily}
                  onChange={(e) => setSettings(prev => ({ ...prev, fontFamily: e.target.value as WatermarkSettings['fontFamily'] }))}
                  className="w-full px-4 py-3 bg-input-background border border-border rounded-lg"
                >
                  <option>Arial</option>
                  <option>Georgia</option>
                  <option>Courier New</option>
                  <option>Times New Roman</option>
                  <option>Verdana</option>
                </select>
              </div>

              <div>
                <label className="block text-foreground mb-3">Position</label>
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { id: 'corner', label: 'Corner' },
                    { id: 'center', label: 'Center' },
                    { id: 'tiled', label: 'Tiled' },
                    { id: 'custom', label: 'Custom', icon: Move },
                  ].map(pos => (
                    <button
                      key={pos.id}
                      onClick={() => setSettings(prev => ({ ...prev, position: pos.id as WatermarkSettings['position'] }))}
                      className={`px-4 py-3 rounded-lg border-2 transition-all text-sm flex items-center justify-center gap-1 ${
                        settings.position === pos.id
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-foreground hover:border-primary/50'
                      }`}
                    >
                      {pos.icon && <pos.icon className="w-4 h-4" />}
                      {pos.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-foreground">Opacity</label>
                  <span className="text-sm text-muted-foreground">{settings.opacity}%</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={settings.opacity}
                  onChange={(e) => setSettings(prev => ({ ...prev, opacity: parseInt(e.target.value, 10) }))}
                  className="w-full"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-foreground">Size</label>
                  <span className="text-sm text-muted-foreground">{settings.size}px</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="150"
                  value={settings.size}
                  onChange={(e) => setSettings(prev => ({ ...prev, size: parseInt(e.target.value, 10) }))}
                  className="w-full"
                />
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-border bg-accent p-4">
              <p className="text-sm text-accent-foreground">Invisible watermark mode</p>
              <p className="text-xs text-muted-foreground mt-1">
                This mode keeps the exported file visually clean while preserving hidden protection behavior for backend processing later.
              </p>
            </div>
          )}

          <div className="bg-accent rounded-lg p-4">
            <p className="text-sm text-accent-foreground mb-2">
              Preview {settings.type === 'invisible' ? '- invisible watermark downloads without a visible overlay' : settings.position === 'custom' ? '- Drag to position' : ''}
            </p>
            <div
              ref={previewRef}
              className="aspect-video bg-muted rounded border border-border flex items-center justify-center relative overflow-hidden"
              style={{
                backgroundImage: photoUrl ? `url(${photoUrl})` : undefined,
                backgroundSize: 'contain',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
              }}
            >
              {settings.type === 'visible' ? (
                settings.position === 'tiled' ? (
                  <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
                    {Array.from({ length: 9 }).map((_, i) => (
                      <div key={i} className="flex items-center justify-center">
                        <span
                          style={{
                            opacity: settings.opacity / 100,
                            fontSize: `${Math.max(8, settings.size / 2)}px`,
                            fontFamily: settings.fontFamily,
                            color: 'white',
                            textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
                          }}
                        >
                          {settings.text}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span
                    onMouseDown={handleMouseDown}
                    style={{
                      opacity: settings.opacity / 100,
                      fontSize: `${settings.size}px`,
                      fontFamily: settings.fontFamily,
                      color: 'white',
                      textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
                      left: settings.position === 'custom' ? `${settings.customX}%` : settings.position === 'corner' ? 'auto' : '50%',
                      top: settings.position === 'custom' ? `${settings.customY}%` : settings.position === 'corner' ? '1rem' : '50%',
                      right: settings.position === 'corner' ? '1rem' : 'auto',
                      transform: settings.position === 'custom' ? 'translate(-50%, -50%)' : settings.position === 'center' ? 'translate(-50%, -50%)' : 'none',
                      cursor: settings.position === 'custom' || settings.position === 'center' ? 'move' : 'default',
                    }}
                    className="absolute select-none"
                  >
                    {settings.text}
                  </span>
                )
              ) : (
                <div className="absolute inset-0 flex items-end justify-start p-3">
                  <span className="rounded-full bg-black/55 px-3 py-1 text-xs text-white">
                    Invisible watermark will stay hidden in the exported file.
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-3 justify-end p-6 border-t border-border">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-secondary text-secondary-foreground rounded hover:bg-secondary/80"
          >
            Cancel
          </button>
          <button
            onClick={() => onApply(settings)}
            className="px-6 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
          >
            Apply Watermark
          </button>
        </div>
      </div>
    </div>
  );
}
