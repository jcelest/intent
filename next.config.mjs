/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: "/intent-quoting-system",
        destination: "/b2b",
        permanent: true,
      },
    ];
  },
  experimental: {
    instrumentationHook: true,
    serverComponentsExternalPackages: ["@google-analytics/data", "google-gax"],
  },
  webpack: (config, { dev }) => {
    // Disable webpack cache in dev to avoid Windows cache corruption (ENOENT, MODULE_NOT_FOUND)
    if (dev) {
      config.cache = false;
    }
    return config;
  },
};

export default nextConfig;
