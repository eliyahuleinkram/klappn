import type { Metadata } from "next";
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
