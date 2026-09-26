/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // scripts/dev-staging.mjs builds into its own folder, so a staging build and
  // a production-pointed one never share compiled NEXT_PUBLIC_* values.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

module.exports = nextConfig;
