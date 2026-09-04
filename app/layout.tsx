import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Namma Metro Planner — Bengaluru Metro Routes, Fares & Timings",
    template: "%s | Namma Metro Planner",
  },
  description:
    "Plan your Namma Metro trip offline: real fares (token, QR, Smart Card), next-train estimates, interchanges, and first/last-mile options across Purple, Green and Yellow lines.",
  manifest: "/manifest.webmanifest",
  applicationName: "Namma Metro Planner",
};

export const viewport: Viewport = {
  themeColor: "#7b2d8e",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ServiceWorkerRegistrar />
        <header className="border-b border-border bg-surface">
          <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2 font-semibold text-lg">
              <span
                aria-hidden
                className="inline-block h-6 w-6 rounded-md"
                style={{ background: "var(--accent)" }}
              />
              Namma Metro
            </Link>
            <nav className="flex gap-4 text-sm text-muted">
              <Link href="/map" className="hover:text-foreground">
                Map
              </Link>
              <Link href="/offline" className="hover:text-foreground">
                Offline
              </Link>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-border py-6 text-center text-xs text-muted">
          Not affiliated with BMRCL. Fares, timings and coordinates are best-effort estimates —
          verify against the official Namma Metro app before travelling.
        </footer>
      </body>
    </html>
  );
}
