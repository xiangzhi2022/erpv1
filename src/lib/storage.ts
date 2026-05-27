import type { SupabaseClient } from '@supabase/supabase-js';

export const UPLOADS_BUCKET = 'uploads';

export const UPLOADS_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;

export const UPLOADS_MAX_FILE_SIZE = 8 * 1024 * 1024;

export async function ensureUploadsBucket(supabase: SupabaseClient): Promise<string | null> {
  const { data, error } = await supabase.storage.getBucket(UPLOADS_BUCKET);
  if (!error && data) {
    if (data.public !== true) {
      const { error: updateError } = await supabase.storage.updateBucket(UPLOADS_BUCKET, {
        public: true,
        allowedMimeTypes: [...UPLOADS_ALLOWED_MIME_TYPES],
        fileSizeLimit: UPLOADS_MAX_FILE_SIZE,
      });
      return updateError?.message || null;
    }
    return null;
  }

  const { error: createError } = await supabase.storage.createBucket(UPLOADS_BUCKET, {
    public: true,
    allowedMimeTypes: [...UPLOADS_ALLOWED_MIME_TYPES],
    fileSizeLimit: UPLOADS_MAX_FILE_SIZE,
  });
  return createError?.message || null;
}
