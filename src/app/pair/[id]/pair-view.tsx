"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { WaffleRecorder } from "@/components/waffle-recorder";
import { InlineNotificationSettings } from "@/components/notification-toggle";
import { StrictModeToggle } from "@/components/strict-mode";
import { exportSingleWaffle, DownloadButton } from "@/components/waffle-export";
import { SpeedControl, usePlaybackSpeed } from "@/components/speed-control";

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

interface Comment {
  id: string;
  user_id: string;
  user_name: string;
  text: string;
  timestamp_seconds: number;
  created_at: string;
}

interface Waffle {
  id: string;
  sender_id: string;
  sender_name: string;
  duration_seconds: number;
  transcript: string;
  word_timestamps: string;
  title: string;
  tags: string;
  comments: Comment[];
  created_at: string;
}

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
      <ellipse cx="40" cy="58" rx="34" ry="10" fill="#f5e6d0" stroke="#d4b896" strokeWidth="1.5" />
      <ellipse cx="40" cy="56" rx="30" ry="8" fill="white" stroke="#e8c47a" strokeWidth="2" strokeDasharray="4 3" />
      <rect x="26" y="48" width="6" height="6" rx="1" fill="#e8c47a" opacity="0.4" transform="rotate(15 29 51)" />
      <rect x="44" y="50" width="4" height="4" rx="1" fill="#e8c47a" opacity="0.3" transform="rotate(-10 46 52)" />
      <rect x="35" y="46" width="5" height="5" rx="1" fill="#e8c47a" opacity="0.35" />
      <path d="M34 40 C34 37 36 37 36 34" stroke="#c8913a" strokeWidth="1.5" strokeLinecap="round" opacity="0.2" />
      <path d="M44 40 C44 37 46 37 46 34" stroke="#c8913a" strokeWidth="1.5" strokeLinecap="round" opacity="0.15" />
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
  const [commentText, setCommentText] = useState("");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [showTranscriptId, setShowTranscriptId] = useState<string | null>(null);
  const [editingTranscript, setEditingTranscript] = useState("");
  const [savingTranscript, setSavingTranscript] = useState(false);
  const [showUnpair, setShowUnpair] = useState(false);
  const [unpairing, setUnpairing] = useState(false);
  const [pendingWaffle, setPendingWaffle] = useState<{
    blob: Blob;
    duration: number;
    transcript: string;
    wordTimestamps: WordTimestamp[];
  } | null>(null);
  const [pendingDescription, setPendingDescription] = useState("");

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

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
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

      transcriptRef.current = "";
      wordTimestampsRef.current = [];
      setLiveTranscript("");
      const recStart = performance.now();
      recordingStartRef.current = recStart;
      lastResultTimeRef.current = recStart;
      const SpeechRecognitionAPI =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognitionAPI) {
        try {
          const recognition = new SpeechRecognitionAPI();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = "en-US";
          let aborted = false;
          let interimText = "";
          recognition.onresult = (event: SpeechRecognitionEvent) => {
            const now = performance.now();
            interimText = "";
            for (let i = event.resultIndex; i < event.results.length; i++) {
              const text = event.results[i][0].transcript;
              if (event.results[i].isFinal) {
                transcriptRef.current += text;
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
                lastResultTimeRef.current = now;
              } else {
                interimText += text;
              }
            }
            setLiveTranscript(transcriptRef.current + interimText);
          };
          recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
            if (event.error !== "no-speech") aborted = true;
          };
          recognition.onend = () => {
            if (aborted) return;
            if (mediaRecorder.current?.state === "recording") {
              try { recognition.start(); } catch { /* noop */ }
            }
          };
          recognition.start();
          recognitionRef.current = recognition;
        } catch { /* noop */ }
      }
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      if (name === "NotAllowedError") {
        setMicError("Microphone access was denied. Open browser settings to allow microphone access, then try again.");
      } else if (name === "NotFoundError") {
        setMicError("No microphone found. Please connect a microphone and try again.");
      } else {
        setMicError("Could not access your microphone. Please check your browser settings and try again.");
      }
    }
  }

  async function stopRecording() {
    const duration = recordingTime;
    // Stop speech recognition — this triggers the final onresult
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    if (mediaRecorder.current && mediaRecorder.current.state !== "inactive") {
      mediaRecorder.current.onstop = () => {
        mediaRecorder.current!.stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks.current, { type: mediaRecorder.current?.mimeType || "audio/webm" });
        // Capture transcript AFTER MediaRecorder stops — by this point
        // the final speech recognition result has arrived via onresult
        const transcript = transcriptRef.current.trim();
        const wordTimestamps = [...wordTimestampsRef.current];
        setPendingWaffle({ blob, duration, transcript, wordTimestamps });
        setPendingDescription("");
      };
      mediaRecorder.current.stop();
    }
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }

  async function sendPendingWaffle() {
    if (!pendingWaffle) return;
    setUploading(true);
    const { blob, duration, transcript, wordTimestamps } = pendingWaffle;
    const formData = new FormData();
    formData.append("pairId", pairId);
    formData.append("audio", blob, "waffle.webm");
    formData.append("duration", String(duration));
    formData.append("transcript", transcript);
    if (wordTimestamps.length > 0) {
      formData.append("word_timestamps", JSON.stringify(wordTimestamps));
    }
    if (pendingDescription.trim()) {
      formData.append("title", pendingDescription.trim());
    }
    await fetch("/api/waffles", { method: "POST", body: formData });
    setPendingWaffle(null);
    setPendingDescription("");
    setUploading(false);
    setRecordingTime(0);
    setLiveTranscript("");
    setPrompt(getRandomPrompt());
    loadWaffles();
  }

  function discardPendingWaffle() {
    setPendingWaffle(null);
    setPendingDescription("");
    setRecordingTime(0);
    setLiveTranscript("");
  }

  // Use a persistent <audio> element for iOS Safari compatibility.
  // iOS requires play() in the same user gesture and from a DOM element.
  const persistentAudioRef = useRef<HTMLAudioElement | null>(null);
  const { speed, updateSpeed } = usePlaybackSpeed(persistentAudioRef);

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

  // Clean up on unmount
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
    setPlayingId(null);
    setPlaybackTime(0);
    setPlaybackDuration(0);
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

  async function addComment(waffleId: string) {
    if (!commentText.trim()) return;
    await fetch(`/api/waffles/comments/${waffleId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: commentText.trim(),
        timestampSeconds: playingId === waffleId ? playbackTime : 0,
      }),
    });
    setCommentText("");
    loadWaffles();
  }

  async function saveDescription(waffleId: string, title: string) {
    await fetch("/api/waffles", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ waffleId, title }),
    });
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

  async function handleUnpair() {
    setUnpairing(true);
    const res = await fetch(`/api/pairs/${pairId}/unpair`, { method: "POST" });
    if (res.ok) {
      window.location.href = "/dashboard";
    } else {
      setUnpairing(false);
      setShowUnpair(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Settings bar */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <InlineNotificationSettings targetType="pair" targetId={pairId} />
          <StrictModeToggle targetType="pair" targetId={pairId} />
        </div>
        <div className="flex items-center gap-3">
        {showUnpair ? (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
            <span className="text-xs text-red-700">Remove this pair?</span>
            <button
              onClick={handleUnpair}
              disabled={unpairing}
              className="rounded-md bg-red-600 px-2 py-0.5 text-[10px] font-semibold text-white disabled:opacity-50"
            >
              {unpairing ? "Removing..." : "Yes, unpair"}
            </button>
            <button
              onClick={() => setShowUnpair(false)}
              className="text-[10px] font-semibold text-red-400 hover:text-red-600"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowUnpair(true)}
            className="text-[11px] font-semibold text-waffle-dark/30 hover:text-red-500 transition-colors"
          >
            Unpair
          </button>
        )}
        </div>
      </div>
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto pb-4">
        {waffles.length === 0 && !recording && (
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
        {waffles.map((w) => {
          const isMine = w.sender_id === currentUserId;
          const isExpanded = expandedId === w.id;
          const isPlaying = playingId === w.id;
          const wordTs: WordTimestamp[] = w.word_timestamps
            ? (() => { try { return JSON.parse(w.word_timestamps); } catch { return []; } })()
            : [];
          const progress = isPlaying && playbackDuration > 0
            ? playbackTime / playbackDuration : 0;

          return (
            <div
              key={w.id}
              className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}
            >
              {/* Collapsed card — tap to expand */}
              <div
                onClick={() => {
                  if (isExpanded) {
                    setExpandedId(null);
                  } else {
                    setExpandedId(w.id);
                    setCommentText("");
                  }
                }}
                className={`max-w-[320px] cursor-pointer px-4 py-3 transition-all ${
                  isMine ? "bubble-mine" : "bubble-theirs"
                } ${isExpanded ? "ring-2 ring-waffle-light ring-offset-2" : ""}`}
              >
                <div className="flex items-center gap-2">
                  {isPlaying ? (
                    <svg viewBox="0 0 16 16" className="w-4 h-4 fill-current"><rect x="3" y="2" width="3.5" height="12" rx="1"/><rect x="9.5" y="2" width="3.5" height="12" rx="1"/></svg>
                  ) : (
                    <svg viewBox="0 0 16 16" className="w-4 h-4 fill-current"><path d="M4 2.5v11l9-5.5z"/></svg>
                  )}
                  <span className="font-display text-sm font-semibold">
                    {formatTime(w.duration_seconds)}
                  </span>
                  {w.comments.length > 0 && (
                    <span className="rounded-full bg-waffle-light/30 px-1.5 py-0.5 text-[10px] font-semibold text-waffle-dark/70">
                      {w.comments.length} comment{w.comments.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                {w.title && (
                  <p className="mt-1 text-xs font-medium leading-snug opacity-80">{w.title}</p>
                )}
                <p className="mt-1 text-xs opacity-60">
                  {w.sender_name} &middot; {formatDate(w.created_at)}
                </p>
                {w.transcript && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (showTranscriptId === w.id) {
                        setShowTranscriptId(null);
                      } else {
                        setShowTranscriptId(w.id);
                        setEditingTranscript(w.transcript);
                      }
                    }}
                    className="mt-1.5 text-[11px] font-semibold text-waffle/70 hover:text-waffle transition-colors"
                  >
                    {showTranscriptId === w.id ? "Hide Transcript" : isMine ? "View/Edit Transcript" : "View Transcript"}
                  </button>
                )}
                {showTranscriptId === w.id && w.transcript && (
                  isMine ? (
                    <div className="mt-1.5" onClick={(e) => e.stopPropagation()}>
                      <textarea
                        value={editingTranscript}
                        onChange={(e) => setEditingTranscript(e.target.value)}
                        className="w-full rounded-lg border border-waffle-light/40 bg-white/50 px-2 py-1.5 text-[11px] leading-relaxed text-waffle-dark outline-none placeholder:text-waffle-dark/30 focus:border-waffle resize-none"
                        rows={3}
                      />
                      {editingTranscript !== w.transcript && (
                        <div className="mt-1 flex gap-1.5">
                          <button
                            onClick={async () => {
                              setSavingTranscript(true);
                              await fetch(`/api/waffles/transcript/${w.id}`, {
                                method: "PUT",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ transcript: editingTranscript }),
                              });
                              setSavingTranscript(false);
                              setShowTranscriptId(null);
                              loadWaffles();
                            }}
                            disabled={savingTranscript}
                            className="rounded-md bg-waffle px-2 py-0.5 text-[10px] font-semibold text-white disabled:opacity-50"
                          >
                            {savingTranscript ? "Saving..." : "Save"}
                          </button>
                          <button
                            onClick={() => setEditingTranscript(w.transcript)}
                            className="rounded-md bg-waffle-light/30 px-2 py-0.5 text-[10px] font-semibold text-waffle-dark/60"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="mt-1.5 text-[11px] leading-relaxed opacity-75">{w.transcript}</p>
                  )
                )}
              </div>

              {/* Expanded detail view */}
              {isExpanded && (
                <div className={`mt-2 w-full max-w-[340px] rounded-xl border-2 border-dashed p-4 ${
                  isMine
                    ? "border-waffle-light/50 bg-butter"
                    : "border-waffle-light/30 bg-cream"
                }`}>
                  {/* Audio player */}
                  <div className="mb-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); playWaffle(w.id); }}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-waffle text-white"
                      >
                        {isPlaying ? (
                          <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 fill-current"><rect x="3" y="2" width="3.5" height="12" rx="1"/><rect x="9.5" y="2" width="3.5" height="12" rx="1"/></svg>
                        ) : (
                          <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 fill-current"><path d="M4 2.5v11l9-5.5z"/></svg>
                        )}
                      </button>
                      <div className="flex-1">
                        <div
                          className="relative h-2 cursor-pointer rounded-full bg-waffle-light/30"
                          onClick={(e) => {
                            e.stopPropagation();
                            const rect = e.currentTarget.getBoundingClientRect();
                            seekAudio((e.clientX - rect.left) / rect.width);
                          }}
                        >
                          <div
                            className="h-full rounded-full bg-waffle transition-[width] duration-100"
                            style={{ width: `${progress * 100}%` }}
                          />
                          {/* Comment markers on timeline */}
                          {w.comments.map((c) => {
                            const pos = w.duration_seconds > 0
                              ? (c.timestamp_seconds / w.duration_seconds) * 100 : 0;
                            return (
                              <span
                                key={c.id}
                                className="absolute top-1/2 h-2.5 w-0.5 -translate-y-1/2 rounded-full bg-syrup/50"
                                style={{ left: `${Math.min(pos, 100)}%` }}
                              />
                            );
                          })}
                        </div>
                        <div className="mt-0.5 flex justify-between text-[10px] text-waffle-dark/50">
                          <span>{isPlaying ? formatTime(playbackTime) : "0:00"}</span>
                          <span>{formatTime(isPlaying && playbackDuration ? playbackDuration : w.duration_seconds)}</span>
                        </div>
                      </div>
                      <SpeedControl speed={speed} onSpeedChange={updateSpeed} />
                    </div>
                  </div>

                  {/* Download button */}
                  <div className="mb-2 flex justify-end">
                    <DownloadButton onClick={() => exportSingleWaffle(w)} />
                  </div>

                  {/* Description (editable for own waffles) */}
                  {isMine ? (
                    <textarea
                      defaultValue={w.title}
                      onBlur={(e) => {
                        if (e.target.value !== w.title) saveDescription(w.id, e.target.value);
                      }}
                      placeholder="Add a description or notes..."
                      className="mb-3 w-full resize-none rounded-lg border border-waffle-light/40 bg-white/50 px-2 py-1.5 text-xs leading-relaxed text-waffle-dark outline-none placeholder:text-waffle-dark/30 focus:border-waffle"
                      rows={2}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : w.title ? (
                    <p className="mb-3 text-xs leading-relaxed text-waffle-dark/80">{w.title}</p>
                  ) : null}

                  {/* Transcript */}
                  {w.transcript ? (
                    <div className="mb-3 rounded-lg bg-white/40 p-2 text-xs leading-relaxed text-waffle-dark/80">
                      {wordTs.length > 0 ? (
                        <span>
                          {wordTs.map((wt, idx) => {
                            const active = isPlaying &&
                              playbackTime >= wt.start && playbackTime < wt.end;
                            return (
                              <span
                                key={idx}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!isPlaying) playWaffle(w.id);
                                  if (isPlaying) seekToTime(wt.start);
                                  else setTimeout(() => seekToTime(wt.start), 300);
                                }}
                                className={`cursor-pointer transition-colors ${
                                  active
                                    ? "rounded bg-waffle/20 font-semibold text-syrup"
                                    : "hover:text-waffle"
                                }`}
                              >
                                {wt.word}{idx < wordTs.length - 1 ? " " : ""}
                              </span>
                            );
                          })}
                        </span>
                      ) : (
                        w.transcript
                      )}
                    </div>
                  ) : (
                    <p className="mb-3 text-[11px] italic text-waffle-dark/40">
                      No transcript available
                    </p>
                  )}

                  {/* Timed comments thread */}
                  {w.comments.length > 0 && (
                    <div className="mb-3 space-y-1.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-waffle-dark/40">
                        Comments
                      </p>
                      {w.comments.map((c) => (
                        <div
                          key={c.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isPlaying) playWaffle(w.id);
                            if (isPlaying) seekToTime(c.timestamp_seconds);
                            else setTimeout(() => seekToTime(c.timestamp_seconds), 300);
                          }}
                          className="flex cursor-pointer gap-2 rounded-lg bg-white/30 px-2 py-1.5 text-xs hover:bg-white/50"
                        >
                          <span className="shrink-0 font-mono text-[10px] text-waffle/60">
                            {formatTime(c.timestamp_seconds)}
                          </span>
                          <span className="text-waffle-dark/80">
                            <span className="font-semibold">{c.user_name}:</span> {c.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add comment input */}
                  <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="text"
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addComment(w.id)}
                      placeholder={
                        isPlaying
                          ? `Comment at ${formatTime(playbackTime)}...`
                          : "Add a comment..."
                      }
                      className="flex-1 rounded-lg border border-waffle-light/40 bg-white/50 px-2 py-1.5 text-xs text-waffle-dark outline-none placeholder:text-waffle-dark/30 focus:border-waffle"
                    />
                    <button
                      onClick={() => addComment(w.id)}
                      disabled={!commentText.trim()}
                      className="rounded-lg bg-waffle px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-30"
                    >
                      Send
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Floating comment bar during playback */}
      {playingId && (
        <div className="mb-2 rounded-xl border border-waffle-light/40 bg-white/80 px-3 py-2 shadow-sm backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <span className="shrink-0 rounded-full bg-waffle/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-waffle">
              {formatTime(playbackTime)}
            </span>
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && playingId && addComment(playingId)}
              placeholder="Add a comment..."
              className="flex-1 rounded-lg border border-waffle-light/30 bg-white/60 px-2 py-1.5 text-xs text-waffle-dark outline-none placeholder:text-waffle-dark/30 focus:border-waffle"
            />
            <button
              onClick={() => playingId && addComment(playingId)}
              disabled={!commentText.trim()}
              className="rounded-lg bg-waffle px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-30"
            >
              Send
            </button>
          </div>
        </div>
      )}

      <WaffleRecorder targetId={pairId} targetType="pair" onSent={loadWaffles} />
    </div>
  );
}
