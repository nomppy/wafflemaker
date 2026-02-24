"use client";

import { useState, useEffect, useRef } from "react";

export function usePlaybackSpeed(audioRef: React.RefObject<HTMLAudioElement | null>) {
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  }, [speed, audioRef]);

  function updateSpeed(val: number) {
    const clamped = Math.round(val * 10) / 10;
    setSpeed(clamped);
    if (audioRef.current) {
      audioRef.current.playbackRate = clamped;
    }
  }

  return { speed, updateSpeed };
}

export function SpeedControl({
  speed,
  onSpeedChange,
}: {
  speed: number;
  onSpeedChange: (val: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const label = speed === Math.floor(speed)
    ? `${speed}x`
    : `${speed.toFixed(1)}x`;

  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen(!open)}
        className="flex h-6 min-w-[2rem] items-center justify-center rounded-full bg-waffle-light/30 px-1.5 text-[10px] font-bold text-waffle-dark/60 transition-colors hover:bg-waffle-light/50 hover:text-waffle-dark/80"
        title="Playback speed"
      >
        {label}
      </button>
      {open && (
        <div className="absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 rounded-lg border border-waffle-light/40 bg-white px-3 py-2 shadow-lg">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-waffle-dark/50">1x</span>
            <input
              type="range"
              min="1"
              max="3"
              step="0.1"
              value={speed}
              onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
              className="h-1 w-24 cursor-pointer appearance-none rounded-full bg-waffle-light/40 accent-waffle [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-waffle"
            />
            <span className="text-[10px] text-waffle-dark/50">3x</span>
          </div>
          <p className="mt-1 text-center text-[10px] font-semibold text-waffle-dark/60">{label}</p>
        </div>
      )}
    </div>
  );
}
