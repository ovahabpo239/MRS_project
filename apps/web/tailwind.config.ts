import forms from "@tailwindcss/forms";
import type { Config } from "tailwindcss";

// Design tokens ported from the "webdev-free" template (Material-3 style dark palette); only the
// ones the site uses.
const mono = ["var(--font-mono)", "ui-monospace", "monospace"];
const body = ["var(--font-body)", "ui-sans-serif", "system-ui", "sans-serif"];
const headline = ["var(--font-headline)", "ui-sans-serif", "system-ui", "sans-serif"];

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#121317",
        surface: "#121317",
        "surface-container-lowest": "#0d0e12",
        "surface-container-low": "#1a1b20",
        "surface-container-highest": "#343439",
        "on-background": "#e3e2e8",
        "on-surface": "#e3e2e8",
        "on-surface-variant": "#b9cacb",
        outline: "#849495",
        primary: "#dbfcff",
        "on-primary": "#00363a",
        "primary-fixed": "#7df4ff",
        "primary-fixed-dim": "#00dbe9",
        "on-primary-fixed": "#002022",
        secondary: "#bcff5f",
        error: "#ffb4ab",
        "error-container": "#93000a",
      },
      spacing: {
        "margin-mobile": "24px",
        "margin-desktop": "64px",
        "container-max": "1280px",
        gutter: "24px",
        "section-gap": "128px",
      },
      fontFamily: {
        "code-sm": mono,
        "label-caps": mono,
        "body-md": body,
        "body-lg": body,
        "headline-xl": headline,
        "headline-xl-mobile": headline,
        "headline-lg": headline,
        "headline-md": headline,
      },
      fontSize: {
        "code-sm": ["14px", { lineHeight: "1.5", fontWeight: "500" }],
        "label-caps": ["12px", { lineHeight: "1", letterSpacing: "0.1em", fontWeight: "700" }],
        "body-md": ["16px", { lineHeight: "1.6", fontWeight: "400" }],
        "body-lg": ["18px", { lineHeight: "1.6", fontWeight: "400" }],
        "headline-xl": ["56px", { lineHeight: "1.1", letterSpacing: "-0.03em", fontWeight: "900" }],
        "headline-xl-mobile": [
          "36px",
          { lineHeight: "1.1", letterSpacing: "-0.02em", fontWeight: "900" },
        ],
        "headline-lg": ["36px", { lineHeight: "1.2", letterSpacing: "-0.02em", fontWeight: "700" }],
        "headline-md": ["24px", { lineHeight: "1.3", fontWeight: "700" }],
      },
    },
  },
  plugins: [forms],
};

export default config;
