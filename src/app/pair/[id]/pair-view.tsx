"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: { transcript: string; confidence: number };
}

interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

interface WordTimestamp {
  word: string;
  start: number;
  end: number;
}

interface Reaction {
  id: string;
  user_id: string;
  user_name: string;
  emoji: string;
  timestamp_seconds: number;
  created_at: string;
}

interface Waffle {
  id: string;
  sender_id: string;
  sender_name: string;
  duration_seconds: number;
  transcript: string;
  word_timestamps: string; // JSON array of WordTimestamp
  title: string;
  tags: string; // JSON array of strings
  reply_to_id: string | null;
  reply_to_timestamp: number | null;
  reactions: Reaction[];
  created_at: string;
}

const QUICK_EMOJIS = ["❤️", "😂", "🔥", "👏", "😮"];

const TALK_PROMPTS = [
  "What was the highlight of your week so far?",
  "What's something that made you laugh recently?",
  "What are you looking forward to this week?",
  "What's been on your mind lately?",
  "Describe your week in three words, then explain why.",
  "What's something new you tried or learned?",
  "If your week was a movie, what genre would it be?",
  "What's the best thing you ate this week?",
];

function getRandomPrompt() {
  return TALK_PROMPTS[Math.floor(Math.random() * TALK_PROMPTS.length)];
}

function WaffleEmptyIcon() {
  return (
    <svg
      viewBox="0 0 80 80"
      className="mx-auto mb-4 w-24 opacity-60"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Empty plate */}
      <ellipse cx="40" cy="58" rx="34" ry="10" fill="#f5e6d0" stroke="#d4b896" strokeWidth="1.5" />
      <ellipse cx="40" cy="56" rx="30" ry="8" fill="white" stroke="#e8c47a" strokeWidth="2" strokeDasharray="4 3" />
      {/* Waffle crumbs */}
      <rect x="26" y="48" width="6" height="6" rx="1" fill="#e8c47a" opacity="0.4" transform="rotate(15 29 51)" />
      <rect x="44" y="50" width="4" height="4" rx="1" fill="#e8c47a" opacity="0.3" transform="rotate(-10 46 52)" />
      <rect x="35" y="46" width="5" height="5" rx="1" fill="#e8c47a" opacity="0.35" />
      {/* Steam wisps suggesting warmth */}
      <path d="M34 40 C34 37 36 37 36 34" stroke="#c8913a" strokeWidth="1.5" strokeLinecap="round" opacity="0.2" className="steam-wisp" />
      <path d="M44 40 C44 37 46 37 46 34" stroke="#c8913a" strokeWidth="1.5" strokeLinecap="round" opacity="0.15" className="steam-wisp-delayed" />
    </svg>
  );
}

export function PairView({
  pairId,
  currentUserId,
}: {
  pairId: string;
  currentUserId: string;
}) {
  const [waffles, setWaffles] = useState<Waffle[]>([]);
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState(TALK_PROMPTS[0]);
  const [micError, setMicError] = useState<string | null>(null);
  const [reactionTarget, setReactionTarget] = useState<{
    waffleId: string;
    timestampSeconds: number;
  } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editTags, setEditTags] = useState("");
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<{
    waffleId: string;
    timestamp: number | null;
  } | null>(null);

  useEffect(() => {
    setPrompt(getRandomPrompt());
  }, []);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const transcriptRef = useRef<string>("");
  const wordTimestampsRef = useRef<WordTimestamp[]>([]);
  const recordingStartRef = useRef<number>(0);
  const lastResultTimeRef = useRef<number>(0);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const loadWaffles = useCallback(async () => {
    const res = await fetch(`/api/waffles/${pairId}`);
    if (res.ok) {
      const data = await res.json();
      setWaffles(data);
    }
  }, [pairId]);

  useEffect(() => {
    loadWaffles();
  }, [loadWaffles]);

  // Auto-scroll to bottom when waffles change (newest at bottom)
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

      timerRef.current = setInterval(() => {
        setRecordingTime((t) => t + 1);
      }, 1000);

      // Start speech recognition for transcription with word timestamps
      transcriptRef.current = "";
      wordTimestampsRef.current = [];
      const recStart = performance.now();
      recordingStartRef.current = recStart;
      lastResultTimeRef.current = recStart;
      const SpeechRecognitionAPI =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognitionAPI) {
        try {
          const recognition = new SpeechRecognitionAPI();
          recognition.continuous = true;
          recognition.interimResults = false;
          recognition.lang = "en-US";
          let aborted = false;
          recognition.onresult = (event: SpeechRecognitionEvent) => {
            const now = performance.now();
            for (let i = event.resultIndex; i < event.results.length; i++) {
              if (event.results[i].isFinal) {
                const text = event.results[i][0].transcript;
                transcriptRef.current += text;

                // Estimate word-level timestamps
                const words = text.trim().split(/\s+/).filter(Boolean);
                if (words.length > 0) {
                  const segStart = (lastResultTimeRef.current - recordingStartRef.current) / 1000;
                  const segEnd = (now - recordingStartRef.current) / 1000;
                  const wordDur = (segEnd - segStart) / words.length;
                  for (let j = 0; j < words.length; j++) {
                    wordTimestampsRef.current.push({
                      word: words[j],
                      start: segStart + j * wordDur,
                      end: segStart + (j + 1) * wordDur,
                    });
                  }
                }
              }
            }
            lastResultTimeRef.current = now;
          };
          recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
            // "no-speech" is normal; other errors mean we should stop trying
            if (event.error !== "no-speech") {
              aborted = true;
            }
          };
          recognition.onend = () => {
            if (aborted) return;
            // Recognition auto-stops periodically; restart if still recording
            if (mediaRecorder.current?.state === "recording") {
              try {
                recognition.start();
              } catch {
                // already started or stopped
              }
            }
          };
          recognition.start();
          recognitionRef.current = recognition;
        } catch {
          // SpeechRecognition not functional — continue without transcript
        }
      }
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      if (name === "NotAllowedError") {
        setMicError(
          "Microphone access was denied. To enable it, open your browser settings, find this site under permissions, and allow microphone access. Then try again."
        );
      } else if (name === "NotFoundError") {
        setMicError(
          "No microphone found. Please connect a microphone and try again."
        );
      } else {
        setMicError(
          "Could not access your microphone. Please check your browser settings and try again."
        );
      }
    }
  }

  async function stopRecording() {
    const duration = recordingTime;

    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }

    const transcript = transcriptRef.current.trim();
    const wordTimestamps = [...wordTimestampsRef.current];

    if (mediaRecorder.current && mediaRecorder.current.state !== "inactive") {
      mediaRecorder.current.onstop = async () => {
        mediaRecorder.current!.stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks.current, { type: "audio/webm" });
        await uploadWaffle(blob, duration, transcript, wordTimestamps);
      };
      mediaRecorder.current.stop();
    }
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }

  async function uploadWaffle(blob: Blob, duration: number, transcript: string, wordTimestamps: WordTimestamp[]) {
    setUploading(true);
    const formData = new FormData();
    formData.append("pairId", pairId);
    formData.append("audio", blob, "waffle.webm");
    formData.append("duration", String(duration));
    formData.append("transcript", transcript);
    if (wordTimestamps.length > 0) {
      formData.append("word_timestamps", JSON.stringify(wordTimestamps));
    }
    if (replyTo) {
      formData.append("reply_to_id", replyTo.waffleId);
      if (replyTo.timestamp != null) {
        formData.append("reply_to_timestamp", String(replyTo.timestamp));
      }
    }

    await fetch("/api/waffles", { method: "POST", body: formData });
    setUploading(false);
    setRecordingTime(0);
    setReplyTo(null);
    setPrompt(getRandomPrompt());
    loadWaffles();
  }

  function stopPlayback() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.ontimeupdate = null;
      audioRef.current.onloadedmetadata = null;
      audioRef.current = null;
    }
    setPlayingId(null);
    setPlaybackTime(0);
    setPlaybackDuration(0);
  }

  function playWaffle(id: string) {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.ontimeupdate = null;
      audioRef.current.onloadedmetadata = null;
      audioRef.current = null;
    }
    if (playingId === id) {
      stopPlayback();
      return;
    }
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

  function seekToTime(seconds: number) {
    if (audioRef.current) {
      audioRef.current.currentTime = seconds;
      setPlaybackTime(seconds);
    }
  }

  function parseTags(tags: string): string[] {
    if (!tags) return [];
    try { return JSON.parse(tags); } catch { return []; }
  }

  function startEditing(w: Waffle) {
    setEditingId(w.id);
    setEditTitle(w.title || "");
    setEditTags(parseTags(w.tags).join(", "));
  }

  async function saveMetadata(waffleId: string) {
    const tagList = editTags
      .split(/[,\s]+/)
      .map((t) => t.replace(/^#/, "").trim())
      .filter(Boolean);
    await fetch("/api/waffles", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        waffleId,
        title: editTitle,
        tags: JSON.stringify(tagList),
      }),
    });
    setEditingId(null);
    loadWaffles();
  }

  // Collect all unique tags for filter
  const allTags = Array.from(
    new Set(waffles.flatMap((w) => parseTags(w.tags)))
  );

  const filteredWaffles = filterTag
    ? waffles.filter((w) => parseTags(w.tags).includes(filterTag))
    : waffles;

  async function addReaction(waffleId: string, emoji: string, timestampSeconds: number) {
    await fetch(`/api/waffles/reactions/${waffleId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji, timestampSeconds }),
    });
    setReactionTarget(null);
    loadWaffles();
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
      {/* Waffles list */}
      {/* Tag filter bar */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-b border-waffle-light/30 px-2 py-2">
          <button
            onClick={() => setFilterTag(null)}
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold transition-all ${
              !filterTag
                ? "bg-waffle text-white"
                : "bg-butter text-waffle-dark hover:bg-butter-deep"
            }`}
          >
            All
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setFilterTag(filterTag === tag ? null : tag)}
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold transition-all ${
                filterTag === tag
                  ? "bg-waffle text-white"
                  : "bg-butter text-waffle-dark hover:bg-butter-deep"
              }`}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto pb-4">
        {filteredWaffles.length === 0 && !recording && (
          <div className="card-cottage bg-waffle-texture p-7 text-center">
            <WaffleEmptyIcon />
            <p className="font-display mb-2 text-lg font-semibold text-syrup">
              Your waffle plate is empty!
            </p>
            <p className="text-sm leading-relaxed text-waffle-dark/80">
              Record your first waffle below. Just talk about your week,
              what&apos;s on your mind, or anything at all. There&apos;s no wrong
              way to waffle.
            </p>
          </div>
        )}
        {filteredWaffles.map((w) => {
          const isMine = w.sender_id === currentUserId;
          const isPlaying = playingId === w.id;
          const isExpanded = expandedId === w.id;
          const wordTs: WordTimestamp[] = w.word_timestamps
            ? (() => { try { return JSON.parse(w.word_timestamps); } catch { return []; } })()
            : [];
          const progress = isPlaying && playbackDuration > 0
            ? playbackTime / playbackDuration
            : 0;
          return (
            <div
              key={w.id}
              className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}
            >
              {w.reply_to_id && (() => {
                const parent = waffles.find((p) => p.id === w.reply_to_id);
                if (!parent) return null;
                return (
                  <p className="mb-1 text-[10px] font-semibold text-waffle/60">
                    Replying to {parent.sender_name}
                    {w.reply_to_timestamp != null
                      ? ` at ${formatTime(w.reply_to_timestamp)}`
                      : ""}
                  </p>
                );
              })()}
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
                    <div className="mt-2">
                      <div
                        className="relative h-1.5 cursor-pointer rounded-full bg-waffle-light/30"
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const fraction = (e.clientX - rect.left) / rect.width;
                          seekAudio(fraction);
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          if (playbackDuration > 0) {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const fraction = (e.clientX - rect.left) / rect.width;
                            setReactionTarget({
                              waffleId: w.id,
                              timestampSeconds: fraction * playbackDuration,
                            });
                          }
                        }}
                      >
                        <div
                          className="h-full rounded-full bg-waffle transition-[width] duration-100"
                          style={{ width: `${progress * 100}%` }}
                        />
                        {/* Reaction markers on timeline */}
                        {w.reactions.map((r) => {
                          const pos = w.duration_seconds > 0
                            ? (r.timestamp_seconds / w.duration_seconds) * 100
                            : 0;
                          return (
                            <span
                              key={r.id}
                              className="absolute -top-3 text-xs"
                              style={{ left: `${pos}%`, transform: "translateX(-50%)" }}
                              title={`${r.user_name}: ${r.emoji}`}
                            >
                              {r.emoji}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {/* Reaction badges when not playing */}
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
                  {w.title && (
                    <p className="font-display mt-1 text-xs font-semibold">{w.title}</p>
                  )}
                  {parseTags(w.tags).length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {parseTags(w.tags).map((tag) => (
                        <span
                          key={tag}
                          onClick={(e) => {
                            e.stopPropagation();
                            setFilterTag(filterTag === tag ? null : tag);
                          }}
                          className="cursor-pointer rounded-full bg-waffle-light/20 px-1.5 py-0.5 text-[10px] font-semibold text-waffle hover:bg-waffle-light/40"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="mt-1 text-xs opacity-70">
                    {w.sender_name} &middot; {formatDate(w.created_at)}
                  </p>
                </div>
                {isMine && (
                  <button
                    onClick={() => editingId === w.id ? setEditingId(null) : startEditing(w)}
                    className={`rounded-lg border-2 px-2 py-1 text-[10px] font-semibold transition-all ${
                      editingId === w.id
                        ? "border-waffle bg-butter-deep text-syrup"
                        : "border-waffle-light/50 bg-butter text-waffle-dark hover:border-waffle hover:bg-butter-deep"
                    }`}
                    aria-label="Edit waffle"
                  >
                    Edit
                  </button>
                )}
                <button
                  onClick={() =>
                    setExpandedId(isExpanded ? null : w.id)
                  }
                  className={`rounded-lg border-2 px-2.5 py-1 text-xs font-semibold transition-all ${
                    isExpanded
                      ? "border-waffle bg-butter-deep text-syrup"
                      : "border-waffle-light/50 bg-butter text-waffle-dark hover:border-waffle hover:bg-butter-deep"
                  }`}
                  aria-label="Toggle transcript"
                >
                  Aa
                </button>
                <button
                  onClick={() => setReplyTo({ waffleId: w.id, timestamp: null })}
                  className="rounded-lg border-2 border-waffle-light/50 bg-butter px-2 py-1 text-[10px] font-semibold text-waffle-dark transition-all hover:border-waffle hover:bg-butter-deep"
                  aria-label="Reply to waffle"
                >
                  Reply
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
                  {w.transcript ? (
                    wordTs.length > 0 ? (
                      <span>
                        {wordTs.map((wt, idx) => {
                          const active = isPlaying &&
                            playbackTime >= wt.start &&
                            playbackTime < wt.end;
                          const wordReactions = w.reactions.filter(
                            (r) => r.timestamp_seconds >= wt.start && r.timestamp_seconds < wt.end
                          );
                          return (
                            <span key={idx} className="relative inline">
                              <span
                                onClick={() => {
                                  if (!isPlaying) playWaffle(w.id);
                                  if (isPlaying) seekToTime(wt.start);
                                  else setTimeout(() => seekToTime(wt.start), 300);
                                }}
                                onContextMenu={(e) => {
                                  e.preventDefault();
                                  setReactionTarget({
                                    waffleId: w.id,
                                    timestampSeconds: (wt.start + wt.end) / 2,
                                  });
                                }}
                                className={`cursor-pointer transition-colors ${
                                  active
                                    ? "rounded bg-waffle/20 font-semibold text-syrup"
                                    : "hover:text-waffle"
                                }`}
                              >
                                {wt.word}
                              </span>
                              {wordReactions.length > 0 && (
                                <span className="relative -top-2 -mr-0.5 text-[10px]">
                                  {wordReactions.map((r) => r.emoji).join("")}
                                </span>
                              )}
                              {idx < wordTs.length - 1 ? " " : ""}
                            </span>
                          );
                        })}
                      </span>
                    ) : (
                      <span
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setReactionTarget({ waffleId: w.id, timestampSeconds: 0 });
                        }}
                      >
                        {w.transcript}
                      </span>
                    )
                  ) : (
                    <span className="italic opacity-60">No transcript available</span>
                  )}
                </div>
              )}
              {editingId === w.id && (
                <div className="mt-2 w-full max-w-[280px] rounded-xl border-2 border-waffle bg-butter p-3">
                  <label className="text-xs font-semibold text-waffle-dark">Title</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="Optional title..."
                    className="mt-0.5 w-full rounded-lg border border-waffle-light/50 bg-cream px-2 py-1 text-sm text-waffle-dark outline-none focus:border-waffle"
                  />
                  <label className="mt-2 block text-xs font-semibold text-waffle-dark">
                    Tags <span className="font-normal opacity-60">(comma-separated)</span>
                  </label>
                  <input
                    type="text"
                    value={editTags}
                    onChange={(e) => setEditTags(e.target.value)}
                    placeholder="cooking, travel, funny..."
                    className="mt-0.5 w-full rounded-lg border border-waffle-light/50 bg-cream px-2 py-1 text-sm text-waffle-dark outline-none focus:border-waffle"
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => saveMetadata(w.id)}
                      className="rounded-lg bg-waffle px-3 py-1 text-xs font-semibold text-white hover:bg-syrup"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="text-xs font-semibold text-waffle-dark/50 hover:text-waffle-dark"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Emoji reaction picker */}
      {reactionTarget && (
        <div className="flex items-center justify-center gap-1 border-t border-waffle-light/30 bg-butter py-2">
          {QUICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() =>
                addReaction(reactionTarget.waffleId, emoji, reactionTarget.timestampSeconds)
              }
              className="rounded-lg px-2.5 py-1.5 text-lg transition-transform hover:scale-125 active:scale-95"
            >
              {emoji}
            </button>
          ))}
          <button
            onClick={() => setReactionTarget(null)}
            className="ml-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-waffle-dark/50 hover:text-waffle-dark"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Record area - sticky at bottom */}
      <div className="sticky bottom-0 mt-auto flex flex-col items-center border-t-2 border-dashed border-waffle-light/40 bg-cream pb-6 pt-5 safe-b">
        {/* Reply context */}
        {replyTo && (() => {
          const parent = waffles.find((w) => w.id === replyTo.waffleId);
          if (!parent) return null;
          return (
            <div className="mb-3 flex w-full items-center gap-2 rounded-xl border-2 border-waffle-light/40 bg-butter px-3 py-2">
              <div className="flex-1 text-xs">
                <span className="font-semibold text-waffle-dark">
                  Replying to {parent.sender_name}
                </span>
                {replyTo.timestamp != null && (
                  <span className="text-waffle/60"> at {formatTime(replyTo.timestamp)}</span>
                )}
                {parent.title && (
                  <span className="text-waffle/60"> &mdash; {parent.title}</span>
                )}
              </div>
              <button
                onClick={() => setReplyTo(null)}
                className="text-xs font-bold text-waffle-dark/40 hover:text-waffle-dark"
              >
                &times;
              </button>
            </div>
          );
        })()}
        {uploading ? (
          <div className="flex items-center gap-3">
            <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-waffle border-t-transparent" />
            <p className="font-display font-medium text-waffle-dark">Sending your waffle...</p>
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
            <p className="mt-3 text-sm font-medium text-waffle-dark/60">Tap to stop &amp; send</p>
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
            <div className="prompt-card mb-5 w-full p-4 text-center">
              <p className="font-display text-xs font-semibold uppercase tracking-widest text-waffle/80">
                Not sure what to say?
              </p>
              <p className="mt-1.5 text-sm font-medium leading-relaxed text-syrup">{prompt}</p>
              <button
                onClick={() => setPrompt(getRandomPrompt())}
                className="mt-2 text-xs font-bold text-waffle hover:text-syrup"
              >
                Another prompt &rarr;
              </button>
            </div>
            <button
              onClick={startRecording}
              className="btn-record"
              aria-label="Start recording"
            >
              <span className="relative z-10 block h-5 w-5 rounded-full bg-white shadow-sm" />
            </button>
            <p className="mt-3 text-sm font-medium text-waffle-dark/60">Tap to record a waffle</p>
          </>
        )}
      </div>
    </div>
  );
}
