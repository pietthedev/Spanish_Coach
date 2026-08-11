/**
 * Microphone Flow Contract
 * 
 * Framework-independent microphone-state model for speech recording.
 * 
 * States:
 * - idle
 * - permission_requested
 * - permission_denied
 * - recording
 * - processing
 * - playback_available
 * - evaluation_complete
 * - offline_playback_only
 * - technical_failure
 * 
 * Includes:
 * - Maximum recording duration
 * - Cancellation
 * - Retry behaviour
 * - Permission-denied guidance
 * - Offline behaviour
 * - Prevention of simultaneous recordings
 * - No permanent recording retention by default
 * - No pronunciation percentage
 * - Technical failures not affecting mastery
 */

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Maximum recording duration in seconds
 */
export const MAX_RECORDING_DURATION_MS = 10000;

/**
 * Minimum recording duration in seconds
 */
export const MIN_RECORDING_DURATION_MS = 500;

/**
 * Maximum retry attempts after failure
 */
export const MAX_RETRY_ATTEMPTS = 3;

/**
 * Silence threshold for auto-stop (0-1)
 */
export const SILENCE_THRESHOLD = 0.01;

/**
 * Silence duration before auto-stop in ms
 */
export const SILENCE_DURATION_MS = 2000;

// ============================================================================
// TYPES
// ============================================================================

/**
 * Microphone state machine states
 */
export type MicrophoneState =
  | 'idle'                    // Ready to start recording
  | 'permission_requested'    // Waiting for user permission
  | 'permission_denied'       // User denied permission
  | 'recording'               // Currently recording
  | 'processing'              // Sending to speech service
  | 'playback_available'      // Recording ready for playback
  | 'evaluation_complete'     // Speech evaluated
  | 'offline_playback_only'   // Offline - can play but not evaluate
  | 'technical_failure';      // Speech service unavailable

/**
 * Microphone state with metadata
 */
export interface MicrophoneStateInfo {
  /** Current state */
  readonly state: MicrophoneState;
  /** Recording duration if recorded */
  readonly durationMs?: number;
  /** Number of retries attempted */
  readonly retryCount: number;
  /** Error message if failed */
  readonly errorMessage?: string;
  /** Whether recording is available for playback */
  readonly hasRecording: boolean;
  /** Whether evaluation is available */
  readonly hasEvaluation: boolean;
  /** Offline mode active */
  readonly isOffline: boolean;
}

/**
 * Recording result
 */
export interface RecordingData {
  /** Audio blob */
  readonly audioBlob: Blob;
  /** Playback URL */
  readonly playbackUrl: string;
  /** Duration in milliseconds */
  readonly durationMs: number;
  /** Timestamp when recording started */
  readonly startedAt: string;
  /** Timestamp when recording ended */
  readonly endedAt: string;
}

/**
 * Evaluation result from speech service
 */
export interface SpeechEvaluation {
  /** Transcript text */
  readonly transcript: string;
  /** Confidence score 0-1 */
  readonly confidence: number;
  /** Whether evaluation succeeded */
  readonly success: boolean;
  /** Error if any */
  readonly error?: string;
}

/**
 * Configuration for microphone controller
 */
export interface MicrophoneConfig {
  /** Whether device is offline */
  readonly isOffline: boolean;
  /** Speech service endpoint if online */
  readonly speechEndpoint?: string;
  /** Auth token for speech service */
  readonly authToken?: string;
  /** Maximum recording duration */
  readonly maxDurationMs: number;
  /** Minimum recording duration */
  readonly minDurationMs: number;
  /** Whether to retain recordings permanently */
  readonly retainRecordings: boolean;
}

/**
 * Result of microphone action
 */
export interface MicrophoneActionResult {
  /** New state after action */
  readonly newState: MicrophoneStateInfo;
  /** Recording data if available */
  readonly recording?: RecordingData;
  /** Evaluation if available */
  readonly evaluation?: SpeechEvaluation;
  /** Guidance message for user */
  readonly guidance?: string;
  /** Whether to show retry button */
  readonly showRetry: boolean;
  /** Whether to show cancel button */
  readonly showCancel: boolean;
}

// ============================================================================
// MICROPHONE CONTROLLER
// ============================================================================

/**
 * Microphone state controller
 * 
 * Manages the complete microphone flow without framework dependencies.
 * In production, integrate with Web Audio API and speech service.
 */
export class MicrophoneController {
  private state: MicrophoneState = 'idle';
  private config: MicrophoneConfig;
  private currentRecording?: RecordingData;
  private retryCount: number = 0;
  private mediaRecorder?: MediaRecorder;
  private audioChunks: Blob[] = [];
  private startTime?: number;
  private silenceTimer?: ReturnType<typeof setTimeout>;

  constructor(config: MicrophoneConfig) {
    this.config = config;
  }

  /**
   * Get current state info
   */
  getState(): MicrophoneStateInfo {
    return {
      state: this.state,
      durationMs: this.currentRecording?.durationMs,
      retryCount: this.retryCount,
      hasRecording: !!this.currentRecording,
      hasEvaluation: this.state === 'evaluation_complete',
      isOffline: this.config.isOffline
    };
  }

  /**
   * Request microphone permission
   */
  async requestPermission(): Promise<MicrophoneActionResult> {
    if (this.state !== 'idle') {
      return this.createResult('Cannot request permission now');
    }

    this.state = 'permission_requested';

    try {
      // Check if browser supports getUserMedia
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Browser does not support microphone access');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Stop tracks immediately after getting permission
      stream.getTracks().forEach(track => track.stop());

      this.state = 'idle';
      return this.createResult('Permission granted', false, true);
    } catch (error) {
      this.state = 'permission_denied';
      return this.createResult(
        'Microphone permission denied. Please enable microphone access in your browser settings.',
        false,
        false,
        error instanceof Error ? error.message : 'Permission denied'
      );
    }
  }

  /**
   * Start recording
   */
  async startRecording(): Promise<MicrophoneActionResult> {
    if (this.state !== 'idle' && this.state !== 'playback_available') {
      return this.createResult('Cannot start recording now');
    }

    if (this.retryCount >= MAX_RETRY_ATTEMPTS) {
      return this.createResult(
        'Maximum retry attempts reached. Please refresh the page.',
        false,
        false
      );
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      this.mediaRecorder = new MediaRecorder(stream);
      this.audioChunks = [];
      this.startTime = Date.now();

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        this.completeRecording(stream);
      };

      this.mediaRecorder.start(100); // Collect data every 100ms
      this.state = 'recording';

      // Set maximum duration timer
      setTimeout(() => {
        if (this.state === 'recording') {
          this.stopRecording();
        }
      }, this.config.maxDurationMs);

      return this.createResult('Recording started', true, true);
    } catch (error) {
      this.state = 'technical_failure';
      return this.createResult(
        'Could not access microphone',
        false,
        false,
        error instanceof Error ? error.message : 'Microphone access failed'
      );
    }
  }

  /**
   * Stop recording
   */
  stopRecording(): MicrophoneActionResult {
    if (this.state !== 'recording') {
      return this.createResult('Not currently recording');
    }

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }

    return this.createResult('Recording stopped');
  }

  /**
   * Cancel recording
   */
  cancelRecording(): MicrophoneActionResult {
    if (this.state !== 'recording' && this.state !== 'playback_available') {
      return this.createResult('Nothing to cancel');
    }

    this.cleanupRecording();
    this.state = 'idle';
    this.retryCount = 0;

    return this.createResult('Recording cancelled', true, false);
  }

  /**
   * Play back recording
   */
  playRecording(): MicrophoneActionResult {
    if (this.state !== 'playback_available' && 
        this.state !== 'offline_playback_only' &&
        this.state !== 'evaluation_complete') {
      return this.createResult('No recording available for playback');
    }

    // Playback handled by UI using recording.playbackUrl
    return this.createResult('Playback ready');
  }

  /**
   * Submit for evaluation (online only)
   */
  async submitForEvaluation(): Promise<MicrophoneActionResult> {
    if (!this.currentRecording) {
      return this.createResult('No recording to evaluate');
    }

    if (this.config.isOffline) {
      this.state = 'offline_playback_only';
      return this.createResult(
        'Offline mode: Recording saved but cannot be evaluated until online',
        false,
        false
      );
    }

    this.state = 'processing';

    try {
      // In production, send to speech service
      // const formData = new FormData();
      // formData.append('audio', this.currentRecording.audioBlob);
      // const response = await fetch(this.config.speechEndpoint, { ... });

      // Placeholder for actual evaluation
      const evaluation: SpeechEvaluation = {
        transcript: '',
        confidence: 0,
        success: true
      };

      this.state = 'evaluation_complete';
      return this.createResult('Evaluation complete', false, false, undefined, evaluation);
    } catch (error) {
      this.state = 'technical_failure';
      return this.createResult(
        'Speech evaluation failed',
        true,
        true,
        error instanceof Error ? error.message : 'Evaluation failed'
      );
    }
  }

  /**
   * Retry after failure
   */
  retry(): MicrophoneActionResult {
    if (this.state !== 'technical_failure' && 
        this.state !== 'permission_denied' &&
        this.state !== 'evaluation_complete') {
      return this.createResult('Cannot retry from current state');
    }

    if (this.retryCount >= MAX_RETRY_ATTEMPTS) {
      return this.createResult('Maximum retries exceeded');
    }

    this.cleanupRecording();
    this.retryCount++;
    this.state = 'idle';

    return this.createResult('Ready to retry', true, false);
  }

  /**
   * Reset to initial state
   */
  reset(): MicrophoneActionResult {
    this.cleanupRecording();
    this.retryCount = 0;
    this.state = 'idle';

    return this.createResult('Reset complete', true, false);
  }

  /**
   * Complete recording processing
   */
  private completeRecording(stream: MediaStream): void {
    const endTime = Date.now();
    const durationMs = endTime - (this.startTime || endTime);

    // Check minimum duration
    if (durationMs < this.config.minDurationMs) {
      this.state = 'idle';
      return;
    }

    const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
    const playbackUrl = URL.createObjectURL(audioBlob);

    this.currentRecording = {
      audioBlob,
      playbackUrl,
      durationMs,
      startedAt: new Date(this.startTime || Date.now()).toISOString(),
      endedAt: new Date(endTime).toISOString()
    };

    // Stop all tracks
    stream.getTracks().forEach(track => track.stop());

    if (this.config.isOffline) {
      this.state = 'offline_playback_only';
    } else {
      this.state = 'playback_available';
    }
  }

  /**
   * Clean up recording resources
   */
  private cleanupRecording(): void {
    if (this.currentRecording?.playbackUrl) {
      URL.revokeObjectURL(this.currentRecording.playbackUrl);
    }
    
    this.currentRecording = undefined;
    this.audioChunks = [];
    this.startTime = undefined;

    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = undefined;
    }

    // Don't retain recordings by default
    if (!this.config.retainRecordings) {
      this.currentRecording = undefined;
    }
  }

  /**
   * Create action result helper
   */
  private createResult(
    guidance: string,
    showRetry: boolean = false,
    showCancel: boolean = false,
    errorMessage?: string,
    evaluation?: SpeechEvaluation
  ): MicrophoneActionResult {
    return {
      newState: this.getState(),
      recording: this.currentRecording,
      evaluation,
      guidance,
      showRetry,
      showCancel
    };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get permission-denied guidance message
 */
export function getPermissionDeniedGuidance(browserName?: string): string {
  const baseMessage = 'Microphone permission was denied.';
  
  const browserGuidance: Record<string, string> = {
    chrome: 'Click the lock icon in the address bar and allow microphone access.',
    firefox: 'Click the camera icon in the address bar and allow microphone access.',
    safari: 'Go to Safari > Settings > Websites > Microphone and allow access.',
    edge: 'Click the lock icon in the address bar and allow microphone access.'
  };

  const specificGuidance = browserName ? browserGuidance[browserName.toLowerCase()] : null;
  
  return specificGuidance 
    ? `${baseMessage} ${specificGuidance}`
    : `${baseMessage} Please check your browser settings to enable microphone access.`;
}

/**
 * Check if browser supports required audio APIs
 */
export function checkAudioSupport(): {
  supported: boolean;
  missingFeatures: string[];
} {
  const missingFeatures: string[] = [];

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    missingFeatures.push('getUserMedia API');
  }

  if (typeof MediaRecorder === 'undefined') {
    missingFeatures.push('MediaRecorder API');
  }

  if (typeof AudioContext === 'undefined') {
    missingFeatures.push('AudioContext API');
  }

  return {
    supported: missingFeatures.length === 0,
    missingFeatures
  };
}

/**
 * Determine if technical failure should affect mastery
 * 
 * Requirements:
 * - Technical failures must NOT reduce mastery
 * - Only meaning-changing errors affect mastery
 */
export function shouldAffectMastery(failureType: string): boolean {
  const technicalFailures = [
    'microphone_unavailable',
    'network_error',
    'speech_service_timeout',
    'audio_encoding_error',
    'browser_not_supported'
  ];

  return !technicalFailures.includes(failureType);
}

/**
 * Format recording duration for display
 */
export function formatRecordingDuration(durationMs: number): string {
  const seconds = Math.floor(durationMs / 1000);
  const milliseconds = Math.floor((durationMs % 1000) / 10);
  
  return `${seconds}.${milliseconds.toString().padStart(2, '0')}s`;
}
