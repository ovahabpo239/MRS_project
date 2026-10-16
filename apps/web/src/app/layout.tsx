import type { Metadata, Viewport } from "next";
import { Chivo, Geist, JetBrains_Mono } from "next/font/google";
import "@/styles/globals.css";
import { AmbientBackground } from "@/components/marketing/ambient-background";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { siteConfig } from "@/config/site";
import { getEnv } from "@/lib/env";

const headline = Chivo({
  subsets: ["latin"],
  weight: ["700", "900"],
  variable: "--font-headline",
  display: "swap",
});
const body = Geist({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-body",
  display: "swap",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(getEnv().SITE_URL),
  title: { default: siteConfig.name, template: `%s | ${siteConfig.name}` },
  description: siteConfig.description,
  openGraph: {
    type: "website",
    siteName: siteConfig.name,
    title: siteConfig.name,
    description: siteConfig.description,
  },
};

export const viewport: Viewport = {
  themeColor: "#121317",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${headline.variable} ${body.variable} ${mono.variable}`}>
      <body>
        <a
          href="#main"
          className="sr-only z-[70] rounded-lg bg-primary px-4 py-2 font-label-caps text-label-caps text-on-primary focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          Skip to content
        </a>
        <AmbientBackground />
        <Header />
        <main id="main">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
