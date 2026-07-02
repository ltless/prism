import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";

export const authConfig = {
 providers: [
 Credentials({
 credentials: {
 username: { label: "Username", type: "text" },
 password: { label: "Password", type: "password" },
 },
  // Overridden in auth.ts which has DB access
 authorize: async () => null,
 }),
 ],
 pages: {
 signIn: "/login",
 },
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const hasGoToken = request.cookies.has("auth_token");
      const isOnDashboard = request.nextUrl.pathname.startsWith("/dashboard");
      const isOnEditor = request.nextUrl.pathname.startsWith("/editor");

      if (isOnDashboard || isOnEditor) {
        if (isLoggedIn || hasGoToken) return true;
        return false;
      } else if (isLoggedIn && request.nextUrl.pathname === "/login") {
        return Response.redirect(new URL("/dashboard", request.nextUrl));
      }
      return true;
    },
  },
} satisfies NextAuthConfig;
