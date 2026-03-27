/** @type {import('next').NextConfig} */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

// Extract the hostname from the API URL for CSP connect-src
let apiHost = "localhost:8080";
try {
  apiHost = new URL(API_URL).host;
} catch {}

const nextConfig = {
  reactStrictMode: true,

  images: {
    domains: [
      "cdn.deskbuddy.example.com",
      "res.cloudinary.com",
      "i.scdn.co", // Spotify cover art
    ],
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // Next.js needs inline scripts for hydration
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              // Tailwind inline styles + Material Symbols
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              // Google Fonts + Material Symbols
              "font-src 'self' https://fonts.gstatic.com",
              // API calls to FastAPI gateway
              `connect-src 'self' https://${apiHost} http://${apiHost} https://api.spotify.com https://accounts.spotify.com https://api-inference.huggingface.co https://api.anthropic.com`,
              // Images: self + Spotify CDN + Cloudinary
              "img-src 'self' data: blob: https://i.scdn.co https://res.cloudinary.com",
              // Spotify embeds
              "frame-src https://open.spotify.com",
              // Webcam (checkin page)
              "media-src 'self' blob:",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
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
