/**
 * Conservative advocate-speech cleanup (SPEC §5.5): the jury output should be the
 * speech only. Strips a single wrapping code fence and one leading
 * assistant-preamble line (e.g. "Sure, here is my speech:"). Intentionally narrow
 * so it never eats real speech content.
 */
const PREAMBLE_START =
  /^(sure|certainly|of course|absolutely|okay|ok|alright|here(?:'s| is)\b|below is\b|as (?:requested|asked)\b)/i;
const PREAMBLE_END = /(?:speech|statement|remarks|argument|response)\s*:?\s*$|:\s*$/i;

export function sanitizeSpeech(raw: string): string {
  let text = (raw ?? '').trim();

  const fence = text.match(/^```[a-zA-Z]*\n([\s\S]*?)\n```$/);
  if (fence) text = fence[1].trim();

  const lines = text.split('\n');
  if (lines.length > 1) {
    const first = lines[0].trim();
    if (first.length <= 120 && PREAMBLE_START.test(first) && PREAMBLE_END.test(first)) {
      text = lines.slice(1).join('\n').trim();
    }
  }
  return text;
}
