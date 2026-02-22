"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface Comment {
  id: string;
  user_id: string;
  user_name: string;
  text: string;
  timestamp_seconds: number;
}

interface Waffle {
  id: string;
  sender_id: string;
  sender_name: string;
  duration_seconds: number;
  transcript: string;
  title: string;
  comments: Comment[];
  created_at: string;
}

interface Member {
  id: string;
  display_name: string;
  email: string;
}

export function CircleView({
  circleId,
  currentUserId,
}: {
  circleId: string;
  currentUserId: string;
}) {
  const [waffles, setWaffles] = useState<Waffle[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");

  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const transcriptRef = useRef<string>("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const loadData = useCallback(async () => {
    const res = await fetch(`/api/circles/${circleId}`);
    if (res.ok) {
      const data = await res.json();
      setWaffles(data.waffles);
      setMembers(data.members);
    }
  }, [circleId]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [waffles]);

  async function startRecording() {
    setMicError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "";
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunks.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.current.push(e.data); };
      mediaRecorder.current = recorder;
      recorder.start();
      setRecording(true);
      setRecordingTime(0);
      transcriptRef.current = "";
      timerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
    } catch { setMicError("Could not access your microphone."); }
  }

  async function stopRecording() {
    const duration = recordingTime;
    const transcript = transcriptRef.current.trim();
    if (mediaRecorder.current && mediaRecorder.current.state !== "inactive") {
      mediaRecorder.current.onstop = async () => {
        mediaRecorder.current!.stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks.current, { type: mediaRecorder.current?.mimeType || "audio/webm" });
        setUploading(true);
        const formData = new FormData();
        formData.append("circleId", circleId);
        formData.append("audio", blob, "waffle.webm");
        formData.append("duration", String(duration));
        formData.append("transcript", transcript);
        await fetch("/api/waffles", { method: "POST", body: formData });
        setUploading(false);
        setRecordingTime(0);
        loadData();
      };
      mediaRecorder.current.stop();
    }
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }

  const persistentAudioRef = useRef<HTMLAudioElement | null>(null);

  function getAudioElement(): HTMLAudioElement {
    if (!persistentAudioRef.current) {
      const el = document.createElement("audio");
      el.setAttribute("playsinline", "");
      el.setAttribute("webkit-playsinline", "");
      el.preload = "metadata";
      el.style.display = "none";
      document.body.appendChild(el);
      persistentAudioRef.current = el;
    }
    return persistentAudioRef.current;
  }

  useEffect(() => {
    return () => {
      if (persistentAudioRef.current) {
        persistentAudioRef.current.pause();
        persistentAudioRef.current.remove();
        persistentAudioRef.current = null;
      }
    };
  }, []);

  function stopPlayback() {
    const audio = persistentAudioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    audioRef.current = null;
    setPlayingId(null); setPlaybackTime(0); setPlaybackDuration(0);
  }

  function playWaffle(id: string) {
    if (playingId === id) { stopPlayback(); return; }
    const audio = getAudioElement();
    audio.pause();
    audio.src = `/api/waffles/audio/${id}`;
    audio.onended = () => stopPlayback();
    audio.onerror = (e) => {
      console.error("Audio error:", audio.error?.code, audio.error?.message, e);
      stopPlayback();
    };
    audio.ontimeupdate = () => setPlaybackTime(audio.currentTime);
    audio.onloadedmetadata = () => setPlaybackDuration(audio.duration);
    audio.load();
    audio.play().catch((err) => {
      console.error("Play failed:", err);
      stopPlayback();
    });
    audioRef.current = audio;
    setPlayingId(id); setPlaybackTime(0);
  }

  function seekAudio(fraction: number) {
    if (audioRef.current && playbackDuration > 0) {
      audioRef.current.currentTime = fraction * playbackDuration;
      setPlaybackTime(audioRef.current.currentTime);
    }
  }

  function seekToTime(seconds: number) {
    if (audioRef.current) { audioRef.current.currentTime = seconds; setPlaybackTime(seconds); }
  }

  async function addComment(waffleId: string) {
    if (!commentText.trim()) return;
    await fetch(`/api/waffles/comments/${waffleId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: commentText.trim(), timestampSeconds: playingId === waffleId ? playbackTime : 0 }),
    });
    setCommentText("");
    loadData();
  }

  async function createInvite() {
    const res = await fetch("/api/circles/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ circleId }),
    });
    if (res.ok) { const data = await res.json(); setInviteUrl(data.url); }
  }

  async function copyLink() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function formatTime(seconds: number) {
    const total = Math.floor(seconds);
    return `${Math.floor(total / 60)}:${(total % 60).toString().padStart(2, "0")}`;
  }

  function formatDate(iso: string) {
    return new Date(iso + "Z").toLocaleDateString("en-US", {
      weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Members bar */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-waffle-dark/60">Members:</span>
        {members.map((m) => (
          <span key={m.id} className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            m.id === currentUserId ? "bg-waffle text-white" : "bg-butter text-waffle-dark"
          }`}>{m.display_name}</span>
        ))}
        {inviteUrl ? (
          <button onClick={copyLink} className="rounded-full bg-butter-deep px-2 py-0.5 text-xs font-semibold text-syrup">
            {copied ? "Copied!" : "Copy invite link"}
          </button>
        ) : (
          <button onClick={createInvite} className="rounded-full bg-butter-deep px-2 py-0.5 text-xs font-semibold text-syrup">
            + Invite
          </button>
        )}
      </div>

      {/* Waffles list */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto pb-4">
        {waffles.length === 0 && !recording && (
          <div className="card-cottage bg-waffle-texture p-7 text-center">
            <p className="font-display mb-2 text-lg font-semibold text-syrup">No waffles yet!</p>
            <p className="text-sm leading-relaxed text-waffle-dark/80">Record the first waffle below.</p>
          </div>
        )}
        {waffles.map((w) => {
          const isMine = w.sender_id === currentUserId;
          const isExpanded = expandedId === w.id;
          const isPlaying = playingId === w.id;
          const progress = isPlaying && playbackDuration > 0 ? playbackTime / playbackDuration : 0;
          return (
            <div key={w.id} className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}>
              <div
                onClick={() => { setExpandedId(isExpanded ? null : w.id); setCommentText(""); }}
                className={`max-w-[320px] cursor-pointer px-4 py-3 transition-all ${
                  isMine ? "bubble-mine" : "bubble-theirs"
                } ${isExpanded ? "ring-2 ring-waffle-light ring-offset-2" : ""}`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{isPlaying ? "⏸" : "▶"}</span>
                  <span className="font-display text-sm font-semibold">{formatTime(w.duration_seconds)}</span>
                  {w.comments.length > 0 && (
                    <span className="rounded-full bg-waffle-light/30 px-1.5 py-0.5 text-[10px] font-semibold text-waffle-dark/70">
                      {w.comments.length} comment{w.comments.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                {w.title && <p className="mt-1 text-xs font-medium opacity-80">{w.title}</p>}
                <p className="mt-1 text-xs font-semibold opacity-80">{w.sender_name}</p>
                <p className="text-xs opacity-60">{formatDate(w.created_at)}</p>
              </div>

              {isExpanded && (
                <div className={`mt-2 w-full max-w-[340px] rounded-xl border-2 border-dashed p-4 ${
                  isMine ? "border-waffle-light/50 bg-butter" : "border-waffle-light/30 bg-cream"
                }`}>
                  <div className="mb-3 flex items-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); playWaffle(w.id); }}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-waffle text-white"
                    >
                      <span className="text-sm">{isPlaying ? "⏸" : "▶"}</span>
                    </button>
                    <div className="flex-1">
                      <div
                        className="h-2 cursor-pointer rounded-full bg-waffle-light/30"
                        onClick={(e) => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); seekAudio((e.clientX - r.left) / r.width); }}
                      >
                        <div className="h-full rounded-full bg-waffle transition-[width] duration-100" style={{ width: `${progress * 100}%` }} />
                      </div>
                      <div className="mt-0.5 flex justify-between text-[10px] text-waffle-dark/50">
                        <span>{isPlaying ? formatTime(playbackTime) : "0:00"}</span>
                        <span>{formatTime(isPlaying && playbackDuration ? playbackDuration : w.duration_seconds)}</span>
                      </div>
                    </div>
                  </div>

                  {w.transcript && (
                    <div className="mb-3 rounded-lg bg-white/40 p-2 text-xs leading-relaxed text-waffle-dark/80">
                      {w.transcript}
                    </div>
                  )}

                  {w.comments.length > 0 && (
                    <div className="mb-3 space-y-1.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-waffle-dark/40">Comments</p>
                      {w.comments.map((c) => (
                        <div
                          key={c.id}
                          onClick={(e) => { e.stopPropagation(); if (!isPlaying) playWaffle(w.id); if (isPlaying) seekToTime(c.timestamp_seconds); else setTimeout(() => seekToTime(c.timestamp_seconds), 300); }}
                          className="flex cursor-pointer gap-2 rounded-lg bg-white/30 px-2 py-1.5 text-xs hover:bg-white/50"
                        >
                          <span className="shrink-0 font-mono text-[10px] text-waffle/60">{formatTime(c.timestamp_seconds)}</span>
                          <span className="text-waffle-dark/80"><span className="font-semibold">{c.user_name}:</span> {c.text}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="text" value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addComment(w.id)}
                      placeholder={isPlaying ? `Comment at ${formatTime(playbackTime)}...` : "Add a comment..."}
                      className="flex-1 rounded-lg border border-waffle-light/40 bg-white/50 px-2 py-1.5 text-xs text-waffle-dark outline-none placeholder:text-waffle-dark/30 focus:border-waffle"
                    />
                    <button onClick={() => addComment(w.id)} disabled={!commentText.trim()} className="rounded-lg bg-waffle px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-30">
                      Send
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Record area */}
      <div className="sticky bottom-0 mt-auto flex flex-col items-center border-t-2 border-dashed border-waffle-light/40 bg-cream pb-6 pt-5 safe-b">
        {uploading ? (
          <div className="flex items-center gap-3">
            <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-waffle border-t-transparent" />
            <p className="font-display font-medium text-waffle-dark">Sending your waffle...</p>
          </div>
        ) : recording ? (
          <>
            <p className="mb-3 font-mono text-2xl font-bold text-red-600 tabular-nums">{formatTime(recordingTime)}</p>
            <button onClick={stopRecording} className="btn-record btn-record-active" aria-label="Stop recording">
              <span className="relative z-10 block h-7 w-7 rounded bg-white" />
            </button>
            <p className="mt-3 text-sm font-medium text-waffle-dark/60">Tap to stop &amp; send</p>
          </>
        ) : (
          <>
            {micError && (
              <div className="mb-4 w-full rounded-xl border-2 border-red-200 bg-red-50 p-4 text-left">
                <p className="font-display text-sm font-semibold text-red-800">Microphone unavailable</p>
                <p className="mt-1 text-sm leading-relaxed text-red-600">{micError}</p>
                <button onClick={() => setMicError(null)} className="mt-2 text-xs font-bold text-red-400 hover:text-red-600">Dismiss</button>
              </div>
            )}
            <button onClick={startRecording} className="btn-record" aria-label="Start recording">
              <span className="relative z-10 block h-5 w-5 rounded-full bg-white shadow-sm" />
            </button>
            <p className="mt-3 text-sm font-medium text-waffle-dark/60">Tap to record a waffle</p>
            <p className="mt-2 text-[11px] text-waffle-dark/40">
              Voice messages are kept for 7 days. Transcripts are saved forever.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
