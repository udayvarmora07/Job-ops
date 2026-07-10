/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allow importing the shared engine (lib-ai/) which lives outside web/.
  experimental: {
    externalDir: true,
    // Resolve the AI SDK + yaml at runtime from the root node_modules instead
    // of bundling them into the server build.
    serverComponentsExternalPackages: ['ai', '@ai-sdk/openai-compatible', 'js-yaml', 'dotenv', 'zod', 'better-sqlite3', 'playwright', 'playwright-core', 'pdf-parse', 'pdfjs-dist', 'mammoth', '@prisma/client', '.prisma/client'],
  },
};

export default nextConfig;
