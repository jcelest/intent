/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: "/intent-quoting-system",
        destination: "/b2b",
        permanent: true,
      },
      {
        source: "/b2b/checkout",
        destination: "/b2b/begin",
        permanent: false,
      },
      {
        source: "/b2b/agreement",
        destination: "/b2b/begin/agreement",
        permanent: false,
      },
      {
        source: "/b2b/pay",
        destination: "/b2b/begin/pay",
        permanent: false,
      },
      {
        source: "/b2b/signed",
        destination: "/b2b/begin/signed",
        permanent: false,
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
