import type { Metadata } from "next";
import Script from "next/script";
import { headers } from "next/headers";
import { Suspense } from "react";
import {
  Noto_Sans,
  Noto_Sans_JP,
  Noto_Sans_KR,
  Noto_Sans_SC,
  Noto_Sans_TC,
  Noto_Sans_Arabic,
  Noto_Sans_Hebrew,
  Noto_Sans_Thai,
} from "next/font/google";
import NextTopLoader from "nextjs-toploader";
import { AppToaster } from "../components/toaster";
import "./globals.css";

const sans = Noto_Sans({
  subsets: ["latin", "latin-ext", "cyrillic", "cyrillic-ext", "greek", "greek-ext", "vietnamese", "devanagari"],
  variable: "--font-sans",
});
const jp = Noto_Sans_JP({ variable: "--font-jp" });
const kr = Noto_Sans_KR({ variable: "--font-kr" });
const sc = Noto_Sans_SC({ variable: "--font-sc" });
const tc = Noto_Sans_TC({ variable: "--font-tc" });
const arabic = Noto_Sans_Arabic({ variable: "--font-arabic" });
const hebrew = Noto_Sans_Hebrew({ variable: "--font-hebrew" });
const thai = Noto_Sans_Thai({ variable: "--font-thai" });
const fonts = [sans, jp, kr, sc, tc, arabic, hebrew, thai].map((f) => f.variable).join(" ");
const ORIGIN = process.env.APP_ORIGIN || "http://localhost:3000";
export const metadata: Metadata = {
  metadataBase: new URL(ORIGIN),
  alternates: { canonical: "/" },
  title: {
    default: "Job Atlas — Work without borders",
    template: "%s — Job Atlas",
  },
  description:
    "Country-aware job discovery across public and configured job feeds. Filter by region, eligibility, source and schedule, rank listings against your resume, and track every application in one place.",
  applicationName: "Job Atlas",
  keywords: ["job search", "remote jobs", "job board", "career", "job aggregator", "work abroad"],
  referrer: "origin-when-cross-origin",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/favicon.svg", apple: "/apple-icon" },
  formatDetection: { telephone: false },
  openGraph: {
    type: "website",
    siteName: "Job Atlas",
    title: "Job Atlas — Work without borders",
    description: "Country-aware job discovery across public and configured job feeds.",
    url: "/",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Job Atlas — Work without borders",
    description: "Country-aware job discovery across public and configured job feeds.",
  },
};
const jsonLd = (o: object) => JSON.stringify(o).replace(/</g, "\\u003c");
const ldSite = jsonLd([
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Job Atlas",
    url: ORIGIN,
    logo: `${ORIGIN}/favicon.svg`,
    slogan: "Work without borders",
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Job Atlas",
    url: ORIGIN,
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${ORIGIN}/jobs?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  },
]);
export default async function Layout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="en" suppressHydrationWarning className={fonts}>
      <head>
        <script nonce={nonce} type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldSite }} />
        <Script
          id="theme-init"
          nonce={nonce}
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html:
              "try{if(localStorage.getItem('atlas-theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}",
          }}
        />
      </head>
      <body>
        <Suspense fallback={null}>
          <NextTopLoader color="#2563eb" height={2} showSpinner={false} shadow="none" />
        </Suspense>
        {children}
        <AppToaster />
      </body>
    </html>
  );
}
