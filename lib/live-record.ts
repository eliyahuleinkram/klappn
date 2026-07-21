"use client";

// --- LIVE RECORDING (the performance, taped) ------------------------------------
// A MediaRecorder on the BROADCAST tap (lib/strudel-client getBroadcastStream):
// music + mic + MIDI, post-limiter, post-perf-FX — byte-for-byte what listeners
// hear. It rides the tap node itself, so it survives voice/look changes, device
// swaps and the mic-aware pause (the tap keeps flowing). Stop hands the DJ the
// take as a download — nothing uploads, nothing is kept.

import {
  ensureEngineStarted,
  getBroadcastStream,
  getEngineAudioContext,
} from "@/lib/strudel-client";

// mime ladder: Opus-in-WebM everywhere it exists; Safari records AAC-in-MP4
// (no WebM encoder) — .m4a is the audio-mp4 name every player opens.
const MIMES: [mime: string, ext: string][] = [
  ["audio/webm;codecs=opus", "webm"],
  ["audio/webm", "webm"],
  ["audio/mp4", "m4a"],
];

let rec: { recorder: MediaRecorder; startedAt: number } | null = null;

/** Whether a take is rolling, and since when (ms epoch) — poll for the mm:ss. */
export function liveRecordingState(): { recording: boolean; startedAt: number | null } {
  return rec
    ? { recording: true, startedAt: rec.startedAt }
    : { recording: false, startedAt: null };
}

/** Start taping the broadcast. True when rolling (idempotent); false when
 *  there's no tap yet or the browser can't record. */
export function startLiveRecording(): boolean {
  if (rec) return true;
  if (typeof MediaRecorder === "undefined") return false;
  // THE TAKE STARTS AT THE TAP, not at first playback: a suspended context
  // produces NO frames, so a recorder armed before the music ever played
  // yielded a file that effectively began when the music did. Wake the engine
  // inside this same gesture (ensureEngineStarted = kick-resume + boot +
  // resume) — the recorder then captures real (silent) frames from this very
  // moment, exactly like a tape deck. Fire-and-forget: the tap below already
  // exists in every state the REC pill renders in.
  if (getEngineAudioContext()?.state !== "running") {
    void ensureEngineStarted().catch(() => {});
  }
  const stream = getBroadcastStream();
  if (!stream) return false;
  let mime = "";
  let ext = "webm";
  for (const [m, e] of MIMES) {
    try {
      if (MediaRecorder.isTypeSupported?.(m)) {
        mime = m;
        ext = e;
        break;
      }
    } catch {
      /* an odd UA throwing on probe — fall through to the default */
    }
  }
  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(
      stream,
      mime ? { mimeType: mime, audioBitsPerSecond: 128_000 } : undefined,
    );
  } catch {
    return false;
  }
  const chunks: Blob[] = [];
  const startedAt = Date.now();
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };
  recorder.onstop = () => {
    if (rec?.recorder === recorder) rec = null; // a track-ended stop, not ours
    const blob = new Blob(chunks, mime ? { type: mime } : undefined);
    if (!blob.size) return; // nothing landed — no empty file in the downloads
    // the filename stamps the performance's START, DJ-local time
    const d = new Date(startedAt);
    const p = (n: number) => String(n).padStart(2, "0");
    const name = `klappn-live-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(
      d.getDate(),
    )}-${p(d.getHours())}${p(d.getMinutes())}.${ext}`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
    // revoke off the click's tail — an instant revoke races the download
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    console.log(`[klappn] live recording saved — ${name} (${blob.size} bytes)`);
  };
  recorder.onerror = () => {
    // a dying recorder still flushes what it has — stop() runs onstop above
    try {
      if (recorder.state !== "inactive") recorder.stop();
    } catch {
      /* already down */
    }
  };
  try {
    // 1s timeslice: the take accrues as it rolls — a crash mid-set loses at
    // most the last second, never the whole performance
    recorder.start(1000);
  } catch {
    return false;
  }
  rec = { recorder, startedAt };
  return true;
}

/** Stop the take — the file assembles and downloads itself (onstop above).
 *  Safe when nothing is rolling. */
export function stopLiveRecording(): void {
  const r = rec;
  if (!r) return;
  rec = null; // state flips NOW; the download rides the recorder's own onstop
  try {
    if (r.recorder.state !== "inactive") r.recorder.stop();
  } catch {
    /* already down */
  }
}
