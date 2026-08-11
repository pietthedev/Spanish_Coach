# Rumbo

Rumbo is a mobile-first, installable Mexican-Spanish learning PWA. This repository implements the production-shaped seven-day vertical slice described in `PRODUCT_TECHNICAL_BLUEPRINT.md`.

The app is usable without credentials in a visibly labelled local demo mode. Demo progress stays in IndexedDB. Production authentication, cloud sync and live speech transcription activate only after their environment variables and services are configured.

## What is included

- Next.js 16 App Router, strict TypeScript, Tailwind CSS 4, ESLint and Prettier.
- Responsive Today, Path, Practice, Progress, Settings, setup, lesson, mission, completion, sign-in and offline-pack screens.
- Validated course content for 10–16 August 2026: 15 productive phrase chunks and one deterministic six-intent Friendly Arrival mission.
- Layered answer evaluation, protected meaning-changing concepts and deterministic spaced review scheduling.
- Tap-to-toggle MediaRecorder flow with permission, interruption, silence, offline, timeout, retry and continue paths.
- Server-only ElevenLabs Scribe v2 proxy and a dry-run-capable, resumable TTS generation script.
- Dexie local projections and idempotent sync outbox.
- Supabase passwordless authentication utilities, invite allowlist, migration and RLS isolation test.
- Serwist service worker, install manifest, versioned offline pack and non-disruptive update prompt.
- Unit and Playwright test suites.

All Spanish and voice choices remain marked `required` for qualified Mexican-Spanish human review. Device speech synthesis is a clearly labelled development preview, not production audio.

## Requirements

- Node.js 20.9 or newer (Node 22 LTS is recommended for deployment parity)
- npm 10 or newer
- Optional: Supabase CLI for local database and RLS tests
- Optional: approved ElevenLabs account/key and two approved Mexican-Spanish voice IDs

## Local setup

1. Run `npm install`.
2. Copy `.env.example` to `.env.local` and fill only the services you want to test. Never commit `.env.local`.
3. Run `npm run validate:content` and `npm run dev`.
4. Open `http://localhost:3000`. With no Supabase values the app clearly runs as `Traveller` in device-local demo mode.

Useful checks:

```text
npm run validate:content
npm run typecheck
npm run lint
npm test
npm run security:secrets
npm run build
npm run test:e2e
```

Playwright browser binaries may need a one-time `npx playwright install chromium`. That downloads a browser and should be done only in an approved development environment.

## Environment variables

| Variable                               | Scope             | Purpose                                                                      |
| -------------------------------------- | ----------------- | ---------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | browser-safe      | Supabase project URL                                                         |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | browser-safe      | Supabase publishable key; RLS is the security boundary                       |
| `NEXT_PUBLIC_APP_URL`                  | browser-safe      | Exact local/preview/production origin used in auth redirects                 |
| `NEXT_PUBLIC_CONTENT_VERSION`          | browser-safe      | `2026.1` for this slice                                                      |
| `ELEVENLABS_API_KEY`                   | server/admin only | TTS and Scribe requests; never use a `NEXT_PUBLIC_` prefix                   |
| `ELEVENLABS_VOICE_ID_PRIMARY`          | server/admin only | Approved normal-speed Mexican-Spanish voice                                  |
| `ELEVENLABS_VOICE_ID_SECONDARY`        | server/admin only | Approved alternate/slow Mexican-Spanish voice                                |
| `ELEVENLABS_TTS_MODEL_ID`              | server/admin only | Defaults to `eleven_multilingual_v2`                                         |
| `ELEVENLABS_STT_MODEL_ID`              | server only       | Defaults to `scribe_v2`                                                      |
| `INVITED_EMAIL_HASHES`                 | server only       | Comma-separated lowercase-email SHA-256 hashes for exactly two invited users |
| `SPEECH_RATE_LIMIT_PER_MINUTE`         | server only       | Defaults to 20 per user/IP                                                   |
| `SPEECH_MAX_BYTES`                     | server only       | Defaults to 1,000,000 bytes                                                  |
| `VOICE_FEATURE_MODE`                   | server only       | `fixture` locally or `batch` for live Scribe                                 |

The server checks an email hash before asking Supabase to send an OTP and uses `shouldCreateUser: false`; public signup is therefore not available. Never log or commit the underlying email addresses.

## Supabase setup and invitations

1. Create a Supabase project in the desired region.
2. Apply `supabase/migrations/202608100001_rumbo_vertical_slice.sql` using `supabase db push` or the SQL editor.
3. In Authentication → URL Configuration, set the production Site URL and allow local, Vercel Preview and production `/auth/callback` URLs.
4. In Authentication → Users, choose **Add user → Send invitation** for each of the two travellers. This is an admin action; do not build a public invitation endpoint.
5. Set each user’s `display_name` metadata if desired, or update their own `profiles.display_name` after first sign-in.
6. Compute SHA-256 over each trimmed, lowercase email locally and put only the two hashes in `INVITED_EMAIL_HASHES`, separated by commas.
7. Set `NEXT_PUBLIC_SUPABASE_URL` and the current publishable key. Do not expose a secret/service-role key; the app does not require one.
8. Run the pgTAP file `supabase/tests/rls_isolation.sql` against a disposable/local database. It proves one JWT sees and changes only its own profile/data.

Every learner table has RLS. The profile trigger creates one profile per invited auth user. `progress_events.id` is the client UUID and server primary key, so replayed outbox events cannot duplicate points/events.

## ElevenLabs voices and audio generation

1. In ElevenLabs, shortlist at least two voices whose documented/licensed use fits the project.
2. Have a qualified Mexican-Spanish reviewer evaluate each voice on all 15 phrases at normal and 0.75 speed. “Spanish supported” is not evidence of a Mexican accent.
3. Put the approved IDs and restricted API key in `.env.local`. Use Vercel Sensitive Environment Variables in Preview/Production.
4. Review the intended work without making API calls:

   `npm run generate:audio -- --dry-run`

5. Generate the approved files:

   `npm run generate:audio`

The script reads the key only from the process environment, never logs it, uses current `POST /v1/text-to-speech/:voice_id`, produces deterministic phrase/speed filenames plus a content-hash manifest, skips unchanged assets and retries 429/5xx responses. Generated files are ignored until voice approval. After review, either intentionally add the approved static assets to Git for Vercel CDN delivery or upload them to a public-read Supabase Storage bucket and update the content manifest URLs. Do not silently ship device synthesis as production audio.

For live exercises set `VOICE_FEATURE_MODE=batch`. `/api/speech/transcribe` accepts only authenticated, short, bounded audio, fixes `language_code=es`, uses approved phrase keyterms, times out, returns structured evaluation and does not persist raw audio. Scribe is transcription evidence—not pronunciation scoring.

## Offline and update behaviour

- The production build generates `public/sw.js`; development intentionally disables the service worker to prevent stale-code confusion.
- Today, Path, Practice, Progress, lesson routes and the fallback are cached after the Days 1–7 pack is downloaded.
- Approved hashed/static audio is cacheable. Missing development audio is reported as a partial pack.
- Offline microphone work can be recorded and played back locally, but the UI explicitly says it is not scored.
- Lesson actions commit to IndexedDB before a sync attempt. Foreground startup, `online` events and a 30-second foreground interval retry the outbox with bounded backoff and jitter.
- A waiting worker presents an update prompt. It is disabled while `body[data-lesson-active=true]`, so an active lesson or recording is never forcibly reloaded.

## Vercel deployment

1. Push the repository to a private GitHub repository; connect it to a new Vercel project.
2. Use the detected Next.js framework and `npm run build`. Node 22 is recommended.
3. Add browser-safe variables normally. Add `ELEVENLABS_API_KEY`, voice IDs, invite hashes and operational caps as Vercel **Sensitive** variables with distinct Preview/Production values.
4. Add each exact Vercel Preview/production callback origin to Supabase Auth’s redirect allowlist.
5. Deploy, then inspect the browser bundle/source maps and Vercel logs for secret patterns. `npm run security:secrets` covers repository files; it is not a replacement for deployed-bundle inspection.
6. Install on both phones only after the production manifest, HTTPS, audio pack and service-worker update flow pass the physical checklist.

## Privacy and account lifecycle

Rumbo stores structured attempt outcomes, not voice recordings. The request body and transcript are excluded from application analytics/logging. `/api/account/export` exports RLS-visible learner rows. `DELETE /api/account` deletes the learner profile and cascaded app data, then signs out; an administrator must also delete the Supabase Auth identity to complete deletion. This limitation is stated in the response and should become an audited admin workflow before broader use.

## Testing limits

Viewport emulation is useful for layout regression but is not Samsung hardware testing. Microphone routing, Chrome permission revocation, Android storage eviction, Bluetooth/phone-call interruption, standalone installation and OS background limits require both physical devices. See [the physical-device checklist](docs/PHYSICAL_DEVICE_CHECKLIST.md).

## Architecture notes

- No ORM, CMS or state-management framework was introduced.
- Repository content is deterministic and Zod-validated at build time.
- Auth uses current `@supabase/ssr` cookie utilities and PKCE callback handling.
- The PWA build uses the maintained Serwist integration with webpack because that is its compatible Next.js integration path.
- An in-memory server rate limiter is sufficient as a first defense for two invite-only users; Vercel instances do not share it. Replace it with a durable rate limiter before opening access beyond the two-user scope.
