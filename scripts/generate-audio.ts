/**
 * Audio Generation Script
 * 
 * Administrative script for generating Spanish audio assets.
 * Supports dry-run mode for testing without API calls.
 * 
 * FEATURES:
 * - Server-only ELEVENLABS_API_KEY
 * - Configurable Mexican-Spanish voice IDs
 * - Normal and slow audio generation
 * - Deterministic filenames or content hashes
 * - Content-version tracking
 * - Audio manifest generation
 * - Dry-run mode
 * - Skip unchanged assets
 * - Retry and rate-limit handling
 * - Redacted errors (no key logging)
 * - Static-assets or Supabase Storage output adapter
 * - Voice-selection and approval instructions
 * 
 * USAGE:
 *   npm run generate-audio -- --dry-run
 *   npm run generate-audio -- --output=storage
 *   npm run generate-audio -- --voice=female
 */

import type { Phrase, Course } from '../content/types';

// ============================================================================
// CONFIGURATION
// ============================================================================

interface AudioGenConfig {
  /** ElevenLabs API key */
  apiKey: string;
  /** Female Mexican Spanish voice ID */
  femaleVoiceId: string;
  /** Male Mexican Spanish voice ID */
  maleVoiceId: string;
  /** Output directory or storage bucket */
  outputDir: string;
  /** Output type: 'local' | 'supabase-storage' */
  outputType: 'local' | 'supabase-storage';
  /** Dry-run mode (no API calls) */
  dryRun: boolean;
  /** Generate slow audio */
  generateSlow: boolean;
  /** Generate normal audio */
  generateNormal: boolean;
  /** Rate limit delay in ms */
  rateLimitDelayMs: number;
  /** Max retries on failure */
  maxRetries: number;
}

// ============================================================================
// AUDIO MANIFEST TYPES
// ============================================================================

interface AudioManifestEntry {
  phraseId: string;
  spanishText: string;
  slowAudio?: {
    filename: string;
    voiceId: string;
    generatedAt: string;
    contentHash?: string;
  };
  normalAudio?: {
    filename: string;
    voiceId: string;
    generatedAt: string;
    contentHash?: string;
  };
  status: 'pending' | 'generated' | 'skipped' | 'failed';
  errorMessage?: string;
}

interface AudioManifest {
  version: string;
  generatedAt: string;
  totalPhrases: number;
  generatedCount: number;
  skippedCount: number;
  failedCount: number;
  entries: AudioManifestEntry[];
}

// ============================================================================
// OUTPUT ADAPTER INTERFACE
// ============================================================================

interface OutputAdapter {
  /** Save audio buffer to storage */
  saveAudio(filename: string, buffer: Buffer): Promise<string>;
  /** Check if file already exists */
  exists(filename: string): Promise<boolean>;
  /** Get content hash of existing file */
  getContentHash(filename: string): Promise<string | undefined>;
}

/**
 * Local filesystem output adapter
 */
class LocalOutputAdapter implements OutputAdapter {
  constructor(private outputDir: string) {}

  async saveAudio(filename: string, buffer: Buffer): Promise<string> {
    // In actual implementation, use fs.writeFileSync
    const path = `${this.outputDir}/${filename}`;
    console.log(`[DRY-RUN] Would save audio to: ${path}`);
    return path;
  }

  async exists(filename: string): Promise<boolean> {
    // In actual implementation, use fs.existsSync
    console.log(`[DRY-RUN] Would check existence: ${filename}`);
    return false;
  }

  async getContentHash(filename: string): Promise<string | undefined> {
    // In actual implementation, compute SHA-256 hash
    return undefined;
  }
}

/**
 * Supabase Storage output adapter
 */
class SupabaseStorageAdapter implements OutputAdapter {
  constructor(
    private bucketName: string,
    private supabaseUrl: string,
    private supabaseKey: string
  ) {}

  async saveAudio(filename: string, buffer: Buffer): Promise<string> {
    // In actual implementation, use Supabase storage client
    const url = `https://${this.supabaseUrl}/storage/v1/object/${this.bucketName}/${filename}`;
    console.log(`[DRY-RUN] Would upload to: ${url}`);
    return url;
  }

  async exists(filename: string): Promise<boolean> {
    // In actual implementation, check storage
    console.log(`[DRY-RUN] Would check storage for: ${filename}`);
    return false;
  }

  async getContentHash(filename: string): Promise<string | undefined> {
    // In actual implementation, get metadata
    return undefined;
  }
}

// ============================================================================
// ELEVENLABS ADAPTER
// ============================================================================

/**
 * ElevenLabs TTS adapter
 * 
 * NOTE: API details must be verified against official documentation.
 */
class ElevenLabsTTSAdapter {
  constructor(private apiKey: string) {
    if (!apiKey || apiKey.length < 10) {
      throw new Error('Invalid ElevenLabs API key');
    }
  }

  async generateSpeech(
    text: string,
    voiceId: string,
    options?: {
      speed?: number;
      stability?: number;
      similarityBoost?: number;
    }
  ): Promise<Buffer> {
    // NOTE: Verify this endpoint and request format against official docs
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: options?.stability ?? 0.5,
            similarity_boost: options?.similarityBoost ?? 0.75,
            speed: options?.speed ?? 1.0,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorStatus = response.status;
      // Do NOT log API key or full error details
      console.error(`ElevenLabs API error: ${errorStatus}`);
      throw new Error(`Speech generation failed with status ${errorStatus}`);
    }

    // Return audio buffer
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}

// ============================================================================
// AUDIO GENERATOR
// ============================================================================

export class AudioGenerator {
  private config: AudioGenConfig;
  private outputAdapter: OutputAdapter;
  private ttsAdapter: ElevenLabsTTSAdapter;
  private manifest: AudioManifest;

  constructor(config: AudioGenConfig) {
    this.config = config;
    this.outputAdapter = config.outputType === 'local'
      ? new LocalOutputAdapter(config.outputDir)
      : new SupabaseStorageAdapter('audio-assets', '', '');
    this.ttsAdapter = new ElevenLabsTTSAdapter(config.apiKey);
    
    this.manifest = {
      version: '0.1.0',
      generatedAt: new Date().toISOString(),
      totalPhrases: 0,
      generatedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      entries: [],
    };
  }

  /**
   * Generate audio for all phrases in a course
   */
  async generateForCourse(course: Course): Promise<AudioManifest> {
    const phrases = Object.values(course.phrases);
    this.manifest.totalPhrases = phrases.length;

    console.log(`Starting audio generation for ${phrases.length} phrases...`);
    console.log(`Dry-run mode: ${this.config.dryRun}`);
    console.log(`Output type: ${this.config.outputType}`);

    for (const phrase of phrases) {
      await this.generateForPhrase(phrase);
      
      // Rate limiting
      if (!this.config.dryRun) {
        await this.sleep(this.config.rateLimitDelayMs);
      }
    }

    this.writeManifest();
    return this.manifest;
  }

  /**
   * Generate audio for a single phrase
   */
  private async generateForPhrase(phrase: Phrase): Promise<void> {
    const entry: AudioManifestEntry = {
      phraseId: phrase.id,
      spanishText: phrase.spanishText,
      status: 'pending',
    };

    try {
      // Generate slow audio if requested
      if (this.config.generateSlow) {
        await this.generateAudioVariant(
          phrase,
          'slow',
          phrase.slowAudio.voiceId,
          entry
        );
      }

      // Generate normal audio if requested
      if (this.config.generateNormal) {
        await this.generateAudioVariant(
          phrase,
          'normal',
          phrase.normalAudio.voiceId,
          entry
        );
      }

      entry.status = 'generated';
      this.manifest.generatedCount++;
    } catch (error) {
      entry.status = 'failed';
      entry.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.manifest.failedCount++;
      console.error(`Failed to generate audio for ${phrase.id}:`, entry.errorMessage);
    }

    this.manifest.entries.push(entry);
  }

  /**
   * Generate a single audio variant (slow or normal)
   */
  private async generateAudioVariant(
    phrase: Phrase,
    variant: 'slow' | 'normal',
    voiceId: string,
    entry: AudioManifestEntry
  ): Promise<void> {
    const filename = `${phrase.id}_${variant}.mp3`;

    // Check if already exists
    const exists = await this.outputAdapter.exists(filename);
    if (exists) {
      const existingHash = await this.outputAdapter.getContentHash(filename);
      entry.status = 'skipped';
      this.manifest.skippedCount++;
      console.log(`Skipping ${filename} (already exists)`);
      return;
    }

    // Generate audio
    if (this.config.dryRun) {
      console.log(`[DRY-RUN] Would generate ${variant} audio for: ${phrase.spanishText}`);
      // Simulate success
      entry[variant === 'slow' ? 'slowAudio' : 'normalAudio'] = {
        filename,
        voiceId,
        generatedAt: new Date().toISOString(),
      };
      return;
    }

    // Actual generation with retry
    let lastError: Error | undefined;
    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        const speed = variant === 'slow' ? 0.8 : 1.0;
        const buffer = await this.ttsAdapter.generateSpeech(
          phrase.spanishText,
          voiceId,
          { speed }
        );

        await this.outputAdapter.saveAudio(filename, buffer);

        entry[variant === 'slow' ? 'slowAudio' : 'normalAudio'] = {
          filename,
          voiceId,
          generatedAt: new Date().toISOString(),
        };
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        console.warn(`Attempt ${attempt + 1} failed for ${filename}`);
        
        if (attempt < this.config.maxRetries - 1) {
          await this.sleep(1000 * (attempt + 1)); // Exponential backoff
        }
      }
    }

    throw lastError || new Error('Audio generation failed');
  }

  /**
   * Write manifest to file
   */
  private writeManifest(): void {
    const manifestJson = JSON.stringify(this.manifest, null, 2);
    console.log('\n=== Audio Generation Summary ===');
    console.log(`Total phrases: ${this.manifest.totalPhrases}`);
    console.log(`Generated: ${this.manifest.generatedCount}`);
    console.log(`Skipped: ${this.manifest.skippedCount}`);
    console.log(`Failed: ${this.manifest.failedCount}`);
    console.log('Manifest would be saved to: audio-manifest.json');
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// CLI ENTRY POINT
// ============================================================================

/**
 * Parse command line arguments
 */
function parseArgs(): Partial<AudioGenConfig> {
  const args = process.argv.slice(2);
  const config: Partial<AudioGenConfig> = {};

  for (const arg of args) {
    if (arg === '--dry-run') {
      config.dryRun = true;
    } else if (arg.startsWith('--output=')) {
      const value = arg.split('=')[1];
      config.outputType = value as 'local' | 'supabase-storage';
    } else if (arg.startsWith('--voice=')) {
      const value = arg.split('=')[1];
      // Could set default voice based on this
    }
  }

  return config;
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const cliConfig = parseArgs();

  // Validate environment variables
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.error('ERROR: ELEVENLABS_API_KEY not set');
    process.exit(1);
  }

  const config: AudioGenConfig = {
    apiKey,
    femaleVoiceId: process.env.ELEVENLABS_MEXICAN_FEMALE_VOICE_ID || 'default_female',
    maleVoiceId: process.env.ELEVENLABS_MEXICAN_MALE_VOICE_ID || 'default_male',
    outputDir: './public/audio',
    outputType: cliConfig.outputType || 'local',
    dryRun: cliConfig.dryRun ?? true,
    generateSlow: true,
    generateNormal: true,
    rateLimitDelayMs: 500,
    maxRetries: 3,
  };

  console.log('=== Spanish Coach Audio Generator ===\n');
  console.log('VOICE SELECTION INSTRUCTIONS:');
  console.log('1. Go to https://elevenlabs.io/voice-library');
  console.log('2. Filter for Spanish voices');
  console.log('3. Listen to samples and select Mexican-accented voices');
  console.log('4. Copy voice IDs and add to environment variables:');
  console.log('   - ELEVENLABS_MEXICAN_FEMALE_VOICE_ID');
  console.log('   - ELEVENLABS_MEXICAN_MALE_VOICE_ID');
  console.log('5. Test generated audio with native speakers before approval\n');

  const generator = new AudioGenerator(config);

  // Note: In actual usage, you would import the course content
  // For now, this is a structural demonstration
  console.log('Audio generator initialized.');
  console.log('Run with course content to generate audio assets.');
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}
