# Wafflemaker Design Guidelines

## Visual Style
- Cottagecore aesthetic: warm tones, gingham backgrounds, dashed borders
- Font: display (Fredoka) for headings, system for body
- Colors: waffle (golden), syrup (dark brown), cream, butter
- Cards: `card-cottage` class with dashed borders
- Buttons: `btn-retro` for primary actions

## UI Principles
- **No emoji for functional UI elements** — use text labels instead (e.g., "Notifications" not 🔔)
- Emoji are fine in content/user-facing copy where they add warmth (e.g., "Send waffle 🧇" button text)
- Keep actions discoverable — use text buttons, not icon-only
- Toggles for settings, not checkboxes
- Inline settings where possible (per-pair/circle) instead of forcing users to a separate page
- Confirmation dialogs for destructive actions (unpair, leave circle)

## Notifications
- Push via Web Push API (works on iOS 16.4+ when added to Home Screen)
- Dashboard shows a hint if push not enabled
- Per-pair/circle notification overrides accessible inline from the conversation
- Notification content: plain text, no emoji in titles

## Strict Mode
- Wednesday-only waffle sending
- Requires ALL members to opt in — any single member can disable
- Enforced server-side (UTC Wednesday check)
- Clearly shows opt-in status (X/Y opted in)

## Data Export
- Client-side zip creation (JSZip) — no server compute overhead
- Export includes: audio files + metadata.json (transcript, comments, timestamps)
- Available per-waffle and per-conversation

## Platform
- Next.js on Cloudflare Workers + D1 + R2
- PWA: installable, standalone mode, service worker for push
- Auth: magic link + GitHub OAuth + Google OAuth
