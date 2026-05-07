/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          900: "#0a0f1e",
          800: "#0f172a",
          700: "#1e293b",
          600: "#334155",
          400: "#94a3b8",
          300: "#cbd5e1",
          accent: "#38bdf8",
          green: "#22c55e",
          red: "#ef4444",
          yellow: "#f59e0b",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system", "BlinkMacSystemFont", "SF Pro Display", "SF Pro Text",
          "Helvetica Neue", "Segoe UI", "Roboto", "Arial", "sans-serif",
        ],
        mono: [
          "ui-monospace", "SF Mono", "SFMono-Regular", "Menlo",
          "Monaco", "Cascadia Code", "Consolas", "Liberation Mono", "monospace",
        ],
      },
    },
  },
  plugins: [],
};
