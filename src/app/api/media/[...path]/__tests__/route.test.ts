import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "../route";
import { NextRequest } from "next/server";
import path from "path";

const mocks = vi.hoisted(() => {
 const state = {
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 mockDbUser: null as any,
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 mockDbMedia: null as any,
 };
 const mockGlobalDb = {
 select: vi.fn(() => ({
 from: vi.fn(() => ({
 where: vi.fn(() => ({
 limit: vi.fn(() => ({
 get: vi.fn(() => state.mockDbUser),
 })),
 })),
 })),
 })),
 };
 const mockTenantDb = {
 select: vi.fn(() => ({
 from: vi.fn(() => ({
 where: vi.fn(() => ({
 limit: vi.fn(() => ({
 get: vi.fn(() => state.mockDbMedia),
 })),
 })),
 })),
 })),
 };
 return {
 state,
 mockGlobalDb,
 mockTenantDb,
 };
});

// Mock auth
vi.mock("@/auth", () => ({
 auth: vi.fn(async () => ({ user: { id: "test-user-id" } })),
}));

vi.mock("@/services/db", () => ({
 db: mocks.mockGlobalDb,
}));

vi.mock("@/services/db/multitenant", () => ({
 getUserPaths: vi.fn(async (userId) => ({
 mediaDir: path.normalize(`/storage/users/${userId}/media`),
 thumbDir: path.normalize(`/storage/users/${userId}/media/thumbnails`),
 dbPath: path.normalize(`/storage/users/${userId}/prism.db`),
 })),
 getUserDb: vi.fn(async () => ({
 db: mocks.mockTenantDb,
 })),
}));

// Mock fs and fs/promises
vi.mock("fs", () => {
 const mStream = {
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 on: vi.fn((event: string, cb: any) => {
 if (event === "data") {
 cb(Buffer.from("file content chunk"));
 }
 if (event === "end") {
 cb();
 }
 return mStream;
 }),
 destroy: vi.fn(),
 };
 return {
 default: {
 createReadStream: vi.fn(() => mStream),
 },
 createReadStream: vi.fn(() => mStream),
 };
});

vi.mock("fs/promises", () => ({
 default: {
 access: vi.fn(async () => {}),
 stat: vi.fn(async () => ({ size: 1000 })),
 readFile: vi.fn(async () => Buffer.from("original content")),
 writeFile: vi.fn(async () => {}),
 },
}));

vi.mock("sharp", () => ({
 default: vi.fn(() => ({
 resize: vi.fn(() => ({
 webp: vi.fn(() => ({
 toBuffer: vi.fn(async () => Buffer.from("thumbnail webp buffer")),
 })),
 })),
 })),
}));

describe("Media Serving API Protection", () => {
 beforeEach(() => {
 vi.clearAllMocks();
 mocks.state.mockDbUser = null;
 mocks.state.mockDbMedia = null;
 });

 it("returns 401 when unauthorized", async () => {
 const authModule = await import("@/auth");
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 vi.mocked(authModule.auth).mockResolvedValueOnce(null as any);

 const request = new NextRequest("http://localhost/api/media/image.jpg");
 const response = await GET(request, { params: Promise.resolve({ path: ["image.jpg"] }) });
 expect(response.status).toBe(401);
 });

 it("returns 403 when path traversal is attempted", async () => {
 const request = new NextRequest("http://localhost/api/media/../../image.jpg");
 const response = await GET(request, { params: Promise.resolve({ path: ["..", "..", "image.jpg"] }) });
 expect(response.status).toBe(403);
 });

 it("returns 403 when media file is unregistered and not profile/cover picture", async () => {
 mocks.state.mockDbUser = { image: null, coverImage: null };
 mocks.state.mockDbMedia = null; // unregistered

 const request = new NextRequest("http://localhost/api/media/unregistered.jpg");
 const response = await GET(request, { params: Promise.resolve({ path: ["unregistered.jpg"] }) });
 expect(response.status).toBe(403);
 });

 it("returns 200 and streams content when file is registered in the database", async () => {
 mocks.state.mockDbUser = { image: null, coverImage: null };
 mocks.state.mockDbMedia = { id: "media-1", filePath: "registered.jpg" };

 const request = new NextRequest("http://localhost/api/media/registered.jpg");
 const response = await GET(request, { params: Promise.resolve({ path: ["registered.jpg"] }) });
 expect(response.status).toBe(200);
 });

 it("returns 200 when file is not in media database but is user profile picture", async () => {
 mocks.state.mockDbUser = { image: ".profile/user_avatar.jpg", coverImage: null };
 mocks.state.mockDbMedia = null;

 const request = new NextRequest("http://localhost/api/media/.profile/user_avatar.jpg");
 const response = await GET(request, { params: Promise.resolve({ path: [".profile", "user_avatar.jpg"] }) });
 expect(response.status).toBe(200);
 });

 it("returns 403 when thumbnail containment check fails", async () => {
 mocks.state.mockDbUser = { image: null, coverImage: null };
 mocks.state.mockDbMedia = { id: "media-1", filePath: "escapethumb.jpg" };

 const request = new NextRequest("http://localhost/api/media/escapethumb.jpg?thumb=1");
 // Simulate escape thumb path via parameter manipulation inside params resolution
 const response = await GET(request, { params: Promise.resolve({ path: ["..", "escapethumb.jpg"] }) });
 expect(response.status).toBe(403);
 });
});
