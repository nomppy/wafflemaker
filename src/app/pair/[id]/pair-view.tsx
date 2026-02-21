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
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    const transcript = transcriptRef.current.trim();
    const wordTimestamps = [...wordTimestampsRef.current];
    if (mediaRecorder.current && mediaRecorder.current.state !== "inactive") {
      mediaRecorder.current.onstop = () => {
        mediaRecorder.current!.stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks.current, { type: "audio/webm" });
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

  return (
    <div className="flex min-h-0 flex-1 flex-col">
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
                  <span className="text-lg">{isPlaying ? "⏸" : "▶"}</span>
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
                        <span className="text-sm">{isPlaying ? "⏸" : "▶"}</span>
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
                    </div>
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
                  {w.transcript && (
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

      {/* Record area */}
      <div className="sticky bottom-0 mt-auto flex flex-col items-center border-t-2 border-dashed border-waffle-light/40 bg-cream pb-6 pt-5 safe-b">
        {uploading ? (
          <div className="flex items-center gap-3">
            <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-waffle border-t-transparent" />
            <p className="font-display font-medium text-waffle-dark">Sending your waffle...</p>
          </div>
        ) : pendingWaffle ? (
          /* Post-recording: add description before sending */
          <div className="w-full space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-display text-sm font-semibold text-syrup">
                Your waffle ({formatTime(pendingWaffle.duration)})
              </p>
              <button
                onClick={discardPendingWaffle}
                className="text-xs font-bold text-waffle-dark/40 hover:text-red-600"
              >
                Discard
              </button>
            </div>
            {pendingWaffle.transcript && (
              <div className="rounded-lg bg-white/60 p-2 text-xs leading-relaxed text-waffle-dark/70">
                {pendingWaffle.transcript}
              </div>
            )}
            <textarea
              value={pendingDescription}
              onChange={(e) => setPendingDescription(e.target.value)}
              placeholder="Add a description or notes about this waffle... (optional)"
              className="w-full resize-none rounded-xl border-2 border-waffle-light/40 bg-white/50 px-3 py-2 text-sm leading-relaxed text-waffle-dark outline-none placeholder:text-waffle-dark/30 focus:border-waffle"
              rows={3}
              autoFocus
            />
            <button
              onClick={sendPendingWaffle}
              className="btn-retro w-full py-3 text-sm"
            >
              Send waffle
            </button>
          </div>
        ) : recording ? (
          <>
            <p className="mb-3 font-mono text-2xl font-bold text-red-600 tabular-nums">
              {formatTime(recordingTime)}
            </p>
            {liveTranscript && (
              <div className="mb-3 w-full rounded-lg bg-white/60 px-3 py-2 text-xs leading-relaxed text-waffle-dark/70">
                <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-waffle/50">
                  Live transcript
                </p>
                {liveTranscript}
              </div>
            )}
            <button
              onClick={stopRecording}
              className="btn-record btn-record-active"
              aria-label="Stop recording"
            >
              <span className="relative z-10 block h-7 w-7 rounded bg-white" />
            </button>
            <p className="mt-3 text-sm font-medium text-waffle-dark/60">Tap to stop</p>
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
            <p className="mt-2 text-[11px] text-waffle-dark/40">
              Voice messages are kept for 7 days. Transcripts are saved forever.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
