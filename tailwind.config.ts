import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        mint: {
          DEFAULT: "#00C9A7",
          light: "#00E5C4",
          dark: "#00A88D",
        },
        sky: "#00B4D8",
        coral: {
          DEFAULT: "#FF6B6B",
          dark: "#FF4757",
        },
        bg: {
          DEFAULT: "#F0FAFA",
          2: "#E8F8F5",
        },
        brand: {
          text: "#1A1A2E",
          sub: "#4A4A6A",
          light: "#9A9AB0",
        },
      },
      fontFamily: {
        sans: ["Noto Sans KR", "sans-serif"],
      },
      boxShadow: {
        mint: "0 8px 32px rgba(0,201,167,0.12)",
        "mint-lg": "0 20px 60px rgba(0,201,167,0.18)",
        coral: "0 4px 14px rgba(255,107,107,0.35)",
      },
    },
  },
  plugins: [],
};
export default config;
