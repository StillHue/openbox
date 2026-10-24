/** Models sometimes return the answer wrapped in JSON like
 * `{"answer": "...", "sources": [...]}`. Unwrap to plain prose. */
export function unwrapJsonAnswer(text: string): string {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?\s*|\s*```$/g, "")
    .trim();
  if (!trimmed.startsWith("{")) return text;
  try {
    const parsed = JSON.parse(trimmed) as { answer?: unknown };
    return typeof parsed.answer === "string" ? parsed.answer : text;
  } catch {
    return text;
  }
}
