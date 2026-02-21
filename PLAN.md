# Wednesday Waffles - Implementation Plan

## Overview
A lightweight web app where friends pair up and exchange async audio messages every Wednesday. Built to run at ~$0 cost using Cloudflare's free tiers.

## Tech Stack
- **Frontend**: Next.js (deployed to Cloudflare Pages)
- **Backend API**: Next.js API routes (running on Cloudflare Workers via `@cloudflare/next-on-pages`)
- **Database**: Cloudflare D1 (SQLite, free tier: 5M reads/day, 100K writes/day)
- **Storage**: Cloudflare R2 (free tier: 10GB storage, free egress)
- **Auth**: Magic link via email (Resend free tier: 100 emails/day)
- **Media**: Audio only (browser MediaRecorder API, opus/webm)

## Data Model

### Tables
- **users** - id, email, display_name, created_at
- **sessions** - id, user_id, token, expires_at
- **pairs** - id, user_a_id, user_b_id, created_at
- **waffles** - id, pair_id, sender_id, r2_key, duration_seconds, created_at, expires_at (auto-delete after 4 weeks)
- **invites** - id, from_user_id, code, accepted_by_user_id, expires_at

## Implementation Steps

### Step 1: Project scaffolding
- Init Next.js project with TypeScript
- Configure for Cloudflare Pages deployment (`@cloudflare/next-on-pages`)
- Set up Tailwind CSS
- Add wrangler.toml for D1 + R2 bindings
- Create D1 migration for the schema above

### Step 2: Auth (magic link)
- `/api/auth/send-link` - takes email, generates token, sends magic link via Resend
- `/api/auth/verify` - validates token, creates session cookie
- `/api/auth/me` - returns current user from session
- Simple middleware to protect authenticated routes
- Login page with email input

### Step 3: Pairing system
- `/api/invites/create` - generates a shareable invite code/link
- `/api/invites/accept` - accepts invite, creates a pair
- `/api/pairs` - lists current user's pairs
- UI: "Invite a friend" button that copies a link, and an accept flow

### Step 4: Audio recording & upload
- Browser-based recorder using MediaRecorder API (opus/webm)
- Recording UI: record button, timer, playback preview before sending
- `/api/waffles/upload-url` - returns a presigned R2 upload URL
- Client uploads directly to R2 (no server relay)
- `/api/waffles/create` - saves waffle metadata to D1 after upload

### Step 5: Playback & feed
- `/api/waffles/[pairId]` - lists waffles for a pair (paginated)
- `/api/waffles/[id]/play` - returns a presigned R2 download URL
- UI: conversation-style timeline showing waffles between you and your pair
- Audio player with playback speed controls

### Step 6: Reminders & cleanup
- Wednesday reminder: Cloudflare Workers Cron Trigger
  - Checks which users haven't sent a waffle this week
  - Sends a nudge email via Resend
- Cleanup cron: deletes waffles older than 4 weeks from R2 + D1

### Step 7: Polish
- PWA manifest + service worker for "add to home screen"
- Streak counter (consecutive Wednesdays with a waffle)
- Mobile-friendly responsive design (this is primarily a phone experience)

## Pages
- `/` - Landing page / marketing
- `/login` - Email input for magic link
- `/dashboard` - List of your waffle pairs, invite button
- `/pair/[id]` - Conversation view with a specific friend (record + listen)

## What's NOT in MVP
- Video support (add later)
- Group waffles (1:1 only for now)
- Push notifications (email reminders only)
- Auto-transcription (future feature)
