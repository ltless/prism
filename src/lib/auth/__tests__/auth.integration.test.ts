import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import crypto from 'crypto';
import { createTestDb, seedUser } from '@/__tests__/helpers/db';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '@/services/db/schema';
import { eq } from 'drizzle-orm';

// localStorage mock to avoid Node experimental warning
const store = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: vi.fn((k: string) => store.get(k) ?? null),
    setItem: vi.fn((k: string, v: string) => store.set(k, v)),
    removeItem: vi.fn((k: string) => store.delete(k)),
    clear: vi.fn(() => store.clear()),
    get length() { return store.size; },
    key: vi.fn((i: number) => [...store.keys()][i] ?? null),
  },
  configurable: true,
});

// Replicate decodeToken from AuthContext.tsx to test in isolation
function decodeToken(token: string): { id: string; username: string; role: string } | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return { id: payload.user_id, username: payload.username, role: payload.role };
  } catch {
    return null;
  }
}

// auth.ts uses Buffer.from(x, "base64").toString("utf-8") — handles Unicode
// AuthContext uses atob() — Latin-1 only, utf8 usernames get garbled (known limitation)

// Construct a Go-compatible HS256 JWT matching jwt.go claims structure
function signGoJWT(payload: Record<string, unknown>, secret = "dev-secret-do-not-use-in-prod"): string {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(JSON.stringify(payload));
  const sig = crypto.createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${sig}`;
}

function base64url(s: string): string {
  return Buffer.from(s).toString("base64url");
}

// Replicate auth.config.ts authorized callback
function authorizedCallback(
  auth: { user?: { id?: string } } | null,
  requestCookies: Map<string, string>,
  pathname: string,
): boolean {
  const isLoggedIn = !!auth?.user?.id;
  const hasGoToken = requestCookies.has("auth_token");
  const isOnDashboard = pathname.startsWith("/dashboard");
  const isOnEditor = pathname.startsWith("/editor");

  if (isOnDashboard || isOnEditor) {
    if (isLoggedIn || hasGoToken) return true;
    return false;
  } else if (isLoggedIn && pathname === "/login") {
    // Would redirect, but test just checks the condition
    return false;
  }
  return true;
}

interface TestDb {
  db: BetterSQLite3Database<typeof schema>;
  sqlite: import('better-sqlite3').Database;
  cleanup: () => void;
}

let testDb: TestDb;

beforeEach(() => {
  testDb = createTestDb() as unknown as TestDb;
});

afterEach(() => {
  testDb?.cleanup();
});

describe("decodeToken (JWT payload extraction)", () => {
  it("decodes valid Go-issued JWT", () => {
    const jwt = signGoJWT({
      user_id: "u-123",
      username: "alice",
      role: "admin",
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
    });
    const result = decodeToken(jwt);
    expect(result).toEqual({ id: "u-123", username: "alice", role: "admin" });
  });

  it("decodes JWT with user role", () => {
    const jwt = signGoJWT({
      user_id: "u-456",
      username: "bob",
      role: "user",
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
    });
    expect(decodeToken(jwt)).toEqual({ id: "u-456", username: "bob", role: "user" });
  });

  it("returns null for malformed JWT (no dots)", () => {
    expect(decodeToken("not-a-jwt")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(decodeToken("")).toBeNull();
  });

  it("returns null for non-JSON payload", () => {
    const junk = `${base64url("header")}.${base64url("not-json")}.${base64url("sig")}`;
    expect(decodeToken(junk)).toBeNull();
  });

  it("returns partial object for missing user_id field (known gap: decodeToken does not validate payload)", () => {
    const jwt = signGoJWT({
      username: "alice",
      role: "admin",
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    const result = decodeToken(jwt);
    expect(result).toEqual({ id: undefined, username: "alice", role: "admin" });
  });
});

describe("Go JWT format compatibility", () => {
  it("extracts correct claims from Go-structured JWT", () => {
    const userId = crypto.randomUUID();
    const jwt = signGoJWT({
      user_id: userId,
      username: "go_user_42",
      role: "admin",
      exp: Math.floor(Date.now() / 1000) + 604800,
      iat: Math.floor(Date.now() / 1000),
    });
    const result = decodeToken(jwt);
    expect(result?.id).toBe(userId);
    expect(result?.username).toBe("go_user_42");
    expect(result?.role).toBe("admin");
  });

  it("all JWT claims match Go jwt.go Claims struct keys", () => {
    // Go Claims: UserID -> user_id, Username -> username, Role -> role
    // RegisteredClaims: exp, iat are flattened into JSON
    const payload = {
      user_id: "u-1",
      username: "test",
      role: "user",
      exp: Date.now() / 1000 + 86400,
      iat: Date.now() / 1000,
    } as const;
    const jwt = signGoJWT(payload);
    const decoded = JSON.parse(atob(jwt.split(".")[1]));
    expect(decoded).toHaveProperty("user_id");
    expect(decoded).toHaveProperty("username");
    expect(decoded).toHaveProperty("role");
    expect(decoded).toHaveProperty("exp");
    expect(decoded).toHaveProperty("iat");
    expect(decoded.user_id).toBe("u-1");
  });
});

describe("localStorage token lifecycle", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("stores and retrieves auth_token", () => {
    const jwt = signGoJWT({
      user_id: "u-1",
      username: "alice",
      role: "admin",
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
    });
    localStorage.setItem("auth_token", jwt);
    expect(localStorage.getItem("auth_token")).toBe(jwt);
  });

  it("decodeToken works on stored token", () => {
    const jwt = signGoJWT({
      user_id: "u-1",
      username: "alice",
      role: "admin",
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
    });
    localStorage.setItem("auth_token", jwt);
    const stored = localStorage.getItem("auth_token")!;
    expect(decodeToken(stored)).toEqual({ id: "u-1", username: "alice", role: "admin" });
  });

  it("removeItem clears token from localStorage", () => {
    localStorage.setItem("auth_token", "some-token");
    localStorage.removeItem("auth_token");
    expect(localStorage.getItem("auth_token")).toBeNull();
  });
});

describe("authorized callback (Go JWT bridge in middleware)", () => {
  it("allows /dashboard when NextAuth session exists", () => {
    const cookies = new Map<string, string>();
    const auth = { user: { id: "u-1" } };
    expect(authorizedCallback(auth, cookies, "/dashboard")).toBe(true);
  });

  it("allows /dashboard when auth_token cookie exists (Go JWT fallback)", () => {
    const cookies = new Map([["auth_token", "some-jwt"]]);
    expect(authorizedCallback(null, cookies, "/dashboard")).toBe(true);
  });

  it("allows /editor with Go JWT cookie", () => {
    const cookies = new Map([["auth_token", "some-jwt"]]);
    expect(authorizedCallback(null, cookies, "/editor")).toBe(true);
  });

  it("blocks /dashboard without auth", () => {
    const cookies = new Map<string, string>();
    expect(authorizedCallback(null, cookies, "/dashboard")).toBe(false);
  });

  it("blocks /editor without auth", () => {
    const cookies = new Map<string, string>();
    const auth = { user: {} }; // no id
    expect(authorizedCallback(auth, cookies, "/editor")).toBe(false);
  });

  it("allows public routes without auth", () => {
    const cookies = new Map<string, string>();
    expect(authorizedCallback(null, cookies, "/login")).toBe(true);
    expect(authorizedCallback(null, cookies, "/register")).toBe(true);
    expect(authorizedCallback(null, cookies, "/")).toBe(true);
  });

  it("redirects /login when already logged in (returns false)", () => {
    const cookies = new Map<string, string>();
    const auth = { user: { id: "u-1" } };
    expect(authorizedCallback(auth, cookies, "/login")).toBe(false);
  });
});

describe("DB-backed auth bridge (auth.ts Go JWT -> session)", () => {
  it("queries user by ID from decoded JWT payload", () => {
    const user = seedUser(testDb.db, { role: "admin" });
    const result = testDb.db.select().from(schema.users).where(eq(schema.users.id, user.id)).get();
    expect(result).toBeDefined();
    expect(result!.username).toBe(user.username);
    expect(result!.role).toBe("admin");
  });

  it("fetches image/coverImage for synthetic session", () => {
    const user = seedUser(testDb.db, {
      image: "https://example.com/avatar.png",
      coverImage: "https://example.com/cover.png",
    });
    const row = testDb.db.select({
      image: schema.users.image,
      coverImage: schema.users.coverImage,
    }).from(schema.users).where(eq(schema.users.id, user.id)).get();
    expect(row!.image).toBe("https://example.com/avatar.png");
    expect(row!.coverImage).toBe("https://example.com/cover.png");
  });

  it("decoded JWT payload matches DB user", () => {
    const user = seedUser(testDb.db, { role: "user" });
    const jwt = signGoJWT({
      user_id: user.id,
      username: user.username,
      role: user.role,
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
    });
    const claims = decodeToken(jwt)!;
    expect(claims.id).toBe(user.id);

    const dbUser = testDb.db.select().from(schema.users).where(eq(schema.users.id, claims.id)).get();
    expect(dbUser).toBeDefined();
    expect(dbUser!.username).toBe(user.username);
  });
});
