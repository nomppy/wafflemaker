"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface Reaction {
  id: string;
  user_id: string;
  user_name: string;
  emoji: string;
  timestamp_seconds: number;
}

interface Waffle {
  id: string;
  sender_id: string;
  sender_name: string;
  duration_seconds: number;
  transcript: string;
  reactions: Reaction[];
  created_at: string;
}

interface Member {
  id: string;
  display_name: string;
  email: string;
}

const QUICK_EMOJIS = ["❤️", "😂", "🔥", "👏", "😮"];

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

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [waffles]);

  async function startRecording() {
    setMicError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunks.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };
      mediaRecorder.current = recorder;
      recorder.start();
      setRecording(true);
      setRecordingTime(0);
      transcriptRef.current = "";
      timerRef.current = setInterval(() => {
        setRecordingTime((t) => t + 1);
      }, 1000);
    } catch {
      setMicError("Could not access your microphone.");
    }
  }

  async function stopRecording() {
    const duration = recordingTime;
    const transcript = transcriptRef.current.trim();
    if (mediaRecorder.current && mediaRecorder.current.state !== "inactive") {
      mediaRecorder.current.onstop = async () => {
        mediaRecorder.current!.stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks.current, { type: "audio/webm" });
        await uploadWaffle(blob, duration, transcript);
      };
      mediaRecorder.current.stop();
    }
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }

  async function uploadWaffle(blob: Blob, duration: number, transcript: string) {
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
  }

  function stopPlayback() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlayingId(null);
    setPlaybackTime(0);
    setPlaybackDuration(0);
  }

  function playWaffle(id: string) {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (playingId === id) { stopPlayback(); return; }
    const audio = new Audio(`/api/waffles/audio/${id}`);
    audio.onended = () => stopPlayback();
    audio.onerror = () => stopPlayback();
    audio.ontimeupdate = () => setPlaybackTime(audio.currentTime);
    audio.onloadedmetadata = () => setPlaybackDuration(audio.duration);
    audio.play().catch(() => stopPlayback());
    audioRef.current = audio;
    setPlayingId(id);
    setPlaybackTime(0);
  }

  function seekAudio(fraction: number) {
    if (audioRef.current && playbackDuration > 0) {
      audioRef.current.currentTime = fraction * playbackDuration;
      setPlaybackTime(audioRef.current.currentTime);
    }
  }

  async function createInvite() {
    const res = await fetch("/api/circles/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ circleId }),
    });
    if (res.ok) {
      const data = await res.json();
      setInviteUrl(data.url);
    }
  }

  async function copyLink() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function formatTime(seconds: number) {
    const total = Math.floor(seconds);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  function formatDate(iso: string) {
    const d = new Date(iso + "Z");
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Members bar */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-waffle-dark/60">Members:</span>
        {members.map((m) => (
          <span
            key={m.id}
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
              m.id === currentUserId
                ? "bg-waffle text-white"
                : "bg-butter text-waffle-dark"
            }`}
          >
            {m.display_name}
          </span>
        ))}
        {inviteUrl ? (
          <button
            onClick={copyLink}
            className="rounded-full bg-butter-deep px-2 py-0.5 text-xs font-semibold text-syrup hover:bg-waffle-light/40"
          >
            {copied ? "Copied!" : "Copy invite link"}
          </button>
        ) : (
          <button
            onClick={createInvite}
            className="rounded-full bg-butter-deep px-2 py-0.5 text-xs font-semibold text-syrup hover:bg-waffle-light/40"
          >
            + Invite
          </button>
        )}
      </div>

      {/* Waffles list */}
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto pb-4">
        {waffles.length === 0 && !recording && (
          <div className="card-cottage bg-waffle-texture p-7 text-center">
            <p className="font-display mb-2 text-lg font-semibold text-syrup">
              No waffles yet!
            </p>
            <p className="text-sm leading-relaxed text-waffle-dark/80">
              Record the first waffle for this circle below.
            </p>
          </div>
        )}
        {waffles.map((w) => {
          const isMine = w.sender_id === currentUserId;
          const isPlaying = playingId === w.id;
          const isExpanded = expandedId === w.id;
          const progress = isPlaying && playbackDuration > 0
            ? playbackTime / playbackDuration : 0;
          return (
            <div
              key={w.id}
              className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}
            >
              <div className="flex items-center gap-1.5">
                <div
                  className={`px-4 py-3 transition-all ${
                    isMine ? "bubble-mine" : "bubble-theirs"
                  } ${isPlaying ? "ring-2 ring-waffle-light ring-offset-2" : ""}`}
                >
                  <button
                    onClick={() => playWaffle(w.id)}
                    className="flex w-full items-center gap-2"
                  >
                    <span className="text-lg">{isPlaying ? "⏸" : "▶"}</span>
                    <span className="font-display text-sm font-semibold">
                      {isPlaying
                        ? `${formatTime(playbackTime)} / ${formatTime(playbackDuration || w.duration_seconds)}`
                        : formatTime(w.duration_seconds)}
                    </span>
                  </button>
                  {isPlaying && (
                    <div
                      className="mt-2 h-1.5 cursor-pointer rounded-full bg-waffle-light/30"
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        seekAudio((e.clientX - rect.left) / rect.width);
                      }}
                    >
                      <div
                        className="h-full rounded-full bg-waffle transition-[width] duration-100"
                        style={{ width: `${progress * 100}%` }}
                      />
                    </div>
                  )}
                  {!isPlaying && w.reactions.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {Object.entries(
                        w.reactions.reduce<Record<string, number>>((acc, r) => {
                          acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                          return acc;
                        }, {})
                      ).map(([emoji, count]) => (
                        <span
                          key={emoji}
                          className="rounded-full border border-waffle-light/40 bg-butter px-1.5 py-0.5 text-xs"
                        >
                          {emoji}{count > 1 ? ` ${count}` : ""}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="mt-1 text-xs font-semibold opacity-80">
                    {w.sender_name}
                  </p>
                  <p className="text-xs opacity-60">{formatDate(w.created_at)}</p>
                </div>
                <button
                  onClick={() => setExpandedId(isExpanded ? null : w.id)}
                  className={`rounded-lg border-2 px-2.5 py-1 text-xs font-semibold transition-all ${
                    isExpanded
                      ? "border-waffle bg-butter-deep text-syrup"
                      : "border-waffle-light/50 bg-butter text-waffle-dark hover:border-waffle hover:bg-butter-deep"
                  }`}
                  aria-label="Toggle transcript"
                >
                  Aa
                </button>
              </div>
              {isExpanded && (
                <div
                  className={`mt-2 max-w-[280px] rounded-xl border-2 border-dashed p-3 text-sm leading-relaxed ${
                    isMine
                      ? "border-waffle-light/50 bg-butter text-syrup"
                      : "border-waffle-light/30 bg-cream text-waffle-dark"
                  }`}
                >
                  {w.transcript || (
                    <span className="italic opacity-60">No transcript available</span>
                  )}
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
            <p className="font-display font-medium text-waffle-dark">
              Sending your waffle...
            </p>
          </div>
        ) : recording ? (
          <>
            <p className="mb-3 font-mono text-2xl font-bold text-red-600 tabular-nums">
              {formatTime(recordingTime)}
            </p>
            <button
              onClick={stopRecording}
              className="btn-record btn-record-active"
              aria-label="Stop recording"
            >
              <span className="relative z-10 block h-7 w-7 rounded bg-white" />
            </button>
            <p className="mt-3 text-sm font-medium text-waffle-dark/60">
              Tap to stop &amp; send
            </p>
          </>
        ) : (
          <>
            {micError && (
              <div className="mb-4 w-full rounded-xl border-2 border-red-200 bg-red-50 p-4 text-left">
                <p className="font-display text-sm font-semibold text-red-800">
                  Microphone unavailable
                </p>
                <p className="mt-1 text-sm leading-relaxed text-red-600">{micError}</p>
                <button
                  onClick={() => setMicError(null)}
                  className="mt-2 text-xs font-bold text-red-400 hover:text-red-600"
                >
                  Dismiss
                </button>
              </div>
            )}
            <button
              onClick={startRecording}
              className="btn-record"
              aria-label="Start recording"
            >
              <span className="relative z-10 block h-5 w-5 rounded-full bg-white shadow-sm" />
            </button>
            <p className="mt-3 text-sm font-medium text-waffle-dark/60">
              Tap to record a waffle
            </p>
          </>
        )}
      </div>
    </div>
  );
}
