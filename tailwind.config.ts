import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        sand: "#f7f2e8",
        ink: "#1f2a2a",
        sage: "#6f8a70",
        clay: "#d97f5f",
        oat: "#efe5d1"
      },
      fontFamily: {
        sans: ["Pretendard", "Noto Sans KR", "system-ui", "sans-serif"]
      },
      boxShadow: {
        card: "0 16px 40px rgba(31, 42, 42, 0.08)"
      }
    }
  },
  plugins: []
} satisfies Config;
