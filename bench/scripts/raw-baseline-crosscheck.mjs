// Raw-baseline cross-check.
//
// Every saving figure in this project is a percentage OF OUR OWN RAW OUTPUT, so the
// baseline itself has to be checked: an inflated raw response would flatter every
// reduction downstream. This script fetches the same calls, untransformed, from our
// endpoint and from an independent Ethereum mainnet endpoint, and compares sizes.
//
// Both sides are plain JSON-RPC with no opt-in header, so this measures node output,
// not a product. It is a control, not a comparison of providers.
import { createRequire } from 'node:module';
const require = createRequire(new URL('../package.json', import.meta.url));
const { encode } = require('gpt-tokenizer/encoding/o200k_base');
// Both endpoints come from the environment. Set OTHER_RPC_URL to any independent
// Ethereum mainnet JSON-RPC endpoint, including your own node.
const ANKR = process.env.ANKR_RPC_URL ?? `https://rpc.ankr.com/eth/${process.env.ANKR_RPC_KEY ?? ''}`;
const OTHER = process.env.OTHER_RPC_URL;
if (!OTHER || !ANKR.includes('http')) {
  console.error('Set OTHER_RPC_URL and either ANKR_RPC_URL or ANKR_RPC_KEY. Keys never live in this repo.');
  process.exit(1);
}
const TX = '0x4d415bcf65c3ae5c21922db408a0c3c657897d04369cd35c9291181a09dccbc0';
const BLOCK = '0x17ee5d9';
const USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const tasks = [
  ['eth_getTransactionByHash', [TX]],
  ['eth_getTransactionReceipt', [TX]],
  ['eth_getBlockByNumber', [BLOCK, false]],
  ['eth_getBlockByNumber (full tx)', [BLOCK, true], 'eth_getBlockByNumber'],
  ['eth_getBlockReceipts', [BLOCK]],
  ['eth_getLogs', [{ fromBlock: BLOCK, toBlock: BLOCK, address: USDC }]],
  ['eth_blockNumber', []],
];
const call = async (url, method, params) => {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  return r.text();
};
const rows = [];
for (const [label, params, methodOverride] of tasks) {
  const method = methodOverride ?? label;
  const [ours, theirs] = await Promise.all([call(ANKR, method, params), call(OTHER, method, params)]);
  const o = JSON.parse(ours), t = JSON.parse(theirs);
  if (o.error || t.error) { rows.push({ label, error: (o.error ?? t.error).message }); continue; }
  const same = JSON.stringify(o.result) === JSON.stringify(t.result);
  const ob = ours.length, tb = theirs.length, ot = encode(ours).length, tt = encode(theirs).length;
  rows.push({ label, identical_result: same, our_bytes: ob, their_bytes: tb,
    our_tokens: ot, their_tokens: tt,
    byte_delta_pct: +(((ob - tb) / tb) * 100).toFixed(2),
    token_delta_pct: +(((ot - tt) / tt) * 100).toFixed(2) });
}
const ok = rows.filter((r) => !r.error);
const agg = (f) => ok.reduce((s, r) => s + r[f], 0);
console.log(JSON.stringify({ rows,
  totals: { our_tokens: agg('our_tokens'), their_tokens: agg('their_tokens'),
    token_delta_pct: +(((agg('our_tokens') - agg('their_tokens')) / agg('their_tokens')) * 100).toFixed(2),
    byte_delta_pct: +(((agg('our_bytes') - agg('their_bytes')) / agg('their_bytes')) * 100).toFixed(2),
    results_identical: ok.every((r) => r.identical_result) } }, null, 1));
