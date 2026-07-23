"use client";

/**
 * CLOUDFLARE REALTIME SFU — browser WebRTC helper.
 *
 * The DJ's computer publishes ONE mix stream; every listener's phone pulls it.
 * The SFU fans it out, so the DJ uploads once no matter how big the crowd, and
 * the phone does zero synthesis — it just plays a stream (the one audio thing
 * iOS is rock-solid at). All signaling goes through /api/rtc so the Bearer
 * token never touches the browser.
 *
 * Non-trickle ICE: we wait for candidate gathering to finish so the SDP we send
 * is complete (no separate trickle channel needed). Recovery from a dropped
 * connection (a phone flipping WiFi↔cellular) is the CALLER's job — it watches
 * pc.connectionState and re-runs publish/subscribe from scratch, which is
 * simpler and more robust than an ICE-restart dance we can't easily verify.
 */

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.cloudflare.com:3478" }],
  bundlePolicy: "max-bundle",
};

async function sfu(
  path: string,
  method: string,
  body?: unknown,
  liveToken?: string,
): Promise<any> {
  // sessions/new takes NO body — sending "{}" trips the SFU's validator. Only
  // attach a body (and its content-type) when the caller actually gives one.
  // Anonymous listeners authenticate to the proxy with their live-link token.
  const headers: Record<string, string> = {
    ...(body !== undefined ? { "content-type": "application/json" } : {}),
    ...(liveToken ? { "x-live-token": liveToken } : {}),
  };
  const r = await fetch(`/api/rtc/${path}`, {
    method,
    ...(Object.keys(headers).length ? { headers } : {}),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!r.ok) throw new Error(`rtc ${path} → ${r.status}`);
  return r.json();
}

/** Make the mix resilient to packet loss (the #1 cause of "it just dropped out"
 *  on cellular): turn on Opus in-band FEC — each packet carries a low-bitrate
 *  copy of the previous one, so a single lost packet is reconstructed instead of
 *  heard as a gap — and lift the bitrate for quality + headroom. SDP-munged onto
 *  the Opus fmtp line of the publish offer, so both the local encoder and the
 *  SFU honour it. */
function tuneOpus(sdp: string): string {
  const rtpmap = sdp.match(/a=rtpmap:(\d+)\s+opus\/48000/i);
  if (!rtpmap) return sdp;
  const pt = rtpmap[1];
  const lines = sdp.split(/\r?\n/);
  // MUSIC-GRADE Opus: FEC on (packet loss concealed, not heard); DTX OFF —
  // silence suppression is for speech and CHOPS quiet musical tails; true
  // stereo both directions (stereo = decode, sprop-stereo = we SEND stereo);
  // 256k ceiling (Opus music transparency ~192k stereo — headroom above it,
  // and this is a CEILING: the sender's congestion control still adapts DOWN
  // for a weak uplink, and weak LISTENERS are covered by FEC/PLC — a high cap
  // never breaks a bad connection, it only feeds a good one).
  const wanted: [string, string][] = [
    ["useinbandfec", "1"],
    ["usedtx", "0"],
    ["stereo", "1"],
    ["sprop-stereo", "1"],
    ["maxaveragebitrate", "256000"],
  ];
  // UPSERT each param (the old code appended the whole block only when FEC was
  // absent — a browser default fmtp that already carried useinbandfec=1 kept
  // the 64k mono defaults for everything else).
  const upsert = (fmtp: string): string => {
    let out = fmtp;
    for (const [k, v] of wanted) {
      const re = new RegExp(`${k}=[^;\\s]*`);
      if (re.test(out)) out = out.replace(re, `${k}=${v}`);
      else out = `${out};${k}=${v}`;
    }
    return out;
  };
  let touched = false;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith(`a=fmtp:${pt} `)) {
      lines[i] = upsert(lines[i]);
      touched = true;
    }
  }
  if (!touched) {
    const params = wanted.map(([k, v]) => `${k}=${v}`).join(";");
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith(`a=rtpmap:${pt} opus`)) {
        lines.splice(i + 1, 0, `a=fmtp:${pt} ${params}`);
        break;
      }
    }
  }
  return lines.join("\r\n");
}

/** Resolve once ICE candidates are gathered (SDP complete), or after a cap —
 *  some networks never reach "complete" but have usable candidates by then. */
function waitIce(pc: RTCPeerConnection, capMs = 2500): Promise<void> {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      pc.removeEventListener("icegatheringstatechange", onChange);
      resolve();
    };
    const onChange = () => {
      if (pc.iceGatheringState === "complete") finish();
    };
    pc.addEventListener("icegatheringstatechange", onChange);
    setTimeout(finish, capMs);
  });
}

export interface Broadcast {
  pc: RTCPeerConnection;
  sessionId: string;
  audioTrack: string;
}

/**
 * PUBLISH the mix (DJ). Sends the stream's audio track as sendonly (with Opus
 * FEC for packet-loss resilience). Returns the session + track name to store in
 * the live state so listeners can find it. (Visuals aren't streamed — each
 * listener renders the Hydra natively; see lib/hydra-live.)
 */
export async function publishStream(stream: MediaStream): Promise<Broadcast> {
  const pc = new RTCPeerConnection(RTC_CONFIG);
  const audio = stream.getAudioTracks()[0];
  if (!audio) throw new Error("no audio track to publish");
  // This track is a synthesized MIX, not speech: the hint switches the encoder
  // out of voice mode (no aggressive noise/voice DSP, full-band music coding).
  try {
    audio.contentHint = "music";
  } catch {
    /* older engines without contentHint — harmless */
  }

  const audioTx = pc.addTransceiver(audio, { direction: "sendonly" });

  // Any failure past this point (SFU 5xx, SDP error, ICE timeout) must close the
  // peer connection — otherwise a flaky handshake leaks a live PC on the caller's
  // account, and the listen-side retry loop compounds it one-per-attempt.
  try {
    const { sessionId } = await sfu("sessions/new", "POST");
    const offer = await pc.createOffer();
    offer.sdp = tuneOpus(offer.sdp ?? ""); // FEC + bitrate before it's the local desc
    await pc.setLocalDescription(offer);
    await waitIce(pc); // embed candidates into the offer

    const audioName = "mix-audio";
    const res = await sfu(`sessions/${sessionId}/tracks/new`, "POST", {
      sessionDescription: { type: "offer", sdp: pc.localDescription!.sdp },
      tracks: [{ location: "local", mid: audioTx.mid ?? undefined, trackName: audioName }],
    });
    await pc.setRemoteDescription(res.sessionDescription);
    return { pc, sessionId, audioTrack: audioName };
  } catch (e) {
    try {
      pc.close();
    } catch {
      /* already gone */
    }
    throw e;
  }
}

/**
 * SUBSCRIBE to the DJ's tracks (listener). Returns a MediaStream to attach to
 * an <audio>/<video> element. The SFU offers; we answer, then renegotiate.
 */
export async function subscribe(
  djSessionId: string,
  trackNames: string[],
  targetStream?: MediaStream,
  liveToken?: string,
): Promise<{ pc: RTCPeerConnection; stream: MediaStream }> {
  const pc = new RTCPeerConnection(RTC_CONFIG);
  // Reuse a caller-supplied stream when given: on iOS the <audio> element must
  // be blessed by a user gesture, so the listener plays an (empty) stream in
  // the Join tap and we add the DJ's tracks into that SAME stream here — audio
  // then flows through the already-activated element with no second play().
  const stream = targetStream ?? new MediaStream();
  pc.addEventListener("track", (e) => {
    stream.addTrack(e.track);
  });

  // Close the PC on any handshake failure — the listener poll re-subscribes on a
  // fresh PC every ~1.5s during an SFU outage, so a leak here is unbounded.
  try {
    const { sessionId } = await sfu("sessions/new", "POST", undefined, liveToken);
    const res = await sfu(
      `sessions/${sessionId}/tracks/new`,
      "POST",
      {
        tracks: trackNames.map((trackName) => ({
          location: "remote",
          sessionId: djSessionId,
          trackName,
        })),
      },
      liveToken,
    );
    // Pulling remote tracks makes the SFU send US an offer.
    await pc.setRemoteDescription(res.sessionDescription);
    await pc.setLocalDescription(await pc.createAnswer());
    await waitIce(pc);
    await sfu(
      `sessions/${sessionId}/renegotiate`,
      "PUT",
      { sessionDescription: { type: "answer", sdp: pc.localDescription!.sdp } },
      liveToken,
    );
    return { pc, stream };
  } catch (e) {
    try {
      pc.close();
    } catch {
      /* already gone */
    }
    throw e;
  }
}

/** Dead for good — the caller should tear down and re-publish/re-subscribe. */
export function isDead(pc: RTCPeerConnection): boolean {
  return (
    pc.connectionState === "failed" ||
    pc.connectionState === "closed" ||
    pc.iceConnectionState === "failed"
  );
}
