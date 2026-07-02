import NextAuth from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "./services/db";
import { users } from "./services/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { authConfig } from "./auth.config";
import Credentials from "next-auth/providers/credentials";
import { env } from "./env";
import { verifyGoToken } from "./lib/auth/verifyGoToken";

if (!process.env.AUTH_TRUST_HOST) {
  process.env.AUTH_TRUST_HOST = env.NODE_ENV === "production" ? "false" : "true";
}

export const { handlers, signIn, signOut, auth: _nextAuth } = NextAuth({
  ...authConfig,
  adapter: DrizzleAdapter(db),
  session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60 },
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.image = user.image;
        token.coverImage = user.coverImage;
      }
      if (trigger === "update") {
        const [dbUser] = await db.select().from(users).where(eq(users.id, token.id as string)).limit(1);
        if (dbUser) {
          token.name = dbUser.username;
          token.image = dbUser.image;
          token.coverImage = dbUser.coverImage;
          token.role = dbUser.role;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token?.id) {
        session.user.id = token.id as string;
      }
      if (token?.role) {
        session.user.role = token.role as string;
      }
      if (token?.image) {
        session.user.image = token.image as string;
      }
      session.user.coverImage = token.coverImage as string;
      return session;
    },
    ...authConfig.callbacks,
  },
  providers: [
    Credentials({
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;

        const results = await db.select().from(users).where(eq(users.username, credentials.username as string)).limit(1);
        const user = results[0];

        if (!user) return null;

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );

        if (!isValid) return null;

        return {
          id: user.id,
          name: user.username,
          role: user.role,
          image: user.image,
          coverImage: user.coverImage,
        };
      },
    }),
  ],
});

export async function auth() {
  const session = await _nextAuth();
  if (session?.user?.id && session.user.role) return session;

  try {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const goToken = cookieStore.get("auth_token")?.value;
    if (!goToken) return null;

    const claims = await verifyGoToken(goToken);
    if (!claims) return null;
    const userId = claims.user_id;

    // Fetch fresh user data from DB to get image/coverImage (not in JWT payload)
    let image: string | null = null;
    let coverImage: string | null = null;
    try {
      const [dbUser] = await db.select({
        image: users.image,
        coverImage: users.coverImage,
      }).from(users).where(eq(users.id, userId)).limit(1);
      if (dbUser) {
        image = dbUser.image ?? null;
        coverImage = dbUser.coverImage ?? null;
      }
    } catch {
      // Non-fatal: fallback to null
    }

    return {
      user: {
        id: userId,
        name: claims.username,
        role: claims.role,
        image,
        coverImage,
      },
      expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };
  } catch {
    return null;
  }
}
