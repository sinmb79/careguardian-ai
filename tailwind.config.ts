import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        sand: "#f7f2e8",
        ink: "#1a2626",
        sage: "#6f8a70",
        clay: "#d97f5f",
        oat: "#efe5d1"
      },
      fontFamily: {
        sans: ["Pretendard", "Noto Sans KR", "system-ui", "sans-serif"]
      },
      boxShadow: {
        card: "0 16px 40px rgba(31, 42, 42, 0.08)"
      },
      fontSize: {
        label: ["1.0625rem", { lineHeight: "1.5rem" }],
        input: ["1.125rem", { lineHeight: "1.625rem" }]
      }
    }
  },
  plugins: []
} satisfies Config;
