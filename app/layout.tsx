import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Mark } from "@/components/Mark";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Namma Metro Planner — Bengaluru metro routes, fares & timings",
    template: "%s · Namma Metro Planner",
  },
  description:
    "Plan Bengaluru metro trips offline. Real fares compared across token, mobile QR and Smart Card, next-train estimates, interchange guidance and first/last-mile options across the Purple, Green and Yellow lines.",
  manifest: "/manifest.webmanifest",
  applicationName: "Namma Metro Planner",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfaf9" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0d" },
  ],
  width: "device-width",
  initialScale: 1,
};

const NAV = [
  { href: "/map", label: "Map" },
  { href: "/offline", label: "Offline" },
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${archivo.variable} h-full`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col bg-paper font-sans text-ink antialiased">
        <ServiceWorkerRegistrar />

        <header className="sticky top-0 z-30 border-b border-hairline bg-paper/85 backdrop-blur-md">
          <div className="mx-auto flex h-14 max-w-3xl items-center gap-6 px-5">
            <Link
              href="/"
              className="flex items-center gap-2 text-[0.9375rem] font-semibold tracking-[-0.01em]"
            >
              <Mark />
              Namma Metro
            </Link>
            <nav className="ml-auto flex items-center gap-1">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-md px-2.5 py-1.5 text-sm text-ink-secondary transition-colors hover:bg-sunken hover:text-ink"
                >
                  {item.label}
                </Link>
              ))}
              <ThemeToggle />
            </nav>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="mt-20 border-t border-hairline">
          <div className="mx-auto max-w-3xl px-5 py-8 text-[0.8125rem] leading-relaxed text-ink-muted">
            <p className="max-w-xl">
              An independent project, not affiliated with BMRCL. Fares, timings and coordinates are
              modelled estimates — check the official Namma Metro app before you travel.
            </p>
            <p className="mt-2 text-ink-faint">Network data last verified September 2026.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
