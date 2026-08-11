export function isTrustedSpeechOrigin(
  requestOrigin: string | null,
  appUrl: string,
  production: boolean,
): boolean {
  if (!production) return true;
  if (!requestOrigin) return false;
  try {
    return new URL(requestOrigin).origin === new URL(appUrl).origin;
  } catch {
    return false;
  }
}
