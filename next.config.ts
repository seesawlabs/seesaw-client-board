import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  // pdf-parse wraps pdfjs-dist (worker + wasm assets); bundling it breaks those
  // paths on Vercel, so load it from node_modules at runtime instead.
  serverExternalPackages: ["pdf-parse"],
};
export default nextConfig;
