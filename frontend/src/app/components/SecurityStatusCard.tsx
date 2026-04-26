import { AlertTriangle, Eye, Download, MoreVertical, Droplet, Pencil } from 'lucide-react';
import { useState } from 'react';

interface Photo {
  id: string;
  name: string;
  url: string;
  watermarked: boolean;
  size: string;
  uploadedAt: Date;
}

interface SecurityStatusCardProps {
  photo: Photo & {
    shared?: boolean;
    viewCount?: number;
  };
  onWatermark: (id: string) => void;
  onDownload: (id: string) => void;
  onDelete: (id: string) => void;
  onPreview: (id: string) => void;
}

export function SecurityStatusCard({
  photo,
  onWatermark,
  onDownload,
  onDelete,
  onPreview,
}: SecurityStatusCardProps) {
  const [showMenu, setShowMenu] = useState(false);

  const getSecurityLevel = () => {
    if (photo.watermarked && !photo.shared) {
      return { label: 'High Security', color: 'text-green-600', bg: 'bg-green-100' };
    }
    if (photo.watermarked) return { label: 'Medium Security', color: 'text-yellow-600', bg: 'bg-yellow-100' };
    return { label: 'Low Security', color: 'text-red-600', bg: 'bg-red-100' };
  };

  const security = getSecurityLevel();

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden hover:shadow-lg transition-all group">
      <div className="aspect-video relative overflow-hidden bg-muted cursor-pointer" onClick={() => onPreview(photo.id)}>
        <img
          src={photo.url}
          alt={photo.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-3">
          <button
            onClick={(event) => {
              event.stopPropagation();
              onPreview(photo.id);
            }}
            className="px-3 py-2 rounded bg-white text-foreground text-sm inline-flex items-center gap-2"
          >
            <Pencil className="w-4 h-4" />
            Edit
          </button>
          <button
            onClick={(event) => {
              event.stopPropagation();
              onDownload(photo.id);
            }}
            className="px-3 py-2 rounded bg-white text-foreground text-sm inline-flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Download
          </button>
        </div>
        <div className={`absolute top-2 right-2 ${security.bg} ${security.color} rounded-full px-2 py-1 text-xs`}>
          {security.label}
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-foreground truncate mb-1">{photo.name}</h3>
            <p className="text-xs text-muted-foreground">
              {photo.uploadedAt.toLocaleDateString()} • {photo.size}
            </p>
          </div>
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1 hover:bg-accent rounded"
              aria-label="More options"
            >
              <MoreVertical className="w-4 h-4 text-muted-foreground" />
            </button>
            {showMenu && (
              <div className="absolute right-0 mt-1 w-48 bg-popover border border-border rounded-lg shadow-lg z-10">
                <button
                  onClick={() => { onDownload(photo.id); setShowMenu(false); }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-accent flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
                <button
                  onClick={() => { onDelete(photo.id); setShowMenu(false); }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-accent flex items-center gap-2 text-destructive"
                >
                  <AlertTriangle className="w-4 h-4" />
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2 mb-3">
          <button
            onClick={() => onWatermark(photo.id)}
            className="w-full flex items-center justify-between rounded-lg border border-border px-3 py-2 hover:bg-accent transition text-left"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Droplet className={`w-4 h-4 ${photo.watermarked ? 'text-primary' : 'text-muted-foreground'}`} />
              <span className="text-xs text-foreground">{photo.watermarked ? 'Watermarked' : 'No Watermark'}</span>
            </div>
            <span className="inline-flex items-center gap-1 text-xs text-primary">
              <Pencil className="w-3 h-3" />
              Edit
            </span>
          </button>
        </div>

        {photo.viewCount !== undefined && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
            <Eye className="w-3 h-3" />
            <span>Viewed {photo.viewCount} times</span>
          </div>
        )}
      </div>
    </div>
  );
}
