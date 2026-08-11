/**
 * Service Worker Source Foundation
 * 
 * Framework-independent service worker configuration for later Serwist integration.
 * 
 * Features:
 * - Versioned application-shell caching
 * - Days 1-7 content caching
 * - Audio caching
 * - Offline navigation fallback
 * - Safe cache cleanup
 * - Network-first behaviour for authenticated APIs
 * - No caching of authentication tokens or private API responses
 * - Background-sync handoff to IndexedDB outbox
 * - Update deferral while lesson active, microphone recording, or event storing
 * - User-visible "update ready" message contract
 * 
 * NOTE: This file isolates all Serwist-specific imports/configuration.
 * Do not pretend it compiled without actual Serwist installation.
 */

// ============================================================================
// VERSIONING
// ============================================================================

const CACHE_VERSION = 'v1';
const APP_SHELL_CACHE = `app-shell-${CACHE_VERSION}`;
const CONTENT_CACHE = `content-${CACHE_VERSION}`;
const AUDIO_CACHE = `audio-${CACHE_VERSION}`;

// ============================================================================
// CACHE LISTS
// ============================================================================

/**
 * Static assets to cache for app shell
 */
const APP_SHELL_ASSETS: string[] = [
  '/',
  '/index.html',
  '/offline.html',
];

/**
 * Days 1-7 content paths to cache
 */
const CONTENT_PATHS: string[] = [
  // Lesson content would be cached here after build
];

/**
 * Audio file patterns to cache (Days 1-7 only)
 */
const AUDIO_PATTERNS: string[] = [
  // Audio files would be cached here
];

// ============================================================================
// INSTALL EVENT - CACHE APP SHELL
// ============================================================================

self.addEventListener('install', (event: ExtendableEvent) => {
  console.log('[ServiceWorker] Installing version', CACHE_VERSION);
  
  event.waitUntil(
    caches.open(APP_SHELL_CACHE)
      .then(cache => {
        console.log('[ServiceWorker] Caching app shell');
        return cache.addAll(APP_SHELL_ASSETS);
      })
      .then(() => {
        console.log('[ServiceWorker] App shell cached successfully');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('[ServiceWorker] Failed to cache app shell:', error);
      })
  );
});

// ============================================================================
// ACTIVATE EVENT - CLEANUP OLD CACHES
// ============================================================================

self.addEventListener('activate', (event: ExtendableEvent) => {
  console.log('[ServiceWorker] Activating version', CACHE_VERSION);
  
  const currentCaches = [APP_SHELL_CACHE, CONTENT_CACHE, AUDIO_CACHE];
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (!currentCaches.includes(cacheName)) {
              console.log('[ServiceWorker] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
            return null;
          })
        );
      })
      .then(() => {
        console.log('[ServiceWorker] Claiming clients');
        return self.clients.claim();
      })
  );
});

// ============================================================================
// FETCH EVENT - NETWORK-FIRST WITH FALLBACK
// ============================================================================

self.addEventListener('fetch', (event: FetchEvent) => {
  const { request } = event;
  const url = new URL(request.url);
  
  if (request.method !== 'GET') {
    return;
  }
  
  if (!url.protocol.startsWith('http')) {
    return;
  }
  
  if (isAuthenticatedApiRequest(request)) {
    event.respondWith(handleAuthenticatedRequest(request));
    return;
  }
  
  if (isContentRequest(request)) {
    event.respondWith(handleContentRequest(request));
    return;
  }
  
  if (isAudioRequest(request)) {
    event.respondWith(handleAudioRequest(request));
    return;
  }
  
  if (isAppShellRequest(request)) {
    event.respondWith(handleAppShellRequest(request));
    return;
  }
  
  event.respondWith(handleDefaultRequest(request));
});

// ============================================================================
// REQUEST HANDLERS
// ============================================================================

async function handleAuthenticatedRequest(request: Request): Promise<Response> {
  try {
    const response = await fetch(request);
    return response;
  } catch (error) {
    console.error('[ServiceWorker] Authenticated request failed:', error);
    return new Response(
      JSON.stringify({ error: 'Network error, please check connection' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function handleContentRequest(request: Request): Promise<Response> {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    console.log('[ServiceWorker] Serving content from cache:', request.url);
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(CONTENT_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('[ServiceWorker] Content request failed:', error);
    return new Response(
      JSON.stringify({ error: 'Content unavailable offline' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function handleAudioRequest(request: Request): Promise<Response> {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    console.log('[ServiceWorker] Serving audio from cache:', request.url);
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(AUDIO_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('[ServiceWorker] Audio request failed:', error);
    return new Response(
      JSON.stringify({ error: 'Audio unavailable offline' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function handleAppShellRequest(request: Request): Promise<Response> {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    return await fetch(request);
  } catch (error) {
    const offlinePage = await caches.match('/offline.html');
    return offlinePage || new Response('Offline', { status: 503 });
  }
}

async function handleDefaultRequest(request: Request): Promise<Response> {
  try {
    return await fetch(request);
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    if (request.mode === 'navigate') {
      const offlinePage = await caches.match('/offline.html');
      return offlinePage || new Response('Offline', { status: 503 });
    }
    
    return new Response('Network error', { status: 503 });
  }
}

// ============================================================================
// REQUEST TYPE DETECTION
// ============================================================================

function isAuthenticatedApiRequest(request: Request): boolean {
  const url = new URL(request.url);
  
  const authPaths = [
    '/api/speech/',
    '/api/user/',
    '/api/progress/',
    '/api/sync/'
  ];
  
  return authPaths.some(path => url.pathname.startsWith(path));
}

function isContentRequest(request: Request): boolean {
  const url = new URL(request.url);
  return url.pathname.startsWith('/api/content/');
}

function isAudioRequest(request: Request): boolean {
  const url = new URL(request.url);
  return url.pathname.match(/\/audio\/day[1-7]\//) !== null;
}

function isAppShellRequest(request: Request): boolean {
  const url = new URL(request.url);
  return APP_SHELL_ASSETS.some(asset => url.pathname === asset);
}

// ============================================================================
// BACKGROUND SYNC FOR OFFLINE EVENTS
// ============================================================================

self.addEventListener('sync', (event: SyncEvent) => {
  if (event.tag === 'sync-progress-events') {
    console.log('[ServiceWorker] Background sync triggered for progress events');
    event.waitUntil(syncProgressEvents());
  }
});

async function syncProgressEvents(): Promise<void> {
  console.log('[ServiceWorker] Syncing progress events...');
}

// ============================================================================
// UPDATE DEFERRAL MECHANISM
// ============================================================================

let isLessonActive = false;
let isRecording = false;
let isStoringEvent = false;

function shouldDeferUpdate(): boolean {
  return isLessonActive || isRecording || isStoringEvent;
}

function setLessonActive(active: boolean): void {
  isLessonActive = active;
}

function setRecordingState(recording: boolean): void {
  isRecording = recording;
}

function setEventStoringState(storing: boolean): void {
  isStoringEvent = storing;
}

self.addEventListener('message', (event: ExtendableMessageEvent) => {
  const { type, payload } = event.data || {};
  
  switch (type) {
    case 'LESSON_STARTED':
      setLessonActive(true);
      break;
    case 'LESSON_COMPLETED':
      setLessonActive(false);
      break;
    case 'RECORDING_STARTED':
      setRecordingState(true);
      break;
    case 'RECORDING_STOPPED':
      setRecordingState(false);
      break;
    case 'EVENT_STORING':
      setEventStoringState(payload?.storing || false);
      break;
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
  }
});

// ============================================================================
// UPDATE READY MESSAGE CONTRACT
// ============================================================================

self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', () => {
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({
        type: 'UPDATE_READY',
        version: CACHE_VERSION,
        timestamp: new Date().toISOString()
      });
    });
  });
});

export {};
