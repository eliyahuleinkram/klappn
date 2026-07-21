/**
 * LOCK-SCREEN presence — navigator.mediaSession, done properly.
 *
 * When klappn plays (a song, or a set, or a live stream) and the phone locks or the
 * app backgrounds, iOS/Android show the OS now-playing card: artwork, title, what's
 * sounding, and transport buttons. Like Spotify. This module generates a branded
 * artwork image on a canvas (no asset fetch) and wires the metadata + action
 * handlers. Call `applyMediaSession` whenever the now-playing descriptor changes.
 */

interface MediaOpts {
  /** The big line — the song or set name. */
  title: string;
  /** The second line — what's sounding right now (loop / section), or the artist. */
  subtitle: string;
  /** Third line / grouping — "Set" · "Song" · "Live". */
  album?: string;
  playing: boolean;
  onPlay?: () => void;
  onPause?: () => void;
  onStop?: () => void;
  onNext?: () => void;
  onPrev?: () => void;
}

let cachedArt: { key: string; url: string } | null = null;

/** Wrap `text` into lines that fit `maxW`, bottom-aligned at `baselineY` (grows up).
 *  Returns nothing — draws directly. */
function drawWrapped(
  g: CanvasRenderingContext2D,
  text: string,
  x: number,
  baselineY: number,
  maxW: number,
  lineH: number,
  maxLines = 2,
): void {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (g.measureText(t).width > maxW && line) {
      lines.push(line);
      line = w;
    } else {
      line = t;
    }
  }
  if (line) lines.push(line);
  const shown = lines.slice(0, maxLines);
  if (lines.length > maxLines) shown[maxLines - 1] = `${shown[maxLines - 1].replace(/…$/, "")}…`;
  const startY = baselineY - (shown.length - 1) * lineH;
  shown.forEach((l, i) => g.fillText(l, x, startY + i * lineH));
}

/** Branded 512² artwork: the klappn pink aura + wordmark + what's playing. Cached. */
function makeArtwork(title: string, subtitle: string, album: string): string {
  const key = `${title}|${subtitle}|${album}`;
  if (cachedArt?.key === key) return cachedArt.url;
  try {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 512;
    const g = c.getContext("2d");
    if (!g) return "";
    // base: deep plum → near-black
    const base = g.createLinearGradient(0, 0, 0, 512);
    base.addColorStop(0, "#2a0d22");
    base.addColorStop(1, "#0b0710");
    g.fillStyle = base;
    g.fillRect(0, 0, 512, 512);
    // two soft pink auras (the app's breathing gradient language)
    const aura = (cx: number, cy: number, r: number, color: string) => {
      const rad = g.createRadialGradient(cx, cy, 0, cx, cy, r);
      rad.addColorStop(0, color);
      rad.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = rad;
      g.fillRect(0, 0, 512, 512);
    };
    aura(150, 150, 320, "rgba(255,99,193,0.55)"); // #ff63c1
    aura(400, 300, 300, "rgba(179,18,111,0.5)"); // #b3126f
    // legibility scrim at the bottom
    const scrim = g.createLinearGradient(0, 240, 0, 512);
    scrim.addColorStop(0, "rgba(0,0,0,0)");
    scrim.addColorStop(1, "rgba(0,0,0,0.62)");
    g.fillStyle = scrim;
    g.fillRect(0, 0, 512, 512);
    // wordmark
    g.fillStyle = "rgba(255,255,255,0.82)";
    g.font = "600 26px -apple-system, system-ui, sans-serif";
    g.fillText("KLAPPN", 44, 66);
    if (album) {
      g.fillStyle = "rgba(255,255,255,0.5)";
      g.font = "600 20px -apple-system, system-ui, sans-serif";
      const w = g.measureText(album.toUpperCase()).width;
      g.fillText(album.toUpperCase(), 512 - 44 - w, 64);
    }
    // title (bottom, wraps up to 2 lines)
    g.fillStyle = "#fff";
    g.font = "700 46px -apple-system, system-ui, sans-serif";
    drawWrapped(g, title, 44, 408, 424, 52, 2);
    // subtitle — what's sounding
    if (subtitle) {
      g.fillStyle = "rgba(255,255,255,0.82)";
      g.font = "500 26px -apple-system, system-ui, sans-serif";
      const sub = subtitle.length > 34 ? `${subtitle.slice(0, 33)}…` : subtitle;
      g.fillText(sub, 44, 452);
    }
    const url = c.toDataURL("image/png");
    cachedArt = { key, url };
    return url;
  } catch {
    return "";
  }
}

export function applyMediaSession(opts: MediaOpts): void {
  if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
  const ms = navigator.mediaSession;
  try {
    const art = makeArtwork(opts.title, opts.subtitle, opts.album || "");
    ms.metadata = new MediaMetadata({
      title: opts.title || "Klappn",
      artist: opts.subtitle || "Klappn",
      album: opts.album || "Klappn",
      ...(art ? { artwork: [{ src: art, sizes: "512x512", type: "image/png" }] } : {}),
    });
    ms.playbackState = opts.playing ? "playing" : "paused";
  } catch {
    /* MediaMetadata unsupported — the handlers below still help */
  }
  const set = (
    action: MediaSessionAction,
    handler: (() => void) | undefined,
  ) => {
    try {
      ms.setActionHandler(action, handler ? () => handler() : null);
    } catch {
      /* platform rejects this action — fine */
    }
  };
  set("play", opts.onPlay);
  set("pause", opts.onPause);
  set("stop", opts.onStop);
  set("nexttrack", opts.onNext);
  set("previoustrack", opts.onPrev);
}

export function clearMediaSession(): void {
  if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
  try {
    navigator.mediaSession.metadata = null;
    navigator.mediaSession.playbackState = "none";
  } catch {
    /* ignore */
  }
}
