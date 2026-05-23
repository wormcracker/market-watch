import type { NextConfig } from "next";

// When deployed to GitHub Pages, the app lives at /<repo>/
// Set NEXT_PUBLIC_BASE_PATH to your repo name in the workflow env, or leave blank for local dev
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  assetPrefix: basePath,
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  images: { unoptimized: true },
};

export default nextConfig;
