"use client";

import { useState, useEffect, useRef, useCallback } from "react";

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

  useEffect(() => {
    setPrompt(getRandomPrompt());
  }, []);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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
    } catch {
      alert("Microphone access is required to record waffles.");
    }
  }

  async function stopRecording() {
    const duration = recordingTime;

    if (mediaRecorder.current && mediaRecorder.current.state !== "inactive") {
      mediaRecorder.current.onstop = async () => {
        mediaRecorder.current!.stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks.current, { type: "audio/webm" });
        await uploadWaffle(blob, duration);
      };
      mediaRecorder.current.stop();
    }
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }

  async function uploadWaffle(blob: Blob, duration: number) {
    setUploading(true);
    const formData = new FormData();
    formData.append("pairId", pairId);
    formData.append("audio", blob, "waffle.webm");
    formData.append("duration", String(duration));

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
    <div className="flex flex-1 flex-col">
      {/* Waffles list */}
      <div className="flex-1 space-y-3 overflow-y-auto">
        {waffles.length === 0 && !recording && (
          <div className="rounded-xl bg-amber-100 p-6 text-center">
            <p className="mb-2 text-lg font-medium text-amber-900">
              Time to break the ice!
            </p>
            <p className="text-sm text-amber-700">
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
              <div className="flex items-center gap-1">
                <button
                  onClick={() => playWaffle(w.id)}
                  className={`rounded-2xl px-4 py-3 transition ${
                    isMine
                      ? "bg-amber-600 text-white hover:bg-amber-700"
                      : "bg-white text-amber-900 shadow-sm hover:shadow-md"
                  } ${isPlaying ? "ring-2 ring-amber-400" : ""}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{isPlaying ? "⏸" : "▶"}</span>
                    <span className="text-sm font-medium">
                      {formatTime(w.duration_seconds)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs opacity-75">
                    {w.sender_name} &middot; {formatDate(w.created_at)}
                  </p>
                </button>
                {w.transcript && (
                  <button
                    onClick={() =>
                      setExpandedId(isExpanded ? null : w.id)
                    }
                    className={`rounded-lg px-2 py-1 text-xs transition ${
                      isExpanded
                        ? "bg-amber-200 text-amber-800"
                        : "bg-amber-100 text-amber-600 hover:bg-amber-200"
                    }`}
                    aria-label="Toggle transcript"
                  >
                    Aa
                  </button>
                )}
              </div>
              {isExpanded && w.transcript && (
                <div
                  className={`mt-1 max-w-[280px] rounded-lg p-3 text-sm ${
                    isMine
                      ? "bg-amber-100 text-amber-900"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {w.transcript}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Record area */}
      <div className="mt-6 flex flex-col items-center pb-4">
        {uploading ? (
          <p className="text-amber-700">Sending your waffle...</p>
        ) : recording ? (
          <>
            <p className="mb-2 font-mono text-lg text-red-600">
              {formatTime(recordingTime)}
            </p>
            <button
              onClick={stopRecording}
              className="h-16 w-16 rounded-full bg-red-500 shadow-lg transition hover:bg-red-600"
              aria-label="Stop recording"
            >
              <span className="mx-auto block h-6 w-6 rounded bg-white" />
            </button>
            <p className="mt-2 text-sm text-gray-500">Tap to stop & send</p>
          </>
        ) : (
          <>
            <div className="mb-4 w-full rounded-xl bg-amber-50 p-3 text-center">
              <p className="text-xs font-medium uppercase tracking-wide text-amber-500">
                Not sure what to say?
              </p>
              <p className="mt-1 text-sm text-amber-800">{prompt}</p>
              <button
                onClick={() => setPrompt(getRandomPrompt())}
                className="mt-1 text-xs text-amber-500 hover:text-amber-700"
              >
                Another prompt
              </button>
            </div>
            <button
              onClick={startRecording}
              className="h-16 w-16 rounded-full bg-amber-600 shadow-lg transition hover:bg-amber-700"
              aria-label="Start recording"
            >
              <span className="mx-auto block h-4 w-4 rounded-full bg-white" />
            </button>
            <p className="mt-2 text-sm text-gray-500">Tap to record a waffle</p>
          </>
        )}
      </div>
    </div>
  );
}
