import { X, Pencil, Droplet } from 'lucide-react';

interface Photo {
  id: string;
  name: string;
  url: string;
  watermarked: boolean;
  size: string;
  uploadedAt: Date;
}

interface PreviewModalProps {
  photo: Photo | null;
  onClose: () => void;
  onWatermark: (id: string) => void;
}

export function PreviewModal({
  photo,
  onClose,
  onWatermark,
}: PreviewModalProps) {
  if (!photo) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="relative max-w-6xl max-h-[90vh] w-full" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute -top-12 right-0 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
        >
          <X className="w-6 h-6 text-white" />
        </button>
        <div className="bg-card rounded-lg overflow-hidden grid lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="bg-muted flex items-center justify-center">
            <img
              src={photo.url}
              alt={photo.name}
              className="w-full h-auto max-h-[80vh] object-contain"
            />
          </div>

          <div className="border-t lg:border-t-0 lg:border-l border-border p-5 flex flex-col">
            <div className="mb-5">
              <h3 className="text-foreground mb-2">{photo.name}</h3>
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span>{photo.size}</span>
                <span>{photo.uploadedAt.toLocaleDateString()}</span>
                <span className={photo.watermarked ? 'text-primary' : ''}>
                  {photo.watermarked ? 'Protected' : 'Unprotected'}
                </span>
              </div>
            </div>

            <div className="mb-4 flex items-center gap-2 text-sm text-foreground">
              <Pencil className="w-4 h-4" />
              <span>Edit this image</span>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => onWatermark(photo.id)}
                className="w-full rounded-lg border border-border bg-background px-4 py-3 text-left hover:bg-accent transition"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Droplet className="w-4 h-4 text-primary" />
                    <div>
                      <p className="text-sm text-foreground">{photo.watermarked ? 'Edit watermark' : 'Add watermark'}</p>
                      <p className="text-xs text-muted-foreground">
                        {photo.watermarked ? 'Update the current protection mark.' : 'Apply watermark protection to this image.'}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-primary">Edit</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
