import { describe, expect, it } from '@jest/globals';
import { sanitizeSpeech } from './speech-sanitizer';

/** Advocate output cleanup (SPEC §5.5): keep the speech, drop scaffolding. */
describe('sanitizeSpeech', () => {
  it('strips a leading assistant-preamble line', () => {
    const out = sanitizeSpeech('Sure, here is my speech:\nMy lords, the accused acted rightly.');
    expect(out).toBe('My lords, the accused acted rightly.');
  });

  it('unwraps a fenced code block', () => {
    const out = sanitizeSpeech('```\nMembers of the tribunal, hear me.\n```');
    expect(out).toBe('Members of the tribunal, hear me.');
  });

  it('leaves a normal speech untouched', () => {
    const speech = 'I stand before you to defend a difficult act.\nIt was necessary.';
    expect(sanitizeSpeech(speech)).toBe(speech);
  });

  it('does NOT strip a first line that merely starts with a common word', () => {
    // No preamble marker ("speech/statement/:") ending -> kept.
    const speech = 'Here stands a man accused of a grave thing, and I will defend him.';
    expect(sanitizeSpeech(speech)).toBe(speech);
  });

  it('trims surrounding whitespace', () => {
    expect(sanitizeSpeech('   hello   ')).toBe('hello');
  });
});
