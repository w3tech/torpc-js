/**
 * Question bank — 50 questions across 5 TOON-style categories.
 *
 * Canonical answers are extracted from the captured fixtures at pinned block
 * 21540854. Each question references (fixtureId, method) so we know which
 * encoded payload to feed to the LLM.
 */
import type { AnswerType } from '../scorer/index.ts';

export interface Question {
  id: string;
  category: Category;
  fixtureId: string;
  /** Which captured method's data the LLM is shown. */
  method: string;
  prompt: string;
  /** Multiple acceptable forms — any match wins. */
  expected: string[];
  type: AnswerType;
  /** Why we expect compressed_v1 to (or not to) outperform raw_rpc on accuracy. */
  rationale?: string;
}

export type Category = 'retrieval' | 'aggregation' | 'filtering' | 'semantic' | 'validity';

export const QUESTIONS: Question[] = [
  // ============================================================================
  // RETRIEVAL (10) — direct lookups
  // ============================================================================
  {
    id: 'Q-001',
    category: 'retrieval',
    fixtureId: 'W1',
    method: 'ankr_getAccountBalance',
    prompt: "What is this wallet's USDT balance? Return only the number.",
    expected: ['369643884.55', '369643884', '369,643,884.55', '$369.6M', '369.6 million'],
    type: 'number',
  },
  {
    id: 'Q-002',
    category: 'retrieval',
    fixtureId: 'W1',
    method: 'ankr_getAccountBalance',
    prompt: "What is this wallet's native ETH balance? Return only the number.",
    expected: ['53753.96', '53753', '53,753', '53,753.96'],
    type: 'number',
  },
  {
    id: 'Q-003',
    category: 'retrieval',
    fixtureId: 'T1',
    method: 'eth_getTransactionReceipt',
    prompt: 'What is the transaction hash? Return only the hex string.',
    expected: ['0x20d1433b9b41040eaf260bbae71e6bb2370fb1baff4c6b255706afd44efc012f'],
    type: 'hex',
  },
  {
    id: 'Q-004',
    category: 'retrieval',
    fixtureId: 'T1',
    method: 'eth_getTransactionReceipt',
    prompt: 'In which block number was this transaction included? Return only the integer.',
    expected: ['21540854'],
    type: 'integer',
  },
  {
    id: 'Q-005',
    category: 'retrieval',
    fixtureId: 'T1',
    method: 'eth_getTransactionReceipt',
    prompt: 'What is the sender (from) address? Return only the address.',
    expected: ['0x6643c6ca39303dd9cd57655304d42fd2ba9846b8'],
    type: 'address',
  },
  {
    id: 'Q-006',
    category: 'retrieval',
    fixtureId: 'T2',
    method: 'eth_getTransactionReceipt',
    prompt: 'How much gas did this transaction use? Return only the integer.',
    expected: ['164090'],
    type: 'integer',
  },
  {
    id: 'Q-007',
    category: 'retrieval',
    fixtureId: 'T4',
    method: 'eth_getTransactionReceipt',
    prompt: 'Did this transaction succeed or fail? Reply with only "success" or "failed".',
    expected: ['failed'],
    type: 'enum',
  },
  {
    id: 'Q-008',
    category: 'retrieval',
    fixtureId: 'B1',
    method: 'eth_getBlockByNumber',
    prompt: "What is this block's number? Return only the integer.",
    expected: ['21540854'],
    type: 'integer',
  },
  {
    id: 'Q-009',
    category: 'retrieval',
    fixtureId: 'B1',
    method: 'eth_getBlockByNumber',
    prompt: 'How many transactions are in this block? Return only the integer.',
    expected: ['162'],
    type: 'integer',
  },
  {
    id: 'Q-010',
    category: 'retrieval',
    fixtureId: 'L1',
    method: 'eth_getLogs',
    prompt: 'How many log entries are in this response? Return only the integer.',
    expected: ['74'],
    type: 'integer',
  },

  // ============================================================================
  // AGGREGATION (15)
  // ============================================================================
  {
    id: 'Q-011',
    category: 'aggregation',
    fixtureId: 'W1',
    method: 'ankr_getAccountBalance',
    prompt: "What is the wallet's total portfolio value in USD? Return only the number.",
    expected: ['912832508', '912832508.26', '$912M', '912,832,508'],
    type: 'number',
  },
  {
    id: 'Q-012',
    category: 'aggregation',
    fixtureId: 'W1',
    method: 'ankr_getAccountBalance',
    prompt: 'How many distinct token assets does this wallet hold? Return only the integer.',
    expected: ['236'],
    type: 'integer',
  },
  {
    id: 'Q-013',
    category: 'aggregation',
    fixtureId: 'W1',
    method: 'ankr_getAccountBalance',
    prompt: 'Which single asset has the largest USD value? Reply with just the token symbol.',
    expected: ['USDT'],
    type: 'token_set',
  },
  {
    id: 'Q-014',
    category: 'aggregation',
    fixtureId: 'W3',
    method: 'ankr_getNFTsByOwner',
    prompt: 'How many NFTs are returned for this wallet? Return only the integer.',
    expected: ['50'],
    type: 'integer',
  },
  {
    id: 'Q-015',
    category: 'aggregation',
    fixtureId: 'W3',
    method: 'ankr_getNFTsByOwner',
    prompt: 'What collection do the NFTs belong to? Reply with just the collection name.',
    expected: ['AzuLadys'],
    type: 'token_set',
  },
  {
    id: 'Q-016',
    category: 'aggregation',
    fixtureId: 'L1',
    method: 'eth_getLogs',
    prompt: 'How many distinct contract addresses appear across these logs? Return only the integer.',
    expected: ['1'],
    type: 'integer',
  },
  {
    id: 'Q-017',
    category: 'aggregation',
    fixtureId: 'L2',
    method: 'eth_getLogs',
    prompt: 'How many log entries are returned? Return only the integer.',
    expected: ['816'],
    type: 'integer',
  },
  {
    id: 'Q-018',
    category: 'aggregation',
    fixtureId: 'L2',
    method: 'eth_getLogs',
    prompt: 'How many distinct blocks are covered by these logs? Return only the integer.',
    expected: ['50'],
    type: 'integer',
  },
  {
    id: 'Q-019',
    category: 'aggregation',
    fixtureId: 'B1',
    method: 'eth_getBlockByNumber',
    prompt: 'How much gas was used in this block? Return only the integer.',
    expected: ['14958877'],
    type: 'integer',
  },
  {
    id: 'Q-020',
    category: 'aggregation',
    fixtureId: 'B1',
    method: 'eth_getBlockByNumber',
    prompt:
      'What is the gas utilisation percentage (gasUsed / gasLimit × 100)? Return only the percentage as a number.',
    expected: ['49.86', '49.9', '49', '50'],
    type: 'number',
  },
  {
    id: 'Q-021',
    category: 'aggregation',
    fixtureId: 'W2',
    method: 'ankr_getTokenTransfers',
    prompt: 'Across all returned transfers, which token symbol appears most often? Reply with just the symbol.',
    expected: ['USDT'],
    type: 'token_set',
  },
  {
    id: 'Q-022',
    category: 'aggregation',
    fixtureId: 'W2',
    method: 'ankr_getTokenTransfers',
    prompt: 'How many transfers are returned in total? Return only the integer.',
    expected: ['100'],
    type: 'integer',
  },
  {
    id: 'Q-023',
    category: 'aggregation',
    fixtureId: 'T2',
    method: 'eth_getTransactionReceipt',
    prompt: 'How many log entries did this transaction emit? Return only the integer.',
    expected: ['6'],
    type: 'integer',
  },
  {
    id: 'Q-024',
    category: 'aggregation',
    fixtureId: 'T1',
    method: 'eth_getTransactionReceipt',
    prompt: 'How many log entries did this transaction emit? Return only the integer.',
    expected: ['1'],
    type: 'integer',
  },
  {
    id: 'Q-025',
    category: 'aggregation',
    fixtureId: 'W3',
    method: 'ankr_getNFTsByOwner',
    prompt: 'How many distinct NFT collections does this wallet own? Return only the integer.',
    expected: ['1'],
    type: 'integer',
  },

  // ============================================================================
  // FILTERING (12)
  // ============================================================================
  {
    id: 'Q-026',
    category: 'filtering',
    fixtureId: 'W1',
    method: 'ankr_getAccountBalance',
    prompt: 'Does this wallet hold any USDC? Reply with just yes or no.',
    expected: ['yes'],
    type: 'boolean',
  },
  {
    id: 'Q-027',
    category: 'filtering',
    fixtureId: 'W1',
    method: 'ankr_getAccountBalance',
    prompt: "Is the wallet's USDT balance larger than its USDC balance? Reply with just yes or no.",
    expected: ['yes'],
    type: 'boolean',
    rationale: 'USDT=369M vs USDC=5.9M',
  },
  {
    id: 'Q-028',
    category: 'filtering',
    fixtureId: 'L1',
    method: 'eth_getLogs',
    prompt:
      'Are all of these logs from the USDC contract (0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48)? Reply yes or no.',
    expected: ['yes'],
    type: 'boolean',
  },
  {
    id: 'Q-029',
    category: 'filtering',
    fixtureId: 'L1',
    method: 'eth_getLogs',
    prompt: 'Are all of these logs Transfer events? Reply yes or no.',
    expected: ['yes'],
    type: 'boolean',
  },
  {
    id: 'Q-030',
    category: 'filtering',
    fixtureId: 'B1',
    method: 'eth_getBlockByNumber',
    prompt: 'Was this block more than 50% gas-utilised? Reply with just yes or no.',
    expected: ['no'],
    type: 'boolean',
    rationale: '14958877/30000000 = 49.86%',
  },
  {
    id: 'Q-031',
    category: 'filtering',
    fixtureId: 'T2',
    method: 'eth_getTransactionReceipt',
    prompt: 'Did this transaction succeed (i.e. status was 1, not failed)? Reply just yes or no.',
    expected: ['yes'],
    type: 'boolean',
  },
  {
    id: 'Q-032',
    category: 'filtering',
    fixtureId: 'T4',
    method: 'eth_getTransactionReceipt',
    prompt: 'Did this transaction succeed? Reply just yes or no.',
    expected: ['no'],
    type: 'boolean',
  },
  {
    id: 'Q-033',
    category: 'filtering',
    fixtureId: 'T5',
    method: 'eth_getTransactionReceipt',
    prompt: 'Does this transaction deploy a new contract? Reply just yes or no.',
    expected: ['yes'],
    type: 'boolean',
    rationale: 'to=null, contractAddress non-null',
  },
  {
    id: 'Q-034',
    category: 'filtering',
    fixtureId: 'T1',
    method: 'eth_getTransactionReceipt',
    prompt: 'Does this transaction deploy a new contract? Reply just yes or no.',
    expected: ['no'],
    type: 'boolean',
  },
  {
    id: 'Q-035',
    category: 'filtering',
    fixtureId: 'W4',
    method: 'ankr_getNFTsByOwner',
    prompt: 'Does this wallet have any NFTs returned? Reply just yes or no.',
    expected: ['no'],
    type: 'boolean',
    rationale: 'burn address — no NFTs',
  },
  {
    id: 'Q-036',
    category: 'filtering',
    fixtureId: 'W1',
    method: 'ankr_getAccountBalance',
    prompt: 'Does this wallet hold any WBTC? Reply just yes or no.',
    expected: ['no'],
    type: 'boolean',
    rationale: 'No WBTC in top assets',
  },
  {
    id: 'Q-037',
    category: 'filtering',
    fixtureId: 'L2',
    method: 'eth_getLogs',
    prompt: 'Were all of these logs emitted by the same single contract address? Reply just yes or no.',
    expected: ['yes'],
    type: 'boolean',
    rationale: 'All USDC',
  },

  // ============================================================================
  // SEMANTIC AWARENESS (10) — where compressed_v1 should win on accuracy
  // ============================================================================
  {
    id: 'Q-038',
    category: 'semantic',
    fixtureId: 'T1',
    method: 'eth_getTransactionReceipt',
    prompt:
      'Has this transaction reached confirmed finality, or could it still be reorganised? Reply with one word: confirmed, safe, latest, or unknown.',
    expected: ['confirmed'],
    type: 'enum',
    rationale: 'compressed_v1 has explicit finality field; raw_rpc has none — LLM must infer from block age',
  },
  {
    id: 'Q-039',
    category: 'semantic',
    fixtureId: 'T1',
    method: 'eth_getTransactionReceipt',
    prompt:
      'What kind of action does this transaction perform? Reply with exactly one word from: transfer, swap, approve, mint, burn, contract_deployment, failed, other.',
    expected: ['transfer'],
    type: 'enum',
    rationale: 'compressed_v1 precomputes action.type; raw_rpc requires LLM to decode event topics',
  },
  {
    id: 'Q-040',
    category: 'semantic',
    fixtureId: 'T2',
    method: 'eth_getTransactionReceipt',
    prompt:
      'What kind of action does this transaction perform? Reply with exactly one word from: transfer, swap, approve, mint, burn, contract_deployment, failed, other.',
    expected: ['swap'],
    type: 'enum',
  },
  {
    id: 'Q-041',
    category: 'semantic',
    fixtureId: 'T3',
    method: 'eth_getTransactionReceipt',
    prompt:
      'What kind of action does this transaction perform? Reply with exactly one word from: transfer, swap, approve, mint, burn, contract_deployment, failed, other.',
    expected: ['mint'],
    type: 'enum',
  },
  {
    id: 'Q-042',
    category: 'semantic',
    fixtureId: 'T4',
    method: 'eth_getTransactionReceipt',
    prompt:
      'What kind of action does this transaction perform? Reply with exactly one word from: transfer, swap, approve, mint, burn, contract_deployment, failed, other.',
    expected: ['failed'],
    type: 'enum',
  },
  {
    id: 'Q-043',
    category: 'semantic',
    fixtureId: 'T5',
    method: 'eth_getTransactionReceipt',
    prompt:
      'What kind of action does this transaction perform? Reply with exactly one word from: transfer, swap, approve, mint, burn, contract_deployment, failed, other.',
    expected: ['contract_deployment', 'contract-deployment'],
    type: 'enum',
  },
  {
    id: 'Q-044',
    category: 'semantic',
    fixtureId: 'B1',
    method: 'eth_getBlockByNumber',
    prompt:
      'Has this block reached confirmed finality at the time of this data, or could it still be reorganised? Reply with one word: confirmed, safe, latest, or unknown.',
    expected: ['confirmed'],
    type: 'enum',
    rationale: 'compressed_v1 envelope carries finality flag',
  },
  {
    id: 'Q-045',
    category: 'semantic',
    fixtureId: 'B2',
    method: 'eth_getBlockByNumber',
    prompt:
      'Has this block reached confirmed finality, or could it still be reorganised? Reply with one word: confirmed, safe, latest, or unknown.',
    expected: ['confirmed'],
    type: 'enum',
    rationale: 'B2 is block 17000000, far in the past — confirmed by any threshold',
  },
  {
    id: 'Q-046',
    category: 'semantic',
    fixtureId: 'T1',
    method: 'eth_getTransactionReceipt',
    prompt:
      'Which ERC-20 token (by symbol or contract label) was transferred in this transaction? Reply with just the token symbol or contract name.',
    expected: ['BUSD', 'unknown', 'BUSDC', 'B-USDC'],
    type: 'token_set',
    rationale:
      'Token contract 0x57e114b6 — not a major one. compressed_v1 resolves via known-contracts registry if it is there; raw_rpc requires LLM to know contract',
  },
  {
    id: 'Q-047',
    category: 'semantic',
    fixtureId: 'T2',
    method: 'eth_getTransactionReceipt',
    prompt:
      'Is this transaction safe to consider final, or could it still be reorganised? Reply with one word: yes, no, or unknown.',
    expected: ['yes'],
    type: 'boolean_enum',
    rationale: 'compressed_v1 explicit finality=confirmed; raw has nothing',
  },

  // ============================================================================
  // VALIDITY / TRUNCATION (3)
  // ============================================================================
  {
    id: 'Q-048',
    category: 'validity',
    fixtureId: 'W3',
    method: 'ankr_getNFTsByOwner',
    prompt:
      'Is this list of NFTs complete, or are there more available beyond what is shown? Reply with one word: complete, truncated, or unknown.',
    expected: ['truncated'],
    type: 'enum',
    rationale: 'nextPageToken present — compressed_v1 lifts this to truncated:true',
  },
  {
    id: 'Q-049',
    category: 'validity',
    fixtureId: 'W2',
    method: 'ankr_getTokenTransfers',
    prompt:
      'Are these transfers complete, or are there more available beyond what is shown? Reply with one word: complete, truncated, or unknown.',
    expected: ['truncated'],
    type: 'enum',
  },
  {
    id: 'Q-050',
    category: 'validity',
    fixtureId: 'L1',
    method: 'eth_getLogs',
    prompt:
      'Is this list of logs complete for the requested block range, or might more logs exist? Reply with one word: complete, truncated, or unknown.',
    expected: ['complete'],
    type: 'enum',
    rationale: 'eth_getLogs returns exact match for the range — no truncation marker needed',
  },
];

export function questionsByCategory(): Record<Category, Question[]> {
  const out: Record<Category, Question[]> = {
    retrieval: [],
    aggregation: [],
    filtering: [],
    semantic: [],
    validity: [],
  };
  for (const q of QUESTIONS) out[q.category].push(q);
  return out;
}
