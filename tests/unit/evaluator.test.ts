import { describe, expect, it } from "vitest";
import { phrases } from "@/content/course";
import type { Phrase } from "@/content/schema";
import { evaluateAnswer } from "@/lib/evaluation/evaluate";

const get = (id: string) => phrases.find((phrase) => phrase.id === id)!;
function criticalPhrase(overrides: Partial<Phrase>): Phrase {
  return {
    ...get("mx.greeting.hola"),
    id: "mx.test.critical",
    esMX: "Quiero dos boletos sin gluten ahora",
    english: "I want two gluten-free tickets now",
    acceptedAnswers: ["Quiero dos boletos sin gluten ahora"],
    requiredConcepts: ["number", "without", "allergy", "urgency"],
    conceptAliases: {
      number: ["dos"],
      without: ["sin"],
      allergy: ["gluten"],
      urgency: ["ahora"],
    },
    criticalConcepts: ["number", "without", "allergy", "urgency"],
    criticalTerms: {
      number: ["dos"],
      without: ["sin"],
      allergy: ["gluten"],
      urgency: ["ahora"],
    },
    optionalWords: ["quiero"],
    ...overrides,
  };
}

describe("forgiving answer evaluator", () => {
  it("accepts exact and curated variants", () => {
    expect(evaluateAnswer("Hola!", get("mx.greeting.hola")).outcome).toBe(
      "understood",
    );
    expect(
      evaluateAnswer("Muchas gracias", get("mx.polite.gracias")).outcome,
    ).toBe("different-valid");
  });
  it("ignores diacritics, punctuation, case and extra whitespace", () => {
    expect(
      evaluateAnswer("  BUENOS DIAS!!! ", get("mx.greeting.buenos_dias"))
        .outcome,
    ).toBe("understood");
  });
  it("allows curated optional words and formulations", () => {
    expect(
      evaluateAnswer("Yo hablo poquito español", get("mx.language.little"))
        .outcome,
    ).toBe("different-valid");
  });
  it("classifies a partly present phrase as incomplete", () => {
    expect(
      evaluateAnswer("Hablo español", get("mx.language.little")).outcome,
    ).toBe("incomplete");
  });
  it("protects negation", () => {
    const result = evaluateAnswer(
      "Hablo mucho español",
      get("mx.language.not_much"),
    );
    expect(result.outcome).toBe("meaning-error");
    expect(result.criticalError).toBe("negation");
  });
  it("protects number differences", () => {
    expect(
      evaluateAnswer("Quiero tres boletos sin gluten ahora", criticalPhrase({}))
        .outcome,
    ).toBe("meaning-error");
  });
  it("protects con versus sin", () => {
    expect(
      evaluateAnswer("Quiero dos boletos con gluten ahora", criticalPhrase({}))
        .outcome,
    ).toBe("meaning-error");
  });
  it("protects allergy terms", () => {
    expect(
      evaluateAnswer("Quiero dos boletos sin lactosa ahora", criticalPhrase({}))
        .outcome,
    ).toBe("meaning-error");
  });
  it("protects urgency", () => {
    expect(
      evaluateAnswer("Quiero dos boletos sin gluten mañana", criticalPhrase({}))
        .outcome,
    ).toBe("meaning-error");
  });
  it("protects destinations", () => {
    const phrase = criticalPhrase({
      esMX: "Al hotel",
      acceptedAnswers: ["Al hotel"],
      requiredConcepts: ["destination"],
      conceptAliases: { destination: ["hotel"] },
      criticalConcepts: ["destination"],
      criticalTerms: { destination: ["hotel"] },
    });
    expect(evaluateAnswer("Al aeropuerto", phrase).outcome).toBe(
      "meaning-error",
    );
  });
  it("does not turn empty/noisy input into a learning error", () => {
    expect(evaluateAnswer("   ", get("mx.greeting.hola")).outcome).toBe(
      "technical-failure",
    );
    expect(
      evaluateAnswer("", get("mx.greeting.hola"), "upstream timeout").outcome,
    ).toBe("technical-failure");
  });
});
