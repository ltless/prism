import { describe, it, expect, vi, beforeEach } from "vitest";
import { bulkMoveToTrashAction } from "@/features/media/services/mediaTrashActions";
import { bulkSetFavoriteAction } from "@/features/media/services/mediaFavoriteActions";
import { createFolderAction, deleteFolderAction, moveMediaToFolderAction } from "@/features/media/services/mediaFolderActions";

let dbOperations: { table: unknown; action: string; where?: unknown; values?: unknown }[] = [];

const mockDb = {
 update: vi.fn(() => ({
 set: vi.fn((values: unknown) => ({
 where: vi.fn((condition: unknown) => {
 dbOperations.push({ table: "media", action: "update", where: condition, values });
 return Promise.resolve();
 }),
 })),
 })),
 insert: vi.fn(() => ({
 values: vi.fn((values: unknown) => {
 dbOperations.push({ table: "folders", action: "insert", values });
 return Promise.resolve();
 }),
 })),
 delete: vi.fn(() => ({
 where: vi.fn((condition: unknown) => {
 dbOperations.push({ table: "folders", action: "delete", where: condition });
 return Promise.resolve();
 }),
 })),
};

vi.mock("@/services/db/multitenant", () => ({
 getUserDb: vi.fn(async () => ({
 db: mockDb,
 paths: { mediaDir: "/tmp", thumbDir: "/tmp/thumbs", dbPath: ":memory:" },
 })),
}));

vi.mock("next/cache", () => ({
 revalidatePath: vi.fn(),
}));

beforeEach(() => {
 vi.clearAllMocks();
 dbOperations = [];
});

describe("server actions", () => {
 describe("bulkMoveToTrashAction", () => {
 it("trash with empty ids is a no-op", async () => {
 const result = await bulkMoveToTrashAction([]);
 expect(result.success).toBe(true);
 expect(mockDb.update).not.toHaveBeenCalled();
 });

 it("trash updates isTrash and updatedAt", async () => {
 const result = await bulkMoveToTrashAction(["id-1", "id-2"]);
 expect(result.success).toBe(true);
 expect(mockDb.update).toHaveBeenCalled();
 expect(dbOperations[0].table).toBe("media");
 expect(dbOperations[0].action).toBe("update");
 expect((dbOperations[0].values as Record<string, unknown>).isTrash).toBe(true);
 });
 });

 describe("bulkSetFavoriteAction", () => {
 it("updates isFavorite on selected ids", async () => {
 const result = await bulkSetFavoriteAction(["id-1"], true);
 expect(result.success).toBe(true);
 expect(dbOperations[0].table).toBe("media");
 expect((dbOperations[0].values as Record<string, unknown>).isFavorite).toBe(true);
 });

 it("returns count of updated items", async () => {
 const result = await bulkSetFavoriteAction(["a", "b", "c"], true);
 expect(result.success).toBe(true);
 if (result.success && "count" in result) {
 expect(result.count).toBe(3);
 }
 });
 });

 describe("createFolderAction", () => {
 it("inserts a new folder", async () => {
 const result = await createFolderAction("Photos", "blue");
 expect(result.success).toBe(true);
 expect(mockDb.insert).toHaveBeenCalled();
 expect(dbOperations[0].table).toBe("folders");
 expect(dbOperations[0].action).toBe("insert");
 expect((dbOperations[0].values as Record<string, unknown>).name).toBe("Photos");
 expect((dbOperations[0].values as Record<string, unknown>).color).toBe("blue");
 });
 });

 describe("deleteFolderAction", () => {
 it("unlinks media and deletes folder", async () => {
 const result = await deleteFolderAction("folder-1");
 expect(result.success).toBe(true);
 // First operation: update media where folderId matches, setting folderId null
 expect(dbOperations[0].table).toBe("media");
 expect(dbOperations[0].action).toBe("update");
 // Second operation: delete the folder
 expect(dbOperations[1].table).toBe("folders");
 expect(dbOperations[1].action).toBe("delete");
 });
 });

 describe("moveMediaToFolderAction", () => {
 it("updates folderId on selected media", async () => {
 const result = await moveMediaToFolderAction(["id-1"], "folder-1");
 expect(result.success).toBe(true);
 expect(dbOperations[0].table).toBe("media");
 expect((dbOperations[0].values as Record<string, unknown>).folderId).toBe("folder-1");
 });
 });
});
