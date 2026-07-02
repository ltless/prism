import { describe, it, expect, vi, beforeEach } from 'vitest';
import { uploadMediaAction } from '../services/mediaUpload';
import fs from 'fs/promises';
import type { MediaItem } from "../types";

let mockDbItems: MediaItem[] = [];

vi.mock('@/services/db/multitenant', () => ({
 getUserDb: vi.fn(async () => ({
 db: {
 select: vi.fn(() => ({
 from: vi.fn(() => ({
 where: vi.fn(() => ({
 limit: vi.fn(() => Promise.resolve(mockDbItems)),
 })),
 })),
 })),
 insert: vi.fn(() => ({
 values: vi.fn((val: MediaItem) => {
 mockDbItems.push(val);
 return Promise.resolve();
 }),
 })),
 delete: vi.fn(() => ({
 where: vi.fn(() => {
 mockDbItems = [];
 return Promise.resolve();
 }),
 })),
 update: vi.fn(() => ({
 set: vi.fn(() => ({
 where: vi.fn(() => Promise.resolve()),
 })),
 })),
 },
 paths: {
 mediaDir: '/tmp/media',
 thumbDir: '/tmp/thumbs',
 dbPath: ':memory:',
 },
 })),
}));

vi.mock('fs/promises', () => ({
 default: {
 mkdir: vi.fn(() => Promise.resolve()),
 writeFile: vi.fn(() => Promise.resolve()),
 unlink: vi.fn(() => Promise.resolve()),
 rm: vi.fn(() => Promise.resolve()),
 },
}));

vi.mock('sharp', () => ({
  default: vi.fn(() => ({
    metadata: vi.fn(() => Promise.resolve({ width: 100, height: 100 })),
    resize: vi.fn(() => ({
      webp: vi.fn(() => ({
        toFile: vi.fn(() => Promise.resolve()),
        toBuffer: vi.fn(() => Promise.resolve(Buffer.from('mock-webp'))),
      })),
    })),
  })),
}));

vi.mock('@/services/media/processor', () => ({
 MediaProcessor: {
 generateHash: vi.fn(async () => 'mocked-hash'),
 extractExif: vi.fn(async () => ({ date: new Date().toISOString() })),
 processImage: vi.fn(async () => ({ width: 100, height: 100, palette: ['#ffffff', '#000000'] })),
 }
}));

describe('uploadMediaAction', () => {
 beforeEach(() => {
 vi.clearAllMocks();
 mockDbItems = [];
 });

 it('should fail if no file is provided', async () => {
 const formData = new FormData();
 const result = await uploadMediaAction(formData);
 expect(result.success).toBe(false);
 expect((result as { success: false; error: string }).error).toContain('No file uploaded');
 });

 it('should validate file extension', async () => {
 const formData = new FormData();
 const file = new File(['test'], 'test.exe', { type: 'image/jpeg' });
 formData.append('file', file);

 const result = await uploadMediaAction(formData);
 expect(result.success).toBe(false);
 expect((result as { success: false; error: string }).error).toContain('File extension not allowed');
 });

 it('should upload a new file and call writeFile', async () => {
 const formData = new FormData();
 const file = new File([new Uint8Array([0xFF, 0xD8, 0xFF, 0x00])], 'photo.jpg', { type: 'image/jpeg' });
 formData.append('file', file);

 const result = await uploadMediaAction(formData);
 expect(result.success).toBe(true);
 expect(fs.writeFile).toHaveBeenCalled();
 });

 it('should reject file if signature is invalid', async () => {
 const formData = new FormData();
 // This is clearly not a jpeg file signature, it's just zeroed bytes
 const file = new File([new Uint8Array([0x00, 0x00, 0x00, 0x00])], 'photo.jpg', { type: 'image/jpeg' });
 formData.append('file', file);

 const result = await uploadMediaAction(formData);
 expect(result.success).toBe(false);
 expect((result as { success: false; error: string }).error).toContain('Invalid file signature');
 });

 it('should allow PNG file with valid magic bytes', async () => {
 const formData = new FormData();
 const file = new File([new Uint8Array([0x89, 0x50, 0x4E, 0x47])], 'photo.png', { type: 'image/png' });
 formData.append('file', file);

 const result = await uploadMediaAction(formData);
 expect(result.success).toBe(true);
 });

 it('should allow GIF file with valid magic bytes', async () => {
 const formData = new FormData();
 const file = new File([new Uint8Array([0x47, 0x49, 0x46, 0x38])], 'photo.gif', { type: 'image/gif' });
 formData.append('file', file);

 const result = await uploadMediaAction(formData);
 expect(result.success).toBe(true);
 });

 it('should allow WEBP file with valid magic bytes', async () => {
 const formData = new FormData();
 const webpBytes = new Uint8Array(12);
 webpBytes.set([0x52, 0x49, 0x46, 0x46], 0); // RIFF
 webpBytes.set([0x57, 0x45, 0x42, 0x50], 8); // WEBP
 const file = new File([webpBytes], 'photo.webp', { type: 'image/webp' });
 formData.append('file', file);

 const result = await uploadMediaAction(formData);
 expect(result.success).toBe(true);
 });

 it('should allow MP4 file with valid magic bytes (ftyp at offset 4)', async () => {
 const formData = new FormData();
 const mp4Bytes = new Uint8Array(8);
 mp4Bytes.set([0x66, 0x74, 0x79, 0x70], 4); // ftyp
 const file = new File([mp4Bytes], 'video.mp4', { type: 'video/mp4' });
 formData.append('file', file);

 const result = await uploadMediaAction(formData);
 expect(result.success).toBe(true);
 });

 it('should allow WEBM file with valid magic bytes', async () => {
 const formData = new FormData();
 const file = new File([new Uint8Array([0x1A, 0x45, 0xDF, 0xA3])], 'video.webm', { type: 'video/webm' });
 formData.append('file', file);

 const result = await uploadMediaAction(formData);
 expect(result.success).toBe(true);
 });
});
