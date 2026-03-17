/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverActions: {
    allowedOrigins: [
      "localhost:3000",
      "*.app.github.dev",
      "*.preview.app.github.dev",
      "orange-space-yodel-7vgrrvgxr7grcrpqp-3000.app.github.dev",
    ],
  },
};

export default nextConfig;
