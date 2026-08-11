/**
 * Idempotent Synchronisation Outbox
 * 
 * Local-first event synchronisation design.
 * No external dependencies.
 * 
 * Sync flow:
 * 1. Save action locally
 * 2. Update visible local projection immediately
 * 3. Add immutable event with UUID to outbox
 * 4. Synchronise when online
 * 5. Deduplicate server-side by event UUID
 * 6. Confirm authoritative server state
 * 7. Remove acknowledged outbox entries
 */

import type { ProgressEvent, EventUuid, UserId } from '../data/local/types';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Maximum retry attempts before giving up
 */
export const MAX_SYNC_RETRIES = 5;

/**
 * Base delay for exponential backoff (ms)
 */
export const BASE_BACKOFF_DELAY_MS = 1000;

/**
 * Maximum backoff delay (ms)
 */
export const MAX_BACKOFF_DELAY_MS = 30000;

/**
 * Jitter factor (0-1)
 */
export const JITTER_FACTOR = 0.2;

// ============================================================================
// TYPES
// ============================================================================

/**
 * Sync result status
 */
export type SyncStatus = 'success' | 'partial' | 'failed' | 'offline';

/**
 * Result of a sync operation
 */
export interface SyncResult {
  /** Overall status */
  readonly status: SyncStatus;
  /** Number of events attempted */
  readonly eventsAttempted: number;
  /** Number of events successfully synced */
  readonly eventsSynced: number;
  /** Number of events failed */
  readonly eventsFailed: number;
  /** Error messages for failed events */
  readonly errors: Array<{ eventUuid: EventUuid; error: string }>;
  /** Server timestamp for this sync */
  readonly serverTimestamp: string;
}

/**
 * Configuration for sync engine
 */
export interface SyncConfig {
  /** API endpoint for sync */
  readonly syncEndpoint: string;
  /** Whether device is currently online */
  readonly isOnline: boolean;
  /** User ID for partitioning */
  readonly userId: UserId;
  /** Auth token for requests */
  readonly authToken: string;
}

// ============================================================================
// BACKOFF CALCULATION
// ============================================================================

/**
 * Calculate backoff delay with jitter
 */
export function calculateBackoffDelay(retryCount: number): number {
  // Exponential backoff
  const exponentialDelay = Math.min(
    BASE_BACKOFF_DELAY_MS * Math.pow(2, retryCount),
    MAX_BACKOFF_DELAY_MS
  );

  // Add jitter
  const jitter = exponentialDelay * JITTER_FACTOR * (Math.random() * 2 - 1);

  return Math.round(exponentialDelay + jitter);
}

// ============================================================================
// EVENT CREATION
// ============================================================================

/**
 * Generate a UUID v4 for event deduplication
 * 
 * NOTE: In production, use crypto.randomUUID() or a UUID library.
 * This is a simple implementation for demonstration.
 */
export function generateEventUuid(): EventUuid {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback for environments without crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Create a progress event for the outbox
 */
export function createProgressEvent(
  userId: UserId,
  eventType: ProgressEvent['eventType'],
  payload: Record<string, unknown>
): ProgressEvent {
  const now = new Date().toISOString();

  return {
    eventUuid: generateEventUuid(),
    userId,
    eventType,
    payload,
    clientTimestamp: now,
    syncStatus: 'pending',
    retryCount: 0,
    createdAt: now
  };
}

// ============================================================================
// SYNC ENGINE
// ============================================================================

/**
 * Sync engine for managing outbox synchronisation
 * 
 * NOTE: This is a framework-independent implementation.
 * For integration, connect to actual IndexedDB and fetch API.
 */
export class SyncEngine {
  private config: SyncConfig;
  private pendingEvents: ProgressEvent[] = [];
  private isSyncing = false;

  constructor(config: SyncConfig) {
    this.config = config;
  }

  /**
   * Update configuration (e.g., when online status changes)
   */
  updateConfig(config: Partial<SyncConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Add event to outbox
   */
  addEvent(event: ProgressEvent): void {
    this.pendingEvents.push(event);
  }

  /**
   * Get pending events
   */
  getPendingEvents(): ProgressEvent[] {
    return this.pendingEvents.filter(e => e.syncStatus === 'pending');
  }

  /**
   * Attempt to sync pending events
   */
  async sync(): Promise<SyncResult> {
    // Check if already syncing
    if (this.isSyncing) {
      return {
        status: 'partial',
        eventsAttempted: 0,
        eventsSynced: 0,
        eventsFailed: 0,
        errors: [],
        serverTimestamp: new Date().toISOString()
      };
    }

    // Check if online
    if (!this.config.isOnline) {
      return {
        status: 'offline',
        eventsAttempted: 0,
        eventsSynced: 0,
        eventsFailed: 0,
        errors: [],
        serverTimestamp: new Date().toISOString()
      };
    }

    this.isSyncing = true;

    try {
      const pendingEvents = this.getPendingEvents();
      
      if (pendingEvents.length === 0) {
        return {
          status: 'success',
          eventsAttempted: 0,
          eventsSynced: 0,
          eventsFailed: 0,
          errors: [],
          serverTimestamp: new Date().toISOString()
        };
      }

      // Mark events as syncing
      pendingEvents.forEach(e => {
        e.syncStatus = 'syncing';
        e.retryCount = (e.retryCount || 0) + 1;
      });

      // Send to server
      const result = await this.sendEventsToServer(pendingEvents);

      // Update event statuses based on result
      result.eventsSynced > 0 && this.markEventsAcknowledged(result);
      result.eventsFailed > 0 && this.handleFailedEvents(result);

      return result;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Send events to server
   */
  private async sendEventsToServer(events: ProgressEvent[]): Promise<SyncResult> {
    // NOTE: This is a placeholder for actual fetch implementation
    // In production, this would make a POST request to the sync endpoint

    const serverTimestamp = new Date().toISOString();

    // Simulate network call structure
    try {
      // Actual implementation would be:
      // const response = await fetch(this.config.syncEndpoint, {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //     'Authorization': `Bearer ${this.config.authToken}`
      //   },
      //   body: JSON.stringify({ events })
      // });
      // 
      // if (!response.ok) throw new Error('Sync failed');
      // const result = await response.json();

      // Placeholder success response
      return {
        status: 'success',
        eventsAttempted: events.length,
        eventsSynced: events.length,
        eventsFailed: 0,
        errors: [],
        serverTimestamp
      };
    } catch (error) {
      return {
        status: 'failed',
        eventsAttempted: events.length,
        eventsSynced: 0,
        eventsFailed: events.length,
        errors: events.map(e => ({
          eventUuid: e.eventUuid,
          error: error instanceof Error ? error.message : 'Unknown error'
        })),
        serverTimestamp
      };
    }
  }

  /**
   * Mark events as acknowledged after successful sync
   */
  private markEventsAcknowledged(result: SyncResult): void {
    // Events would be removed from outbox in actual implementation
    console.log(`Acknowledged ${result.eventsSynced} events`);
  }

  /**
   * Handle failed events - schedule for retry
   */
  private handleFailedEvents(result: SyncResult): void {
    // Update retry counts and schedule next attempt
    for (const error of result.errors) {
      const event = this.pendingEvents.find(e => e.eventUuid === error.eventUuid);
      if (event) {
        event.syncStatus = 'pending';
        event.lastError = error.error;
        
        // Check if max retries exceeded
        if ((event.retryCount || 0) >= MAX_SYNC_RETRIES) {
          event.syncStatus = 'failed';
          console.error(`Event ${event.eventUuid} exceeded max retries`);
        }
      }
    }
  }

  /**
   * Handle online/reconnection event
   */
  handleReconnection(): void {
    console.log('Network reconnected, initiating sync');
    this.updateConfig({ isOnline: true });
    this.sync();
  }

  /**
   * Handle offline event
   */
  handleOffline(): void {
    console.log('Network disconnected, queuing events locally');
    this.updateConfig({ isOnline: false });
  }
}

// ============================================================================
// FOREGROUND RETRY HANDLER
// ============================================================================

/**
 * Foreground retry handler for persistent sync attempts
 */
export class ForegroundRetryHandler {
  private syncEngine: SyncEngine;
  private retryTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(syncEngine: SyncEngine) {
    this.syncEngine = syncEngine;
  }

  /**
   * Start foreground retry loop
   */
  start(): void {
    this.scheduleNextRetry();
  }

  /**
   * Stop retry loop
   */
  stop(): void {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }
  }

  /**
   * Schedule next retry attempt
   */
  private scheduleNextRetry(): void {
    const pendingEvents = this.syncEngine.getPendingEvents();
    
    if (pendingEvents.length === 0) {
      return;
    }

    // Find event with highest retry count
    const maxRetry = Math.max(...pendingEvents.map(e => e.retryCount || 0));
    const delay = calculateBackoffDelay(maxRetry);

    this.retryTimeout = setTimeout(async () => {
      await this.syncEngine.sync();
      this.scheduleNextRetry();
    }, delay);
  }
}

// ============================================================================
// DEDUPLICATION HELPERS
// ============================================================================

/**
 * Check if an event UUID has already been processed
 */
export function isEventDuplicate(
  processedUuids: Set<EventUuid>,
  eventUuid: EventUuid
): boolean {
  return processedUuids.has(eventUuid);
}

/**
 * Deduplicate events by UUID
 */
export function deduplicateEvents(events: ProgressEvent[]): ProgressEvent[] {
  const seen = new Set<EventUuid>();
  return events.filter(event => {
    if (seen.has(event.eventUuid)) {
      return false;
    }
    seen.add(event.eventUuid);
    return true;
  });
}

// ============================================================================
// CONFLICT RESOLUTION
// ============================================================================

/**
 * Deterministic conflict resolution for two-device sync
 * 
 * Rules:
 * - Server timestamp is authoritative
 * - Client timestamp is retained for audit
 * - Last write wins based on server timestamp
 * - Points/achievements never duplicate
 */
export interface ConflictResolution {
  /** Which value to use */
  readonly resolvedValue: unknown;
  /** Resolution strategy used */
  readonly strategy: 'server_wins' | 'client_wins' | 'merge' | 'max_value';
  /** Reason for resolution */
  readonly reason: string;
}

/**
 * Resolve conflict between client and server values
 */
export function resolveConflict(
  clientValue: unknown,
  serverValue: unknown,
  clientTimestamp: string,
  serverTimestamp: string,
  fieldType: 'counter' | 'timestamp' | 'status' | 'progress'
): ConflictResolution {
  // Server timestamp is always authoritative for timestamps
  if (fieldType === 'timestamp') {
    return {
      resolvedValue: serverValue,
      strategy: 'server_wins',
      reason: 'Server timestamp is authoritative'
    };
  }

  // Counters should use max value to prevent loss
  if (fieldType === 'counter') {
    const clientNum = typeof clientValue === 'number' ? clientValue : 0;
    const serverNum = typeof serverValue === 'number' ? serverValue : 0;
    
    return {
      resolvedValue: Math.max(clientNum, serverNum),
      strategy: 'max_value',
      reason: 'Using maximum counter value to prevent data loss'
    };
  }

  // Progress uses most advanced value
  if (fieldType === 'progress') {
    const clientNum = typeof clientValue === 'number' ? clientValue : 0;
    const serverNum = typeof serverValue === 'number' ? serverValue : 0;
    
    return {
      resolvedValue: Math.max(clientNum, serverNum),
      strategy: 'max_value',
      reason: 'Using most advanced progress value'
    };
  }

  // Default: server wins based on authoritative state
  return {
    resolvedValue: serverValue,
    strategy: 'server_wins',
    reason: 'Server state is authoritative'
  };
}
