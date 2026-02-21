"use client";

import { useState, useEffect, useRef, useCallback } from "react";

declare global {
  interface Window {
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

interface Waffle {
  id: string;
  sender_id: string;
  sender_name: string;
  duration_seconds: number;
  transcript: string;
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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState(TALK_PROMPTS[0]);
  const [micError, setMicError] = useState<string | null>(null);

  useEffect(() => {
    setPrompt(getRandomPrompt());
  }, []);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const transcriptRef = useRef<string>("");
  const recognitionRef = useRef<SpeechRecognition | null>(null);

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

      // Start speech recognition for transcription
      transcriptRef.current = "";
      const SpeechRecognitionAPI =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognitionAPI) {
        const recognition = new SpeechRecognitionAPI();
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = "en-US";
        recognition.onresult = (event: SpeechRecognitionEvent) => {
          for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
              transcriptRef.current += event.results[i][0].transcript;
            }
          }
        };
        recognition.onend = () => {
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
      }

      timerRef.current = setInterval(() => {
        setRecordingTime((t) => t + 1);
      }, 1000);
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
    formData.append("pairId", pairId);
    formData.append("audio", blob, "waffle.webm");
    formData.append("duration", String(duration));
    formData.append("transcript", transcript);

    await fetch("/api/waffles", { method: "POST", body: formData });
    setUploading(false);
    setRecordingTime(0);
    setPrompt(getRandomPrompt());
    loadWaffles();
  }

  function playWaffle(id: string) {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (playingId === id) {
      setPlayingId(null);
      return;
    }
    const audio = new Audio(`/api/waffles/audio/${id}`);
    audio.onended = () => setPlayingId(null);
    audio.onerror = () => setPlayingId(null);
    audio.play().catch(() => setPlayingId(null));
    audioRef.current = audio;
    setPlayingId(id);
  }

  function formatTime(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
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
      <div className="flex-1 space-y-4 overflow-y-auto pb-4">
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
          const isPlaying = playingId === w.id;
          const isExpanded = expandedId === w.id;
          return (
            <div
              key={w.id}
              className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}
            >
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => playWaffle(w.id)}
                  className={`px-4 py-3 transition-all ${
                    isMine ? "bubble-mine" : "bubble-theirs"
                  } ${isPlaying ? "ring-2 ring-waffle-light ring-offset-2" : ""}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{isPlaying ? "⏸" : "▶"}</span>
                    <span className="font-display text-sm font-semibold">
                      {formatTime(w.duration_seconds)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs opacity-70">
                    {w.sender_name} &middot; {formatDate(w.created_at)}
                  </p>
                </button>
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
              </div>
              {isExpanded && (
                <div
                  className={`mt-2 max-w-[280px] rounded-xl border-2 border-dashed p-3 text-sm leading-relaxed ${
                    isMine
                      ? "border-waffle-light/50 bg-butter text-syrup"
                      : "border-waffle-light/30 bg-cream text-waffle-dark"
                  }`}
                >
                  {w.transcript || <span className="italic opacity-60">No transcript available</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Record area - sticky at bottom */}
      <div className="sticky bottom-0 mt-auto flex flex-col items-center border-t-2 border-dashed border-waffle-light/40 bg-cream pb-6 pt-5 safe-b">
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
