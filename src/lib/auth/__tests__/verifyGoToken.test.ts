// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { SignJWT } from "jose";

vi.mock("@/env", () => ({ env: { JWT_SECRET: "test-secret-phrase" } }));

import { verifyGoToken } from "../verifyGoToken";

const secret = new TextEncoder().encode("test-secret-phrase");

async function mint(
  claims: Record<string, unknown>,
  options: { expSeconds?: number } = {}
): Promise<string> {
  const builder = new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt();
  if (options.expSeconds !== undefined) {
    builder.setExpirationTime(options.expSeconds);
  }
  return builder.sign(secret);
}

describe("verifyGoToken", () => {
  it("returns claims for a valid go-issued token", async () => {
    const token = await mint({ user_id: "u-1", username: "alice", role: "admin" });
    expect(await verifyGoToken(token)).toEqual({
      user_id: "u-1",
      username: "alice",
      role: "admin",
    });
  });

  it("returns null for a token signed with a different secret", async () => {
    const other = new TextEncoder().encode("wrong-secret");
    const token = await new SignJWT({ user_id: "u-1", username: "a", role: "admin" })
      .setProtectedHeader({ alg: "HS256" })
      .sign(other);
    expect(await verifyGoToken(token)).toBeNull();
  });

  it("returns null when claims are missing", async () => {
    const token = await mint({ user_id: "u-1" });
    expect(await verifyGoToken(token)).toBeNull();
  });

  it("returns null for a malformed token", async () => {
    expect(await verifyGoToken("not.a.jwt")).toBeNull();
    expect(await verifyGoToken("")).toBeNull();
  });

  it("returns null for an expired token", async () => {
    const token = await mint(
      { user_id: "u-1", username: "a", role: "admin" },
      { expSeconds: Math.floor(Date.now() / 1000) - 10 }
    );
    expect(await verifyGoToken(token)).toBeNull();
  });
});
