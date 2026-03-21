import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: __dirname,
  },
  experimental: {
    serverActions: {
      allowedOrigins: [
        "localhost:3000",
        "*.app.github.dev",
        "*.preview.app.github.dev",
        "orange-space-yodel-7vgrrvgxr7grcrpqp-3000.app.github.dev",
      ],
    },
  },
};

export default nextConfig;
