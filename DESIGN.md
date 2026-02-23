# Wafflemaker Design Doc

## Visual Language
- Cottagecore / warm / gingham background
- Fonts: Fredoka (display), system sans (body)
- Colors: waffle (#C4956A), syrup (dark brown), cream, butter
- No emoji in UI buttons or labels — use plain text

## Notifications
- Push via Web Push API (W3C standard, works on iOS 16.4+ PWA)
- Notification text should be plain and clear, no emoji in notification payloads
- Button labels: "Notifications" not "🔔"
- Users must enable push notifications globally first (via Settings or dashboard prompt)
- Per-pair and per-circle overrides available inline in the conversation view
- Dashboard should hint if notifications aren't enabled yet

## Strict Mode (Wednesday-only)
- Pairs or circles can opt into "strict mode" — waffles can only be sent on Wednesdays (local time)
- **Consensus-based**: 
  - Enabling: all members must opt in for it to activate
  - Disabling: ALL members must agree to disable — one person can't unilaterally turn it off
- Show each member's vote status (opted in / not yet)
- When active, the record button is disabled on non-Wednesdays with a friendly message
- This reinforces the weekly cadence that makes Wafflemaker special

## Audio
- MediaRecorder with MIME detection (webm → mp4 fallback for Safari)
- Persistent DOM `<audio>` element for iOS Safari compatibility
- HTTP 206 range requests for mobile playback
- 5MB upload limit
- Voice messages kept for 7 days, transcripts saved forever

## Transcripts
- Web Speech API for live transcription during recording
- Editable before sending (review screen)
- Editable after sending (sender only, via View/Edit Transcript)
- Word timestamps for karaoke-style highlighting during playback
- Manual typing fallback if speech recognition doesn't capture

## Data Export
- Client-side zip creation (JSZip) — no server compute overhead
- Single waffle: audio + metadata.json
- Bulk export: all waffles in a pair/circle with index.json
- Export button in pair/circle header

## Auth
- Magic link (email) + GitHub OAuth + Google OAuth
- Custom implementation on CF Workers/D1 (no Supabase)
- Dev mode: magic link URL returned in API response when no RESEND_API_KEY

## Infrastructure
- Cloudflare Workers + D1 (SQLite) + R2 (audio storage)
- Domain: waffle.sunken.site
- VAPID keys for push in wrangler.jsonc secrets
