/**
 * ElevenLabs Speech Route Handler
 * 
 * Secure, Vercel-compatible Next.js route handler for short Spanish speech recordings.
 * 
 * SECURITY REQUIREMENTS:
 * - Same-origin authenticated request only
 * - Server-side API key only (NEVER expose to client)
 * - No NEXT_PUBLIC_ prefix for ElevenLabs secret
 * - Bounded file size and expected duration
 * - MIME-type validation
 * - Rate-limit interface
 * - Request timeout
 * - Spanish language hint where officially supported
 * - Phrase key terms only where officially supported
 * - No secret, raw recording or transcript content in logs
 * - Safe structured response
 * - Transient recording deletion
 * - Safe error responses
 * - Technical failure must not count as learner error
 * 
 * NOTE: ElevenLabs API specifics are isolated behind an adapter.
 * The actual API shape must be verified against official documentation.
 */

import type { NextRequest } from 'next/server';

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Maximum audio file size in bytes (1MB)
 */
const MAX_AUDIO_SIZE_BYTES = 1024 * 1024;

/**
 * Maximum audio duration in seconds (30s)
 */
const MAX_AUDIO_DURATION_SECONDS = 30;

/**
 * Request timeout in milliseconds (10s)
 */
const REQUEST_TIMEOUT_MS = 10000;

/**
 * Allowed MIME types for audio upload
 */
const ALLOWED_MIME_TYPES = ['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/wav'];

/**
 * Spanish language code for ElevenLabs
 * NOTE: Verify this against official ElevenLabs documentation
 */
const SPANISH_LANGUAGE_CODE = 'es';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Safe response structure
 */
interface SpeechResponse {
  /** Whether transcription succeeded */
  success: boolean;
  /** Transcribed text if successful */
  transcript?: string;
  /** Error message if failed (safe, no secrets) */
  error?: string;
  /** Error code for client handling */
  errorCode?: 'TOO_LARGE' | 'INVALID_TYPE' | 'TIMEOUT' | 'SERVICE_ERROR' | 'UNAUTHENTICATED';
}

/**
 * ElevenLabs Scribe API adapter interface
 * 
 * IMPORTANT: This adapter must be implemented based on current ElevenLabs documentation.
 * Do not assume API shape - verify against official docs during integration.
 */
interface ElevenLabsAdapter {
  /**
   * Transcribe audio buffer
   * Returns transcript or throws safe error
   */
  transcribeAudio(
    audioBuffer: Buffer,
    mimeType: string,
    options?: {
      languageCode?: string;
      phraseHints?: string[];
    }
  ): Promise<{ transcript: string }>;
}

// ============================================================================
// ADAPTER IMPLEMENTATION (TO BE VERIFIED)
// ============================================================================

/**
 * ElevenLabs adapter implementation
 * 
 * TODO: During integration, verify these API details against official docs:
 * - Correct endpoint URL
 * - Required headers
 * - Request body format
 * - Response structure
 * - Authentication method (API key vs signed token)
 */
class ElevenLabsScribeAdapter implements ElevenLabsAdapter {
  private apiKey: string;

  constructor(apiKey: string) {
    if (!apiKey || apiKey.length < 10) {
      throw new Error('Invalid ElevenLabs API key configuration');
    }
    this.apiKey = apiKey;
  }

  async transcribeAudio(
    audioBuffer: Buffer,
    mimeType: string,
    options?: { languageCode?: string; phraseHints?: string[] }
  ): Promise<{ transcript: string }> {
    // NOTE: This is a placeholder structure.
    // MUST verify against official ElevenLabs Scribe v2 documentation.

    const formData = new FormData();
    
    // In a real Node/Next.js environment, you'd use a library like form-data
    // or convert the buffer appropriately for fetch
    
    // Placeholder - actual implementation depends on runtime
    const response = await fetch('https://api.elevenlabs.io/v1/scribe', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        // Add appropriate content type based on actual API requirements
      },
      body: audioBuffer, // Actual format depends on API spec
    });

    if (!response.ok) {
      // Log error safely without exposing details
      console.error('ElevenLabs transcription failed with status:', response.status);
      
      throw new Error('Speech service unavailable');
    }

    const data = await response.json();
    
    // NOTE: Verify response structure against official docs
    return {
      transcript: data.transcript || ''
    };
  }
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate audio file size
 */
function validateFileSize(size: number): boolean {
  return size <= MAX_AUDIO_SIZE_BYTES;
}

/**
 * Validate MIME type
 */
function validateMimeType(mimeType: string): boolean {
  return ALLOWED_MIME_TYPES.includes(mimeType);
}

/**
 * Create safe error response
 */
function createErrorResponse(
  errorCode: SpeechResponse['errorCode'],
  message: string
): SpeechResponse {
  return {
    success: false,
    error: message,
    errorCode
  };
}

// ============================================================================
// RATE LIMITING INTERFACE
// ============================================================================

/**
 * Simple rate limit check interface
 * 
 * TODO: Integrate with actual rate limiting solution (e.g., @vercel/kv, upstash)
 */
interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number;
}

async function checkRateLimit(userId: string): Promise<RateLimitResult> {
  // Placeholder - implement with actual rate limiting service
  // Example: Check Redis for request count in time window
  
  return {
    allowed: true
  };
}

// ============================================================================
// REQUEST HANDLER
// ============================================================================

/**
 * POST /api/speech/transcribe
 * 
 * Handles speech transcription requests.
 * Must be called from authenticated user session.
 */
export async function POST(request: NextRequest): Promise<Response> {
  const startTime = Date.now();
  
  try {
    // Check request timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), REQUEST_TIMEOUT_MS);
    });

    const handleRequest = async (): Promise<Response> => {
      // 1. Verify authentication
      // NOTE: Implement actual auth verification based on your auth solution
      const authHeader = request.headers.get('authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return Response.json(
          createErrorResponse('UNAUTHENTICATED', 'Authentication required'),
          { status: 401 }
        );
      }

      // 2. Extract user ID for rate limiting and logging
      // NOTE: Implement actual user extraction from auth token
      const userId = extractUserIdFromToken(authHeader);
      if (!userId) {
        return Response.json(
          createErrorResponse('UNAUTHENTICATED', 'Invalid authentication'),
          { status: 401 }
        );
      }

      // 3. Check rate limit
      const rateLimitResult = await checkRateLimit(userId);
      if (!rateLimitResult.allowed) {
        return Response.json(
          createErrorResponse('SERVICE_ERROR', 'Too many requests. Please try again later.'),
          { 
            status: 429,
            headers: rateLimitResult.retryAfter 
              ? { 'Retry-After': String(rateLimitResult.retryAfter) }
              : undefined
          }
        );
      }

      // 4. Parse multipart form data
      const formData = await request.formData();
      const audioFile = formData.get('audio') as File | null;

      if (!audioFile) {
        return Response.json(
          createErrorResponse('INVALID_TYPE', 'No audio file provided'),
          { status: 400 }
        );
      }

      // 5. Validate file size
      if (!validateFileSize(audioFile.size)) {
        return Response.json(
          createErrorResponse('TOO_LARGE', `Audio file exceeds ${MAX_AUDIO_SIZE_BYTES / 1024 / 1024}MB limit`),
          { status: 413 }
        );
      }

      // 6. Validate MIME type
      if (!validateMimeType(audioFile.type)) {
        return Response.json(
          createErrorResponse('INVALID_TYPE', 'Unsupported audio format'),
          { status: 415 }
        );
      }

      // 7. Read audio buffer
      const audioBuffer = Buffer.from(await audioFile.arrayBuffer());

      // 8. Get phrase hints from request (optional)
      const phraseHintsRaw = formData.get('phraseHints');
      const phraseHints = phraseHintsRaw 
        ? String(phraseHintsRaw).split(',').map(h => h.trim()).slice(0, 5)
        : undefined;

      // 9. Call ElevenLabs adapter
      const apiKey = process.env.ELEVENLABS_API_KEY;
      if (!apiKey) {
        console.error('ElevenLabs API key not configured');
        return Response.json(
          createErrorResponse('SERVICE_ERROR', 'Speech service not configured'),
          { status: 503 }
        );
      }

      const adapter = new ElevenLabsScribeAdapter(apiKey);
      
      const result = await adapter.transcribeAudio(audioBuffer, audioFile.type, {
        languageCode: SPANISH_LANGUAGE_CODE,
        phraseHints
      });

      // 10. Return safe response (no raw audio or secrets in logs)
      return Response.json({
        success: true,
        transcript: result.transcript
      });
    };

    // Race between request handling and timeout
    return await Promise.race([handleRequest, timeoutPromise]);

  } catch (error) {
    // Log error safely without exposing internals
    console.error('Speech transcription error:', error instanceof Error ? error.message : 'Unknown error');

    // Determine appropriate error response
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    if (errorMessage === 'Request timeout') {
      return Response.json(
        createErrorResponse('TIMEOUT', 'Request timed out. Please try again.'),
        { status: 408 }
      );
    }

    // Generic service error - don't expose internal details
    return Response.json(
      createErrorResponse('SERVICE_ERROR', 'Speech service temporarily unavailable'),
      { status: 503 }
    );
  }
}

/**
 * Extract user ID from auth token
 * 
 * TODO: Implement based on your authentication solution
 */
function extractUserIdFromToken(authHeader: string): string | null {
  // Placeholder - implement actual token parsing
  // Example for JWT: verify and decode token, extract sub claim
  return null;
}

// ============================================================================
// DOCUMENTATION
// ============================================================================

/**
 * Usage notes for integration:
 * 
 * 1. ENVIRONMENT VARIABLES (set in Vercel):
 *    - ELEVENLABS_API_KEY: Your server-side ElevenLabs API key
 *    - Never use NEXT_PUBLIC_ELEVENLABS_API_KEY
 * 
 * 2. CLIENT-SIDE USAGE:
 *    ```typescript
 *    const formData = new FormData();
 *    formData.append('audio', audioBlob, 'recording.webm');
 *    formData.append('phraseHints', 'hola,buenos días,gracias');
 *    
 *    const response = await fetch('/api/speech/transcribe', {
 *      method: 'POST',
 *      headers: {
 *        'Authorization': `Bearer ${authToken}`
 *      },
 *      body: formData
 *    });
 *    
 *    const result = await response.json();
 *    if (result.success) {
 *      // Use result.transcript
 *    } else {
 *      // Handle error based on result.errorCode
 *    }
 *    ```
 * 
 * 3. ERROR HANDLING:
 *    - UNAUTHENTICATED: Redirect to login
 *    - TOO_LARGE: Ask user to record shorter message
 *    - INVALID_TYPE: Convert audio to supported format
 *    - TIMEOUT: Retry automatically
 *    - SERVICE_ERROR: Show friendly error, allow retry
 * 
 * 4. TECHNICAL FAILURES:
 *    - Never count as learner errors
 *    - Allow unlimited retries for technical failures
 *    - Log for monitoring but don't expose details to user
 */
