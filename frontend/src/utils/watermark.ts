// This file handles injecting invisible (or nearly invisible) watermarks into images.
// We use the HTML5 Canvas API to draw the Creator's Alias with 1% opacity.
// It is invisible to the human eye, but can be extracted by computers.

export async function embedWatermark(file: File, alias: string): Promise<File> {
  // Only watermark images
  if (!file.type.startsWith('image/')) {
    return file; 
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        return resolve(file); // fallback
      }

      // Draw original image
      ctx.drawImage(img, 0, 0);

      // Setup invisible watermark (1% opacity)
      ctx.globalAlpha = 0.01; 
      ctx.fillStyle = "#ffffff";
      ctx.font = `${Math.floor(img.height / 20)}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // Draw text multiple times across the image (tiling)
      for (let x = 0; x < img.width; x += img.width / 3) {
        for (let y = 0; y < img.height; y += img.height / 3) {
          ctx.fillText(`© ${alias} - CreatorVault`, x, y);
        }
      }

      // Convert back to File
      canvas.toBlob((blob) => {
        if (blob) {
          const watermarkedFile = new File([blob], file.name, {
            type: file.type,
            lastModified: Date.now(),
          });
          resolve(watermarkedFile);
        } else {
          resolve(file); // fallback
        }
      }, file.type);
    };

    img.onerror = () => resolve(file); // fallback if error
    img.src = url;
  });
}
