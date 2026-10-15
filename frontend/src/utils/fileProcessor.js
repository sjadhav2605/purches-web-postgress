/**
 * File, image compression, and PDF processor utilities
 */

/**
 * Formats byte count into human-readable size (e.g. "1.2 MB", "450 KB")
 */
export const formatFileSize = (bytes) => {
  if (!bytes || isNaN(bytes)) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

/**
 * Client-side image & PDF processor for Vendor Billed Challans and delivery proofs
 */
export const processBillFile = (file) => {
  return new Promise((resolve, reject) => {
    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

    if (isPdf) {
      const reader = new FileReader();
      reader.onload = () => resolve({ name: file.name, dataUrl: reader.result, size: file.size, isPdf: true });
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }

    if (!isImage) {
      const reader = new FileReader();
      reader.onload = () => resolve({ name: file.name, dataUrl: reader.result, size: file.size, isPdf: false });
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX_DIM = 1600;
        let width = img.width;
        let height = img.height;
        if (width > height && width > MAX_DIM) {
          height = Math.round((height * MAX_DIM) / width);
          width = MAX_DIM;
        } else if (height > MAX_DIM) {
          width = Math.round((width * MAX_DIM) / height);
          height = MAX_DIM;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        resolve({
          name: file.name,
          dataUrl,
          size: Math.round((dataUrl.length * 3) / 4),
          isPdf: false
        });
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * Image compression helper for mobile camera snapshots and site receipts
 */
export const compressImage = (file) => {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => resolve({ name: file.name, dataUrl: reader.result, size: file.size });
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX_DIM = 1600;
        let width = img.width;
        let height = img.height;
        if (width > height && width > MAX_DIM) {
          height = Math.round((height * MAX_DIM) / width);
          width = MAX_DIM;
        } else if (height > MAX_DIM) {
          width = Math.round((width * MAX_DIM) / height);
          height = MAX_DIM;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        resolve({
          name: file.name,
          dataUrl,
          size: Math.round((dataUrl.length * 3) / 4)
        });
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * Triggers direct browser download for base64 documents, PDFs, or photos
 */
export const handleDownloadPhoto = (photoItem, fallbackBaseName = 'attachment') => {
  if (!photoItem) return;
  const src = photoItem.dataUrl || photoItem.url || photoItem;
  if (!src) return;

  const rawName = photoItem.name || '';
  let extension = '.jpg';
  if (typeof src === 'string') {
    if (src.startsWith('data:application/pdf') || rawName.toLowerCase().endsWith('.pdf')) {
      extension = '.pdf';
    } else if (src.startsWith('data:image/png') || rawName.toLowerCase().endsWith('.png')) {
      extension = '.png';
    } else if (src.startsWith('data:image/webp') || rawName.toLowerCase().endsWith('.webp')) {
      extension = '.webp';
    }
  }

  const finalName = rawName || `${fallbackBaseName}_${Date.now()}${extension}`;

  const link = document.createElement('a');
  link.href = src;
  link.download = finalName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Downloads multiple attachments sequentially with pacing to avoid popup blocking
 */
export const handleDownloadAllPhotos = (photos, baseTitle = 'Challan_Docs') => {
  if (!Array.isArray(photos) || photos.length === 0) return;
  photos.forEach((p, idx) => {
    setTimeout(() => {
      handleDownloadPhoto(p, `${baseTitle}_${idx + 1}`);
    }, idx * 250);
  });
};
