import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST, GET } from "../route";

// We mock the database and auth session structures so that we don't accidentally
// invoke real SQLite queries or contact authentication servers during simple unit tests.
const { mockAuth, mockDb, mockInsertValues, mockLimit } = vi.hoisted(() => {
 const mockInsertValues = vi.fn();
 const mockLimit = vi.fn();

 const mockDb = {
 insert: vi.fn(() => ({
 values: mockInsertValues,
 })),
 select: vi.fn(() => ({
 from: vi.fn(() => ({
 orderBy: vi.fn(() => ({
 limit: mockLimit,
 })),
 })),
 })),
 };

 const mockAuth = vi.fn();

 return { mockAuth, mockDb, mockInsertValues, mockLimit };
});

vi.mock("@/auth", () => ({
 auth: mockAuth,
}));

vi.mock("@/services/db", () => ({
 db: mockDb,
}));

describe("Log API - POST", () => {
 beforeEach(() => {
 vi.clearAllMocks();
 });

 it("returns 401 if unauthorized", async () => {
 mockAuth.mockResolvedValueOnce(null);
 const req = new Request("http://localhost/api/log", {
 method: "POST",
 body: JSON.stringify({ level: "info", message: "test message" }),
 });
 const res = await POST(req);
 expect(res.status).toBe(401);
 expect(await res.json()).toEqual({ error: "Unauthorized" });
 });

 it("returns 400 for invalid level", async () => {
 mockAuth.mockResolvedValueOnce({ user: { id: "user-123" } });
 const req = new Request("http://localhost/api/log", {
 method: "POST",
 body: JSON.stringify({ level: "invalid-level", message: "test message" }),
 });
 const res = await POST(req);
 expect(res.status).toBe(400);
 expect(await res.json()).toEqual({ error: "Invalid level" });
 });

 it("returns 400 if message is missing or not a string", async () => {
 mockAuth.mockResolvedValueOnce({ user: { id: "user-123" } });
 const req = new Request("http://localhost/api/log", {
 method: "POST",
 body: JSON.stringify({ level: "info" }),
 });
 const res = await POST(req);
 expect(res.status).toBe(400);
 expect(await res.json()).toEqual({ error: "Message is required" });
 });

 it("returns 400 if message is too long", async () => {
 mockAuth.mockResolvedValueOnce({ user: { id: "user-123" } });
 const longMessage = "a".repeat(5001);
 const req = new Request("http://localhost/api/log", {
 method: "POST",
 body: JSON.stringify({ level: "info", message: longMessage }),
 });
 const res = await POST(req);
 expect(res.status).toBe(400);
 expect(await res.json()).toEqual({ error: "Message too long" });
 });

 it("returns 400 if source is not a string", async () => {
 mockAuth.mockResolvedValueOnce({ user: { id: "user-123" } });
 const req = new Request("http://localhost/api/log", {
 method: "POST",
 body: JSON.stringify({ level: "info", message: "hello", source: 12345 }),
 });
 const res = await POST(req);
 expect(res.status).toBe(400);
 expect(await res.json()).toEqual({ error: "Invalid source" });
 });

 it("returns 400 if source is too long", async () => {
 mockAuth.mockResolvedValueOnce({ user: { id: "user-123" } });
 const longSource = "s".repeat(501);
 const req = new Request("http://localhost/api/log", {
 method: "POST",
 body: JSON.stringify({ level: "info", message: "hello", source: longSource }),
 });
 const res = await POST(req);
 expect(res.status).toBe(400);
 expect(await res.json()).toEqual({ error: "Source too long" });
 });

 it("returns 400 if timestamp is an invalid date format", async () => {
 mockAuth.mockResolvedValueOnce({ user: { id: "user-123" } });
 const req = new Request("http://localhost/api/log", {
 method: "POST",
 body: JSON.stringify({ level: "info", message: "hello", timestamp: "not-a-date" }),
 });
 const res = await POST(req);
 expect(res.status).toBe(400);
 expect(await res.json()).toEqual({ error: "Invalid timestamp" });
 });

 it("returns 400 if timestamp is older than 30 days", async () => {
 mockAuth.mockResolvedValueOnce({ user: { id: "user-123" } });
 const oldTimestamp = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
 const req = new Request("http://localhost/api/log", {
 method: "POST",
 body: JSON.stringify({ level: "info", message: "hello", timestamp: oldTimestamp }),
 });
 const res = await POST(req);
 expect(res.status).toBe(400);
 expect(await res.json()).toEqual({ error: "Timestamp out of bounds" });
 });

 it("returns 400 if timestamp is more than 24 hours in the future", async () => {
 mockAuth.mockResolvedValueOnce({ user: { id: "user-123" } });
 const futureTimestamp = new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString();
 const req = new Request("http://localhost/api/log", {
 method: "POST",
 body: JSON.stringify({ level: "info", message: "hello", timestamp: futureTimestamp }),
 });
 const res = await POST(req);
 expect(res.status).toBe(400);
 expect(await res.json()).toEqual({ error: "Timestamp out of bounds" });
 });

 it("successfully logs a valid payload", async () => {
 mockAuth.mockResolvedValueOnce({ user: { id: "user-123" } });
 mockInsertValues.mockResolvedValueOnce(undefined);
 const validTimestamp = new Date().toISOString();
 const payload = {
 level: "info",
 message: "safe message",
 source: "client-app",
 timestamp: validTimestamp,
 meta: { extra: "data" },
 };
 const req = new Request("http://localhost/api/log", {
 method: "POST",
 body: JSON.stringify(payload),
 });
 const res = await POST(req);
 expect(res.status).toBe(200);
 expect(await res.json()).toEqual({ ok: true });
 expect(mockInsertValues).toHaveBeenCalledWith({
 level: "info",
 message: "safe message",
 source: "client-app",
 timestamp: validTimestamp,
 meta: JSON.stringify({ extra: "data" }),
 });
 });
});

describe("Log API - GET", () => {
 beforeEach(() => {
 vi.clearAllMocks();
 });

 it("returns 401 if unauthorized", async () => {
 mockAuth.mockResolvedValueOnce(null);
 const req = new Request("http://localhost/api/log");
 const res = await GET(req);
 expect(res.status).toBe(401);
 expect(await res.json()).toEqual({ error: "Unauthorized" });
 });

 it("returns 403 if user is not an admin", async () => {
 mockAuth.mockResolvedValueOnce({ user: { id: "user-123", role: "user" } });
 const req = new Request("http://localhost/api/log");
 const res = await GET(req);
 expect(res.status).toBe(403);
 expect(await res.json()).toEqual({ error: "Forbidden" });
 });

 it("returns entries if user is an admin", async () => {
 mockAuth.mockResolvedValueOnce({ user: { id: "user-123", role: "admin" } });
 const mockEntries = [
 { id: 1, level: "info", message: "first", meta: '{"a":1}', source: null, timestamp: "some-time" },
 ];
 mockLimit.mockResolvedValueOnce(mockEntries);

 const req = new Request("http://localhost/api/log?limit=10");
 const res = await GET(req);
 expect(res.status).toBe(200);
 expect(await res.json()).toEqual([
 { id: 1, level: "info", message: "first", meta: { a: 1 }, source: null, timestamp: "some-time" },
 ]);
 });
});
