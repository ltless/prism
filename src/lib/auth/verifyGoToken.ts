import { jwtVerify } from "jose";
import { env } from "@/env";

const secret = new TextEncoder().encode(env.JWT_SECRET);

export interface GoClaims {
  user_id: string;
  username: string;
  role: string;
}

export async function verifyGoToken(token: string): Promise<GoClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
    });
    const user_id = payload.user_id as string | undefined;
    const username = payload.username as string | undefined;
    const role = payload.role as string | undefined;
    if (!user_id || !username || !role) return null;
    return { user_id, username, role };
  } catch {
    return null;
  }
}
