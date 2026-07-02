/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { saveEditedImageAction } from "../services/mediaEditorActions";

let mockDbItems: any[] = [];
let dbOperations: { table: string; action: string; where?: any; values?: any }[] = [];

const mockDb = {
 select: vi.fn(() => ({
 from: vi.fn(() => ({
 where: vi.fn(() => ({
 limit: vi.fn(() => Promise.resolve(mockDbItems)),
 })),
 })),
 })),
 update: vi.fn(() => ({
 set: vi.fn((values: any) => ({
 where: vi.fn((condition: any) => {
 dbOperations.push({ table: "media", action: "update", where: condition, values });
 return Promise.resolve();
 }),
 })),
 })),
 insert: vi.fn(() => ({
 values: vi.fn((values: any) => {
 dbOperations.push({ table: "media", action: "insert", values });
 return Promise.resolve();
 }),
 })),
};

vi.mock("../services/mediaContext", () => ({
 getContext: vi.fn(async () => ({
 db: mockDb,
 paths: { mediaDir: "/tmp/media", thumbDir: "/tmp/thumbs", dbPath: ":memory:" },
 })),
}));

vi.mock("next/cache", () => ({
 revalidatePath: vi.fn(),
}));

vi.mock("fs/promises", () => ({
 default: {
 writeFile: vi.fn(() => Promise.resolve()),
 },
}));

vi.mock("sharp", () => ({
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

vi.mock("@/services/media/processor", () => ({
 MediaProcessor: {
 processImage: vi.fn(async () => ({
 width: 100,
 height: 100,
 palette: ["#ffffff", "#000000"],
 })),
 },
}));

describe("saveEditedImageAction", () => {
 beforeEach(() => {
 vi.clearAllMocks();
 mockDbItems = [];
 dbOperations = [];
 });

 it("should fail if mediaId is missing", async () => {
 const formData = new FormData();
 formData.append("base64Data", "somebase64");
 const result = await saveEditedImageAction(formData);
 expect(result.success).toBe(false);
 expect((result as any).error).toContain("Missing mediaId");
 });

 it("should fail if base64Data is missing", async () => {
 const formData = new FormData();
 formData.append("mediaId", "media-1");
 const result = await saveEditedImageAction(formData);
 expect(result.success).toBe(false);
 expect((result as any).error).toContain("Invalid base64Data type");
 });

 it("should fail if payload size exceeds maximum limit", async () => {
 const formData = new FormData();
 formData.append("mediaId", "media-1");
 // Under test mode, limit is set to 1000 characters to prevent OOM
 const giantBase64 = "a".repeat(1001);
 formData.append("base64Data", giantBase64);

 mockDbItems = [{ id: "media-1", filePath: "photo.jpg", title: "Photo" }];

 const result = await saveEditedImageAction(formData);
 expect(result.success).toBe(false);
 expect((result as any).error).toContain("Payload size exceeds maximum limit");
 });

 it("should succeed and save edited image if under limit", async () => {
 const formData = new FormData();
 formData.append("mediaId", "media-1");
 formData.append("base64Data", "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==");
 formData.append("overwrite", "true");

 mockDbItems = [{ id: "media-1", filePath: "photo.jpg", title: "Photo", metadata: {} }];

 const result = await saveEditedImageAction(formData);
 expect(result.success).toBe(true);
 expect(dbOperations.length).toBe(1);
 expect(dbOperations[0].action).toBe("update");
 });

 it("should inherit folderId, isVault, and isTrash when saving as copy", async () => {
 const formData = new FormData();
 formData.append("mediaId", "media-1");
 formData.append("base64Data", "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==");
 formData.append("overwrite", "false");

 mockDbItems = [{ 
 id: "media-1", 
 filePath: "photo.jpg", 
 title: "Photo", 
 metadata: {}, 
 folderId: "folder-123", 
 isVault: true, 
 isTrash: false 
 }];

 const result = await saveEditedImageAction(formData);
 expect(result.success).toBe(true);
 expect(dbOperations.length).toBe(1);
 expect(dbOperations[0].action).toBe("insert");
 expect(dbOperations[0].values.folderId).toBe("folder-123");
 expect(dbOperations[0].values.isVault).toBe(true);
 expect(dbOperations[0].values.isTrash).toBe(false);
 });
});
