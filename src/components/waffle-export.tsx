"use client";

import { useState } from "react";
import JSZip from "jszip";

interface ExportWaffle {
  id: string;
  sender_name: string;
  duration_seconds: number;
  transcript: string;
  title: string;
  created_at: string;
  comments?: { user_name: string; text: string; timestamp_seconds: number; created_at?: string }[];
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 50);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function fetchAudio(waffleId: string): Promise<ArrayBuffer> {
  const res = await fetch(`/api/waffles/audio/${waffleId}`);
  if (!res.ok) throw new Error(`Failed to fetch audio for ${waffleId}`);
  return res.arrayBuffer();
}

export async function exportSingleWaffle(waffle: ExportWaffle) {
  const zip = new JSZip();
  const audio = await fetchAudio(waffle.id);
  zip.file("audio.webm", audio);
  zip.file(
    "metadata.json",
    JSON.stringify(
      {
        id: waffle.id,
        sender: waffle.sender_name,
        title: waffle.title,
        duration_seconds: waffle.duration_seconds,
        transcript: waffle.transcript,
        created_at: waffle.created_at,
        comments: waffle.comments || [],
      },
      null,
      2
    )
  );
  const blob = await zip.generateAsync({ type: "blob" });
  const name = waffle.title
    ? sanitizeFilename(waffle.title)
    : `waffle-${waffle.created_at.slice(0, 10)}`;
  triggerDownload(blob, `${name}.zip`);
}

export async function exportAllWaffles(
  waffles: ExportWaffle[],
  contextName: string
) {
  const zip = new JSZip();
  const index = waffles.map((w) => ({
    id: w.id,
    sender: w.sender_name,
    title: w.title,
    duration_seconds: w.duration_seconds,
    created_at: w.created_at,
  }));
  zip.file("index.json", JSON.stringify(index, null, 2));

  for (let i = 0; i < waffles.length; i++) {
    const w = waffles[i];
    const folderName = `${String(i + 1).padStart(3, "0")}-${w.created_at.slice(0, 10)}-${sanitizeFilename(w.sender_name)}`;
    const folder = zip.folder(folderName)!;
    try {
      const audio = await fetchAudio(w.id);
      folder.file("audio.webm", audio);
    } catch {
      // Skip audio if fetch fails
    }
    folder.file(
      "metadata.json",
      JSON.stringify(
        {
          id: w.id,
          sender: w.sender_name,
          title: w.title,
          duration_seconds: w.duration_seconds,
          transcript: w.transcript,
          created_at: w.created_at,
          comments: w.comments || [],
        },
        null,
        2
      )
    );
  }

  const blob = await zip.generateAsync({ type: "blob" });
  triggerDownload(blob, `${sanitizeFilename(contextName)}-waffles.zip`);
}

export function DownloadButton({ onClick }: { onClick: () => void | Promise<void> }) {
  const [downloading, setDownloading] = useState(false);

  async function handleClick() {
    setDownloading(true);
    try {
      await onClick();
    } finally {
      setDownloading(false);
    }
  }

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        handleClick();
      }}
      disabled={downloading}
      className="group flex items-center gap-1.5 rounded-lg bg-white/40 border border-waffle-light/30 px-2.5 py-1.5 text-waffle-dark/50 transition-all hover:bg-butter hover:border-waffle-light/50 hover:text-syrup disabled:opacity-50"
      title="Save this waffle"
    >
      {/* Waffle-in-a-takeout-box illustration */}
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Box */}
        <path d="M4 10h16v10a2 2 0 01-2 2H6a2 2 0 01-2-2V10z" fill="#f5e6d0" stroke="#c8913a" strokeWidth="1.2"/>
        {/* Box lid */}
        <path d="M3 7h18a1 1 0 011 1v2H2V8a1 1 0 011-1z" fill="#e8c47a" stroke="#a0722c" strokeWidth="1.2"/>
        {/* Waffle peeking out */}
        <rect x="8" y="3" width="8" height="6" rx="1" fill="#e8c47a" stroke="#c8913a" strokeWidth="0.8"/>
        <line x1="10" y1="3" x2="10" y2="9" stroke="#c8913a" strokeWidth="0.5" opacity="0.4"/>
        <line x1="12" y1="3" x2="12" y2="9" stroke="#c8913a" strokeWidth="0.5" opacity="0.4"/>
        <line x1="14" y1="3" x2="14" y2="9" stroke="#c8913a" strokeWidth="0.5" opacity="0.4"/>
        <line x1="8" y1="5" x2="16" y2="5" stroke="#c8913a" strokeWidth="0.5" opacity="0.4"/>
        <line x1="8" y1="7" x2="16" y2="7" stroke="#c8913a" strokeWidth="0.5" opacity="0.4"/>
        {/* Down arrow on box */}
        <path d="M12 14v4m0 0l-1.5-1.5M12 18l1.5-1.5" stroke="#a0722c" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <span className="text-[10px] font-semibold">{downloading ? "Saving..." : "Save waffle"}</span>
    </button>
  );
}

export function ExportAllButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-[11px] font-semibold text-waffle-dark/30 hover:text-waffle-dark/60 transition-colors"
    >
      Export
    </button>
  );
}
