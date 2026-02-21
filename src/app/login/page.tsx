"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

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
      <div className="text-center">
        <h2 className="mb-2 text-2xl font-bold text-amber-900">Check your email</h2>
        <p className="text-amber-700">
          We sent a login link to <strong>{email}</strong>
        </p>
        {devLink && (
          <a
            href={devLink}
            className="mt-4 inline-block rounded-full bg-amber-600 px-6 py-2 text-white hover:bg-amber-700"
          >
            Dev: Click to login
          </a>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm">
      <h2 className="mb-6 text-center text-2xl font-bold text-amber-900">
        Sign in to Wednesday Waffles
      </h2>
      {error && (
        <p className="mb-4 rounded-lg bg-red-100 p-3 text-sm text-red-700">
          {error === "invalid_token"
            ? "That link has expired. Please try again."
            : "Something went wrong. Please try again."}
        </p>
      )}
      <input
        type="email"
        placeholder="your@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        className="mb-4 w-full rounded-lg border border-amber-300 bg-white px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
      />
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-full bg-amber-600 py-3 font-semibold text-white transition hover:bg-amber-700 disabled:opacity-50"
      >
        {loading ? "Sending..." : "Send magic link"}
      </button>
    </form>
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
