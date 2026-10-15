import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

/**
 * File storage for Base64 document uploads.
 *  - Production: Supabase Storage (persistent; Render's disk is wiped on every deploy).
 *  - Development (no SUPABASE_* vars): local ./uploads folder, served by Express at /uploads.
 *
 * SUPABASE_KEY must be the *service_role* key and stays on the server only.
 * Never expose it to the frontend / VITE_* variables.
 */

const ALLOWED_EXTS = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp'
};

const getBucket = () => process.env.SUPABASE_BUCKET || 'uploads';

let supabaseClient = null;
const getSupabase = () => {
  if (supabaseClient) return supabaseClient;
  const { SUPABASE_URL, SUPABASE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  return supabaseClient;
};

/**
 * Persists a `data:<mime>;base64,...` string and returns its public URL.
 */
export const saveBase64File = async (dataUrl, docName = '', folder, prefix) => {
  const matches = typeof dataUrl === 'string'
    ? dataUrl.match(/^data:([A-Za-z0-9\-+\/]+);base64,(.+)$/)
    : null;
  if (!matches) return null;

  const mime = matches[1];
  const buffer = Buffer.from(matches[2], 'base64');

  // Whitelist safe extensions
  let ext = path.extname(docName || '').toLowerCase();
  if (!ALLOWED_EXTS[ext]) {
    ext = mime.includes('pdf') ? '.pdf' : mime.includes('png') ? '.png' : '.jpg';
  }

  const filename = `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}${ext}`;
  const supabase = getSupabase();

  if (supabase) {
    const objectPath = `${folder}/${filename}`;
    const { error } = await supabase.storage.from(getBucket()).upload(objectPath, buffer, {
      contentType: ALLOWED_EXTS[ext],
      upsert: false
    });
    if (error) {
      console.error('Supabase Storage upload failed:', error.message);
      throw new Error('File upload failed');
    }
    const { data } = supabase.storage.from(getBucket()).getPublicUrl(objectPath);
    return { url: data.publicUrl, filename, size: buffer.length };
  }

  // Local disk fallback
  try {
    const dir = path.resolve('uploads', folder);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, filename), buffer);
    return { url: `/uploads/${folder}/${filename}`, filename, size: buffer.length };
  } catch (fsErr) {
    console.warn('Local disk save fallback error, preserving dataUrl:', fsErr.message);
    return { url: dataUrl, filename, size: buffer.length };
  }
};

/**
 * Converts one attachment to a stored URL.
 */
export const persistDataUrlItem = async (item, folder, prefix) => {
  if (typeof item === 'string') {
    if (!item.startsWith('data:')) return item;
    const saved = await saveBase64File(item, '', folder, prefix);
    return saved ? saved.url : item;
  }
  if (item && typeof item.dataUrl === 'string' && item.dataUrl.startsWith('data:')) {
    const saved = await saveBase64File(item.dataUrl, item.name, folder, prefix);
    if (saved) return { ...item, dataUrl: saved.url, size: item.size || saved.size };
  }
  return item;
};

/** Same as persistDataUrlItem for an array of attachments */
export const persistDataUrlList = async (list, folder, prefix) => {
  if (!Array.isArray(list)) return list;
  return Promise.all(list.map((item, idx) => persistDataUrlItem(item, folder, `${prefix}_${idx}`)));
};

/** Uploads the `photos` array of every requisition line item. */
export const persistItemPhotos = async (items, folder = 'requisition_photos', prefix = 'req') => {
  if (!Array.isArray(items)) return items;
  return Promise.all(items.map(async (item, idx) => {
    if (!item || !Array.isArray(item.photos) || item.photos.length === 0) return item;
    return { ...item, photos: await persistDataUrlList(item.photos, folder, `${prefix}_${idx}`) };
  }));
};

export default {
  saveBase64File,
  persistDataUrlItem,
  persistDataUrlList,
  persistItemPhotos
};
