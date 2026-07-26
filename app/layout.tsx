import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import NowPlayingDock from "@/components/NowPlayingDock";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Klappn",
  description: "Describe a sound. Get editable, playable loops.",
  icons: {
    // SVG primary (crisp, scalable — Chrome/Safari 16.4+/Firefox). app/favicon.ico
    // is auto-served at /favicon.ico as the legacy + bare-probe raster fallback —
    // it is now a rasterization of THIS same mark, so whichever a browser picks,
    // it shows the current logo.
    icon: { url: "/icon.svg", type: "image/svg+xml", sizes: "any" },
    // iOS ignores SVG for the home-screen icon — it requires a PNG.
    apple: { url: "/apple-icon.png", sizes: "180x180", type: "image/png" },
  },
  manifest: "/manifest.webmanifest",
};

/* Notched devices (2026-07-26): viewport-fit=cover lets the page paint to the
   physical edges of the glass; the safe-area env() insets (globals.css) then
   keep content out of the notch and home indicator. themeColor paints the
   browser chrome the stage's own black.
   ⚠ vinext's metadata shim has no `viewportFit` case (it renders width/scale/
   themeColor only), so the directive rides inside `width` — the shim string-
   interpolates it verbatim into the meta content, which the viewport parser
   reads as two ordinary key=value pairs. If we ever move to stock Next.js,
   replace with `width: "device-width", viewportFit: "cover"`. */
export const viewport: Viewport = {
  width: "device-width, viewport-fit=cover",
  themeColor: "#060708",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        {/* the music rides along — the floating player for whatever's sounding
            while you're anywhere other than its own page */}
        <NowPlayingDock />
      </body>
    </html>
  );
}
