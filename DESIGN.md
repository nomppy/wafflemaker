# Wafflemaker Design Guidelines

## Visual Language
- **Aesthetic**: Cottagecore — gingham backgrounds, warm waffle tones, dashed borders, retro buttons
- **Fonts**: `font-display` (Fredoka) for headings, system sans for body
- **Colors**: cream, butter, waffle, syrup, waffle-dark (see tailwind config)
- **Components**: `card-cottage`, `btn-retro`, `bubble-mine`, `bubble-theirs`, `prompt-card`

## Icons & Emoji
- **Do not use emoji for UI controls or interactive elements** — use text labels instead
- Emoji is fine for decorative/content purposes (e.g., waffle 🧇 in marketing copy, empty states)
- For buttons and toggles, plain text labels are clearer and more accessible

## Notifications
- Notification button labels: use "Notifications" text, not 🔔
- Push notification titles: plain text, no emoji prefix (e.g., "New waffle from Kenneth", not "🧇 New waffle from Kenneth")
- Notification body: keep it conversational and short

## Layout
- Max width: `max-w-lg` (32rem) for main content
- Waffle bubbles: right-aligned for sender (`bubble-mine`), left for receiver (`bubble-theirs`)
- Sticky bottom record area with `safe-b` for mobile safe area

## Recording & Transcripts
- Live transcript shown during recording
- Review screen after stop: editable transcript + optional description
- View/Edit Transcript button on sent waffle bubbles (edit for sender, view-only for others)

## Data & Privacy
- Voice audio: kept for 7 days, then deleted
- Transcripts: kept forever
- Users can export their data (audio + metadata) as zip files
- Export is client-side (JSZip) to minimize server overhead
