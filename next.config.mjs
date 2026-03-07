/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { dev }) => {
    // Disable webpack cache in dev to avoid Windows cache corruption (ENOENT, MODULE_NOT_FOUND)
    if (dev) {
      config.cache = false;
    }
    return config;
  },
};

export default nextConfig;
