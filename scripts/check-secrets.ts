const patterns = [
  /sk_[a-zA-Z0-9]{20,}/,
  /xi-api-key["'=:\s]+[a-zA-Z0-9_-]{20,}/,
  /sb_secret_[a-zA-Z0-9_-]+/,
  /service_role["'=:\s]+eyJ/,
];
export {};
const { readFileSync, readdirSync } = await import("node:fs");
const { join, relative } = await import("node:path");
const ignored = new Set([
  ".git",
  ".next",
  "node_modules",
  "playwright-report",
  "test-results",
  "coverage",
]);
function walk(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (ignored.has(entry.name)) return [];
    const full = join(directory, entry.name);
    return entry.isDirectory() ? walk(full) : [relative(process.cwd(), full)];
  });
}
const files = walk(process.cwd()).filter(
  (file) =>
    (!/(^|[\\/])\.env(?:\..*)?$/i.test(file) || file.endsWith(".env.example")) &&
    !file.endsWith("package-lock.json") &&
    !/\.(png|jpg|jpeg|gif|mp3|wav)$/i.test(file),
);
const violations: string[] = [];
for (const file of files) {
  let text = "";
  try {
    text = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  if (patterns.some((pattern) => pattern.test(text))) violations.push(file);
}
if (violations.length) {
  process.stderr.write(
    `Potential secrets found in: ${violations.join(", ")}\n`,
  );
  process.exit(1);
}
process.stdout.write(`Secret scan passed for ${files.length} files.\n`);
