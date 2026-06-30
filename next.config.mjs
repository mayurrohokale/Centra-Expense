/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep Mongoose out of the bundler so its dynamic requires work in the
  // serverless route handlers.
  experimental: {
    serverComponentsExternalPackages: ['mongoose'],
    // Lets instrumentation.js run on server boot (logs config warnings once).
    instrumentationHook: true,
  },
};

export default nextConfig;
