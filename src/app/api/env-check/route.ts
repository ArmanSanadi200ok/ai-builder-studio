export async function GET() {
  return Response.json({
    AUTH_SECRET: !!process.env.AUTH_SECRET,
    AUTH_GOOGLE_ID: !!process.env.AUTH_GOOGLE_ID,
    AUTH_GOOGLE_SECRET: !!process.env.AUTH_GOOGLE_SECRET,
    AUTH_GITHUB_ID: !!process.env.AUTH_GITHUB_ID,
    AUTH_GITHUB_SECRET: !!process.env.AUTH_GITHUB_SECRET,
    DATABASE_URL: !!process.env.DATABASE_URL,
    AUTH_URL: !!process.env.AUTH_URL,
    AUTH_TRUST_HOST: !!process.env.AUTH_TRUST_HOST,
    VERCEL_URL: !!process.env.VERCEL_URL,
    VERCEL_ENV: process.env.VERCEL_ENV || "unknown"
  });
}
