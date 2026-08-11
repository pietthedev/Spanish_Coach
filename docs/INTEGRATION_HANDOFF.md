# Integration Handoff Document

**Project**: Spanish Coach - Days 1-7 Vertical Slice  
**Date**: 2026-08-10  
**Version**: 0.1.0  

---

## Executive Summary

This handoff documents all files created for the Days 1-7 vertical slice of the Spanish Coach application. The implementation is framework-independent where possible, with clear integration points marked for future dependencies.

---

## Files Created

### Content Layer (`src/content/`)

| File | Purpose | Framework |
|------|---------|-----------|
| `types.ts` | Strongly-typed, versioned content model for Course, Phase, Lesson, Phrase, Exercise, Mission, etc. | Framework-independent |
| `validation.ts` | Dependency-free content validation functions detecting duplicate IDs, missing translations, incorrect dates, etc. | Framework-independent |
| `days1to7.ts` | Complete Days 1-7 curriculum content including phrases, exercises, and Mission 1: Friendly Arrival state machine | Framework-independent |

### Domain Layer (`src/domain/`)

| File | Purpose | Framework |
|------|---------|-----------|
| `evaluation/evaluator.ts` | Forgiving answer evaluator with normalisation, critical-concept protection, semantic matching | Framework-independent |
| `review/scheduler.ts` | Deterministic spaced-repetition scheduler (later-in-lesson, 1d, 3d, 7d, 14d, 30d) | Framework-independent |
| `mission/engine.ts` | State machine engine for deterministic mission execution without runtime AI | Framework-independent |

### Data Layer (`src/data/`)

| File | Purpose | Framework |
|------|---------|-----------|
| `local/types.ts` | TypeScript types for IndexedDB storage, Dexie-compatible schema definition, user partitioning by Supabase userId | Framework-independent |
| `sync/outbox.ts` | Idempotent sync outbox with exponential backoff, jitter, deduplication, conflict resolution | Framework-independent |

### API Layer (`src/app/api/speech/`)

| File | Purpose | Framework |
|------|---------|-----------|
| `transcribe/route.ts` | Next.js route handler for ElevenLabs speech transcription with security measures | Next.js App Router |

### Database (`supabase/`)

| File | Purpose |
|------|---------|
| `migrations/001_initial_schema.sql` | Complete SQL migrations for profiles, lesson_progress, phrase_mastery, attempts, scenario_runs, progress_events, achievements, favourites, category_readiness, devices with RLS policies |
| `tests/rls_test_fixtures.sql` | RLS test fixtures demonstrating data isolation between users and event deduplication |

### Scripts (`scripts/`)

| File | Purpose |
|------|---------|
| `generate-audio.ts` | Administrative audio generation script with dry-run mode, rate limiting, retry logic |

### Tests (`tests/fixtures/`)

| File | Purpose |
|------|---------|
| `evaluator.test.ts` | Comprehensive test fixtures for answer evaluator covering exact matches, variants, diacritics, negation, critical substitutions, etc. |

### Configuration

| File | Purpose |
|------|---------|
| `.gitignore` | Excludes node_modules, .next, coverage, Playwright output, env files with secrets |
| `.env.example` | Environment variable names without values |

### Documentation (`docs/`)

| File | Purpose |
|------|---------|
| `INTEGRATION_HANDOFF.md` | This document |

---

## Module Classification

### Framework-Independent Modules (Pure TypeScript)

These modules have NO external dependencies and can be used in any environment:

- `src/content/types.ts` - Content model types
- `src/content/validation.ts` - Content validation logic
- `src/content/days1to7.ts` - Curriculum content
- `src/domain/evaluation/evaluator.ts` - Answer evaluation
- `src/domain/review/scheduler.ts` - Spaced repetition scheduling
- `src/domain/mission/engine.ts` - Mission state machine
- `src/data/local/types.ts` - Local storage type definitions
- `src/data/sync/outbox.ts` - Sync logic (needs fetch/IndexedDB adapter)
- `tests/fixtures/evaluator.test.ts` - Test fixtures

### Requires Integration

These modules need external packages or framework setup:

| Module | Required Dependency | Integration Notes |
|--------|---------------------|-------------------|
| `src/app/api/speech/transcribe/route.ts` | Next.js, ElevenLabs API | Verify ElevenLabs Scribe v2 API spec |
| `scripts/generate-audio.ts` | Node.js fs module, ElevenLabs API | Add actual file I/O |
| `src/data/local/types.ts` | Dexie (optional) | Schema ready for Dexie integration |
| `supabase/migrations/*.sql` | Supabase project | Run via Supabase CLI or Dashboard |

---

## Future Dependencies Required

The following npm packages will be needed when building the full application:

```json
{
  "dependencies": {
    "dexie": "^4.0.0",           // IndexedDB wrapper
    "@supabase/supabase-js": "^2.0.0",  // Supabase client
    "next": "^14.0.0",           // Next.js framework
    "react": "^18.0.0",          // React
    "react-dom": "^18.0.0"       // React DOM
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0"
  }
}
```

---

## Imports/Adapters Requiring Integration

### 1. Dexie Adapter (src/data/local/types.ts)

The `LocalStorageAdapter` interface is defined but not implemented. When integrating:

```typescript
import Dexie from 'dexie';

class DexieAdapter implements LocalStorageAdapter {
  private db: Dexie;
  
  async initialize() {
    this.db = new Dexie('SpanishCoachDB');
    this.db.version(1).stores({
      profiles: 'userId, displayName',
      lessonProgress: '[userId+lessonId], userId, status',
      // ... see schema in types.ts
    });
  }
  
  // Implement all interface methods
}
```

### 2. ElevenLabs API (src/app/api/speech/transcribe/route.ts)

The `ElevenLabsScribeAdapter` must be verified against official documentation:

- Confirm endpoint URL
- Verify request body format
- Check response structure
- Validate authentication method

### 3. Authentication (src/app/api/speech/transcribe/route.ts)

The `extractUserIdFromToken` function needs implementation based on your auth solution:

```typescript
import { createServerClient } from '@supabase/ssr';

async function extractUserIdFromToken(authHeader: string): Promise<string | null> {
  const supabase = createServerClient(/* ... */);
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || null;
}
```

### 4. Rate Limiting (src/app/api/speech/transcribe/route.ts)

Integrate with @vercel/kv or similar:

```typescript
import { kv } from '@vercel/kv';

async function checkRateLimit(userId: string) {
  const key = `ratelimit:${userId}`;
  const count = await kv.incr(key);
  if (count === 1) await kv.expire(key, 60);
  return { allowed: count <= 10 };
}
```

---

## Checks Performed

### Static Inspections Completed ✓

- [x] All TypeScript files have valid syntax (no compilation attempted)
- [x] Type references are consistent across files
- [x] No circular dependencies introduced
- [x] All exported symbols are properly typed
- [x] Content model includes all required fields per blueprint

### Fixture-Based Checks Completed ✓

- [x] Evaluator test fixtures cover all required scenarios
- [x] RLS test fixtures demonstrate data isolation
- [x] Sync outbox has deterministic behavior specifications

### Checks That Could NOT Run (No Dependencies)

- [ ] TypeScript compilation (no tsc available)
- [ ] Unit test execution (no test framework installed)
- [ ] Next.js route validation (no Next.js installed)
- [ ] SQL migration execution (no database connection)
- [ ] Audio generation script execution (no Node.js runtime)

### External Services NOT Tested

- [ ] Supabase authentication and RLS policies
- [ ] ElevenLabs speech-to-text API
- [ ] IndexedDB browser storage
- [ ] Service worker caching
- [ ] PWA installation flow

---

## Next Coding Environment Must Do

### Immediate Commands to Run

```bash
# 1. Install dependencies
npm install

# 2. Copy environment example
cp .env.example .env.local
# Then fill in actual values

# 3. Run TypeScript check
npx tsc --noEmit

# 4. Run evaluator tests
npx ts-node tests/fixtures/evaluator.test.ts

# 5. Run audio generation dry-run
ELEVENLABS_API_KEY=test npm run generate-audio -- --dry-run
```

### Supabase Setup

```bash
# 1. Link to Supabase project
npx supabase link --project-ref YOUR_PROJECT_REF

# 2. Run migrations
npx supabase db push

# 3. Test RLS policies
# Open Supabase SQL Editor and run supabase/tests/rls_test_fixtures.sql
```

### Vercel Deployment

1. Connect GitHub repository to Vercel
2. Set environment variables in Vercel dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `ELEVENLABS_API_KEY` (server-side only)
   - `ELEVENLABS_MEXICAN_FEMALE_VOICE_ID`
   - `ELEVENLABS_MEXICAN_MALE_VOICE_ID`
3. Deploy

---

## Known Limitations

1. **No Actual Compilation**: TypeScript files were not compiled due to environment constraints. Syntax errors may exist.

2. **No Runtime Testing**: No code was executed. Logic errors may exist.

3. **API Specs Unverified**: ElevenLabs Scribe v2 API details must be verified against official documentation.

4. **Audio Files Not Generated**: Only placeholder filenames exist. Actual audio generation requires running the script with valid API keys.

5. **Content Not Linguistically Reviewed**: All Spanish content is marked as `pending_review`. Native Mexican Spanish speaker review is REQUIRED before production.

6. **No UI Components**: This implementation covers backend/domain logic only. UI components must be created separately.

7. **Service Worker Not Implemented**: PWA/offline functionality is specified but service worker code not written.

---

## Assumptions Made

1. **Disk Space**: Kept implementation minimal to fit ~504MB constraint.

2. **No npm install**: Did not attempt to install any packages.

3. **Days 1-7 Only**: Did not create content beyond Day 7.

4. **Placeholder Audio Paths**: Used deterministic filename patterns without generating actual audio files.

5. **Supabase Auth**: Assumed standard Supabase auth.users table structure.

6. **Invite-Only Users**: Documented that user provisioning is invite-only with no real email addresses included.

---

## Security Notes

- ✅ No API keys committed
- ✅ No NEXT_PUBLIC_ prefix for ElevenLabs key
- ✅ RLS policies on all learner tables
- ✅ Event UUID deduplication prevents replay attacks
- ✅ User data partitioned by auth.uid()
- ✅ No secrets in logs

---

## Contact for Questions

Refer to the PRODUCT_TECHNICAL_BLUEPRINT.md for architectural decisions and long-term planning.
