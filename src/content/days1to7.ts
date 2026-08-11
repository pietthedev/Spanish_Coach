/**
 * Days 1-7 Curriculum Content
 * 
 * Complete implementation of the first week of Spanish Coach.
 * All Spanish content marked as requiring professional Mexican-Spanish review.
 * 
 * WARNING: This content was AI-generated and MUST be reviewed by a native
 * Mexican Spanish speaker before production use.
 */

import type {
  Course,
  Phrase,
  Lesson,
  Day,
  Phase,
  Exercise,
  AudioReference,
  MissionDefinition,
  MissionState,
  MissionTransition,
  ScenarioIntent,
  SemanticConcept,
  CriticalConcept,
  LinguisticReviewStatus
} from '../content/types';

// ============================================================================
// CONSTANTS
// ============================================================================

const COURSE_VERSION = '0.1.0';
const CONTENT_STATUS: LinguisticReviewStatus = 'pending_review';

// Voice IDs for audio generation (placeholder - to be configured)
const VOICE_ID_MALE_MEXICAN = 'mx_male_001';
const VOICE_ID_FEMALE_MEXICAN = 'mx_female_001';

// ============================================================================
// AUDIO REFERENCE FACTORY
// ============================================================================

function createAudioReference(
  phraseId: string,
  speed: 'slow' | 'normal',
  voiceId: string = VOICE_ID_FEMALE_MEXICAN
): AudioReference {
  return {
    audioKey: `${phraseId}_${speed}`,
    filename: `${phraseId}_${speed}.mp3`,
    speed,
    voiceId,
    contentHash: undefined // Will be computed during audio generation
  };
}

// ============================================================================
// DAY 1 PHRASES - GREETINGS
// ============================================================================

const PHRASE_DAY1_1: Phrase = {
  id: 'phrase_d1_1',
  spanishText: 'Hola',
  pronunciationAid: 'OH-lah',
  englishMeaning: 'Hello / Hi',
  slowAudio: createAudioReference('phrase_d1_1', 'slow'),
  normalAudio: createAudioReference('phrase_d1_1', 'normal'),
  usageContexts: ['greeting'],
  formality: 'neutral',
  acceptedAlternatives: [],
  requiredSemanticConcepts: [{
    conceptId: 'greeting_basic',
    description: 'Basic greeting expression',
    expressions: ['hola', 'buenos días', 'buenas tardes'],
    required: true
  }],
  criticalConcepts: [],
  commonLearnerErrors: [{
    errorPattern: 'Pronouncing H (it is silent)',
    explanation: 'In Spanish, the letter H is always silent',
    correction: 'Say "OH-lah" without the H sound',
    severity: 'minor'
  }],
  feedbackRules: [],
  likelyReplies: ['Hola', '¿Qué tal?', 'Buenos días'],
  offlineAvailable: true,
  linguisticReviewStatus: CONTENT_STATUS,
  version: COURSE_VERSION,
  dayNumber: 1,
  lessonNumber: 1,
  positionInLesson: 1,
  isProductive: true,
  maxNewPerLesson: 1
};

const PHRASE_DAY1_2: Phrase = {
  id: 'phrase_d1_2',
  spanishText: 'Buenos días',
  pronunciationAid: 'BWEH-nos DEE-ahs',
  englishMeaning: 'Good morning',
  slowAudio: createAudioReference('phrase_d1_2', 'slow'),
  normalAudio: createAudioReference('phrase_d1_2', 'normal'),
  usageContexts: ['greeting'],
  formality: 'neutral',
  acceptedAlternatives: ['Buen día'],
  criticalConcepts: [{
    slotId: 'time_of_day',
    slotType: 'time',
    correctValue: 'días',
    commonConfusions: ['tardes', 'noches'],
    errorMessage: 'Use "días" only for morning (before noon)'
  }],
  commonLearnerErrors: [],
  feedbackRules: [],
  likelyReplies: ['Buenos días', 'Hola', 'Que tenga buen día'],
  offlineAvailable: true,
  linguisticReviewStatus: CONTENT_STATUS,
  version: COURSE_VERSION,
  dayNumber: 1,
  lessonNumber: 1,
  positionInLesson: 2,
  isProductive: true,
  maxNewPerLesson: 1
};

const PHRASE_DAY1_3: Phrase = {
  id: 'phrase_d1_3',
  spanishText: 'Gracias',
  pronunciationAid: 'GRAH-syahs',
  englishMeaning: 'Thank you',
  slowAudio: createAudioReference('phrase_d1_3', 'slow'),
  normalAudio: createAudioReference('phrase_d1_3', 'normal'),
  usageContexts: ['politeness', 'response'],
  formality: 'neutral',
  acceptedAlternatives: ['Muchas gracias'],
  criticalConcepts: [],
  commonLearnerErrors: [],
  feedbackRules: [],
  likelyReplies: ['De nada', 'Por nada', 'Con gusto'],
  offlineAvailable: true,
  linguisticReviewStatus: CONTENT_STATUS,
  version: COURSE_VERSION,
  dayNumber: 1,
  lessonNumber: 1,
  positionInLesson: 3,
  isProductive: true,
  maxNewPerLesson: 1
};

// ============================================================================
// DAY 2 PHRASES - POLITENESS
// ============================================================================

const PHRASE_DAY2_1: Phrase = {
  id: 'phrase_d2_1',
  spanishText: 'Por favor',
  pronunciationAid: 'por fah-BOR',
  englishMeaning: 'Please',
  slowAudio: createAudioReference('phrase_d2_1', 'slow'),
  normalAudio: createAudioReference('phrase_d2_1', 'normal'),
  usageContexts: ['politeness', 'request'],
  formality: 'neutral',
  acceptedAlternatives: [],
  criticalConcepts: [],
  commonLearnerErrors: [{
    errorPattern: 'Forgetting to use "por favor" in requests',
    explanation: 'Mexican Spanish values politeness in all interactions',
    correction: 'Always add "por favor" when asking for something',
    severity: 'minor'
  }],
  feedbackRules: [],
  likelyReplies: ['Sí, claro', 'Ahí está', 'Con gusto'],
  offlineAvailable: true,
  linguisticReviewStatus: CONTENT_STATUS,
  version: COURSE_VERSION,
  dayNumber: 2,
  lessonNumber: 1,
  positionInLesson: 1,
  isProductive: true,
  maxNewPerLesson: 1
};

const PHRASE_DAY2_2: Phrase = {
  id: 'phrase_d2_2',
  spanishText: 'De nada',
  pronunciationAid: 'deh NAH-dah',
  englishMeaning: "You're welcome / It's nothing",
  slowAudio: createAudioReference('phrase_d2_2', 'slow'),
  normalAudio: createAudioReference('phrase_d2_2', 'normal'),
  usageContexts: ['politeness', 'response'],
  formality: 'neutral',
  acceptedAlternatives: ['Por nada', 'Con gusto', 'No hay de qué'],
  criticalConcepts: [],
  commonLearnerErrors: [],
  feedbackRules: [],
  likelyReplies: [],
  offlineAvailable: true,
  linguisticReviewStatus: CONTENT_STATUS,
  version: COURSE_VERSION,
  dayNumber: 2,
  lessonNumber: 1,
  positionInLesson: 2,
  isProductive: true,
  maxNewPerLesson: 1
};

const PHRASE_DAY2_3: Phrase = {
  id: 'phrase_d2_3',
  spanishText: 'Con permiso',
  pronunciationAid: 'kon per-MEE-soh',
  englishMeaning: 'Excuse me (to pass through) / May I?',
  slowAudio: createAudioReference('phrase_d2_3', 'slow'),
  normalAudio: createAudioReference('phrase_d2_3', 'normal'),
  usageContexts: ['politeness'],
  formality: 'neutral',
  acceptedAlternatives: ['Permiso'],
  criticalConcepts: [{
    slotId: 'con_vs_sin',
    slotType: 'preposition',
    correctValue: 'con',
    commonConfusions: ['sin'],
    errorMessage: '"Con permiso" means "with permission"; "sin permiso" means "without permission"'
  }],
  commonLearnerErrors: [],
  feedbackRules: [],
  likelyReplies: ['Adelante', 'Pase', 'Sí, claro'],
  offlineAvailable: true,
  linguisticReviewStatus: CONTENT_STATUS,
  version: COURSE_VERSION,
  dayNumber: 2,
  lessonNumber: 1,
  positionInLesson: 3,
  isProductive: true,
  maxNewPerLesson: 1
};

// ============================================================================
// DAY 3 PHRASES - INTRODUCTIONS
// ============================================================================

const PHRASE_DAY3_1: Phrase = {
  id: 'phrase_d3_1',
  spanishText: 'Me llamo…',
  pronunciationAid: 'meh YAH-moh',
  englishMeaning: 'My name is...',
  slowAudio: createAudioReference('phrase_d3_1', 'slow'),
  normalAudio: createAudioReference('phrase_d3_1', 'normal'),
  usageContexts: ['introduction'],
  formality: 'neutral',
  acceptedAlternatives: ['Mi nombre es…'],
  criticalConcepts: [{
    slotId: 'person_marker',
    slotType: 'person',
    correctValue: 'me',
    commonConfusions: ['te', 'se', 'le'],
    errorMessage: '"Me llamo" is first person; "se llama" is third person formal'
  }],
  commonLearnerErrors: [],
  feedbackRules: [],
  likelyReplies: ['Mucho gusto', '¿Cómo se llama?', 'Igualmente'],
  offlineAvailable: true,
  linguisticReviewStatus: CONTENT_STATUS,
  version: COURSE_VERSION,
  dayNumber: 3,
  lessonNumber: 1,
  positionInLesson: 1,
  isProductive: true,
  maxNewPerLesson: 1
};

const PHRASE_DAY3_2: Phrase = {
  id: 'phrase_d3_2',
  spanishText: 'Mucho gusto',
  pronunciationAid: 'MOO-choh GOOS-toh',
  englishMeaning: 'Nice to meet you / Pleased to meet you',
  slowAudio: createAudioReference('phrase_d3_2', 'slow'),
  normalAudio: createAudioReference('phrase_d3_2', 'normal'),
  usageContexts: ['introduction', 'politeness'],
  formality: 'neutral',
  acceptedAlternatives: ['Encantado', 'Encantada', 'El gusto es mío'],
  criticalConcepts: [],
  commonLearnerErrors: [],
  feedbackRules: [],
  likelyReplies: ['Mucho gusto también', 'Igualmente', 'El gusto es mío'],
  offlineAvailable: true,
  linguisticReviewStatus: CONTENT_STATUS,
  version: COURSE_VERSION,
  dayNumber: 3,
  lessonNumber: 1,
  positionInLesson: 2,
  isProductive: true,
  maxNewPerLesson: 1
};

const PHRASE_DAY3_3: Phrase = {
  id: 'phrase_d3_3',
  spanishText: '¿Cómo se llama?',
  pronunciationAid: 'KOH-moh seh YAH-mah',
  englishMeaning: 'What is your name? (formal)',
  slowAudio: createAudioReference('phrase_d3_3', 'slow'),
  normalAudio: createAudioReference('phrase_d3_3', 'normal'),
  usageContexts: ['introduction', 'question'],
  formality: 'formal',
  acceptedAlternatives: ['¿Cuál es su nombre?', '¿Y tú cómo te llamas?'],
  criticalConcepts: [{
    slotId: 'formality_marker',
    slotType: 'person',
    correctValue: 'se',
    commonConfusions: ['te'],
    errorMessage: '"Se llama" is formal (usted); "te llamas" is informal (tú)'
  }],
  commonLearnerErrors: [],
  feedbackRules: [],
  likelyReplies: ['Me llamo…', 'Mi nombre es…', 'Soy…'],
  offlineAvailable: true,
  linguisticReviewStatus: CONTENT_STATUS,
  version: COURSE_VERSION,
  dayNumber: 3,
  lessonNumber: 1,
  positionInLesson: 3,
  isProductive: true,
  maxNewPerLesson: 1
};

// ============================================================================
// DAY 4 PHRASES - SOUTH AFRICA
// ============================================================================

const PHRASE_DAY4_1: Phrase = {
  id: 'phrase_d4_1',
  spanishText: 'Somos de Sudáfrica',
  pronunciationAid: 'SOH-mos deh soo-DAH-free-kah',
  englishMeaning: 'We are from South Africa',
  slowAudio: createAudioReference('phrase_d4_1', 'slow'),
  normalAudio: createAudioReference('phrase_d4_1', 'normal'),
  usageContexts: ['introduction', 'statement'],
  formality: 'neutral',
  acceptedAlternatives: ['Venimos de Sudáfrica'],
  criticalConcepts: [{
    slotId: 'number_person',
    slotType: 'person',
    correctValue: 'somos',
    commonConfusions: ['soy', 'son'],
    errorMessage: '"Somos" is we are; "soy" is I am; "son" is they are'
  }],
  commonLearnerErrors: [],
  feedbackRules: [],
  likelyReplies: ['¡Qué interesante!', '¿De qué parte?', 'Bienvenidos'],
  offlineAvailable: true,
  linguisticReviewStatus: CONTENT_STATUS,
  version: COURSE_VERSION,
  dayNumber: 4,
  lessonNumber: 1,
  positionInLesson: 1,
  isProductive: true,
  maxNewPerLesson: 1
};

const PHRASE_DAY4_2: Phrase = {
  id: 'phrase_d4_2',
  spanishText: 'Soy de Sudáfrica',
  pronunciationAid: 'soy deh soo-DAH-free-kah',
  englishMeaning: 'I am from South Africa',
  slowAudio: createAudioReference('phrase_d4_2', 'slow'),
  normalAudio: createAudioReference('phrase_d4_2', 'normal'),
  usageContexts: ['introduction', 'statement'],
  formality: 'neutral',
  acceptedAlternatives: ['Vengo de Sudáfrica'],
  criticalConcepts: [{
    slotId: 'person_singular',
    slotType: 'person',
    correctValue: 'soy',
    commonConfusions: ['eres', 'es'],
    errorMessage: '"Soy" is I am (first person); "es" is he/she/you formal is'
  }],
  commonLearnerErrors: [],
  feedbackRules: [],
  likelyReplies: ['¡Qué bien!', '¿Primera vez aquí?', 'Bienvenido', 'Bienvenida'],
  offlineAvailable: true,
  linguisticReviewStatus: CONTENT_STATUS,
  version: COURSE_VERSION,
  dayNumber: 4,
  lessonNumber: 1,
  positionInLesson: 2,
  isProductive: true,
  maxNewPerLesson: 1
};

// ============================================================================
// DAY 5 PHRASES - LIMITED SPANISH
// ============================================================================

const PHRASE_DAY5_1: Phrase = {
  id: 'phrase_d5_1',
  spanishText: 'Hablo un poco de español',
  pronunciationAid: 'AH-bloh oon POH-koh deh eh-spah-NYOHL',
  englishMeaning: 'I speak a little Spanish',
  slowAudio: createAudioReference('phrase_d5_1', 'slow'),
  normalAudio: createAudioReference('phrase_d5_1', 'normal'),
  usageContexts: ['statement'],
  formality: 'neutral',
  acceptedAlternatives: ['Hablo poquito español'],
  criticalConcepts: [{
    slotId: 'negation_absent',
    slotType: 'negation',
    correctValue: '',
    commonConfusions: ['no'],
    errorMessage: 'This is positive statement; adding "no" changes meaning to negative'
  }],
  commonLearnerErrors: [],
  feedbackRules: [],
  likelyReplies: ['Muy bien', 'No se preocupe', 'Yo le ayudo'],
  offlineAvailable: true,
  linguisticReviewStatus: CONTENT_STATUS,
  version: COURSE_VERSION,
  dayNumber: 5,
  lessonNumber: 1,
  positionInLesson: 1,
  isProductive: true,
  maxNewPerLesson: 1
};

const PHRASE_DAY5_2: Phrase = {
  id: 'phrase_d5_2',
  spanishText: 'No hablo mucho español',
  pronunciationAid: 'noh AH-bloh MOO-choh deh eh-spah-NYOHL',
  englishMeaning: "I don't speak much Spanish",
  slowAudio: createAudioReference('phrase_d5_2', 'slow'),
  normalAudio: createAudioReference('phrase_d5_2', 'normal'),
  usageContexts: ['statement'],
  formality: 'neutral',
  acceptedAlternatives: ['No hablo muy bien el español'],
  criticalConcepts: [{
    slotId: 'negation_present',
    slotType: 'negation',
    correctValue: 'no',
    commonConfusions: [''],
    errorMessage: 'The "no" is essential - without it, the meaning reverses'
  }],
  commonLearnerErrors: [],
  feedbackRules: [],
  likelyReplies: ['No hay problema', 'Tranquilo', 'Yo hablo inglés un poco'],
  offlineAvailable: true,
  linguisticReviewStatus: CONTENT_STATUS,
  version: COURSE_VERSION,
  dayNumber: 5,
  lessonNumber: 1,
  positionInLesson: 2,
  isProductive: true,
  maxNewPerLesson: 1
};

// ============================================================================
// DAY 6 PHRASES - SLOWER SPEECH
// ============================================================================

const PHRASE_DAY6_1: Phrase = {
  id: 'phrase_d6_1',
  spanishText: '¿Puede hablar más despacio?',
  pronunciationAid: 'PWEH-deh ah-BLAR mahs des-PAH-syo',
  englishMeaning: 'Can you speak more slowly? (formal)',
  slowAudio: createAudioReference('phrase_d6_1', 'slow'),
  normalAudio: createAudioReference('phrase_d6_1', 'normal'),
  usageContexts: ['question', 'request'],
  formality: 'formal',
  acceptedAlternatives: ['¿Puedes hablar más despacio?', 'Más despacio, por favor'],
  criticalConcepts: [{
    slotId: 'despacio_vs_rapido',
    slotType: 'destination',
    correctValue: 'despacio',
    commonConfusions: ['rápido'],
    errorMessage: '"Despacio" means slowly; "rápido" means fast - opposite meanings!'
  }],
  commonLearnerErrors: [],
  feedbackRules: [],
  likelyReplies: ['Sí, claro', 'Por supuesto', 'Disculpe'],
  offlineAvailable: true,
  linguisticReviewStatus: CONTENT_STATUS,
  version: COURSE_VERSION,
  dayNumber: 6,
  lessonNumber: 1,
  positionInLesson: 1,
  isProductive: true,
  maxNewPerLesson: 1
};

const PHRASE_DAY6_2: Phrase = {
  id: 'phrase_d6_2',
  spanishText: 'Más despacio, por favor',
  pronunciationAid: 'mahs des-PAH-syo por fah-BOR',
  englishMeaning: 'More slowly, please',
  slowAudio: createAudioReference('phrase_d6_2', 'slow'),
  normalAudio: createAudioReference('phrase_d6_2', 'normal'),
  usageContexts: ['request', 'politeness'],
  formality: 'neutral',
  acceptedAlternatives: ['Más lento, por favor', 'Despacio, por favor'],
  criticalConcepts: [{
    slotId: 'mas_vs_menos',
    slotType: 'number',
    correctValue: 'más',
    commonConfusions: ['menos'],
    errorMessage: '"Más" means more; "menos" means less - opposite meanings!'
  }],
  commonLearnerErrors: [],
  feedbackRules: [],
  likelyReplies: ['Claro', 'Sí, sí', 'Perdón'],
  offlineAvailable: true,
  linguisticReviewStatus: CONTENT_STATUS,
  version: COURSE_VERSION,
  dayNumber: 6,
  lessonNumber: 1,
  positionInLesson: 2,
  isProductive: true,
  maxNewPerLesson: 1
};

// ============================================================================
// EXERCISES FOR DAYS 1-7
// ============================================================================

function createExercises(): Record<string, Exercise> {
  const exercises: Record<string, Exercise> = {};

  // Day 1 Exercises
  exercises['ex_d1_1'] = {
    id: 'ex_d1_1',
    type: 'listen_and_select',
    prompt: 'Listen and select the correct meaning',
    correctAnswers: ['phrase_d1_1'],
    audioReference: createAudioReference('phrase_d1_1', 'normal'),
    points: 10
  };

  exercises['ex_d1_2'] = {
    id: 'ex_d1_2',
    type: 'select_and_listen',
    prompt: 'Select "Hello" in Spanish',
    correctAnswers: ['Hola'],
    acceptedVariants: ['hola'],
    points: 10
  };

  exercises['ex_d1_3'] = {
    id: 'ex_d1_3',
    type: 'speaking_practice',
    prompt: 'Say "Buenos días" (Good morning)',
    correctAnswers: ['Buenos días'],
    acceptedVariants: ['buenos días', 'Buen día', 'buen día'],
    points: 15
  };

  // Day 2 Exercises
  exercises['ex_d2_1'] = {
    id: 'ex_d2_1',
    type: 'active_retrieval',
    prompt: 'How do you say "Please" in Spanish?',
    correctAnswers: ['Por favor'],
    acceptedVariants: ['por favor'],
    points: 10
  };

  exercises['ex_d2_2'] = {
    id: 'ex_d2_2',
    type: 'listening_comprehension',
    prompt: 'You hear "De nada". What does it mean?',
    correctAnswers: ["You're welcome"],
    acceptedVariants: ["you're welcome", "Its nothing", "it's nothing"],
    points: 10
  };

  // Day 3 Exercises
  exercises['ex_d3_1'] = {
    id: 'ex_d3_1',
    type: 'scenario_roleplay',
    prompt: 'Introduce yourself. Say your name.',
    correctAnswers: ['Me llamo…'],
    acceptedVariants: ['me llamo', 'Mi nombre es', 'mi nombre es'],
    scenarioContext: {
      setting: 'Meeting someone new at a language exchange',
      characters: ['Another learner'],
      goal: 'Introduce yourself politely',
      openingLine: '¡Hola! ¿Cómo te llamas?'
    },
    points: 20
  };

  // Day 4 Exercises
  exercises['ex_d4_1'] = {
    id: 'ex_d4_1',
    type: 'active_retrieval',
    prompt: 'Say "We are from South Africa"',
    correctAnswers: ['Somos de Sudáfrica'],
    acceptedVariants: ['somos de Sudáfrica'],
    points: 15
  };

  // Day 5 Exercises
  exercises['ex_d5_1'] = {
    id: 'ex_d5_1',
    type: 'active_retrieval',
    prompt: 'Tell someone you speak a little Spanish',
    correctAnswers: ['Hablo un poco de español'],
    acceptedVariants: ['hablo un poco de español', 'Hablo poquito español'],
    points: 15
  };

  // Day 6 Exercises
  exercises['ex_d6_1'] = {
    id: 'ex_d6_1',
    type: 'speaking_practice',
    prompt: 'Ask someone to speak more slowly',
    correctAnswers: ['¿Puede hablar más despacio?'],
    acceptedVariants: ['puede hablar más despacio', 'Más despacio, por favor', 'más despacio, por favor'],
    points: 20
  };

  return exercises;
}

// ============================================================================
// LESSONS FOR DAYS 1-7
// ============================================================================

function createLessons(): Record<string, Lesson> {
  const lessons: Record<string, Lesson> = {};

  // Day 1 Lesson
  lessons['lesson_d1_1'] = {
    id: 'lesson_d1_1',
    dayNumber: 1,
    lessonNumber: 1,
    title: 'Greetings',
    goal: 'Learn to greet people politely in Spanish',
    estimatedDurationMin: 7,
    newPhrases: ['phrase_d1_1', 'phrase_d1_2', 'phrase_d1_3'],
    reviewPhrases: [],
    exercises: [
      { id: 'ex_d1_1', type: 'listen_and_select', prompt: 'Listen and select', correctAnswers: ['phrase_d1_1'], points: 10 },
      { id: 'ex_d1_2', type: 'select_and_listen', prompt: 'Select Hello', correctAnswers: ['Hola'], points: 10 },
      { id: 'ex_d1_3', type: 'speaking_practice', prompt: 'Say Buenos días', correctAnswers: ['Buenos días'], points: 15 }
    ],
    completionCriteria: {
      minCorrectExercises: 2,
      totalExercises: 3,
      speakingRequired: true,
      minScenarioProgress: 0
    },
    travelPoints: 50,
    offlineAvailable: true,
    linguisticReviewStatus: CONTENT_STATUS,
    version: COURSE_VERSION
  };

  // Day 2 Lesson
  lessons['lesson_d2_1'] = {
    id: 'lesson_d2_1',
    dayNumber: 2,
    lessonNumber: 1,
    title: 'Politeness Essentials',
    goal: 'Learn polite phrases for everyday interactions',
    estimatedDurationMin: 7,
    newPhrases: ['phrase_d2_1', 'phrase_d2_2', 'phrase_d2_3'],
    reviewPhrases: ['phrase_d1_1', 'phrase_d1_3'],
    exercises: [
      { id: 'ex_d2_1', type: 'active_retrieval', prompt: 'Say Please', correctAnswers: ['Por favor'], points: 10 },
      { id: 'ex_d2_2', type: 'listening_comprehension', prompt: 'Understand De nada', correctAnswers: ["You're welcome"], points: 10 }
    ],
    completionCriteria: {
      minCorrectExercises: 2,
      totalExercises: 2,
      speakingRequired: true,
      minScenarioProgress: 0
    },
    travelPoints: 50,
    offlineAvailable: true,
    linguisticReviewStatus: CONTENT_STATUS,
    version: COURSE_VERSION
  };

  // Day 3 Lesson
  lessons['lesson_d3_1'] = {
    id: 'lesson_d3_1',
    dayNumber: 3,
    lessonNumber: 1,
    title: 'Introductions',
    goal: 'Introduce yourself and ask for names',
    estimatedDurationMin: 8,
    newPhrases: ['phrase_d3_1', 'phrase_d3_2', 'phrase_d3_3'],
    reviewPhrases: ['phrase_d1_1', 'phrase_d1_2'],
    exercises: [
      { id: 'ex_d3_1', type: 'scenario_roleplay', prompt: 'Introduce yourself', correctAnswers: ['Me llamo'], points: 20 }
    ],
    completionCriteria: {
      minCorrectExercises: 1,
      totalExercises: 1,
      speakingRequired: true,
      minScenarioProgress: 100
    },
    travelPoints: 75,
    offlineAvailable: true,
    linguisticReviewStatus: CONTENT_STATUS,
    version: COURSE_VERSION
  };

  // Day 4 Lesson
  lessons['lesson_d4_1'] = {
    id: 'lesson_d4_1',
    dayNumber: 4,
    lessonNumber: 1,
    title: 'Talking About Origin',
    goal: 'Say where you are from',
    estimatedDurationMin: 6,
    newPhrases: ['phrase_d4_1', 'phrase_d4_2'],
    reviewPhrases: ['phrase_d3_1', 'phrase_d3_2'],
    exercises: [
      { id: 'ex_d4_1', type: 'active_retrieval', prompt: 'Say We are from South Africa', correctAnswers: ['Somos de Sudáfrica'], points: 15 }
    ],
    completionCriteria: {
      minCorrectExercises: 1,
      totalExercises: 1,
      speakingRequired: true,
      minScenarioProgress: 0
    },
    travelPoints: 50,
    offlineAvailable: true,
    linguisticReviewStatus: CONTENT_STATUS,
    version: COURSE_VERSION
  };

  // Day 5 Lesson
  lessons['lesson_d5_1'] = {
    id: 'lesson_d5_1',
    dayNumber: 5,
    lessonNumber: 1,
    title: 'Setting Expectations',
    goal: 'Communicate your Spanish level',
    estimatedDurationMin: 7,
    newPhrases: ['phrase_d5_1', 'phrase_d5_2'],
    reviewPhrases: ['phrase_d1_1', 'phrase_d2_1'],
    exercises: [
      { id: 'ex_d5_1', type: 'active_retrieval', prompt: 'Say you speak a little Spanish', correctAnswers: ['Hablo un poco de español'], points: 15 }
    ],
    completionCriteria: {
      minCorrectExercises: 1,
      totalExercises: 1,
      speakingRequired: true,
      minScenarioProgress: 0
    },
    travelPoints: 50,
    offlineAvailable: true,
    linguisticReviewStatus: CONTENT_STATUS,
    version: COURSE_VERSION
  };

  // Day 6 Lesson
  lessons['lesson_d6_1'] = {
    id: 'lesson_d6_1',
    dayNumber: 6,
    lessonNumber: 1,
    title: 'Repair Strategies',
    goal: 'Ask for slower speech when needed',
    estimatedDurationMin: 7,
    newPhrases: ['phrase_d6_1', 'phrase_d6_2'],
    reviewPhrases: ['phrase_d5_1', 'phrase_d5_2'],
    exercises: [
      { id: 'ex_d6_1', type: 'speaking_practice', prompt: 'Ask for slower speech', correctAnswers: ['¿Puede hablar más despacio?'], points: 20 }
    ],
    completionCriteria: {
      minCorrectExercises: 1,
      totalExercises: 1,
      speakingRequired: true,
      minScenarioProgress: 0
    },
    travelPoints: 50,
    offlineAvailable: true,
    linguisticReviewStatus: CONTENT_STATUS,
    version: COURSE_VERSION
  };

  return lessons;
}

// ============================================================================
// DAY 7 MISSION - FRIENDLY ARRIVAL
// ============================================================================

const MISSION_FRIENDLY_ARRIVAL: MissionDefinition = {
  missionId: 'mission_day7',
  name: 'Mission 1: Friendly Arrival',
  goal: 'Complete a friendly arrival conversation using greetings, introductions, origin, limited Spanish, and request for slower speech',
  states: [], // Populated below
  initialState: 'state_greeting',
  successCondition: {
    finalStateId: 'state_closing',
    minStatesVisited: 6,
    maxFailures: 3
  },
  failureRecovery: {
    allowContinue: true,
    failuresBeforeSkip: 3,
    retryMessage: 'Would you like to try again or see the solution?',
    showSolution: true
  },
  maxTotalRetries: 5,
  hints: []
};

// Mission States
const MISSION_STATES: MissionState[] = [
  {
    stateId: 'state_greeting',
    description: 'Greet the hotel receptionist',
    prompt: 'Receptionist: ¡Buenos días! Bienvenidos al hotel.',
    promptAudio: createAudioReference('mission_receptionist_greeting', 'normal', VOICE_ID_MALE_MEXICAN),
    allowedIntents: [
      {
        intentId: 'intent_greet_back',
        description: 'Greet back with buenos días',
        acceptedVariants: ['Buenos días', 'buenos días', 'Hola', 'hola'],
        requiredConcepts: [{
          conceptId: 'greeting_response',
          description: 'Respond to greeting',
          expressions: ['buenos días', 'hola'],
          required: true
        }]
      }
    ],
    transitions: [
      { trigger: 'success', nextStateId: 'state_introduction', response: 'Receptionist: ¿Cómo están?' },
      { trigger: 'failure', nextStateId: 'state_greeting', response: 'Try greeting them back!' }
    ],
    hint: 'Say "Buenos días" back to them'
  },
  {
    stateId: 'state_introduction',
    description: 'Introduce yourself',
    prompt: 'Receptionist: ¿Cómo se llama?',
    promptAudio: createAudioReference('mission_receptionist_name', 'normal', VOICE_ID_MALE_MEXICAN),
    allowedIntents: [
      {
        intentId: 'intent_introduce',
        description: 'State your name',
        acceptedVariants: ['Me llamo', 'me llamo', 'Mi nombre es', 'mi nombre es'],
        requiredConcepts: [{
          conceptId: 'self_introduction',
          description: 'Introduce yourself with name',
          expressions: ['me llamo', 'mi nombre es'],
          required: true
        }]
      }
    ],
    transitions: [
      { trigger: 'success', nextStateId: 'state_origin', response: 'Receptionist: Mucho gusto.' },
      { trigger: 'failure', nextStateId: 'state_introduction', response: 'Tell them your name using "Me llamo..."' }
    ],
    hint: 'Say "Me llamo [your name]"'
  },
  {
    stateId: 'state_origin',
    description: 'State where you are from',
    prompt: 'Receptionist: ¿De dónde son?',
    promptAudio: createAudioReference('mission_receptionist_origin', 'normal', VOICE_ID_MALE_MEXICAN),
    allowedIntents: [
      {
        intentId: 'intent_state_origin',
        description: 'Say you are from South Africa',
        acceptedVariants: ['Somos de Sudáfrica', 'somos de Sudáfrica', 'Venimos de Sudáfrica'],
        requiredConcepts: [{
          conceptId: 'origin_south_africa',
          description: 'State origin as South Africa',
          expressions: ['Sudáfrica', 'de Sudáfrica'],
          required: true
        }]
      }
    ],
    transitions: [
      { trigger: 'success', nextStateId: 'state_limited_spanish', response: 'Receptionist: ¡Qué interesante!' },
      { trigger: 'failure', nextStateId: 'state_origin', response: 'Tell them "Somos de Sudáfrica"' }
    ],
    hint: 'Say "Somos de Sudáfrica"'
  },
  {
    stateId: 'state_limited_spanish',
    description: 'Indicate limited Spanish ability',
    prompt: 'Receptionist: ¿Hablan español?',
    promptAudio: createAudioReference('mission_receptionist_spanish', 'normal', VOICE_ID_MALE_MEXICAN),
    allowedIntents: [
      {
        intentId: 'intent_limited_spanish',
        description: 'Say you speak a little Spanish',
        acceptedVariants: ['Hablo un poco de español', 'hablo un poco de español', 'No hablo mucho español'],
        requiredConcepts: [{
          conceptId: 'limited_ability',
          description: 'Express limited Spanish ability',
          expressions: ['un poco', 'no mucho'],
          required: true
        }]
      }
    ],
    transitions: [
      { trigger: 'success', nextStateId: 'state_slower_speech', response: 'Receptionist: No se preocupe.' },
      { trigger: 'failure', nextStateId: 'state_limited_spanish', response: 'Say "Hablo un poco de español"' }
    ],
    hint: 'Say "Hablo un poco de español"'
  },
  {
    stateId: 'state_slower_speech',
    description: 'Request slower speech if needed',
    prompt: 'Receptionist: (speaks quickly) Necesito ver sus pasaportes y llenar este formulario con toda la información...',
    promptAudio: createAudioReference('mission_receptionist_fast', 'normal', VOICE_ID_MALE_MEXICAN),
    allowedIntents: [
      {
        intentId: 'intent_slower_speech',
        description: 'Ask for slower speech',
        acceptedVariants: ['¿Puede hablar más despacio?', 'Más despacio, por favor', 'más despacio, por favor'],
        requiredConcepts: [{
          conceptId: 'request_slower',
          description: 'Request slower speech',
          expressions: ['más despacio', 'despacio'],
          required: true
        }]
      }
    ],
    transitions: [
      { trigger: 'success', nextStateId: 'state_closing', response: 'Receptionist: Sí, claro. Disculpe.' },
      { trigger: 'partial', nextStateId: 'state_closing', response: 'Receptionist: Ah, perdón.' },
      { trigger: 'failure', nextStateId: 'state_slower_speech', response: 'Ask them to speak more slowly' }
    ],
    hint: 'Say "Más despacio, por favor"'
  },
  {
    stateId: 'state_closing',
    description: 'Close with thanks',
    prompt: 'Receptionist: Aquí tienen las llaves. Su habitación es la 205.',
    promptAudio: createAudioReference('mission_receptionist_keys', 'normal', VOICE_ID_MALE_MEXICAN),
    allowedIntents: [
      {
        intentId: 'intent_thanks',
        description: 'Thank the receptionist',
        acceptedVariants: ['Gracias', 'gracias', 'Muchas gracias'],
        requiredConcepts: [{
          conceptId: 'express_gratitude',
          description: 'Express thanks',
          expressions: ['gracias'],
          required: true
        }]
      }
    ],
    transitions: [
      { trigger: 'success', nextStateId: 'state_complete', response: 'Receptionist: ¡Que disfruten su estancia!' },
      { trigger: 'failure', nextStateId: 'state_closing', response: 'Thank them with "Gracias"' }
    ],
    hint: 'Say "Gracias"'
  }
];

MISSION_FRIENDLY_ARRIVAL.states = MISSION_STATES;

// ============================================================================
// DAYS STRUCTURE
// ============================================================================

function createDays(): Day[] {
  const days: Day[] = [];

  // Day 1
  days.push({
    id: 'day_1',
    dayNumber: 1,
    dateLabel: 'Aug 10',
    theme: 'Greetings',
    lessons: [lessons['lesson_d1_1']],
    isMissionDay: false,
    isReviewDay: false,
    offlineAvailable: true
  });

  // Day 2
  days.push({
    id: 'day_2',
    dayNumber: 2,
    dateLabel: 'Aug 11',
    theme: 'Politeness',
    lessons: [lessons['lesson_d2_1']],
    isMissionDay: false,
    isReviewDay: false,
    offlineAvailable: true
  });

  // Day 3
  days.push({
    id: 'day_3',
    dayNumber: 3,
    dateLabel: 'Aug 12',
    theme: 'Introductions',
    lessons: [lessons['lesson_d3_1']],
    isMissionDay: false,
    isReviewDay: false,
    offlineAvailable: true
  });

  // Day 4
  days.push({
    id: 'day_4',
    dayNumber: 4,
    dateLabel: 'Aug 13',
    theme: 'South Africa',
    lessons: [lessons['lesson_d4_1']],
    isMissionDay: false,
    isReviewDay: false,
    offlineAvailable: true
  });

  // Day 5
  days.push({
    id: 'day_5',
    dayNumber: 5,
    dateLabel: 'Aug 14',
    theme: 'Limited Spanish',
    lessons: [lessons['lesson_d5_1']],
    isMissionDay: false,
    isReviewDay: false,
    offlineAvailable: true
  });

  // Day 6
  days.push({
    id: 'day_6',
    dayNumber: 6,
    dateLabel: 'Aug 15',
    theme: 'Slower Speech',
    lessons: [lessons['lesson_d6_1']],
    isMissionDay: false,
    isReviewDay: false,
    offlineAvailable: true
  });

  // Day 7 - Mission Day
  days.push({
    id: 'day_7',
    dayNumber: 7,
    dateLabel: 'Aug 16',
    theme: 'Mission 1: Friendly Arrival',
    lessons: [],
    isMissionDay: true,
    isReviewDay: false,
    mission: MISSION_FRIENDLY_ARRIVAL,
    offlineAvailable: true
  });

  return days;
}

// ============================================================================
// PHASE STRUCTURE
// ============================================================================

function createPhase(): Phase {
  return {
    id: 'phase_1',
    phaseNumber: 1,
    name: 'Foundations and Repair',
    description: 'Learn basic greetings, politeness, introductions, and repair strategies',
    startDay: 1,
    endDay: 12,
    objectives: [
      'Greet people appropriately based on time of day',
      'Use polite phrases in all interactions',
      'Introduce yourself and ask for names',
      'State your origin',
      'Communicate limited Spanish ability',
      'Request slower speech when needed'
    ]
  };
}

// ============================================================================
// COMPLETE COURSE EXPORT
// ============================================================================

export function createDays1to7Course(): Course {
  const phrases: Record<string, Phrase> = {
    'phrase_d1_1': PHRASE_DAY1_1,
    'phrase_d1_2': PHRASE_DAY1_2,
    'phrase_d1_3': PHRASE_DAY1_3,
    'phrase_d2_1': PHRASE_DAY2_1,
    'phrase_d2_2': PHRASE_DAY2_2,
    'phrase_d2_3': PHRASE_DAY2_3,
    'phrase_d3_1': PHRASE_DAY3_1,
    'phrase_d3_2': PHRASE_DAY3_2,
    'phrase_d3_3': PHRASE_DAY3_3,
    'phrase_d4_1': PHRASE_DAY4_1,
    'phrase_d4_2': PHRASE_DAY4_2,
    'phrase_d5_1': PHRASE_DAY5_1,
    'phrase_d5_2': PHRASE_DAY5_2,
    'phrase_d6_1': PHRASE_DAY6_1,
    'phrase_d6_2': PHRASE_DAY6_2
  };

  const exercises = createExercises();
  const lessons = createLessons();
  const days = createDays();
  const phase = createPhase();

  return {
    id: 'course_mexico_spanish_days_1_7',
    name: 'Mexico Spanish - Week 1 (Days 1-7)',
    version: COURSE_VERSION,
    targetLanguage: 'es-MX',
    sourceLanguage: 'en-ZA',
    phases: [phase],
    days: days,
    phrases: phrases,
    exercises: exercises,
    metadata: {
      createdDate: '2026-08-10',
      lastUpdated: '2026-08-10',
      linguisticReviewStatus: CONTENT_STATUS,
      authoringVersion: '0.1.0'
    }
  };
}

// Export individual components for testing
export {
  PHRASE_DAY1_1,
  PHRASE_DAY1_2,
  PHRASE_DAY1_3,
  PHRASE_DAY2_1,
  PHRASE_DAY2_2,
  PHRASE_DAY2_3,
  PHRASE_DAY3_1,
  PHRASE_DAY3_2,
  PHRASE_DAY3_3,
  PHRASE_DAY4_1,
  PHRASE_DAY4_2,
  PHRASE_DAY5_1,
  PHRASE_DAY5_2,
  PHRASE_DAY6_1,
  PHRASE_DAY6_2,
  MISSION_FRIENDLY_ARRIVAL
};
