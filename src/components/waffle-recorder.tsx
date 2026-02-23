"use client";

import { useState, useEffect, useRef } from "react";

interface WordTimestamp {
  word: string;
  start: number;
  end: number;
}

interface PendingWaffle {
  blob: Blob;
  duration: number;
  transcript: string;
  wordTimestamps: WordTimestamp[];
}

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

function formatTime(seconds: number) {
  const total = Math.floor(seconds);
  return `${Math.floor(total / 60)}:${(total % 60).toString().padStart(2, "0")}`;
}

interface WaffleRecorderProps {
  targetId: string;
  targetType: "pair" | "circle";
  onSent: () => void;
}

export function WaffleRecorder({ targetId, targetType, onSent }: WaffleRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [pendingWaffle, setPendingWaffle] = useState<PendingWaffle | null>(null);
  const [pendingDescription, setPendingDescription] = useState("");
  const [prompt, setPrompt] = useState(TALK_PROMPTS[0]);

  useEffect(() => { setPrompt(getRandomPrompt()); }, []);

  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const transcriptRef = useRef<string>("");
  const wordTimestampsRef = useRef<WordTimestamp[]>([]);
  const recordingStartRef = useRef<number>(0);
  const lastResultTimeRef = useRef<number>(0);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

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

      timerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);

      transcriptRef.current = "";
      wordTimestampsRef.current = [];
      setLiveTranscript("");
      const recStart = performance.now();
      recordingStartRef.current = recStart;
      lastResultTimeRef.current = recStart;

      const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
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
    // Stop speech recognition first — triggers final onresult
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    if (mediaRecorder.current && mediaRecorder.current.state !== "inactive") {
      mediaRecorder.current.onstop = async () => {
        mediaRecorder.current!.stream.getTracks().forEach((t) => t.stop());
        // Wait for final speech recognition results to land
        await new Promise((r) => setTimeout(r, 300));
        const blob = new Blob(chunks.current, { type: mediaRecorder.current?.mimeType || "audio/webm" });
        const transcript = transcriptRef.current.trim();
        const wordTimestamps = [...wordTimestampsRef.current];
        setPendingWaffle({ blob, duration, transcript, wordTimestamps });
        setPendingDescription("");
        setRecordingTime(0);
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
    formData.append(targetType === "pair" ? "pairId" : "circleId", targetId);
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
    onSent();
  }

  function discardPendingWaffle() {
    setPendingWaffle(null);
    setPendingDescription("");
    setRecordingTime(0);
    setLiveTranscript("");
  }

  return (
    <div className="sticky bottom-0 mt-auto flex flex-col items-center border-t-2 border-dashed border-waffle-light/40 bg-cream pb-6 pt-5 safe-b">
      {uploading ? (
        <div className="flex items-center gap-3">
          <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-waffle border-t-transparent" />
          <p className="font-display font-medium text-waffle-dark">Sending your waffle...</p>
        </div>
      ) : pendingWaffle ? (
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
          <div>
            <label className="mb-1 block text-xs font-semibold text-waffle-dark/60">Transcript</label>
            <textarea
              value={pendingWaffle.transcript}
              onChange={(e) => setPendingWaffle({ ...pendingWaffle, transcript: e.target.value })}
              placeholder="No transcript captured — type one manually if you'd like"
              className="w-full resize-none rounded-lg border border-waffle-light/40 bg-white/50 px-3 py-2 text-xs leading-relaxed text-waffle-dark outline-none placeholder:text-waffle-dark/30 focus:border-waffle"
              rows={3}
            />
          </div>
          <textarea
            value={pendingDescription}
            onChange={(e) => setPendingDescription(e.target.value)}
            placeholder="Add a description or notes about this waffle... (optional)"
            className="w-full resize-none rounded-xl border-2 border-waffle-light/40 bg-white/50 px-3 py-2 text-sm leading-relaxed text-waffle-dark outline-none placeholder:text-waffle-dark/30 focus:border-waffle"
            rows={2}
          />
          <button
            onClick={sendPendingWaffle}
            className="btn-retro w-full py-3 text-sm"
          >
            Send waffle 🧇
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
          <button onClick={stopRecording} className="btn-record btn-record-active" aria-label="Stop recording">
            <span className="relative z-10 block h-7 w-7 rounded bg-white" />
          </button>
          <p className="mt-3 text-sm font-medium text-waffle-dark/60">Tap to stop</p>
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
          <div className="prompt-card mb-5 w-full p-4 text-center">
            <p className="font-display text-xs font-semibold uppercase tracking-widest text-waffle/80">
              Not sure what to say?
            </p>
            <p className="mt-1.5 text-sm font-medium leading-relaxed text-syrup">{prompt}</p>
            <button onClick={() => setPrompt(getRandomPrompt())} className="mt-2 text-xs font-bold text-waffle hover:text-syrup">
              Another prompt &rarr;
            </button>
          </div>
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
  );
}
