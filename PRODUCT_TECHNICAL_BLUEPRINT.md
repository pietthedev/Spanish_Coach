# Mexico-ready Spanish PWA — product and technical blueprint

**Planning baseline:** 10 August 2026  
**Course window:** Monday 10 August–Monday 19 October 2026 (71 learning days); departure Tuesday 20 October 2026  
**Audience:** two English-speaking adult beginners from South Africa  
**Target:** practical, polite, commonly spoken Mexican Spanish—not fluency  
**Status:** blueprint for approval; no application implementation is included

---

## 1. Executive recommendation

Build a small, curated, mobile-first PWA whose central loop is **hear → understand → retrieve → say → use in a scenario → schedule review**. The app should teach roughly **115–135 high-value phrase chunks** plus recognition of approximately **80 likely replies and variants**. It should not try to compress a general A1 Spanish course into 71 days.

Use four primary destinations, not six: **Today, Path, Practice, Progress**. Put profile/settings behind the avatar. “Speak” is a mode within Today and Practice; “Review” is the default item in Practice. This reduces one-handed navigation and choice overhead.

Recommended v1 stack:

- Next.js App Router + TypeScript + Tailwind CSS on Vercel.
- Supabase Postgres + Auth + Row Level Security. Create two invite-only passwordless accounts, one durable learner profile per account. This is only slightly more work than a local profile picker and prevents lost/crossed progress.
- Curated, versioned course content stored as validated JSON/TypeScript data at build time; learner state in Postgres. Do not put the curriculum in editable production database tables for the first release.
- IndexedDB for content manifests, downloaded audio, the outbox, and local progress snapshots; Cache Storage for application shell/static assets.
- ElevenLabs multilingual TTS to pre-generate reviewed slow and normal Mexican-Spanish audio; Scribe v2 for short utterance transcription; ElevenAgents only for later, tightly constrained missions.
- A server-only ElevenLabs API key in Vercel Sensitive Environment Variables. For browser streaming, issue ElevenLabs’ documented 15-minute single-use Scribe token or 15-minute agent signed URL only after app authentication and rate checks.

The most important scope decision is to **defer open-ended AI conversation until the deterministic lesson, review, offline pack, and short-answer speech loop are excellent**. Early missions should use authored branching dialogue. Add ElevenAgents behind a feature flag during Phase 5 only if it obeys vocabulary constraints in device tests.

The most important accuracy decision is to **not advertise pronunciation scoring**. ElevenLabs Scribe transcribes speech; its public documentation does not expose a phoneme-level learner pronunciation score. The MVP can assess answer meaning and estimated intelligibility from transcripts, detect missing/key words, and offer phrase-specific coaching. Any “pronunciation quality” label must be either learner self-assessment, a conservative inference, or later supplied by a purpose-built pronunciation-assessment vendor.

## 2. Honest assessment of 71 days

At 5–10 minutes per person per day, each learner has **5.9–11.8 total hours**; a realistic median is about 8 hours. That can create useful automaticity for a narrow travel repertoire, especially when the phrases are rehearsed aloud. It cannot reliably deliver broad A1 competence, free conversation, robust grammar, or comprehension of rapid unconstrained native speech.

By departure, a consistent learner should be able to:

- open and close polite interactions; introduce themselves and South Africa;
- say they speak little Spanish and repair communication;
- transact in predictable restaurant, shop, taxi, airport and hotel scripts;
- ask essential questions and recognise a small set of likely short answers;
- handle numbers, prices and time with visual/context support;
- request urgent help and show an offline full-screen phrase when speech fails;
- sustain a friendly 3–5-turn exchange when the other person accommodates a beginner.

They should not expect to:

- follow group conversation, slang-heavy speech, announcements or complex directions unaided;
- negotiate nuanced medical, legal or financial matters;
- understand every regional accent or produce a native accent;
- generate unfamiliar sentences from grammar rules under pressure.

Success is therefore defined as **intelligible task completion and confident repair**, not grammatical perfection. The product should show a readiness estimate, never a claim of proficiency or safety.

## 3. Competitor and learning-method research

### Patterns worth adopting

| Product                  | Observed current pattern                                                                                                                           | Adopt                                                                                              | Deliberately avoid                                                                      |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Duolingo                 | Bite-sized path, speaking from early lessons, targeted Practice areas, mistake review, spaced practice and visible completion                      | One obvious next lesson, immediate interaction, mixed review, small celebrations                   | Punitive hearts, leaderboard pressure, novelty phrases, excessive currencies            |
| Babbel                   | Practical conversational language, expert-authored 10–15 minute lessons, native audio and speech recognition                                       | Real situations, short explanations, phrase chunks, speech embedded in context                     | 10–15 minute default is too long for this brief; cap normal flow near 7 minutes         |
| Busuu                    | Topic-focused 3–5 minute lessons, controlled then freer practice, weak/medium/strong review, CEFR-bounded AI conversations, native/fluent feedback | Communicative goal per lesson, weak-item queue, goal-bounded scenarios, post-conversation feedback | Community dependency and a general CEFR syllabus are unnecessary for two travellers     |
| Memrise                  | Increasing-interval reviews and exposure to real speakers/voices in context                                                                        | Multiple Mexican voices and speeds; recognition before production; contextual memory               | Point accumulation as a proxy for readiness                                             |
| Pimsleur                 | Graduated interval recall, anticipation (prompt, pause, response, reinforcement), core vocabulary                                                  | Audio-first retrieval pauses and whole phrase chunks                                               | 30-minute audio lesson format; opaque linearity without visual/offline reference        |
| Speaking-focused AI apps | Low-stakes role-play, turn-taking, replay, transcript and targeted correction                                                                      | Constrained mission role-play after the language has been taught                                   | Open chat on day one, advanced surprise language, overly confident pronunciation scores |

Sources: [Duolingo speaking design](https://blog.duolingo.com/covering-all-the-bases-duolingos-approach-to-speaking-skills/), [Duolingo spaced repetition](https://blog.duolingo.com/spaced-repetition-for-learning/), [Babbel Method](https://www.babbel.com/en/magazine/how-babbel-method-makes-easy-learn-language), [Busuu methodology](https://www.busuu.com/en/it-works/busuu-methodology), [Busuu Conversations](https://www.busuu.com/en/languages/speak-fluently-with-busuu-conversations), [Memrise approach](https://www.memrise.com/about), [Pimsleur Method](https://www.pimsleur.com/the-pimsleur-method/).

### Learning-method synthesis

1. **Spaced retrieval, not re-reading.** A phrase is due according to learner performance. Default intervals after a successful recall: later in the lesson, +1 day, +3, +7, +14, +30; failures return today or tomorrow. The exact scheduler can be tuned from observed data.
2. **Chunks before grammar.** Store and retrieve _¿Me puede ayudar?_ as a useful unit. Give only “micro-grammar” that prevents a travel error (for example, _puede_ is the polite “can you”).
3. **Comprehension is bidirectional.** Teach likely replies at the same time as the question: _a la derecha/izquierda, aquí/allá, sí/no, en efectivo/con tarjeta, está incluido/no está incluido_.
4. **Audio variability.** Use at least two reviewed Mexican voices across the course and normal/slow versions. High-variability phonetic training research finds meaningful gains in L2 speech perception and some transfer to new stimuli; variability must remain intelligible for beginners ([2025 meta-analysis of 79 studies](https://www.cambridge.org/core/journals/studies-in-second-language-acquisition/article/high-variability-phonetic-training-hvpt-a-metaanalysis-of-l2-perceptual-training-studies/6ABB8C1F32D88D53EA8D05A4565E76F6)).
5. **Shadowing is a tool, not the whole method.** Short listen-and-repeat work can train perception/imitation, but evidence does not justify replacing retrieval and comprehension with parroting ([42-day shadowing study](https://www.jstage.jst.go.jp/article/let/59/0/59_77/_article/-char/en)).
6. **Scaffold then fade.** Spanish + English + aid → Spanish + optional English → audio + intent → situation alone. English never disappears from emergency/reference content.
7. **Correct for meaning first.** Early confidence depends on successful communication. Correct one high-impact issue at a time; do not surface a red error state for harmless accent/article variation.

## 4. Product principles

1. **Trip value per minute:** every taught item must plausibly help in Mexico.
2. **Hear the answer too:** no question enters the course without likely responses.
3. **Speech from day one, conversation after preparation.**
4. **Curated core, bounded variation:** AI may vary details, never invent learning outcomes.
5. **Understandable beats perfect:** meaning-changing errors matter; accent does not equal failure.
6. **One thumb, one decision:** a persistent bottom action and 48px minimum targets.
7. **Local-first resilience:** completed work is written locally before network sync.
8. **Progress without guilt:** a flexible streak and catch-up plan; no lost status.
9. **Privacy is visible:** explain when voice leaves the phone; retain as little as possible.
10. **Show evidence, not false precision:** readiness is category evidence with confidence bands, not a magical 92% fluency number.

## 5. User journey

**First run (3 minutes):** install prompt education → sign in with invited email/magic link or OTP → name/avatar → audio check → contextual microphone explanation → microphone test → download first seven days → 45-second “what you can achieve” orientation → Day 1.

**Daily return:** Today opens directly to one primary card (“7-minute lesson”) plus the departure countdown and at most one due-review chip. The lesson starts with audio; a compact progress bar shows 1/7 steps. Completion writes locally, then syncs. The app offers “Done for today” first and “Keep practising” second.

**Weekly:** a Mexico Mission replaces most new content. The learner sees the goal, practises 2–3 weak chunks, completes an authored scenario, then receives evidence-based category feedback.

**Missed day:** Today says “Welcome back—your trip plan has adjusted.” It inserts the most valuable missed material into the next 2–3 sessions and offers a 3-minute Catch-up. The visible streak becomes a **rhythm**: full flame for completion, outlined flame for a planned/rest/catch-up day. One miss does not reset the longest streak or readiness.

**Before departure:** Day 64 prompts Travel Pack download. Day 71 ends with the offline pack, emergency card, favourites, and category-specific “last look” lists.

## 6. Complete 71-day curriculum map

Each “language” cell is a small teachable group, normally 2–3 productive chunks plus short receptive replies. Mission/review days introduce little or nothing new. Mexican usage must receive human review before publishing.

### Phase 1 — Foundations and repair (Days 1–12; 10–21 Aug)

| Day/date    | Goal and core language                                 | Listening/retrieval scenario                              |
| ----------- | ------------------------------------------------------ | --------------------------------------------------------- |
| 1 · Aug 10  | _Hola; buenos días; gracias_                           | Choose time-appropriate greeting; greet a host            |
| 2 · Aug 11  | _Por favor; de nada; con permiso_                      | Hear thanks/reply; pass politely through a space          |
| 3 · Aug 12  | _Me llamo…; mucho gusto; ¿cómo se llama?_              | Introductions with formal default                         |
| 4 · Aug 13  | _Somos de Sudáfrica; soy de Sudáfrica_                 | Hear _¿De dónde son?_; introduce one/both travellers      |
| 5 · Aug 14  | _Hablo un poco de español; no hablo mucho español_     | Hear _¿Habla español?_; set expectations                  |
| 6 · Aug 15  | _¿Puede hablar más despacio?; más despacio, por favor_ | Recognise _claro/sí, por supuesto_; request slower speech |
| 7 · Aug 16  | **Mission 1: Friendly arrival**                        | Greet, introduce, origin, little Spanish, thanks          |
| 8 · Aug 17  | _¿Puede repetir?; otra vez, por favor; no entendí_     | Distinguish repeat/slow-down repair                       |
| 9 · Aug 18  | _¿Qué significa…?; ¿cómo se dice … en español?_        | Ask meaning; hear a short explanation without penalty     |
| 10 · Aug 19 | _Sí; no; tal vez; está bien_                           | Recognise acceptance/refusal/uncertainty in natural speed |
| 11 · Aug 20 | _Perdón/disculpe; lo siento; no pasa nada_             | Polite attention versus apology; hear reassurance         |
| 12 · Aug 21 | Foundation checkpoint                                  | Audio-only mixed repair dialogue; weak-item reset         |

### Phase 2 — Food, shopping and money (Days 13–25; 22 Aug–3 Sep)

| Day/date    | Goal and core language                                       | Listening/retrieval scenario                                                                                      |
| ----------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| 13 · Aug 22 | Numbers 0–10; _uno/dos…; ¿cuántos?_                          | Quantities for tickets/items                                                                                      |
| 14 · Aug 23 | **Mission 2: Café greeting and order**                       | _Quisiera…; un café/agua, por favor_ with known politeness                                                        |
| 15 · Aug 24 | _Quisiera…; para mí…; ¿me da…?_                              | Three natural ordering frames; accept any appropriate one                                                         |
| 16 · Aug 25 | Drinks: _agua natural/mineral; con/sin hielo; una cerveza_   | Hear size/type choices: _¿con gas o sin gas?_                                                                     |
| 17 · Aug 26 | _¿Qué recomienda?; ¿qué lleva?_                              | Hear a simple recommendation and ingredient list                                                                  |
| 18 · Aug 27 | _Sin… por favor; soy alérgico/alérgica a…_                   | Ingredient safety; explicit warning that app is not medical assurance                                             |
| 19 · Aug 28 | _No muy picante; ¿pica mucho?; poquito/mucho_                | Mexican _picar_; recognise heat replies                                                                           |
| 20 · Aug 29 | _Para comer aquí/para llevar; ¿algo más?; nada más_          | Counter-service branching                                                                                         |
| 21 · Aug 30 | **Mission 3: Order a meal**                                  | Greet, order, clarify ingredient/heat, respond to _¿algo más?_                                                    |
| 22 · Aug 31 | _La cuenta, por favor; ¿está incluido el servicio?_          | Hear _sí/no, se la traigo_; bill and service context                                                              |
| 23 · Sep 1  | Numbers 11–100 in price families; _¿cuánto cuesta?_          | Discriminate 15/50, 60/70; price cards in MXN                                                                     |
| 24 · Sep 2  | _¿Aceptan tarjeta?; en efectivo/con tarjeta; ¿tiene cambio?_ | Payment terminal/cash replies                                                                                     |
| 25 · Sep 3  | **Mission 4: Market purchase**                               | Ask price, confirm _¿son ___ pesos?_, quantity, appropriate light price clarification; no blanket haggling lesson |

### Phase 3 — Transport, time and directions (Days 26–38; 4–16 Sep)

| Day/date    | Goal and core language                              | Listening/retrieval scenario                                         |
| ----------- | --------------------------------------------------- | -------------------------------------------------------------------- |
| 26 · Sep 4  | _¿Dónde está…?; el baño/la salida/la entrada_       | Locate essentials; hear _aquí/allá_                                  |
| 27 · Sep 5  | _A la derecha; a la izquierda; todo derecho_        | Point/arrow comprehension at normal speed                            |
| 28 · Sep 6  | **Mission 5: Find the restroom/gate**               | Ask, repair, follow one- and two-step direction                      |
| 29 · Sep 7  | _Cerca/lejos; aquí/allí; enfrente de…_              | Distance/location contrasts                                          |
| 30 · Sep 8  | _¿Cómo llego a…?; ¿puede mostrarme en el mapa?_     | Use map as communication support                                     |
| 31 · Sep 9  | _Al aeropuerto/al hotel, por favor; esta dirección_ | Taxi/rideshare destination                                           |
| 32 · Sep 10 | _¿Cuánto tarda?; ¿cuánto tiempo?; unos ___ minutos_ | Hear approximate journey time                                        |
| 33 · Sep 11 | _¿Cuánto va a costar?; ¿es el precio total?_        | Confirm fare without adversarial bargaining                          |
| 34 · Sep 12 | _Aquí está bien; por favor, pare aquí; gracias_     | End taxi ride safely/politely                                        |
| 35 · Sep 13 | **Mission 6: Taxi to hotel**                        | Destination, duration, fare, arrival, payment                        |
| 36 · Sep 14 | _¿A qué hora sale/llega?; a las…_                   | Whole/half hours; hear delay/on-time: _retrasado/a tiempo_           |
| 37 · Sep 15 | _¿Dónde compro los boletos?; dos boletos para…_     | Bus/airport ticket counter; _ida/ida y vuelta_ recognition only      |
| 38 · Sep 16 | Transport checkpoint                                | Mixed station announcement fragments, platform/gate, time and repair |

### Phase 4 — Accommodation and practical problems (Days 39–49; 17–27 Sep)

| Day/date    | Goal and core language                                              | Listening/retrieval scenario                                    |
| ----------- | ------------------------------------------------------------------- | --------------------------------------------------------------- |
| 39 · Sep 17 | _Tengo/tenemos una reservación a nombre de…_                        | Receptionist asks _¿a nombre de quién?_                         |
| 40 · Sep 18 | _Quisiera registrarme; una habitación para dos_                     | Check-in and occupancy                                          |
| 41 · Sep 19 | _¿A qué hora es el desayuno/la salida?_                             | Hear time and location response                                 |
| 42 · Sep 20 | **Mission 7: Hotel check-in**                                       | Reservation, names, room, breakfast, thanks                     |
| 43 · Sep 21 | _La llave no funciona; no hay agua caliente; hay un problema con…_  | Report one concrete room problem                                |
| 44 · Sep 22 | _Necesito ayuda; ¿me puede ayudar?; es urgente_                     | Triage urgent versus non-urgent                                 |
| 45 · Sep 23 | _Perdí mi teléfono/cartera/pasaporte; ¿lo encontró?_                | Lost-item desk; hear _sí/no, ¿dónde?_                           |
| 46 · Sep 24 | _¿Dónde hay una farmacia/un médico?; me siento mal_                 | Seek healthcare; recognise _cerca/a dos calles_                 |
| 47 · Sep 25 | _Llame a una ambulancia/a la policía; emergencia_                   | Emergency commands; prominent 911 Mexico note in reference pack |
| 48 · Sep 26 | Body/problem essentials: _me duele aquí; necesito mis medicamentos_ | Point-and-show fallback; not diagnosis vocabulary               |
| 49 · Sep 27 | **Mission 8: Solve a practical problem**                            | Lost item or room problem; ask, understand next step, repair    |

### Phase 5 — Short friendly conversations (Days 50–61; 28 Sep–9 Oct)

| Day/date    | Goal and core language                                                           | Listening/retrieval scenario                                      |
| ----------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 50 · Sep 28 | _¿Cómo está?; muy bien/bien/cansado/a; ¿y usted?_                                | Formal-friendly small talk                                        |
| 51 · Sep 29 | _Nos gusta México; es muy bonito; la comida está muy rica_                       | Genuine compliments; Mexican _rico_ for tasty                     |
| 52 · Sep 30 | _Es nuestra primera vez en México; estamos de vacaciones_                        | Hear _bienvenidos/que disfruten_                                  |
| 53 · Oct 1  | _¿Qué lugar recomienda?; ¿qué podemos visitar?_                                  | Recognise one attraction and location clue                        |
| 54 · Oct 2  | Weather comfort: _hace calor/frío; está lloviendo_                               | Short elevator/taxi small talk                                    |
| 55 · Oct 3  | _Hoy/mañana; lunes…domingo; el veinte de octubre_                                | Confirm dates; booking context                                    |
| 56 · Oct 4  | **Mission 9: Chat with a local**                                                 | Greeting, origin, first visit, compliment, recommendation, close  |
| 57 · Oct 5  | _¡Qué padre!; qué bueno; órale_ recognition; neutral productive replies          | Mexico-specific informal listening; do not force slang production |
| 58 · Oct 6  | _¿Me toma una foto?; ¿podría tomar una foto?_                                    | Tourist request; accept/refuse politely                           |
| 59 · Oct 7  | Invitations/closing: _sí, gracias; no, gracias; hasta luego; que tenga buen día_ | Exit gracefully                                                   |
| 60 · Oct 8  | Conversation repair under speed: _entendí \___; no entendí lo último_            | Confirm partial understanding                                     |
| 61 · Oct 9  | Conversation checkpoint                                                          | Authored 5-turn adaptive conversation using only learned chunks   |

### Phase 6 — Mexico simulations and departure readiness (Days 62–71; 10–19 Oct)

| Day/date    | Goal                                | Simulation and review focus                                                                              |
| ----------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 62 · Oct 10 | Weakest-category clinic             | Scheduler selects at most six due chunks; no new content                                                 |
| 63 · Oct 11 | **Mission 10: Airport arrival**     | Sign/announcement recognition, exit, taxi, repair                                                        |
| 64 · Oct 12 | Download Travel Pack                | Verify offline phrase/audio/search; emergency card drill                                                 |
| 65 · Oct 13 | Restaurant under realistic speed    | Alternate voice, menu choices, ingredients, bill, payment                                                |
| 66 · Oct 14 | Hotel + room problem                | Check-in then report one fault; listen without text first                                                |
| 67 · Oct 15 | **Mission 11: Market + directions** | Price, payment, polite clarification, two-step directions                                                |
| 68 · Oct 16 | Emergency and lost-item recall      | Audio-free prompt, then noisy audio; show-phrase fallback                                                |
| 69 · Oct 17 | Friendly conversation simulation    | 5–7 turns, constrained vocabulary, graceful close                                                        |
| 70 · Oct 18 | **Grand Mexico Mission**            | Airport → taxi → hotel → dinner; category evidence and retry                                             |
| 71 · Oct 19 | Confidence day                      | Personal weak 10, favourites, emergency card, offline verification; celebrate readiness, no exam framing |

### Content limits and sequencing rules

- Hard cap: three new productive chunks on a normal day; mission days normally zero.
- Each new question stores 2–5 likely receptive replies.
- Numbers are practised as discriminations and real price/time patterns, not exhaustive counting recitation.
- _Usted_ is the safe productive default with adult strangers; learners recognise informal _tú_ but do not study a conjugation table.
- Teach neutral, widely understood phrases for production. Mark Mexican colloquialisms as recognition-only unless human review says otherwise.
- Food allergy content must instruct learners to carry a written allergy card; language practice is not a safety guarantee.

## 7. Daily lesson format

Target median: **6½ minutes**, hard design target under 10 minutes.

| Step                |    Time | Interaction                                                            |
| ------------------- | ------: | ---------------------------------------------------------------------- |
| Welcome + retrieval |  45–75s | 2–3 due items; audio or English intent, answer before reveal           |
| New chunk A         |     45s | Normal audio, Spanish, meaning; slow audio/pronunciation aid on demand |
| Notice + shadow     |  30–45s | One useful sound/rhythm note; listen, pause, repeat                    |
| New chunk B/C       |  60–90s | Same, linked situation; never unrelated words                          |
| Comprehension       |  45–60s | Hear another voice; select meaning or likely response                  |
| Speaking            |  60–90s | Hold/tap to speak; forgiving evaluation; one retry suggested           |
| Micro-scenario      | 60–120s | 2–4 authored turns; English support fades by phase                     |
| Completion          |  20–30s | “You can now…” outcome, travel points, readiness evidence, sync state  |

If time exceeds 10 minutes, the product should offer “Finish for today” after the scenario and schedule remaining review; it should not trap the learner.

## 8. Speech and pronunciation-evaluation design

### Separate four constructs

| Construct                      | What v1 can claim                                                     | Evidence                                                                                |
| ------------------------------ | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Transcription accuracy         | “The service heard…” with uncertainty                                 | Scribe transcript, timing, language, provider errors; never ground truth                |
| Answer correctness             | Intended meaning matched / partly matched / not matched               | Normalised transcript, accepted variants, required/forbidden concepts, scenario state   |
| Pronunciation quality          | Only phrase-specific coaching or “likely understandable,” with caveat | Multiple ASR passes/confidence proxies plus curated error rules; no phoneme score claim |
| Conversational appropriateness | Whether the response completes this turn politely and plausibly       | Curated intent/slot rules or bounded evaluator, independent of accent                   |

### Recommended interaction pipeline

1. Explain mic use before the first browser prompt; request permission only after a user tap.
2. Capture mono audio with browser MediaDevices/MediaRecorder; show clear idle/listening/processing/success/failure states, elapsed time and cancel.
3. For 1–6 second exercises, send the recording to a same-origin authenticated route handler, which calls Scribe v2 with Spanish fixed and phrase keyterms where supported. This is simpler to secure/debug than realtime streaming and costs less.
4. Normalise transcript for evaluation only: Unicode/case/punctuation, whitespace, optional diacritics, common STT number forms. Preserve raw transcript for the learner display only during the session.
5. Match in layers: exact normalised accepted answer → token/character similarity → required semantic slots and synonym sets → bounded semantic classifier for ambiguous variants. Never accept a high string score if a negation, number, allergen, destination or other critical slot differs.
6. Produce one of six outcomes below, select one short feedback message, and update the review strength. A learner may continue after an understandable response or manually choose “I said it correctly” after repeated ASR failure.
7. Delete transient audio after processing unless the learner explicitly opts into saving examples. Store structured attempt facts, not audio.

### Outcome model

| Outcome                            | UI                                                         | Scheduler/effect                                      |
| ---------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------- |
| Correct and clearly understandable | Green/teal “Understood” + optional specific praise         | Successful recall; normal interval growth             |
| Understandable, minor issue        | Amber-neutral “That works. Try stressing…”                 | Count complete; bring back once sooner                |
| Meaning-changing error             | “I heard X; for Y, say…”; highlight one critical word      | Immediate supported retry; early review               |
| Incomplete phrase                  | Acknowledge what was heard; reveal missing key chunk       | Scaffolded retry; early review                        |
| Mic/transcription failure          | Technical state, playback/test/retry, skip without penalty | No learning failure recorded                          |
| Different but valid Spanish        | “Also correct” and show model phrase as an alternative     | Successful recall; optionally flag for content review |

Harmless differences include punctuation, capitalisation, diacritics in transcripts, optional subject pronouns, appropriate articles, and curated variants such as _quisiera/me gustaría/para mí_. Critical differences include _con/sin_, wrong number/price/time, wrong destination, negation, allergy item, or urgency.

### Pronunciation strategy

- In MVP, give authored tips for common English-speaker issues only when relevant: five stable vowels, tapped _r_ without demanding a trill, _j_ sound, syllable stress, and chunk rhythm. Avoid eye-dialect that teaches distorted sounds.
- The optional pronunciation aid should be learner-friendly syllable/stress markup, e.g. `BWEH-nos DEE-as`, explicitly approximate and hidden by default. Audio remains the authority.
- Ask the learner “Did that feel clear?” after repeated attempts; agency is better than false machine certainty.
- During build, benchmark Scribe with both learners on 30 representative phrases in quiet and moderate noise. Measure semantic pass rate, false rejection and false acceptance.
- If true pronunciation scoring becomes a requirement, evaluate a specialised pronunciation-assessment API that returns phone/word-level evidence, complete a privacy review, and keep it a separate signal. Do not derive a 0–100 pronunciation score from edit distance.

ElevenLabs documents Scribe v2 as transcription in 90+ languages and realtime at about 150ms model latency, not as a learner pronunciation-assessment API ([STT overview](https://elevenlabs.io/docs/overview/capabilities/speech-to-text), [realtime reference](https://elevenlabs.io/docs/api-reference/speech-to-text/v-1-speech-to-text-realtime)).

### Guided conversation guardrails

Prefer authored state machines for v1: role, 3–7 turns, allowed intents, required slots, likely replies, hints, repair branches, and success condition. If ElevenAgents is enabled:

- one private agent/config per scenario family or versioned workflow branches;
- server-issued signed URL after authentication/rate limiting;
- dynamic variables: learner name, completed phrase IDs, scenario goal, maximum CEFR pre-A1/A1, allowed vocabulary and reply length;
- agent must use one short sentence per turn, wait patiently, accept taught variants, repair in English after two failures, and never introduce an untaught task;
- a deterministic client/server scenario controller, not the LLM, decides completion;
- post-run automated tests probe advanced-language leakage, unsafe advice, role drift and prompt injection.

## 9. Gamification system

- **Travel Points:** 10 for a daily lesson, 2 per due review (daily cap), 25 for a weekly Mission. Points visualise effort only and buy nothing.
- **Travel rhythm:** consecutive active days plus one flexible day per rolling seven days. Show longest rhythm and total days; never erase either.
- **Destination path:** six phase postcards/stamps with original geometric art, awarded for demonstrated outcomes rather than raw XP.
- **Achievements:** First Words, Repair Ready, Confident Order, Route Finder, Smooth Check-in, Calm Problem Solver, Friendly Local, Travel Pack Ready.
- **Readiness by category:** Foundations, Food, Money, Transport, Directions, Stay, Problems, Friendly chat. Each is `Not started / Building / Practised / Trip-ready`, based on recent retrieval, listening and mission evidence. It decays gently when overdue and states why.
- **Friendly comparison:** opt-in only: total learning days and completed missions, never error rates or pronunciation.
- **Completion motion:** 600–900ms lightweight stamp/radiating-line animation; static state under `prefers-reduced-motion`.

## 10. Screen inventory and low-fidelity wireframes

The primary navigation is **Today · Path · Practice · Progress**. Settings/profile is the avatar. On 360–430px widths, bottom navigation labels remain visible; active lesson hides navigation to prevent accidental exit.

### 10.1 Profile/sign-in

```text
┌────────────────────────────┐
│            ◇               │ original route-mark symbol
│     Ready for México       │
│  Two travellers, own pace  │
│                            │
│  [ Continue as Partner A ] │ 56px button
│  [ Continue as Partner B ] │ only if switching on shared device
│                            │
│  [ Send me a sign-in link ]│ invite-only first run
│  Offline progress: synced ✓│
└────────────────────────────┘
```

On each person’s own phone, a remembered authenticated account bypasses the picker. Do not let an unauthenticated name tile access cloud data.

### 10.2 Today

```text
┌────────────────────────────┐
│ Hola, Sam             (S)  │
│ 71 days → 1 day left        │
│                            │
│ TODAY · 6–8 min            │
│ ┌────────────────────────┐ │
│ │ Hotel + room problem   │ │ outcome title
│ │ Review 3 · Learn 0     │ │
│ │ [ Start today’s lesson]│ │ primary action
│ └────────────────────────┘ │
│ Due now: 4   Offline: ✓    │
│ Rhythm 🔥 6   82% plan done│
├────────────────────────────┤
│ Today  Path Practice Prog. │
└────────────────────────────┘
```

### 10.3 Learning path

Vertical route with six named phases, compact day nodes, mission stamps, “today” anchored into view, and locked future content only when pedagogically required. Past lessons are replayable; emergency pack is always accessible.

### 10.4 New phrase

```text
┌────────────────────────────┐
│ 2/7 ━━━━━────────   ×      │
│ LISTEN                     │
│                            │
│       “¿Puede repetir?”    │
│       Can you repeat that? │
│       Context: polite      │
│                            │
│ [🐢 Slow]     [▶ Normal]   │
│ [ Show pronunciation aid ] │
│                            │
│              [ Continue ]  │ thumb-zone CTA
└────────────────────────────┘
```

Text can be hidden on first play in later phases. Audio buttons always have text labels.

### 10.5 Listen and repeat

Large central 80px mic; tap toggles by default (more accessible than hold), optional hold mode in settings. States: “Tap to speak” → pulsing “Listening…” waveform + timer + cancel → “Checking…” → outcome. Never use colour alone.

### 10.6 Speech feedback

Show `You said` transcript, outcome label, one correction, replay and two equally visible choices: Retry / Continue. For technical failures show Mic test / Try again / Practise without scoring.

### 10.7 Multiple-choice comprehension

Audio-first prompt with replay and optional slow control; 2–4 large answer cards. Correct choice explains in one line. Incorrect choice remains emotionally neutral: “Almost—_derecha_ is right.”

### 10.8 Guided conversation

```text
┌────────────────────────────┐
│ Taxi to the hotel   Turn 2/5│
│ Goal: confirm total fare    │
│                             │
│ DRIVER  “Son 350 pesos.”    │
│ [▶ replay] [show meaning]   │
│                             │
│ Hint: Confirm what you heard│
│          (  mic  )          │
│ transcript appears here     │
│ [Need a phrase] [End safely]│
└─────────────────────────────┘
```

### 10.9 Lesson completion

“You can now confirm a taxi fare.” Show stamp animation, +points, category moved/evidence, local/sync state and Done for today. Do not turn completion into three upsell screens.

### 10.10 Review queue

Top: “6 due · about 4 min.” Filters only when needed: All, Listening, Speaking, Favourites. Cards default to active recall with reveal. Allow snooze until tomorrow without shame.

### 10.11 Progress/readiness

Eight horizontal category bars with named states, evidence line (“2 missions passed; 4 phrases due”), days learned, missions completed, current/longest rhythm, total chunks, countdown. Avoid a radar chart on mobile because exact comparison is harder to read.

### 10.12 Settings + microphone test

Account/profile, audio speed, tap/hold mic mode, permission status with Android instructions, live level meter, record/playback test, download manager/storage size, notifications opt-in, privacy/voice retention, export/delete progress, sign out, app/course versions.

## 11. Original visual design direction

Working identity: **Rumbo** (“route/direction”), subject to naming/domain checks. Visual idea: a modern route line becoming a speech mark—travel progress and conversation without sombreros, cacti or copied mascots.

- **Palette:** Ink `#14213D`, warm canvas `#FFF8EC`, coral `#E85D4A`, marigold `#F2B134`, agave `#167D76`, sky `#3A86C8`. Validate every text/background pair to WCAG AA; success/error also use icon + label.
- **Type:** system-first (`Inter`/`Roboto` fallback) for UI; a distinctive licensed display face only for headings if performance permits. Spanish punctuation and accents must render cleanly.
- **Shape:** 16–20px cards, 48–56px controls, crisp 2px route-line illustrations, subtle paper/grain only if compressed.
- **Motion:** route draw, stamp settle and mic breathing; transform/opacity only; reduced-motion equivalent.
- **Voice UI:** agave listening, indigo processing, labelled coral issue; timer and cancel always visible.
- **Tone:** warm adult coach: “That will be understood,” “One word to fix,” “The mic didn’t catch that.” Never “Wrong!” or baby talk.

## 12. Recommended technical architecture

### Decision record

| Concern       | Recommendation                                                                              | Why                                                                                        |
| ------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Web framework | Current stable Next.js App Router, TypeScript                                               | Vercel fit, route handlers, server/client boundary, official PWA guidance                  |
| UI            | React + Tailwind + a small accessible component layer                                       | Fast, consistent, no large design-system burden                                            |
| PWA           | Manifest + service worker using a maintained Serwist/Workbox integration, pinned and tested | Precaching, runtime audio strategies and upgrade lifecycle; do not hand-roll caching logic |
| Backend       | Supabase hosted Postgres/Auth/Storage                                                       | One small service covers invite auth, sync, RLS and optional audio objects                 |
| Data access   | Supabase generated types + SQL migrations; no Prisma/Drizzle initially                      | ORM adds little for this small schema and complicates RLS/direct access                    |
| Content       | Versioned validated content bundle in repository; media manifest in CDN/storage             | Reviewable diffs, deterministic releases, offline download; no CMS yet                     |
| Voice         | Pre-generated ElevenLabs TTS; batch Scribe route; optional signed agent sessions            | Best cost/reliability split and key remains server-side                                    |
| Local data    | IndexedDB (Dexie is justified) + Cache Storage                                              | Transactional outbox/querying plus service-worker assets                                   |
| Analytics     | Minimal first-party event table or privacy-respecting hosted analytics                      | Two users do not justify a heavy SDK                                                       |

Next.js now has an official PWA guide covering manifest, service worker, push and security; it notes Serwist as an offline option ([Next.js PWA guide, updated March 2026](https://nextjs.org/docs/app/guides/progressive-web-apps)).

### Conceptual repository structure (for the build phase)

```text
app/
  (auth)/                  sign-in/callback
  (product)/               today, path, practice, progress, settings
  lesson/[lessonId]/       lesson player
  mission/[scenarioId]/    authored conversation player
  api/
    speech/transcribe/     authenticated batch STT proxy
    speech/token/          optional realtime single-use token
    conversation/url/      optional agent signed URL
    sync/                  idempotent batch sync if not direct Supabase
    account/export|delete/
  manifest.ts
components/                UI, lesson exercises, voice controls
content/
  course/                  phases/units/lessons/scenarios
  schema/                  runtime validation schemas
  locale/en/               interface strings
lib/
  auth/ db/ speech/ evaluation/ review/ offline/ analytics/
public/
  icons/ illustrations/ offline-fallback/
supabase/
  migrations/ seed/
scripts/                   validate-content, generate-audio, security checks
tests/                     unit, integration, e2e, fixtures
```

This is a design, not a request to create these paths now.

### API surface

- `POST /api/speech/transcribe`: authenticated; exercise/phrase ID + bounded audio; validates MIME/size/duration; rate limits; calls Scribe; evaluates or returns structured transcript evidence; never returns provider secrets.
- `POST /api/speech/token`: authenticated, feature-flagged; creates ElevenLabs `realtime_scribe` single-use token, expiring after 15 minutes.
- `POST /api/conversation/url`: authenticated; validates learner eligibility/scenario, rate limits and gets signed URL for a private agent. URL expires after 15 minutes.
- `POST /api/sync`: optional if direct RLS writes are insufficient; accepts idempotent event IDs and client timestamps, resolves revisions, returns authoritative cursors.
- `POST /api/account/export` and `DELETE /api/account`: authenticated and re-confirmed.
- Static/versioned content and audio: CDN URLs with hashes; no API call on every lesson view.

### Authentication recommendation

Use Supabase passwordless email OTP/magic link with an allowlist of the two emails and persistent sessions. Each auth user owns exactly one profile. On a shared phone, use explicit sign-out/account switch; a cosmetic picker must not switch data without authentication. This gives sync/recovery and protects signed voice endpoints. It is worth including in v1.

## 13. Database and content model

### Learner-state schema

| Entity               | Important fields                                                                                                                                                      |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `profiles`           | `id`, `auth_user_id unique`, display name, avatar key, timezone, course ID/version, start/departure dates, preferences, created/updated                               |
| `lesson_progress`    | profile, lesson, status, started/completed timestamps, duration, content version, local revision, points; unique(profile, lesson)                                     |
| `phrase_mastery`     | profile, phrase, strength, due_at, interval, ease, consecutive successes, listening/speaking evidence, last outcome                                                   |
| `attempts`           | UUID/idempotency key, profile, exercise/phrase/scenario, mode, outcome, semantic score band, critical-error code, latency, provider status, created; raw audio absent |
| `scenario_runs`      | profile, scenario/version, started/completed, goal result, hints, repairs, turn count, category evidence                                                              |
| `progress_events`    | immutable event ID, profile, device ID, event type, entity ID, payload version, client/server timestamps; sync audit/deduplication                                    |
| `achievements`       | profile, achievement key, earned_at, evidence reference; unique(profile, key)                                                                                         |
| `favourites`         | profile, phrase, created_at                                                                                                                                           |
| `category_readiness` | profile, category, state, evidence count, confidence, computed_at, explanation                                                                                        |
| `devices`            | profile, anonymous device ID, last sync, app/content versions; no ad identifier                                                                                       |
| `analytics_events`   | pseudonymous profile, allowed event name, coarse properties, timestamp; short retention                                                                               |

All learner tables use RLS tied to `auth.uid()`. Course content can be public/static; voice endpoints remain authenticated. Supabase requires RLS on exposed tables and supports `auth.uid()` policies ([official RLS guide](https://supabase.com/docs/guides/database/postgres/row-level-security)).

### Curated content entities

`Course → Phase → Unit → Lesson → Exercise`; phrases and scenarios are referenced, not duplicated. Supporting entities: `Phrase`, `Translation`, `AcceptedAnswer`, `AudioAsset`, `Scenario`, `ScenarioTurn`, `FeedbackRule`, `CulturalNote`, `ReviewPolicy`, `AchievementDefinition`.

Every publish runs schema validation, unique-ID/reference checks, day/date checks, maximum-new-phrase checks, missing audio checks, accepted-answer/critical-slot checks and content-review status checks.

### Sample complete Day 6 content (illustrative JSON)

```json
{
  "id": "mx71.d06",
  "courseVersion": "2026.1",
  "day": 6,
  "date": "2026-08-15",
  "title": "Ask someone to slow down",
  "outcome": "Ask a Spanish speaker to speak more slowly and recognise a helpful reply.",
  "estimatedSeconds": 390,
  "review": [
    { "phraseId": "mx.intro.little_spanish", "mode": "audio_to_intent" },
    { "phraseId": "mx.polite.please", "mode": "intent_to_speech" }
  ],
  "newPhraseIds": ["mx.repair.slower_full", "mx.repair.slower_short"],
  "phrases": [
    {
      "id": "mx.repair.slower_full",
      "esMX": "¿Puede hablar más despacio, por favor?",
      "english": "Can you speak more slowly, please?",
      "pronunciationAid": "PWEH-deh ah-BLAR mahs deh-SPAH-syoh, por fah-BOR",
      "contextNote": "Polite and appropriate with an adult stranger in Mexico.",
      "register": "formal-neutral",
      "difficulty": 1,
      "acceptedAnswers": [
        { "text": "¿Puede hablar más despacio, por favor?", "type": "model" },
        {
          "text": "¿Podría hablar más despacio, por favor?",
          "type": "valid-advanced"
        },
        { "text": "Más despacio, por favor.", "type": "valid-short" }
      ],
      "requiredConcepts": ["slower"],
      "optionalTokens": ["puede", "hablar", "por", "favor"],
      "criticalContrasts": [],
      "likelyReplies": [
        { "esMX": "Sí, claro.", "english": "Yes, of course." },
        { "esMX": "Sí, perdón.", "english": "Yes, sorry." }
      ],
      "commonErrors": [
        {
          "pattern": "despacio omitted",
          "feedback": "Include ‘más despacio’—that carries ‘more slowly’."
        }
      ],
      "feedbackRules": [
        { "when": "concept:slower present", "outcome": "understandable" },
        { "when": "transcription_failure", "outcome": "technical_failure" }
      ],
      "audio": {
        "normal": {
          "assetId": "a.mx.repair.slower_full.n.v1",
          "voiceLocale": "es-MX",
          "sha256": "<publish-time hash>"
        },
        "slow": {
          "assetId": "a.mx.repair.slower_full.s.v1",
          "voiceLocale": "es-MX",
          "sha256": "<publish-time hash>"
        }
      },
      "reviewPolicy": { "initialIntervalsDays": [0, 1, 3, 7, 14, 30] },
      "offline": "core"
    },
    {
      "id": "mx.repair.slower_short",
      "esMX": "Más despacio, por favor.",
      "english": "More slowly, please.",
      "pronunciationAid": "mahs deh-SPAH-syoh, por fah-BOR",
      "contextNote": "A short repair phrase when a full sentence is hard to retrieve.",
      "register": "neutral",
      "difficulty": 1,
      "acceptedAnswers": [
        { "text": "Más despacio, por favor.", "type": "model" }
      ],
      "requiredConcepts": ["slower"],
      "likelyReplies": [{ "esMX": "Claro.", "english": "Of course." }],
      "audio": {
        "normal": {
          "assetId": "a.mx.repair.slower_short.n.v1",
          "voiceLocale": "es-MX",
          "sha256": "<publish-time hash>"
        },
        "slow": {
          "assetId": "a.mx.repair.slower_short.s.v1",
          "voiceLocale": "es-MX",
          "sha256": "<publish-time hash>"
        }
      },
      "reviewPolicy": { "initialIntervalsDays": [0, 1, 3, 7, 14, 30] },
      "offline": "core"
    }
  ],
  "exercises": [
    {
      "id": "d06.e1",
      "type": "review_retrieval",
      "phraseId": "mx.intro.little_spanish"
    },
    {
      "id": "d06.e2",
      "type": "present_phrase",
      "phraseId": "mx.repair.slower_full"
    },
    {
      "id": "d06.e3",
      "type": "shadow",
      "phraseId": "mx.repair.slower_full",
      "attemptsSuggested": 2
    },
    {
      "id": "d06.e4",
      "type": "listen_choose_reply",
      "audioReply": "Sí, claro.",
      "correctIntent": "The person agrees"
    },
    {
      "id": "d06.e5",
      "type": "speak_intent",
      "intent": "Ask a shopkeeper to speak more slowly",
      "acceptedPhraseIds": ["mx.repair.slower_full", "mx.repair.slower_short"]
    },
    {
      "id": "d06.e6",
      "type": "scenario",
      "scenarioId": "mx.scenario.fast_shopkeeper.v1"
    }
  ],
  "completion": {
    "message": "You can now slow a conversation down without giving up.",
    "category": "repair",
    "travelPoints": 10
  },
  "reviewStatus": {
    "linguist": "required",
    "mexicanUsage": "required",
    "safety": "not-applicable"
  }
}
```

The pronunciation aid above is intentionally labelled approximate and must be reviewed; it is not IPA or a substitute for audio.

## 14. ElevenLabs integration plan

### TTS

- Select two voices that native Mexican reviewers judge natural for Mexican Spanish; a model’s Spanish support alone does not guarantee a Mexican accent.
- Pre-generate each curated phrase at normal conversational delivery and a genuinely slower, natural delivery. Do not slow audio by crude playback below about 0.85× if it distorts prosody; generate reviewed slow takes.
- Prefer `eleven_multilingual_v2` for stable high-quality course assets; compare `eleven_v3` during content production. Use Flash v2.5 only where latency matters. ElevenLabs lists Spanish in Multilingual v2 and Flash v2.5, with Flash around 75ms model inference ([models](https://elevenlabs.io/docs/overview/models)).
- Generate once during an authorised content pipeline, store immutable hashed files in Supabase Storage/CDN, and ship manifests. Runtime TTS is unnecessary for deterministic lessons.

### STT

- Default: upload short recording from browser to `/api/speech/transcribe`; server calls Scribe v2 batch. Fix Spanish, supply phrase vocabulary/keyterms if current API parameters support it, and enforce 10-second/size limits.
- Optional later: direct browser Scribe realtime using a server-created `realtime_scribe` single-use token. ElevenLabs documents that this token expires after 15 minutes and prevents client key exposure ([client-side streaming guide](https://elevenlabs.io/docs/eleven-api/guides/how-to/speech-to-text/realtime/client-side-streaming)).
- Realtime’s advertised ~150ms is model latency, not South Africa-to-provider end-to-end latency; device/network testing decides whether it improves the short exercise UX.

### ElevenAgents

- Keep agents private. The authenticated server obtains a signed WebSocket URL; ElevenLabs recommends signed URLs for client applications, expiring after 15 minutes ([agent authentication](https://elevenlabs.io/docs/eleven-agents/customization/authentication)).
- Use the official React SDK only after compatibility and bundle review. Its session uses microphone access and accepts a signed URL ([React SDK](https://elevenlabs.io/docs/eleven-agents/libraries/react)).
- Limit a mission to 2–4 minutes, hard-stop idle sessions, and display an online requirement. Save only structured outcome evidence locally unless explicit consent permits transcript storage.

### Limits, latency and retention

- Two users do not approach documented concurrency (Free currently lists 4 simultaneous calls; Starter 6), but app-side per-user rate limits and monthly spend alerts are still required ([concurrency limits](https://elevenlabs.io/docs/help-center/product/conversational-agents/eleven-labs-agents-formerly-conversational-ai/how-many-eleven-agents-requests-can-i-make-and-can-i-increase-it)).
- Default ElevenAgents conversation retention is documented as two years unless changed. Set transcript and audio retention to **0 days** if operationally supported and disable recordings; otherwise choose the minimum available and disclose it ([retention controls](https://elevenlabs.io/docs/eleven-agents/customization/privacy/retention)).
- ElevenLabs’ Zero Retention Mode is generally an Enterprise feature. Do not promise it on a self-serve account ([ZRM documentation](https://elevenlabs.io/docs/eleven-api/resources/zero-retention-mode)).

## 15. Security and privacy plan

### Secret controls

- `ELEVENLABS_API_KEY` exists only in server runtime and local ignored environment file; never prefix it `NEXT_PUBLIC_`.
- Mark it Sensitive for Vercel Preview and Production; Vercel stores sensitive values as non-readable after creation ([Vercel sensitive variables](https://vercel.com/docs/environment-variables/sensitive-environment-variables)).
- Use a restricted ElevenLabs key if the account supports scoped keys; rotate on suspected exposure.
- No secret values in logs, error objects, analytics, source maps, test fixtures, client responses or build output. Add secret scanning in pre-commit/CI and GitHub secret scanning.
- Browser access receives only single-use token/signed URL, after session validation, scenario entitlement, origin/CSRF checks and a rate/spend gate.

### Application controls

- HTTPS only; secure, HttpOnly, SameSite auth cookies where applicable; short sessions with refresh flow.
- RLS on every exposed personal table; service-role key server-only. Explicit two-user allowlist disables public signup.
- Validate all route input, MIME, file signature, duration and size; reject decompression/oversized uploads; time out upstream calls.
- Per-user and per-IP rate limits: e.g. 20 STT/minute burst, 150/day/user; 10 signed agent sessions/day/user, then tune.
- Security headers: strict CSP (including only required ElevenLabs WebSocket/media domains), `frame-ancestors 'none'`, `nosniff`, strict referrer policy, permissions policy for microphone self.
- Sanitise agent/transcript text before display; no HTML rendering. Scenario IDs map to server-approved agent IDs; client cannot choose arbitrary agents.
- Dependency pinning/updates, CI audit, SAST and client-bundle secret scan. Do not log request bodies for voice routes.

### Voice privacy

- Just-in-time notice: “Your recording is sent securely to ElevenLabs to turn speech into text. We do not save the recording.” Link full notice before consent.
- Default app retention: raw audio in memory/temp storage only, deleted immediately after response/error. Do not upload offline practice recordings. Keep transcript only long enough to show feedback; store outcome/error codes rather than raw transcript unless debugging opt-in exists.
- If an opt-in diagnostic sample is needed, separate consent, maximum 7 days, private encrypted bucket, access audit and one-tap deletion.
- Provide export/delete account. Delete cloud state, analytics mapping and stored samples; explain third-party deletion/backup limits.
- Treat voice as personal data. Document providers, regions, retention and cross-border processing. This blueprint is product guidance, not legal advice; review POPIA implications for the two South African users.

### Environment variables

Server-only: `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID_*`, `SUPABASE_SERVICE_ROLE_KEY` (only if necessary), `DATABASE_URL` (only if server SQL is used), rate-limit provider token, analytics ingest secret.  
Browser-safe by design: `NEXT_PUBLIC_SUPABASE_URL`, Supabase publishable/anon key (protected by RLS, not a secret), `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_CONTENT_VERSION`.  
Operational: `VOICE_FEATURE_MODE=batch|realtime|agent`, retention/size/rate caps, Sentry DSN only if privacy-approved. Secrets use distinct preview/production values.

## 16. Offline and synchronisation strategy

### Capability matrix

| Feature                                     | Offline behaviour                                                                            |
| ------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Previously downloaded lesson text/exercises | Full; versioned bundle in IndexedDB                                                          |
| Downloaded slow/normal audio                | Full; hashed audio in Cache Storage or IndexedDB blob store with verified manifest           |
| Progress/favourites/review                  | Full local write, immediate UI; queued sync                                                  |
| Speaking practice                           | Record and playback locally; self-check/reveal; clearly “Not scored—offline”                 |
| STT/evaluation                              | Unavailable unless a future on-device model is deliberately added; never fake a score        |
| AI conversation                             | Unavailable; offer authored text/audio branch or rehearsal mode                              |
| Synchronisation                             | Outbox retries on app open/online; background sync is an enhancement, not the only mechanism |

### Storage and caching

- Precache only app shell, fonts/icons and offline fallback. Network-first for HTML/navigation with cached fallback; stale-while-revalidate for versioned content; cache-first for immutable hashed audio.
- Prompt downloads: next 7 days automatically on Wi-Fi-equivalent connection when possible; phase packs manually; Travel Pack explicitly before departure. Show sizes and delete controls.
- Request persistent storage where supported after the user downloads the pack, but assume the OS/browser may evict data. On every pack open, verify manifest/hash/availability and provide “Repair download.”
- Never cache authenticated API responses or signed URLs/tokens in the service worker. Never store the API key.

### Conflict and sync model

1. Every local mutation creates a UUID event and updates the local projection in one IndexedDB transaction.
2. Outbox sends events idempotently; server records event ID once and returns server revision/cursor.
3. Completion is monotonic (completed beats started); points are derived from unique events, not client totals; favourites use last-write-wins; phrase mastery is recomputed from ordered attempts where feasible.
4. Device stores acknowledged cursor and removes acked outbox entries. Retries use exponential backoff/jitter.
5. Server clock is authoritative for streak/date boundaries, while original client time is retained to tolerate offline completion. Timezone is Africa/Johannesburg until travel; define “learning day” explicitly rather than silently changing on arrival.

### PWA behaviour on Samsung/Chrome

- Chrome on Android supports installable web apps with manifest/HTTPS and places installed PWAs in Android surfaces. A service worker is no longer an Android install prerequisite, but this app needs one for offline behaviour ([Chrome Android PWA update](https://developer.chrome.com/blog/whats-new-in-web-on-android-io2023)).
- Microphone `getUserMedia` requires HTTPS, a top-level active document and user permission; denial/revocation/hardware errors must be first-class states ([MDN MediaDevices](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)).
- Service workers are event-driven with short lifetimes; do not rely on them for a persistent voice session. Background sync/periodic sync availability and scheduling are browser/OS controlled. Always retry in the foreground ([PWA updates](https://web.dev/learn/pwa/update)).
- Audio should start from a user gesture, pre-load cautiously, recover from Bluetooth/phone-call interruptions and stop mic tracks immediately after use.
- Updates: detect `waiting` worker, finish/save the active lesson, then show “Update ready.” Never force reload mid-recording/lesson. Version content separately and retain the old lesson version until a session ends.
- Push is technically possible on Chromium Android but defer it for two users. Begin with optional in-app/device-calendar habit cues; push adds keys, consent and delivery variability without teaching value.

### Mexico Travel Pack

Core phrases, favourites, emergency phrases, all core audio, searchable categories/synonyms, large Spanish “show this” view, Mexico emergency number 911 with a verification timestamp/source, hotel/address personal cards stored locally, and pack health/version. Personal cards remain on-device by default. The pack opens from Today and app launch while offline in at most two taps.

## 17. Testing plan

### Test layers

- **Content tests:** schema, links, phrase caps, audio/hash, accepted variants, required/critical concepts, dates, human review flags and cultural/safety review.
- **Unit:** normalisation, evaluator precedence (negation/number critical), scheduler, readiness, streak/flexible day, sync merge/idempotency, content migration.
- **Integration:** auth/RLS isolation, STT success/timeouts/errors, token/URL expiry, rate limits, upstream redaction, offline outbox, account delete/export.
- **E2E:** Playwright mobile viewport for first-run, lesson, denied mic, retry/skip, mission, completion, refresh/resume, offline pack and update prompt.
- **Physical devices:** Galaxy S25 and S23 on the current stable Chrome and Samsung Android builds; browser tab and installed standalone; phone speaker, wired/Bluetooth if used, quiet room, street/café noise, screen lock/phone interruption.
- **Security:** client bundle and source maps for key patterns, Git history scan, unauthenticated/other-user route attempts, RLS tests, oversized/spoofed audio, replayed event/token, arbitrary agent ID, log review.
- **Accessibility:** keyboard/switch path, TalkBack, 200% text, landscape, contrast, focus, target sizes, captions/transcripts, reduced motion, colour independence.
- **Performance:** Lighthouse as signal plus physical cold/warm runs on throttled 4G; route JS, LCP, INP, offline launch, audio first-play and STT end-to-feedback.

### Speech benchmark

Before launch, each learner records the same 30-phrase set twice (quiet and moderate background noise) on their own device: native-model audio followed by genuine learner production including intentional valid variants and critical errors. Human-label intended meaning and intelligibility, then compare evaluator outcomes. Tune thresholds on held-out recordings, not the same examples used to author rules.

Target metrics:

- ≥90% of human-understandable target/accepted responses pass within two attempts in quiet conditions.
- ≤5% false acceptance for deliberately meaning-changing errors involving negation, numbers, destination, _con/sin_ and allergens.
- Technical-failure path appears correctly for denial, no speech, too quiet, upstream timeout and offline.
- Do not publish a pronunciation accuracy percentage from this test.

### Service-worker/update matrix

Install old version → begin lesson → deploy new shell/content → verify no mid-lesson reload → complete/save → apply update → ensure progress and downloaded audio remain/migrate. Repeat online, offline during deploy, and with partially downloaded Travel Pack.

## 18. MVP acceptance criteria

1. Both Galaxy phones install from Chrome and relaunch standalone with correct icon/name/theme.
2. Each invited user signs in and can access only their own learner rows; automated RLS cross-user tests pass.
3. Median normal daily lesson time is ≤8 minutes and ≥90% of pilot runs finish under 10 minutes.
4. Every normal lesson contains due review, ≤3 new chunks, Mexican-Spanish audio, comprehension, speech/rehearsal, scenario, feedback and completion.
5. All published Spanish, translations, register, likely replies and audio are approved by a qualified Mexican-Spanish reviewer.
6. Profile progress remains separate across both phones and correctly restores after refresh/reinstall/sign-in (download cache may require re-download).
7. Completion is durable locally before network response; offline work syncs exactly once after reconnection.
8. Downloaded Travel Pack text/search/normal+slow audio works in airplane mode after a cold launch.
9. Offline speech offers record/play/reveal and explicitly does not claim scoring; online failure never blocks lesson completion.
10. Accepted variants pass; harmless punctuation/diacritic/article differences do not cause rejection; critical negative/number/_con-sin_ errors do not pass via fuzzy matching.
11. Mic accepted, denied, ignored, revoked, occupied and hardware-error cases each provide a working explanation/retry/skip route.
12. No ElevenLabs or service-role secret appears in repository, Git history, client bundle, source map, response, analytics or logs; automated scans pass.
13. Signed/single-use voice credentials require auth, expire as documented, are rate-limited and are never cached.
14. TalkBack can complete the core lesson; controls have accessible names, visible focus and ≥48 CSS-pixel targets; text contrast meets WCAG 2.2 AA.
15. On both devices, p75 measured LCP is <2.5s and INP <200ms on representative 4G after optimisation; offline shell opens <1.5s.
16. Update flow never reloads an active recording/lesson and migrates or safely invalidates old cached content.
17. Account deletion removes app-managed personal data and initiates documented provider/storage deletion steps.
18. Readiness states link to concrete evidence and never use “fluent” or imply guaranteed emergency competence.

## 19. Estimated API usage and likely costs for two users

These are planning ranges at prices visible on 10 August 2026; taxes, existing plan credits and future provider changes are excluded.

### Assumptions

- 125 productive phrases, two speeds, average 45 Spanish characters, two selected voice variants on 25% of assets: about 14k–20k one-time TTS characters including regeneration.
- 4–8 short speech attempts/person/day, average 5 seconds: 47–95 STT minutes total per learner, 95–190 minutes (1.6–3.2 hours) for both, plus 30% testing/retries → roughly 2–4.2 billed hours.
- 10 agent missions/person, 3 minutes each: 60 total conversation minutes; broader use could reach 120 minutes.

### Variable estimate

| Item                | Current public unit price |                      Likely variable usage/cost |
| ------------------- | ------------------------: | ----------------------------------------------: |
| TTS Flash/Turbo     |         $0.05/1,000 chars |                            $0.70–$1.00 one-time |
| TTS Multilingual/v3 |         $0.10/1,000 chars |                            $1.40–$2.00 one-time |
| Scribe batch        |                $0.22/hour |                         about $0.44–$0.92 total |
| Scribe realtime     |                $0.39/hour |                         about $0.78–$1.64 total |
| ElevenAgents voice  |        $0.08/min plus LLM | $4.80 for 60 min; $9.60 for 120 min, before LLM |

Official API prices currently list TTS $0.05 Flash/Turbo or $0.10 Multilingual/v3 per 1,000 characters, Scribe $0.22/hour and realtime $0.39/hour ([ElevenAPI pricing](https://elevenlabs.io/pricing/api?price.section=speech_to_text)). ElevenAgents currently lists 15 free minutes, Starter $6/75 included minutes, Creator $22/275, and additional minutes $0.08 plus model costs ([Agents pricing](https://elevenlabs.io/pricing/agents)).

**Budget recommendation:** if the existing ElevenLabs plan covers TTS/STT, voice API variable cost is negligible. For agent missions, start with Free during development, then Starter if 75 minutes covers launch, or Creator only if testing plus use will exceed that. Set a hard **$25 monthly voice budget alert** and a server-side minute cap. Vercel and Supabase free tiers may cover two users, but verify their current plan limits immediately before build/deploy; budget $0–$50/month contingency rather than architecting around a guaranteed free tier.

Pre-generation makes costs predictable. The dominant project cost is expert Mexican-Spanish content/audio review and implementation time, not API usage.

## 20. Risks, limitations and mitigations

| Risk                                              | Impact                                  | Mitigation/decision                                                                                          |
| ------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Tiny total study time                             | Overpromised outcome                    | Narrow survival repertoire, high review density, explicit expectations                                       |
| ASR bias/noise/accent                             | False rejection damages confidence      | Meaning-first layered evaluator, two attempts, manual continue, benchmark both users                         |
| False “pronunciation score”                       | Misleading teaching                     | No phoneme score; label constructs separately; specialist vendor only after validation                       |
| Agent language drift                              | Beginners become lost                   | Authored missions first, allowed vocabulary, short replies, deterministic controller, leakage tests          |
| Provider/network latency from South Africa/Mexico | Broken speech loop                      | Pre-generated audio, batch short uploads, timeouts, offline rehearsal, realtime only after benchmark         |
| Voice privacy/default retention                   | Disproportionate personal-data exposure | No raw app retention, agent retention 0/disabled recordings, clear consent; acknowledge self-serve ZRM limit |
| Service-worker stale app/content                  | Corruption or old lessons               | Immutable assets, explicit versions, safe update prompt, migration tests                                     |
| Android storage eviction                          | Travel Pack missing                     | Persistent-storage request, health check, size UI, repair download, pre-departure verification               |
| Two-account friction                              | Missed learning                         | Invite-only OTP, persistent session; still safer than unauthenticated picker                                 |
| Mexico regional variation                         | Unnatural/incorrect content             | Mexican linguist review, neutral productive phrases, mark alternatives and regions                           |
| Safety phrases misconstrued as advice             | Harm in allergy/emergency               | Written cards, point/show fallback, verified emergency references, medical disclaimer                        |
| Date/streak timezone change                       | Incorrect rhythm                        | Fixed course schedule, explicit learning-day timezone policy, flexible streak                                |
| Provider/pricing change                           | Cost/scope surprise                     | Adapter boundaries, feature flags, caps, re-check official docs before implementation                        |

## 21. MVP versus later enhancements

### MVP for the trip

- Two invite-only accounts/profiles and cloud sync.
- Complete curated 71-day course, authored missions and review scheduler.
- Pre-generated reviewed normal/slow Mexican Spanish audio.
- Batch STT, forgiving meaning evaluation and offline self-rehearsal.
- Four-tab mobile UX, readiness, flexible rhythm and restrained achievements.
- Installable PWA, seven-day downloads and final Travel Pack.
- Minimal analytics, privacy controls, export/delete and robust Samsung testing.

### Feature-flagged if time permits

- ElevenAgents for a small subset of Phase 5/6 missions after constraint tests.
- Two-learner comparison card.
- Optional, non-guilt reminders/push.

### Later

- Specialist phoneme/word-level pronunciation assessment after a real vendor bake-off.
- Human coach/linguist feedback, native-speaker video, more Mexican voices/regions.
- CMS/editor workflow after content stabilises.
- Adaptive mission generation inside certified templates, not open curriculum generation.
- Dark mode, additional trips/courses, partner practice mode, on-device STT if mature and small enough.

## 22. Step-by-step build plan for the next Codex phase

1. **Approval gate:** confirm outcome, curriculum, authentication and agent deferral; name both learner profiles; inventory current ElevenLabs plan/voice rights.
2. **Content prototype:** Mexican linguist reviews Days 1–7 and the content schema; record/select two voices; create a 30-phrase speech benchmark.
3. **Foundation:** initialise repo/Next.js/TypeScript/Tailwind, CI, lint/type/test, environment templates, GitHub/Vercel preview; no secrets.
4. **Design system:** tokens, typography, components, accessibility states, app shell and four-tab navigation; test 360–430px and TalkBack early.
5. **Auth/data:** Supabase migrations, invite-only passwordless flow, RLS tests, two profiles, progress event model.
6. **Content engine:** validation schema, lesson/exercise renderer, Day 1–7 content, versioning and publish checks.
7. **Audio:** secure generation script, immutable storage/manifests, player/slow/normal, interruption handling and cache strategy.
8. **Learning loop:** review scheduler, comprehension, speaking capture, authored scenario, completion/readiness and flexible rhythm.
9. **Speech service:** batch route, validation/redaction/rate limits, layered evaluator and outcome UI; run benchmark and tune.
10. **Offline/sync:** service worker, IndexedDB projections/outbox, conflict rules, seven-day downloads and update lifecycle.
11. **Travel Pack:** phrase search/categories/favourites/show mode, emergency cards, download health/repair.
12. **Content production:** complete and review all 71 days in phase batches; TTS QA and likely-reply QA; content freeze before final regression.
13. **Optional agent spike:** one private taxi mission with signed URL and strict controller; ship only if vocabulary leakage, privacy, latency and cost gates pass.
14. **Hardening:** device matrix, accessibility/performance/security/offline tests, secret/history scans, account deletion and retention verification.
15. **Pilot and release:** both users complete Days 1–3 plus a Mission; fix friction; production deploy; install/download rehearsal; monitoring and rollback plan.

Recommended build order deliberately gets a complete seven-day vertical slice onto both actual phones before producing 71 days of content or adding live AI.

## 23. Genuinely blocking questions

No question blocks approval of this blueprint. These answers are required before implementation reaches the indicated gate:

1. **Before account setup:** the two invited email addresses and preferred display names. Do not put these in source control.
2. **Before TTS production:** which current ElevenLabs subscription/usage model is active, whether selected voices are licensed for the intended use, and approval of two voices after Mexican-native review.
3. **Before safety content freeze:** any allergies, medical needs or accessibility needs that should shape personal offline cards. This information should default to on-device storage and is optional.
4. **Before visual implementation:** approve or replace the working name “Rumbo” after a lightweight trademark/domain check; the product can proceed under an internal codename.
5. **Before agent release:** consent to third-party conversation processing/retention settings and confirmation that authored missions are acceptable if the live agent fails its latency/constraint gate.

### Decisive assumptions to approve

- Use real invite-only authentication now, not an unsecured profile picker.
- Use curated build-time content plus database learner state, not a CMS.
- Treat ElevenLabs STT as transcription and intelligibility evidence, not pronunciation scoring.
- Ship authored branching Missions first; keep live agents optional.
- Defer push notifications, dark mode, social features and a second currency system.

---

## Research/source register

Research checked on 10 August 2026. Product pages describe vendor claims and current UX; official technical documentation is used for architecture. Re-check pricing, retention, SDK/API signatures and browser versions immediately before implementation.

### Learning products and research

- [Duolingo speaking approach](https://blog.duolingo.com/covering-all-the-bases-duolingos-approach-to-speaking-skills/)
- [Duolingo Practice](https://blog.duolingo.com/guide-to-duolingo-practice-hub/)
- [Duolingo spaced repetition](https://blog.duolingo.com/spaced-repetition-for-learning/)
- [Babbel Method](https://www.babbel.com/en/magazine/how-babbel-method-makes-easy-learn-language)
- [Busuu methodology](https://www.busuu.com/en/it-works/busuu-methodology)
- [Busuu Conversations](https://www.busuu.com/en/languages/speak-fluently-with-busuu-conversations)
- [Busuu review model](https://help.busuu.com/hc/en-us/articles/16941990776593-How-can-I-review-my-vocabulary)
- [Memrise approach](https://www.memrise.com/about)
- [Pimsleur Method](https://www.pimsleur.com/the-pimsleur-method/)
- [High-variability phonetic training meta-analysis (2025)](https://www.cambridge.org/core/journals/studies-in-second-language-acquisition/article/high-variability-phonetic-training-hvpt-a-metaanalysis-of-l2-perceptual-training-studies/6ABB8C1F32D88D53EA8D05A4565E76F6)
- [Shadowing study (2022)](https://www.jstage.jst.go.jp/article/let/59/0/59_77/_article/-char/en)

### ElevenLabs official sources

- [Models/languages](https://elevenlabs.io/docs/overview/models)
- [Speech-to-text overview](https://elevenlabs.io/docs/overview/capabilities/speech-to-text)
- [Realtime STT reference](https://elevenlabs.io/docs/api-reference/speech-to-text/v-1-speech-to-text-realtime)
- [Client-side realtime + single-use tokens](https://elevenlabs.io/docs/eleven-api/guides/how-to/speech-to-text/realtime/client-side-streaming)
- [Agent authentication and 15-minute signed URLs](https://elevenlabs.io/docs/eleven-agents/customization/authentication)
- [React Agents SDK](https://elevenlabs.io/docs/eleven-agents/libraries/react)
- [Latency guidance](https://elevenlabs.io/docs/api-reference/reducing-latency)
- [Agent retention](https://elevenlabs.io/docs/eleven-agents/customization/privacy/retention)
- [Zero Retention Mode](https://elevenlabs.io/docs/eleven-api/resources/zero-retention-mode)
- [API pricing](https://elevenlabs.io/pricing/api)
- [Agents pricing](https://elevenlabs.io/pricing/agents)

### PWA/platform/architecture official sources

- [Next.js PWA guide](https://nextjs.org/docs/app/guides/progressive-web-apps)
- [Chrome: web apps on Android](https://developer.chrome.com/blog/whats-new-in-web-on-android-io2023)
- [Chrome DevTools: PWA inspection](https://developer.chrome.com/docs/devtools/progressive-web-apps)
- [web.dev: PWA assets and offline data](https://web.dev/learn/pwa/assets-and-data)
- [web.dev: PWA updates/background behaviour](https://web.dev/learn/pwa/update)
- [MDN: `getUserMedia` permissions/security/errors](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Auth with Next.js](https://supabase.com/docs/guides/auth/quickstarts/nextjs)
- [Vercel environment variables](https://vercel.com/docs/environment-variables)
- [Vercel sensitive environment variables](https://vercel.com/docs/environment-variables/sensitive-environment-variables)
