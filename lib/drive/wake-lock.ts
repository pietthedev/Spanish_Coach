/**
 * Keeps the screen awake so the browser is less likely to suspend the page
 * while the phone sits untouched. Entirely optional: Drive Mode must work on
 * devices and browsers that do not support the API.
 */
interface WakeLockSentinelLike {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (type: "release", listener: () => void) => void;
}

interface WakeLockCapableNavigator {
  wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
}

export function wakeLockSupported(): boolean {
  if (typeof navigator === "undefined") return false;
  return Boolean((navigator as WakeLockCapableNavigator).wakeLock);
}

export class WakeLockHandle {
  private sentinel?: WakeLockSentinelLike;
  private wanted = false;

  async acquire(): Promise<boolean> {
    this.wanted = true;
    if (!wakeLockSupported()) return false;
    if (this.sentinel && !this.sentinel.released) return true;
    try {
      const sentinel = await (
        navigator as WakeLockCapableNavigator
      ).wakeLock!.request("screen");
      this.sentinel = sentinel;
      // The OS may revoke the lock at any time; forget it so a later
      // visibility change can ask for a fresh one.
      sentinel.addEventListener("release", () => {
        if (this.sentinel === sentinel) this.sentinel = undefined;
      });
      return true;
    } catch {
      return false;
    }
  }

  /** Re-acquire after the tab becomes visible again, if still wanted. */
  async reacquire(): Promise<void> {
    if (!this.wanted) return;
    if (this.sentinel && !this.sentinel.released) return;
    await this.acquire();
  }

  async release(): Promise<void> {
    this.wanted = false;
    const sentinel = this.sentinel;
    this.sentinel = undefined;
    if (!sentinel || sentinel.released) return;
    await sentinel.release().catch(() => undefined);
  }
}
