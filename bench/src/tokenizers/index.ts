/**
 * Tokenizer wrappers — common interface returning token counts for a given text.
 * Phase 1 ships o200k_base (GPT-5/4o family) and cl100k_base (GPT-4 family) via
 * the gpt-tokenizer npm package (BPE, native JS, no API call).
 * Claude and Gemini tokenizers land in Phase 2 once those API keys are available.
 */
import type { TokenizerName } from '../types/index.ts';

export interface Tokenizer {
  name: TokenizerName;
  countTokens(text: string): number;
}

let _o200k: ((text: string) => number[]) | null = null;
let _cl100k: ((text: string) => number[]) | null = null;

async function getO200k(): Promise<(text: string) => number[]> {
  if (_o200k) return _o200k;
  const mod = await import('gpt-tokenizer/model/gpt-4o');
  _o200k = mod.encode;
  return _o200k;
}

async function getCl100k(): Promise<(text: string) => number[]> {
  if (_cl100k) return _cl100k;
  const mod = await import('gpt-tokenizer/model/gpt-4');
  _cl100k = mod.encode;
  return _cl100k;
}

export async function makeTokenizer(name: TokenizerName): Promise<Tokenizer> {
  switch (name) {
    case 'o200k_base': {
      const encode = await getO200k();
      return {
        name: 'o200k_base',
        countTokens: (text) => encode(text).length,
      };
    }
    case 'cl100k_base': {
      const encode = await getCl100k();
      return {
        name: 'cl100k_base',
        countTokens: (text) => encode(text).length,
      };
    }
    case 'claude':
    case 'gemini':
      throw new Error(`Tokenizer ${name} not yet implemented — Phase 2.`);
  }
}

export const PHASE_1_TOKENIZERS: TokenizerName[] = ['o200k_base', 'cl100k_base'];
