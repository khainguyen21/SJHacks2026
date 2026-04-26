// Invisible canvas watermark (ported from Duc branch)
// Embeds the owner alias at 1% opacity so it survives screenshots but is invisible to the eye.
export async function embedInvisibleWatermark(file: File, alias: string): Promise<File> {
  if (!file.type.startsWith('image/')) return file;

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        resolve(file);
        return;
      }

      ctx.drawImage(img, 0, 0);

      ctx.globalAlpha = 0.01;
      ctx.fillStyle = '#ffffff';
      ctx.font = `${Math.floor(img.height / 20)}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const stepX = img.width / 3;
      const stepY = img.height / 3;
      for (let x = stepX / 2; x < img.width; x += stepX) {
        for (let y = stepY / 2; y < img.height; y += stepY) {
          ctx.fillText(`© ${alias} — PhotoGuard`, x, y);
        }
      }

      canvas.toBlob((blob) => {
        if (blob) {
          resolve(new File([blob], file.name, { type: file.type, lastModified: Date.now() }));
        } else {
          resolve(file);
        }
      }, file.type);
    };

    img.onerror = () => resolve(file);
    img.src = objectUrl;
  });
}
