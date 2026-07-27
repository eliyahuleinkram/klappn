import type { Metadata } from "next";
import ZisslPlayground from "@/components/ZisslPlayground";

export const metadata: Metadata = {
  // zaltz is "the instrument you type" — zissl is its light. One family,
  // one grammar: you type, the room answers.
  title: "zissl — the light you type",
  description:
    "Hydra's language on WebGPU: one file of WGSL, the H() bridge to Strudel time, and a million-agent swarm the old machine could never run. Type a chain — the room lights up.",
  icons: {
    icon: [
      { url: "/zissl-icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/zissl-icon.svg", type: "image/svg+xml" },
    ],
    apple: "/zissl-icon-180.png",
  },
};

/** PUBLIC PLAYGROUND (zissl.klappn.com lands here) — no account, no gate:
 *  the engine and a text box. This is the demo site AND the proof: the same
 *  package that paints klappn.com and zaltz.klappn.com behind the scenes. */
export default function ZisslPage() {
  return <ZisslPlayground />;
}
