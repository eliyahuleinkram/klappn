import type { Metadata } from "next";
import ZaltzIDE from "@/components/ZaltzIDE";

export const metadata: Metadata = {
  title: "zaltz — the live-coding IDE",
  description:
    "Strudel on the left, Hydra on the right, our 165 KB wasm engine underneath. Type, ⌘↵, the room hears you — and the machine takes requests.",
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

/** PUBLIC IDE (zaltz.klappn.com lands here) — no account, no gate: play first,
 *  a guest session appears only when you save or ask the machine, and one
 *  email later it's all yours forever. */
export default function ZaltzPage() {
  return <ZaltzIDE />;
}
