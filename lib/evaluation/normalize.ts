const articles = new Set([
  "el",
  "la",
  "los",
  "las",
  "un",
  "una",
  "unos",
  "unas",
]);

export function stripDiacritics(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function normalizeAnswer(
  value: string,
  optionalWords: string[] = [],
): string {
  const optional = new Set(
    optionalWords.map((word) =>
      stripDiacritics(word.toLocaleLowerCase("es-MX")),
    ),
  );
  return stripDiacritics(value.toLocaleLowerCase("es-MX"))
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((word) => !optional.has(word))
    .join(" ")
    .trim();
}

export function normalizeWithoutArticles(
  value: string,
  optionalWords: string[] = [],
): string {
  return normalizeAnswer(value, optionalWords)
    .split(" ")
    .filter((word) => !articles.has(word))
    .join(" ");
}
