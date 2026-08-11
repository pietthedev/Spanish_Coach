import { describe, expect, it } from "vitest";
import { isTrustedSpeechOrigin } from "@/lib/speech/origin";

describe("speech request origins", () => {
  const appUrl = "https://spanish-coach-seven.vercel.app";

  it("allows local development requests", () => {
    expect(isTrustedSpeechOrigin(null, appUrl, false)).toBe(true);
  });

  it("allows the configured production origin", () => {
    expect(isTrustedSpeechOrigin(appUrl, appUrl, true)).toBe(true);
  });

  it("rejects missing, malformed and foreign production origins", () => {
    expect(isTrustedSpeechOrigin(null, appUrl, true)).toBe(false);
    expect(isTrustedSpeechOrigin("not-a-url", appUrl, true)).toBe(false);
    expect(
      isTrustedSpeechOrigin("https://example.com", appUrl, true),
    ).toBe(false);
  });
});
