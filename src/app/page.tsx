import Link from "next/link";

/* ===== Inline SVG Components ===== */

function WaffleIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 80 80"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Plate */}
      <ellipse cx="40" cy="62" rx="36" ry="6" fill="#f5e6d0" stroke="#d4b896" strokeWidth="1.5" />
      {/* Waffle body */}
      <rect x="12" y="14" width="56" height="44" rx="8" fill="#e8c47a" stroke="#a0722c" strokeWidth="2.5" />
      {/* Grid lines */}
      <line x1="26" y1="14" x2="26" y2="58" stroke="#c8913a" strokeWidth="1.5" opacity="0.4" />
      <line x1="40" y1="14" x2="40" y2="58" stroke="#c8913a" strokeWidth="1.5" opacity="0.4" />
      <line x1="54" y1="14" x2="54" y2="58" stroke="#c8913a" strokeWidth="1.5" opacity="0.4" />
      <line x1="12" y1="26" x2="68" y2="26" stroke="#c8913a" strokeWidth="1.5" opacity="0.4" />
      <line x1="12" y1="38" x2="68" y2="38" stroke="#c8913a" strokeWidth="1.5" opacity="0.4" />
      <line x1="12" y1="50" x2="68" y2="50" stroke="#c8913a" strokeWidth="1.5" opacity="0.4" />
      {/* Butter pat */}
      <rect x="28" y="22" width="24" height="14" rx="4" fill="#fef3c7" stroke="#fde68a" strokeWidth="1.5" />
      {/* Butter shine */}
      <rect x="32" y="25" width="8" height="3" rx="1.5" fill="#fff" opacity="0.5" />
      {/* Syrup drip */}
      <path d="M56 44 C56 44, 62 50, 62 55 C62 58 59.5 60, 56 60 C52.5 60, 50 58, 50 55 C50 50, 56 44, 56 44Z" fill="#5c3310" opacity="0.5" />
    </svg>
  );
}

function SteamWisps({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 60 40"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M15 38 C15 30, 10 28, 10 22 C10 16, 16 14, 16 8"
        stroke="#c8913a"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.25"
        className="steam-wisp"
      />
      <path
        d="M30 38 C30 30, 25 26, 25 20 C25 14, 31 12, 31 6"
        stroke="#c8913a"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.2"
        className="steam-wisp-delayed"
      />
      <path
        d="M45 38 C45 32, 40 28, 40 22 C40 16, 46 14, 46 10"
        stroke="#c8913a"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.2"
        className="steam-wisp-slow"
      />
    </svg>
  );
}

function SyrupDrip() {
  return (
    <div className="relative w-full py-2">
      <svg
        viewBox="0 0 300 20"
        className="mx-auto w-64 opacity-35"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        preserveAspectRatio="none"
      >
        <path
          d="M0 4 Q40 4 60 4 Q75 4 78 10 Q80 16 82 10 Q84 4 100 4 Q130 4 150 4 Q170 4 174 10 Q176 14 178 10 Q180 4 200 4 Q230 4 250 4 Q260 4 262 8 Q264 12 266 8 Q268 4 280 4 L300 4"
          stroke="#c8913a"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.5"
        />
      </svg>
    </div>
  );
}

function CoffeeIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Cup */}
      <path d="M8 18 L12 40 C12 42 14 44 18 44 L30 44 C34 44 36 42 36 40 L40 18Z" fill="#e8c47a" stroke="#a0722c" strokeWidth="2" />
      {/* Handle */}
      <path d="M40 22 C44 22 46 26 46 30 C46 34 44 38 40 38" stroke="#a0722c" strokeWidth="2" fill="none" />
      {/* Liquid */}
      <path d="M12 22 L14 38 C14 40 16 42 18 42 L30 42 C32 42 34 40 34 38 L36 22Z" fill="#5c3310" opacity="0.35" />
      {/* Steam */}
      <path d="M18 14 C18 10 22 10 22 6" stroke="#c8913a" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" className="steam-wisp" />
      <path d="M28 14 C28 10 32 10 32 6" stroke="#c8913a" strokeWidth="1.5" strokeLinecap="round" opacity="0.25" className="steam-wisp-delayed" />
    </svg>
  );
}

function HeartIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  );
}

function MicIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect x="11" y="4" width="10" height="18" rx="5" fill="currentColor" />
      <path d="M8 16 C8 22 11.6 26 16 26 C20.4 26 24 22 24 16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="16" y1="26" x2="16" y2="30" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="12" y1="30" x2="20" y2="30" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function KitchenWindowIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Window frame */}
      <rect x="6" y="6" width="36" height="36" rx="3" fill="#fef3c7" stroke="#a0722c" strokeWidth="2" />
      {/* Cross bars */}
      <line x1="24" y1="6" x2="24" y2="42" stroke="#a0722c" strokeWidth="2" />
      <line x1="6" y1="24" x2="42" y2="24" stroke="#a0722c" strokeWidth="2" />
      {/* Sky */}
      <rect x="8" y="8" width="14" height="14" rx="1" fill="#bae6fd" opacity="0.5" />
      <rect x="26" y="8" width="14" height="14" rx="1" fill="#bae6fd" opacity="0.5" />
      {/* Sun */}
      <circle cx="34" cy="14" r="4" fill="#fbbf24" opacity="0.6" />
      {/* Curtain hints */}
      <path d="M6 6 Q14 12 6 18" stroke="#f9a8d4" strokeWidth="1.5" opacity="0.4" fill="none" />
      <path d="M42 6 Q34 12 42 18" stroke="#f9a8d4" strokeWidth="1.5" opacity="0.4" fill="none" />
    </svg>
  );
}

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center overflow-x-hidden">
      {/* Hero */}
      <div className="relative w-full px-6 pb-14 pt-16 text-center md:pt-24">
        {/* Floating decorations */}
        <CoffeeIcon className="animate-float-delayed absolute left-8 top-20 hidden w-10 opacity-20 md:block" />
        <KitchenWindowIcon className="animate-float-slow absolute right-8 top-16 hidden w-12 opacity-20 md:block" />

        {/* Steam above the waffle */}
        <SteamWisps className="mx-auto mb-1 w-20" />

        {/* Big waffle icon */}
        <WaffleIcon className="mx-auto mb-5 w-28 drop-shadow-lg md:w-32" />

        <h1 className="font-display mb-3 text-5xl font-bold tracking-tight text-syrup md:text-6xl">
          Wednesday Waffles
        </h1>
        <p className="mx-auto mb-2 max-w-sm text-lg font-medium leading-relaxed text-waffle-dark">
          A voice message to a friend, every Wednesday.
        </p>
        <p className="mx-auto mb-10 max-w-xs text-sm text-waffle-dark/60">
          Like a kitchen phone call, but you can listen whenever.
        </p>

        <Link
          href="/login"
          className="btn-retro px-10 py-4 text-lg"
        >
          <MicIcon className="inline-block w-5 text-syrup" />
          Get Started
        </Link>
      </div>

      <SyrupDrip />

      {/* What are Wednesday Waffles? */}
      <div className="w-full max-w-lg px-6 py-12">
        <h2 className="font-display mb-6 text-center text-3xl font-bold text-syrup">
          What&apos;s a Wednesday Waffle?
        </h2>
        <div className="card-cottage bg-waffle-texture p-7">
          <p className="mb-4 text-center text-[1.05rem] leading-relaxed text-syrup">
            It&apos;s simple: every Wednesday, you record a short voice message
            for a friend. Talk about your week, what&apos;s on your mind, a funny
            thing that happened &mdash; literally anything. Your friend does the same.
          </p>
          <p className="text-center leading-relaxed text-waffle-dark/80">
            No pressure to respond in real-time. No typing. Just your voice,
            once a week, adding a little warmth to hump day.
          </p>
        </div>
      </div>

      <SyrupDrip />

      {/* How it works — Step cards */}
      <div className="w-full max-w-lg px-6 py-12">
        <h2 className="font-display mb-8 text-center text-2xl font-bold text-syrup">
          How it works
        </h2>
        <div className="space-y-5">
          {[
            {
              num: "01",
              title: "Pair up",
              desc: "Send an invite link to a friend. Once they join, you're a waffle pair.",
              icon: "🤝",
            },
            {
              num: "02",
              title: "Record your waffle",
              desc: "Every Wednesday, tap record and talk for a couple minutes. A transcript is auto-generated so you can skim later.",
              icon: "🎙️",
            },
            {
              num: "03",
              title: "Listen on your own time",
              desc: "No need to be online at the same time. Listen when it suits you. It's async friendship.",
              icon: "🎧",
            },
            {
              num: "04",
              title: "Keep the streak going",
              desc: "Your streak counts consecutive Wednesdays. See how long you can keep it up.",
              icon: "🔥",
            },
          ].map((step) => (
            <div key={step.num} className="card-cottage flex items-start gap-4 p-5 transition-all">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-butter text-2xl shadow-sm">
                {step.icon}
              </div>
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <span className="counter-retro">{step.num}</span>
                  <span className="font-display text-lg font-semibold text-syrup">{step.title}</span>
                </div>
                <p className="leading-relaxed text-waffle-dark/90">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <SyrupDrip />

      {/* Why Wednesday? */}
      <div className="w-full max-w-lg px-6 py-12 text-center">
        <h2 className="font-display mb-4 text-2xl font-bold text-syrup">
          Why Wednesday?
        </h2>
        <div className="card-cottage mx-auto max-w-md bg-waffle-texture p-7">
          <p className="text-[1.05rem] leading-relaxed text-syrup">
            A little boost for hump day. It&apos;s the middle of the week, and
            hearing a friend&apos;s voice is the perfect pick-me-up. Plus,
            &ldquo;Wednesday Waffles&rdquo; has a nice ring to it.
          </p>
        </div>
        <div className="mt-10">
          <Link
            href="/login"
            className="btn-retro-berry btn-retro px-10 py-4 text-lg"
          >
            <HeartIcon className="inline-block w-5" />
            Start Waffling
          </Link>
        </div>
      </div>

      {/* Footer — Web ring energy */}
      <footer className="mt-8 w-full border-t-2 border-dashed border-waffle-light/50 bg-linen py-8 text-center">
        <div className="mb-4 flex items-center justify-center gap-3 text-sm text-waffle-dark/60">
          <span className="text-xs">&#9664; prev</span>
          <span className="font-display px-3 font-medium tracking-wide text-waffle-dark/70">~ Wednesday Waffles ~</span>
          <span className="text-xs">next &#9654;</span>
        </div>
        <div className="webring-footer mx-auto max-w-xs">
          <p className="mb-2">
            You are visitor #<span className="counter-retro mx-1 inline-block text-xs">0042</span> to this waffle stand
          </p>
        </div>
        <p className="mt-4 text-xs text-waffle-dark/40">
          Made with <HeartIcon className="inline-block w-3 text-berry" /> and maple syrup
        </p>
        <p className="mt-1 text-xs text-waffle-dark/30">
          Best viewed with a cup of coffee in hand &bull; Est. 2026
        </p>
      </footer>
    </main>
  );
}
