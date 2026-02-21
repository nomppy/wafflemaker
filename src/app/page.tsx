import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center p-6">
      {/* Hero */}
      <div className="mt-16 max-w-md text-center">
        <h1 className="mb-2 text-5xl font-bold tracking-tight text-amber-900">
          Wednesday Waffles
        </h1>
        <p className="mb-8 text-lg text-amber-700">
          A voice message to a friend, every Wednesday.
        </p>
        <Link
          href="/login"
          className="inline-block rounded-full bg-amber-600 px-8 py-3 text-lg font-semibold text-white transition hover:bg-amber-700"
        >
          Get Started
        </Link>
      </div>

      {/* What are Wednesday Waffles? */}
      <div className="mt-20 max-w-lg">
        <h2 className="mb-4 text-center text-2xl font-bold text-amber-900">
          What&apos;s a Wednesday Waffle?
        </h2>
        <p className="mb-4 text-center text-amber-800">
          It&apos;s simple: every Wednesday, you record a short voice message
          for a friend. Talk about your week, what&apos;s on your mind, a funny
          thing that happened, literally anything. Your friend does the same.
        </p>
        <p className="mb-8 text-center text-amber-700">
          No pressure to respond in real-time. No typing. Just your voice,
          once a week, adding a little warmth to hump day.
        </p>

        {/* How it works */}
        <div className="space-y-4">
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <div className="mb-1 text-sm font-semibold text-amber-600">
              1. Pair up
            </div>
            <p className="text-sm text-gray-700">
              Send an invite link to a friend. Once they join, you&apos;re
              a waffle pair.
            </p>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <div className="mb-1 text-sm font-semibold text-amber-600">
              2. Record your waffle
            </div>
            <p className="text-sm text-gray-700">
              Every Wednesday (or whenever you get to it), tap record and
              talk for at least a couple minutes. A transcript is generated
              automatically so you can skim later.
            </p>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <div className="mb-1 text-sm font-semibold text-amber-600">
              3. Listen on your own time
            </div>
            <p className="text-sm text-gray-700">
              No need to be online at the same time. Listen when it suits you,
              and send yours when you&apos;re ready. It&apos;s async friendship.
            </p>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <div className="mb-1 text-sm font-semibold text-amber-600">
              4. Keep the streak going
            </div>
            <p className="text-sm text-gray-700">
              Your streak counts how many consecutive Wednesdays you&apos;ve
              sent a waffle. See how long you can keep it up.
            </p>
          </div>
        </div>
      </div>

      {/* Why Wednesdays? */}
      <div className="mb-16 mt-12 max-w-lg text-center">
        <h2 className="mb-3 text-xl font-bold text-amber-900">
          Why Wednesday?
        </h2>
        <p className="text-amber-700">
          A little boost for hump day. It&apos;s the middle of the week, and
          hearing a friend&apos;s voice is the perfect pick-me-up. Plus,
          &ldquo;Wednesday Waffles&rdquo; has a nice ring to it.
        </p>
        <div className="mt-8">
          <Link
            href="/login"
            className="inline-block rounded-full bg-amber-600 px-8 py-3 font-semibold text-white transition hover:bg-amber-700"
          >
            Start Waffling
          </Link>
        </div>
      </div>
    </main>
  );
}
