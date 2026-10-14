import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer, webpack }) => {
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
      // edgar.ts fingerprints cache keys with node:crypto. Next 14's client
      // webpack rejects the node: scheme. The fingerprint only runs on the server.
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          /^node:crypto$/,
          path.join(__dirname, "lib/research/node-crypto-stub.ts")
        )
      );
    }
    return config;
  },
};

export default nextConfig;
