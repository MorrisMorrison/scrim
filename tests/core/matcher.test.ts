import { describe, expect, it } from 'vitest';
import { AI_KEYWORDS } from '../../src/core/defaults/ai';
import { NSFW_KEYWORDS } from '../../src/core/defaults/nsfw';
import { SOFTWARE_KEYWORDS } from '../../src/core/defaults/software';
import { compileKeywords, firstMatch, validateKeyword } from '../../src/core/matcher';

const ai = compileKeywords(AI_KEYWORDS);
const hitAi = (s: string | null | undefined) => firstMatch(s, ai) !== null;

describe('AI keywords', () => {
  it('match obvious AI content', () => {
    for (const s of [
      'the new AI model is wild',
      'ChatGPT launches a new feature',
      'this is generative AI at its finest',
      'a deep dive into large language models',
      'OpenAI and Anthropic race ahead',
      'made with Midjourney',
      'GPT-4 vs GPT-5 benchmarks',
      'AI-generated artwork',
      'Is AGI near?',
      'running an LLM locally',
      'Wer auf proprietäre KI-Modelle setzt, riskiert alles',
      "I found what's missing in agentic development",
      'Meet IBM Bob. An AI coding agent for real workflows',
      'Mistral-Gründer über Künstliche Intelligenz',
    ]) {
      expect(hitAi(s), s).toBe(true);
    }
  });

  it('do not match ordinary text containing a-i letters', () => {
    for (const s of [
      'email me again about the chair',
      'she said the mail is on the table',
      'maintain the main domain',
      'a brilliant sunrise over the bay',
      'the aircraft gained altitude',
      'I need a haircut and a coffee',
      'Kinder spielen mit der Kiste im Park',
    ]) {
      expect(hitAi(s), s).toBe(false);
    }
  });

  it('match acronyms only as standalone uppercase tokens', () => {
    expect(hitAi('the AI wins')).toBe(true);
    expect(hitAi('email')).toBe(false);
    expect(hitAi('CHAIR')).toBe(false);
  });

  it('handle empty input safely', () => {
    expect(hitAi('')).toBe(false);
    expect(hitAi(null)).toBe(false);
    expect(hitAi(undefined)).toBe(false);
  });

  it('report the matched text', () => {
    expect(firstMatch('all about ChatGPT today', ai)).toBe('ChatGPT');
    expect(firstMatch('nothing relevant', ai)).toBeNull();
  });
});

describe('compileKeywords', () => {
  it('handles an empty list', () => {
    expect(firstMatch('anything about AI', compileKeywords([]))).toBeNull();
  });

  it('supports raw /regex/ entries', () => {
    const c = compileKeywords(['/gpt-?[0-9]/i']);
    expect(firstMatch('the GPT4 release', c)).toBe('GPT4');
    expect(firstMatch('gpt-5 is out', c)).toBe('gpt-5');
    expect(firstMatch('a plain sentence', c)).toBeNull();
  });

  it('strips stateful g/y flags so repeated calls agree', () => {
    const c = compileKeywords(['/llm/gi']);
    expect(firstMatch('an llm here', c)).toBe('llm');
    expect(firstMatch('an llm here', c)).toBe('llm');
  });

  it('skips invalid regex entries without breaking the rest', () => {
    const c = compileKeywords(['/([unclosed/', 'ChatGPT']);
    expect(firstMatch('ChatGPT news', c)).toBe('ChatGPT');
    expect(firstMatch('nothing here', c)).toBeNull();
  });
});

describe('validateKeyword', () => {
  it('accepts plain words and valid regexes', () => {
    expect(validateKeyword('ChatGPT')).toBeNull();
    expect(validateKeyword('/gpt-?[0-9]/i')).toBeNull();
  });

  it('rejects empty input and invalid regexes', () => {
    expect(validateKeyword('   ')).toBe('Keyword is empty');
    expect(validateKeyword('/([unclosed/')).toMatch(/^Invalid regex/);
  });
});

describe('software keywords', () => {
  const c = compileKeywords(SOFTWARE_KEYWORDS);
  it('catch dev content', () => {
    for (const s of [
      'learning Python for data science',
      'opened a pull request on GitHub',
      'our REST API returns JSON',
      'debugging a nasty stack trace',
      'he just landed a software engineer role',
      'deploying with Docker and Kubernetes',
      'Jr Devs - "I Can\'t Code Anymore"',
      'Terry Davis – Die schwerste Frage in der Programmierung',
      'The Java Story | Official Trailer | Full Film Coming July 17th',
    ]) {
      expect(firstMatch(s, c), s).not.toBeNull();
    }
  });

  it('leave ambiguous everyday words alone', () => {
    for (const s of [
      'fans react to the shocking news',
      "let's go to the beach this weekend",
      'rust spots on the old car',
      'a bug flew into the room',
      'the waiter was a great server',
      'just a quick coffee break',
      "the device won't charge",
      'Die Entwicklung der Stadt geht voran',
    ]) {
      expect(firstMatch(s, c), s).toBeNull();
    }
  });
});

describe('NSFW keywords', () => {
  const c = compileKeywords(NSFW_KEYWORDS);
  it('catch explicit content', () => {
    expect(firstMatch('new OnlyFans drama', c)).not.toBeNull();
    expect(firstMatch('leaked sex tape rumours', c)).not.toBeNull();
    expect(firstMatch('NSFW warning', c)).not.toBeNull();
  });
  it('leave ordinary text alone', () => {
    expect(firstMatch('weekend trip to Essex', c)).toBeNull();
    expect(firstMatch('nsfw in lowercase is still fine to miss', c)).toBeNull();
  });
});
