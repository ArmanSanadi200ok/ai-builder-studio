import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";

export const authConfig = {
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt" as const },
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isProtectedRoute = 
        nextUrl.pathname.startsWith("/dashboard") ||
        nextUrl.pathname.startsWith("/workspace") ||
        nextUrl.pathname.startsWith("/preview");

      if (isProtectedRoute) {
        if (isLoggedIn) return true;
        return false; // Redirect to signIn
      } else if (isLoggedIn) {
        // If they are logged in and hit /login or /signup, redirect to dashboard
        if (nextUrl.pathname === "/login" || nextUrl.pathname === "/signup") {
          return Response.redirect(new URL("/dashboard", nextUrl));
        }
      }
      return true;
    },
  },
} satisfies NextAuthConfig;

export default NextAuth(authConfig).auth;

export const config = {
  // matcher for all routes except static files, api, _next
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
