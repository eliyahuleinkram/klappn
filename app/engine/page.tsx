import type { Metadata } from "next";
import ZaltzPlayground from "@/components/ZaltzPlayground";

export const metadata: Metadata = {
  title: "zaltz — the engine, live",
  description:
    "A Strudel-compatible audio engine in one file of C — 165 KB of wasm in an AudioWorklet. Type a pattern, hear it render.",
  // The grain, not the Klappn mark: SVG for the browsers that take it, PNG for
  // the rest; the worker also answers /favicon.ico host-aware for Safari.
  icons: {
    icon: [
      { url: "/zaltz-icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/zaltz-icon.svg", type: "image/svg+xml" },
    ],
    apple: "/zaltz-icon-180.png",
  },
};

/** PUBLIC playground (zaltz.klappn.com lands here) — no account, no gate:
 *  the demo for the open-source release. */
export default function ZaltzPage() {
  return <ZaltzPlayground />;
}
