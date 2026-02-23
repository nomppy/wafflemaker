"use client";

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

export function DownloadButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="flex h-6 w-6 items-center justify-center rounded text-waffle-dark/40 transition-colors hover:bg-waffle-light/30 hover:text-waffle-dark/70"
      title="Download waffle"
    >
      <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 fill-current">
        <path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z" />
        <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
      </svg>
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
