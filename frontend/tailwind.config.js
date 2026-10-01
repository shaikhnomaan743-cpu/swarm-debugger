/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#f5f3ee",
        surface: "#ffffff",
        "surface-2": "#faf9f6",
        border: "#e7e2d8",
        muted: "#667085",
        primary: "#101828",
        "primary-soft": "#e7e2d8",
        text: "#101828",
        prosecutor: "#f04452",
        defender: "#2e90fa",
        judge: "#12b76a",
        warning: "#dc6803",
        danger: "#d92d20",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "SFMono-Regular", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};
