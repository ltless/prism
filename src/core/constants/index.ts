/**
 * Global application constants
 */

// Default storage quota for non-admin users when no explicit per-user or
// admin-configured global default is set. 10 GiB.
export const DEFAULT_USER_QUOTA_BYTES = 10 * 1024 * 1024 * 1024;

export const MEDIA_LIMITS = {
  MAX_FILE_SIZE_BYTES: 200 * 1024 * 1024,
  ALLOWED_EXTENSIONS: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'mp4', 'mov', 'webm'],
 ALLOWED_MIME_TYPES: [
 'image/jpeg', 
 'image/png', 
 'image/gif', 
 'image/webp',
 'image/heic',
 'image/heif',
 'video/mp4', 
 'video/quicktime', 
 'video/webm'
 ],
};

export const SECURITY = {
 RETENTION_DAYS: 30,
 NUKE_CONFIRMATION_TOKEN: process.env.NUKE_CONFIRMATION_TOKEN,
};

export const FOLDER_COLORS: Record<string, string> = {
 zinc: '#71717a',
 blue: '#3b82f6',
 rose: '#f43f5e',
 emerald: '#10b981',
 amber: '#f59e0b',
 indigo: '#6366f1',
 violet: '#8b5cf6'
};
