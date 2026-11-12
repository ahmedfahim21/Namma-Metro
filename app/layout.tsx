import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";
import { SITE_URL } from "@/lib/site";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Namma Metro Planner — Bengaluru Metro Routes, Fares & Timings",
    template: "%s | Namma Metro Planner",
  },
  description:
    "Plan a Bengaluru metro trip across the Purple, Green, Yellow and new Pink lines: fares by token, QR and Smart Card, next-train estimates, interchanges, and an animated network map. Works offline.",
  alternates: { canonical: "/" },
  openGraph: { type: "website", siteName: "Namma Metro Planner", locale: "en_IN" },
  twitter: { card: "summary_large_image" },
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
          <div className="mx-auto flex w-full max-w-[110rem] items-center justify-between px-4 py-3 sm:px-6">
            <Link href="/" className="flex items-center gap-2 text-lg tracking-tight">
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
        <footer className="border-t border-border px-4 py-6 text-center text-xs leading-relaxed text-muted">
          <p>
            Not affiliated with BMRCL. Fares and timings are estimates — check the official Namma Metro
            app before you travel.
          </p>
          <p className="mt-1">
            Station positions ©{" "}
            <a
              href="https://www.openstreetmap.org/copyright"
              className="underline underline-offset-2 hover:text-foreground"
              rel="noreferrer"
              target="_blank"
            >
              OpenStreetMap contributors
            </a>
            .
          </p>
        </footer>
      </body>
    </html>
  );
}
