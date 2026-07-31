import type { Metadata } from "next";
import ZaltzSite from "@/components/ZaltzSite";

export const metadata: Metadata = {
  // zaltz is the ENGINE's name — never the room's. The room is Klappn's
  // engine room; this is the free software underneath it.
  title: "zaltz — the instrument you type",
  description:
    "A live-coding audio engine in C, compiled to WebAssembly, running on the audio thread: superdough's sound rebuilt so nothing allocates while it plays. Nine distortion algorithms, a phase vocoder, an FDN room, per-orbit buses. AGPL, on npm.",
  icons: {
    icon: [
      { url: "/zaltz-icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/zaltz-icon.svg", type: "image/svg+xml" },
    ],
    apple: "/zaltz-icon-180.png",
  },
};

/** THE ENGINE'S FRONT DOOR (zaltz.klappn.com lands here — a rewrite, never a
 *  redirect). Deliberately NOT the IDE: the instrument lives at
 *  klappn.com/engine. This page is the open-source shop window, the same
 *  shape zissl.klappn.com wears for the picture engine. */
export default function ZaltzPage() {
  return <ZaltzSite />;
}
