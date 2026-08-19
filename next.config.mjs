/** @type {import('next').NextConfig} */
const nextConfig = {
  // Only the Docker build wants a standalone bundle; `next start` refuses to run
  // against one, and that is the normal way to launch this locally.
  output: process.env.BUILD_STANDALONE === "1" ? "standalone" : undefined,
  reactStrictMode: true,
  // `next dev` otherwise appends its own block to CLAUDE.md on every start.
  agentRules: false,
};

export default nextConfig;
