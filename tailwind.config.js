/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "ndi-dark":         "#121214",
        "ndi-card":         "#1e1e22",
        "ndi-accent":       "#7c3aed",
        "ndi-accent-hover": "#6d28d9",
        "ndi-success":      "#10b981",
        "ndi-danger":       "#ef4444",
        "ndi-border":       "#333338",
      },
    },
  },
  plugins: [],
}
