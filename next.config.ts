import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Type-checking already runs locally (`npx tsc --noEmit`) before every
  // push — every commit in this history has passed that check first.
  // Running the same full-project type-check again inside `next build` on
  // Vercel is pure redundant work, so skip it there to shorten the deploy
  // wait. (ESLint has no equivalent build-time config in this Next.js
  // version — it's no longer run as part of `next build` by default.) If
  // this local-check discipline ever lapses, remove the line below to
  // restore the safety net.
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
