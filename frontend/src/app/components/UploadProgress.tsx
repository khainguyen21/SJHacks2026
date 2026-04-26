import { X } from 'lucide-react';

export interface UploadingFile {
  id: string;
  name: string;
  progress: number;
  size: string;
}

interface UploadProgressProps {
  uploads: UploadingFile[];
  onCancel: (id: string) => void;
}

export function UploadProgress({ uploads, onCancel }: UploadProgressProps) {
  if (uploads.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 w-96 max-w-[calc(100vw-2rem)] bg-card border border-border rounded-lg shadow-lg overflow-hidden z-40">
      <div className="bg-primary/10 px-4 py-2 border-b border-border">
        <p className="text-sm text-foreground">Uploading {uploads.length} file{uploads.length > 1 ? 's' : ''}</p>
      </div>
      <div className="max-h-48 overflow-auto p-4 space-y-3">
        {uploads.map(upload => (
          <div key={upload.id} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0 mr-2">
                <p className="text-sm text-foreground truncate">{upload.name}</p>
                <p className="text-xs text-muted-foreground">{upload.size}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-primary">{upload.progress}%</span>
                <button
                  onClick={() => onCancel(upload.id)}
                  className="p-1 hover:bg-accent rounded"
                  aria-label="Cancel upload"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            </div>
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div
                className="bg-primary h-full transition-all duration-300 ease-out"
                style={{ width: `${upload.progress}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
