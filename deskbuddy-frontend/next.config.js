/** @type {import('next').NextConfig} */

const nextConfig = {
  reactStrictMode: true,

  images: {
    domains: [
      "cdn.deskbuddy.example.com",
      "res.cloudinary.com",
      "i.scdn.co", // Spotify cover art
    ],
  },

  /**
   * Non-CSP security headers applied to every route.
   *
   * Content-Security-Policy is intentionally omitted here because
   * middleware.ts generates a per-request nonce and sets a dynamic CSP
   * header on every response.  The static headers below complement the
   * dynamic CSP without conflicting with it.
   */
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
