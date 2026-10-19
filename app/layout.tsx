import type { Metadata } from "next";
import Script from "next/script";
import { Suspense } from "react";
import { Inter } from "next/font/google";
import NextTopLoader from "nextjs-toploader";
import { AppToaster } from "../components/toaster";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-inter" });
const ORIGIN = process.env.APP_ORIGIN || "http://localhost:3000";
export const metadata: Metadata = {
  metadataBase: new URL(ORIGIN),
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
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <head>
        <Script
          id="theme-init"
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
