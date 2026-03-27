/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./node_modules/next/dist/shared/lib/esm-worker.mjs"
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: "#4ade80",
        "desk-wood": "#EADFC8",
        "desk-wood-dark": "#3D2B1F",
        "journal-black": "#1E1E1E",
        "ipod-blue": "#6FA8DC",
        "camera-silver": "#C9CCD6",
        "calendar-white": "#FAFAFA",
        "pixel-black": "#2A2A2A"
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        pixel: ["var(--font-pixel)", "monospace"]
      },
      boxShadow: {
        pixel: "6px 6px 0px rgba(0,0,0,0.15)"
      }
    }
  },
  plugins: []
};