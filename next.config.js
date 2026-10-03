/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // scripts/dev-staging.mjs builds into its own folder, so a staging build and
  // a production-pointed one never share compiled NEXT_PUBLIC_* values.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Development only (production ignores it): lets the dev server's pages
  // hydrate when opened as 127.0.0.1, which carries no localhost cookies, for
  // checking the public pages signed out next to a signed-in localhost tab.
  allowedDevOrigins: ["127.0.0.1"],
};

module.exports = nextConfig;
