"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function WaffleLoginIcon() {
  return (
    <svg
      viewBox="0 0 64 64"
      className="mx-auto mb-5 w-20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Waffle body */}
      <rect x="8" y="12" width="48" height="40" rx="8" fill="#e8c47a" stroke="#a0722c" strokeWidth="2.5" />
      {/* Grid */}
      <line x1="24" y1="12" x2="24" y2="52" stroke="#c8913a" strokeWidth="1.5" opacity="0.4" />
      <line x1="40" y1="12" x2="40" y2="52" stroke="#c8913a" strokeWidth="1.5" opacity="0.4" />
      <line x1="8" y1="25" x2="56" y2="25" stroke="#c8913a" strokeWidth="1.5" opacity="0.4" />
      <line x1="8" y1="38" x2="56" y2="38" stroke="#c8913a" strokeWidth="1.5" opacity="0.4" />
      {/* Heart in center */}
      <path d="M32 40l-1-0.9C27 35.5 25 33.5 25 31.2c0-1.8 1.4-3.2 3.2-3.2 1 0 2 .5 2.8 1.3.8-.8 1.8-1.3 2.8-1.3 1.8 0 3.2 1.4 3.2 3.2 0 2.3-2 4.3-6 8L32 40z" fill="#be185d" opacity="0.6" />
      {/* Steam */}
      <path d="M22 8 C22 5 25 5 25 2" stroke="#c8913a" strokeWidth="1.5" strokeLinecap="round" opacity="0.25" className="steam-wisp" />
      <path d="M32 8 C32 5 35 5 35 2" stroke="#c8913a" strokeWidth="1.5" strokeLinecap="round" opacity="0.2" className="steam-wisp-delayed" />
      <path d="M42 8 C42 5 45 5 45 2" stroke="#c8913a" strokeWidth="1.5" strokeLinecap="round" opacity="0.2" className="steam-wisp-slow" />
    </svg>
  );
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const redirectTo = searchParams.get("redirect") || "/dashboard";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const res = await fetch("/api/auth/send-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, redirect: redirectTo }),
    });

    const data = await res.json();
    if (data.ok) {
      setSent(true);
      if (data.magicUrl) setDevLink(data.magicUrl);
    }
    setLoading(false);
  }

  if (sent) {
    return (
      <div className="card-cottage bg-waffle-texture p-8 text-center">
        <h2 className="font-display mb-2 text-2xl font-bold text-syrup">Check your email</h2>
        <p className="leading-relaxed text-waffle-dark">
          We sent a login link to <strong className="text-syrup">{email}</strong>
        </p>
        <p className="mt-2 text-sm text-waffle-dark/60">
          It&apos;ll arrive in a jiffy &mdash; check your inbox!
        </p>
        {devLink && (
          <a
            href={devLink}
            className="btn-retro mt-6 inline-block px-8 py-3"
          >
            Dev: Click to login
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="card-cottage w-full max-w-sm bg-waffle-texture p-8">
      <WaffleLoginIcon />
      <h2 className="font-display mb-6 text-center text-2xl font-bold text-syrup">
        Sign in to Wafflemaker
      </h2>
      {error && (
        <div className="mb-4 rounded-xl border-2 border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error === "invalid_token"
            ? "That link has expired or is invalid. Please try again."
            : "Something went wrong. Please try again."}
        </div>
      )}
      <form onSubmit={handleSubmit}>
        <label className="font-display mb-1.5 block text-sm font-semibold text-waffle-dark">
          Your email
        </label>
        <input
          type="email"
          name="email"
          autoComplete="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="input-cottage mb-4 w-full"
        />
        <button
          type="submit"
          disabled={loading}
          className="btn-retro w-full py-3.5 text-base disabled:opacity-50"
        >
          {loading ? "Sending..." : "Send magic link"}
        </button>
      </form>
      <p className="mt-4 text-center text-xs text-waffle-dark/50">
        No password needed &mdash; we&apos;ll email you a link
      </p>

      <div className="mt-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-waffle-light/50" />
        <span className="text-xs text-waffle-dark/40">or</span>
        <div className="h-px flex-1 bg-waffle-light/50" />
      </div>

      <a
        href="/api/auth/github"
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-waffle-light/50 bg-white/50 px-4 py-3 text-sm font-semibold text-waffle-dark transition-colors hover:border-waffle hover:bg-white/80"
      >
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
        </svg>
        Continue with GitHub
      </a>

      <a
        href="/api/auth/google"
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-waffle-light/50 bg-white/50 px-4 py-3 text-sm font-semibold text-waffle-dark transition-colors hover:border-waffle hover:bg-white/80"
      >
        <svg viewBox="0 0 24 24" className="w-5 h-5">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        Continue with Google
      </a>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
