# Galaxy S23/S25 release checklist

Run every item on both the Samsung Galaxy S23 and S25 using the current stable Chrome for Android. Repeat critical items in an installed standalone PWA and an ordinary Chrome tab. Viewport-emulated Playwright results are not substitutes.

## Installation and layout

- Open the HTTPS production URL, use Chrome’s Install app action, and confirm the Rumbo name, route-mark icon, canvas splash and standalone launch.
- Check widths/rotation around 360, 390, 412 and 430 CSS pixels; ensure no horizontal scrolling, clipped Spanish punctuation or content hidden by gesture/navigation areas.
- Confirm every primary action is at least 48 CSS pixels and comfortable one-handed.
- Increase Android font size/display zoom and confirm 200% text remains usable.
- Enable Remove animations/reduced motion and confirm the mic/celebration remain understandable without motion.

## Audio

- Download the Days 1–7 pack on Wi-Fi. Put the phone in airplane mode, force-close the PWA, relaunch, and play normal and slow audio from multiple lessons.
- Verify approved Mexican-Spanish files—not device preview speech—play in production.
- Test phone speaker, wired adapter if used and Bluetooth earbuds.
- Start playback, receive a phone call/audio-focus interruption, return, and confirm controls recover without overlapping audio.
- Check volume at quiet and noisy realistic levels; confirm replay labels are announced by TalkBack.

## Microphone permissions and recording

- First attempt: confirm Rumbo explains processing before the Android permission prompt and that the prompt occurs only after tapping.
- Accept: record 1–6 seconds, watch the visible timer, stop, hear playback, receive a structured result, retry and continue.
- Deny: confirm a plain explanation plus retry/continue path; lesson completion remains possible.
- Revoke in Chrome site settings, return to the open PWA, and retry.
- Leave the permission prompt unanswered, background/return, and confirm the UI is not permanently stuck.
- Test silence, whisper/too quiet, >10 seconds, another app using the mic, Bluetooth mic, screen lock and an incoming call.
- After every stop/cancel/error, verify Android’s microphone privacy indicator turns off promptly.
- Repeat quiet-room and moderate café/street-noise attempts. Record false rejections separately from pronunciation observations.

## Speech correctness

- Test exact, accent-less transcript, optional subject and approved alternate phrasing.
- Deliberately omit required words and confirm “Almost there.”
- Deliberately reverse protected meanings: `no`, number, `con/sin`, destination and urgency fixtures when those content phases arrive; they must not pass via similarity.
- Disable the network mid-recording. Confirm local playback and “online feedback unavailable,” never a fabricated score.
- Confirm no screen says pronunciation score, percent accuracy or fluent.

## Progress, accounts and sync

- Sign in as learner A on S23 and learner B on S25; complete different lessons and confirm no cross-profile progress.
- Complete Day 1 online, refresh, force-close/relaunch and confirm Day 2 is next.
- Complete a lesson offline, force-close/relaunch offline, confirm progress, reconnect and watch status become Synced once.
- Replay/suspend during sync and confirm points/completion are not duplicated.
- Sign learner A into the second phone and confirm monotonic completion/conflict handling.
- Sign out/switch account and confirm cached learner data is never shown as the other learner’s cloud data.

## Mission and review

- Complete all six Friendly Arrival intents with model phrases and accepted variants.
- Fail the same turn twice; confirm hint then repair without advanced Spanish.
- Confirm the mission cannot finish when a required intent is skipped.
- Complete reviews across day boundaries using Africa/Johannesburg dates; confirm minor issues return sooner and technical failures do not weaken mastery.
- Miss one day and confirm the flexible rhythm remains while total/longest progress is preserved.

## Offline pack, storage and updates

- Verify pack status after download, then clear only Chrome cache/storage and confirm Rumbo accurately reports the missing pack.
- Simulate low storage/eviction if possible; reopen and use Repair download.
- Begin a lesson on the old deployed version, deploy an update, return and confirm no reload. Finish/exit, accept Update now and verify progress remains.
- Test a partial audio download and lost connection; app shell and text remain usable and pack reports partial.

## Accessibility and security observations

- Complete Day 1 with TalkBack: navigation, progress bar, audio speed, reveal, answers, microphone, feedback and completion.
- Confirm focus order and labels; success/failure must include text/icon, not colour alone.
- Inspect Chrome site data/DevTools remote debugging: no ElevenLabs key, Supabase secret/service-role key, raw recording or signed credential in Cache Storage/IndexedDB.
- Review Vercel function logs after voice use: no raw audio, transcript, request body, email or secret.

Record device model, Android build, Chrome version, installed/tab mode, network, audio route, result and evidence for every failure.
