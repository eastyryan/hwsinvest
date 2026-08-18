import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    // Research client components import shared lib modules that also use
    // `@vercel/functions` on the server. Stub that package in the browser
    // bundle so webpack does not try to pull in Node-only deps like `ws`.
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        "@vercel/functions": path.join(
          __dirname,
          "lib/research/vercel-functions-stub.ts"
        ),
      };
    }
    return config;
  },
};

export default nextConfig;
