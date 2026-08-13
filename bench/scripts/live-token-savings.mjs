// Live token-savings measurement, TORPC tiers 0/1/2 over a public Ankr EVM endpoint.
//
// What it does:
//   phase 1  probes every candidate EVM method with `Accept-Token-Tier: 2` and `: 1` and
//            records the server's own `Token-Tier` response echo, which is its coverage
//            declaration. Methods that never echo a tier are dropped from the measurement.
//   phase 2  picks 25 deterministic random blocks in [head - 1,000,000, head] (LCG, seed 42),
//            calls every covered method at tier 0, 1 and 2 on data from that block, and counts
//            o200k_base tokens over the FULL HTTP response body (JSON-RPC envelope included,
//            since that is what an LLM consumer pays for). A raw/T1/T2 triple is discarded if
//            any leg returns a JSON-RPC error, an empty `eth_getLogs` result or a null uncle.
//   report   per-method averages plus token-weighted and unweighted overall reductions, and
//            per-method p50 wall-clock latency for each tier.
//
// An earlier, narrower run of the same protocol (six methods, 2026-05-27, on the pre-canonical
// `X-Rpc-Compress` header) measured -34.0% at T1 and -45.6% at T2. See
// ../results/live-token-savings-2026-07-17.md for the published 21-method run.
//
// Run from this repository (the tokenizer is resolved from bench/package.json, so run
// `pnpm install` in bench/ first):
//
//   ANKR_RPC_KEY=<your-key> node bench/scripts/live-token-savings.mjs
//
// or, to measure any other TORPC endpoint, the same variable the rest of the harness uses:
//
//   ANKR_RPC_URL=https://<host>/<path>/<key> node bench/scripts/live-token-savings.mjs
//
// The endpoint and key are read from the environment only. Never hardcode them, and never print
// them: the URL carries the key, so it must not appear in logs or in committed output.
import { createRequire } from 'module';
const require = createRequire(new URL('../package.json', import.meta.url));
const { encode } = require('gpt-tokenizer/encoding/o200k_base');

const ENDPOINT = process.env.ANKR_RPC_URL
  || (process.env.ANKR_RPC_KEY ? `https://rpc.ankr.com/eth/${process.env.ANKR_RPC_KEY}` : null);
if (!ENDPOINT) {
  console.error('Set ANKR_RPC_KEY=<your-key> (ETH mainnet on rpc.ankr.com) or ANKR_RPC_URL=<full endpoint URL with key>.');
  console.error('Run: ANKR_RPC_KEY=<your-key> node bench/scripts/live-token-savings.mjs');
  process.exit(1);
}
const ITERS = 25;
// LCG, seed 42 (deterministic block/tx/token selection, so the run is reproducible)
let s = 42n;
const rnd = () => { s = (s * 6364136223846793005n + 1442695040888963407n) & 0xffffffffffffffffn; return Number(s >> 33n) / 2 ** 31; };
const TOKENS = ['0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', '0x6B175474E89094C44Da98b954EedeAC495271d0F', '0xdAC17F958D2ee523a2206206994597C13D831ec7', '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2']; // USDC DAI USDT WETH
const TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const ADDR = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';

async function call(method, params, tier) {
  const headers = { 'Content-Type': 'application/json' };
  if (tier > 0) headers['Accept-Token-Tier'] = String(tier);
  const t0 = performance.now();
  const res = await fetch(ENDPOINT, { method: 'POST', headers, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  const body = await res.text();
  const ms = performance.now() - t0;
  return { body, ms, echo: res.headers.get('token-tier'), status: res.status };
}

// ---------- phase 1: coverage probe ----------
const CANDIDATES = [
  ['eth_getTransactionReceipt', null], ['eth_getTransactionByHash', null],
  ['eth_getBlockByNumber', null], ['eth_getBlockByHash', null], ['eth_getBlockReceipts', null],
  ['eth_getLogs', null], ['eth_getTransactionByBlockNumberAndIndex', null], ['eth_getTransactionByBlockHashAndIndex', null],
  ['eth_blockNumber', []], ['eth_chainId', []], ['eth_gasPrice', []], ['eth_maxPriorityFeePerGas', []],
  ['eth_blobBaseFee', []], ['eth_getBalance', [ADDR, 'latest']], ['eth_getTransactionCount', [ADDR, 'latest']],
  ['eth_getBlockTransactionCountByNumber', ['latest']], ['eth_getBlockTransactionCountByHash', null],
  ['eth_getUncleCountByBlockNumber', ['latest']], ['eth_getUncleCountByBlockHash', null],
  ['eth_estimateGas', [{ from: ADDR, to: ADDR, value: '0x1' }]],
  ['eth_feeHistory', ['0x4', 'latest', [25, 75]]],
  ['eth_getUncleByBlockNumberAndIndex', null], ['eth_getUncleByBlockHashAndIndex', null],
  ['eth_call', [{ to: TOKENS[0], data: '0x18160ddd' }, 'latest']],
  ['eth_getCode', [TOKENS[0], 'latest']], ['eth_getStorageAt', [TOKENS[0], '0x0', 'latest']],
  ['net_version', []], ['web3_clientVersion', []], ['eth_syncing', []],
];

const head = parseInt(JSON.parse((await call('eth_blockNumber', [], 0)).body).result, 16);
const headHex = '0x' + head.toString(16);
const bootstrap = JSON.parse((await call('eth_getBlockByNumber', [headHex, false], 0)).body).result;
const probeCtx = { blkHex: headHex, blkHash: bootstrap.hash, tx: bootstrap.transactions[0] };
const fill = (m) => ({
  eth_getTransactionReceipt: [probeCtx.tx], eth_getTransactionByHash: [probeCtx.tx],
  eth_getBlockByNumber: [probeCtx.blkHex, false], eth_getBlockByHash: [probeCtx.blkHash, false],
  eth_getBlockReceipts: [probeCtx.blkHex], eth_getLogs: [{ fromBlock: probeCtx.blkHex, toBlock: probeCtx.blkHex, address: TOKENS[0], topics: [TRANSFER] }],
  eth_getTransactionByBlockNumberAndIndex: [probeCtx.blkHex, '0x0'], eth_getTransactionByBlockHashAndIndex: [probeCtx.blkHash, '0x0'],
  eth_getBlockTransactionCountByHash: [probeCtx.blkHash], eth_getUncleCountByBlockHash: [probeCtx.blkHash],
  eth_getUncleByBlockNumberAndIndex: [probeCtx.blkHex, '0x0'], eth_getUncleByBlockHashAndIndex: [probeCtx.blkHash, '0x0'],
}[m]);

console.log('== coverage probe ==');
const coverage = {};
for (const [m, p] of CANDIDATES) {
  const params = p ?? fill(m);
  const r2 = await call(m, params, 2);
  const r1 = await call(m, params, 1);
  let err = '';
  try { const j = JSON.parse(r2.body); if (j.error) err = `err:${j.error.code}`; } catch { err = 'non-json'; }
  coverage[m] = { t2echo: r2.echo, t1echo: r1.echo, note: err };
  console.log(`${m.padEnd(42)} ATT:2->${r2.echo} ATT:1->${r1.echo} ${err}`);
}

// ---------- phase 2: live measurement ----------
const MEASURED = Object.entries(coverage).filter(([m, c]) => c.t2echo !== null && ['eth_syncing','net_version','web3_clientVersion'].indexOf(m) === -1).map(([m]) => m);
console.log(`\n== live run: ${ITERS} random blocks x ${MEASURED.length} methods x 3 tiers ==`);
const acc = {}; // method -> {n, tok:[t0,t1,t2], ms:[..]}
const add = (m, tier, tok, ms) => { const a = acc[m] ??= { n: [0,0,0], tok: [0,0,0], ms: [[],[],[]] }; a.n[tier]++; a.tok[tier] += tok; a.ms[tier].push(ms); };

for (let it = 0; it < ITERS; it++) {
  const blk = head - 1 - Math.floor(rnd() * 1_000_000);
  const blkHex = '0x' + blk.toString(16);
  const bs = JSON.parse((await call('eth_getBlockByNumber', [blkHex, false], 0)).body).result;
  if (!bs || !bs.transactions.length) { console.log(`iter ${it}: empty block ${blk}, skip`); continue; }
  const tx = bs.transactions[Math.floor(rnd() * bs.transactions.length)];
  const token = TOKENS[Math.floor(rnd() * 4)];
  const ctx = {
    eth_getTransactionReceipt: [tx], eth_getTransactionByHash: [tx],
    eth_getBlockByNumber: [blkHex, true], eth_getBlockByHash: [bs.hash, true], eth_getBlockReceipts: [blkHex],
    eth_getLogs: [{ fromBlock: '0x' + (blk - 2).toString(16), toBlock: blkHex, address: token, topics: [TRANSFER] }],
    eth_getTransactionByBlockNumberAndIndex: [blkHex, '0x0'], eth_getTransactionByBlockHashAndIndex: [bs.hash, '0x0'],
    eth_blockNumber: [], eth_chainId: [], eth_gasPrice: [], eth_maxPriorityFeePerGas: [], eth_blobBaseFee: [],
    eth_getBalance: [ADDR, blkHex], eth_getTransactionCount: [ADDR, blkHex],
    eth_getBlockTransactionCountByNumber: [blkHex], eth_getBlockTransactionCountByHash: [bs.hash],
    eth_getUncleCountByBlockNumber: [blkHex], eth_getUncleCountByBlockHash: [bs.hash],
    eth_estimateGas: [{ from: ADDR, to: ADDR, value: '0x1' }],
    eth_feeHistory: ['0x4', blkHex, [25, 75]],
    eth_getUncleByBlockNumberAndIndex: [blkHex, '0x0'], eth_getUncleByBlockHashAndIndex: [bs.hash, '0x0'],
  };
  for (const m of MEASURED) {
    if (!(m in ctx)) continue;
    const results = [];
    for (const tier of [0, 1, 2]) results.push(await call(m, ctx[m], tier));
    // skip triple if any leg errored (JSON-RPC error, empty logs result or null uncle)
    let ok = true;
    for (const r of results) { try { const j = JSON.parse(r.body); if (j.error || (m === 'eth_getLogs' && Array.isArray(j.result) && j.result.length === 0) || (m.startsWith('eth_getUncleBy') && j.result === null)) ok = false; } catch { ok = false; } }
    if (!ok) continue;
    results.forEach((r, tier) => add(m, tier, encode(r.body).length, r.ms));
  }
  process.stdout.write(`iter ${it + 1}/${ITERS} blk=${blk} done\n`);
}

// ---------- report ----------
const med = (a) => { const x = [...a].sort((p, q) => p - q); return x.length ? x[Math.floor(x.length / 2)] : 0; };
let totRaw = 0, totT1 = 0, totT2 = 0, rows = [];
for (const [m, a] of Object.entries(acc)) {
  if (!a.n[0]) continue;
  const avg = a.tok.map((t, i) => t / a.n[i]);
  totRaw += a.tok[0]; totT1 += a.tok[1]; totT2 += a.tok[2];
  rows.push({ m, n: a.n[0], raw: avg[0], t1: avg[1], t2: avg[2], d1: (1 - avg[1] / avg[0]) * 100, d2: (1 - avg[2] / avg[0]) * 100, ms0: med(a.ms[0]), ms2: med(a.ms[2]) });
}
rows.sort((a, b) => b.raw - a.raw);
console.log('\n| method | n | avg raw | avg T1 | avg T2 | T1 d | T2 d | p50 raw ms | p50 T2 ms |');
console.log('|---|--:|--:|--:|--:|--:|--:|--:|--:|');
for (const r of rows) console.log(`| ${r.m} | ${r.n} | ${Math.round(r.raw).toLocaleString('en')} | ${Math.round(r.t1).toLocaleString('en')} | ${Math.round(r.t2).toLocaleString('en')} | -${r.d1.toFixed(1)}% | -${r.d2.toFixed(1)}% | ${Math.round(r.ms0)} | ${Math.round(r.ms2)} |`);
console.log(`\nOVERALL (token-sum): raw=${totRaw.toLocaleString('en')} T1=${totT1.toLocaleString('en')} (-${((1 - totT1 / totRaw) * 100).toFixed(1)}%) T2=${totT2.toLocaleString('en')} (-${((1 - totT2 / totRaw) * 100).toFixed(1)}%)`);
const um = rows.filter(r => r.d2 > 0.5); // methods with real movement
console.log(`Unweighted per-method mean (moved methods, n=${um.length}): T1=-${(um.reduce((s, r) => s + r.d1, 0) / um.length).toFixed(1)}% T2=-${(um.reduce((s, r) => s + r.d2, 0) / um.length).toFixed(1)}%`);
console.log(`Unweighted per-method mean (ALL measured, n=${rows.length}): T1=-${(rows.reduce((s, r) => s + r.d1, 0) / rows.length).toFixed(1)}% T2=-${(rows.reduce((s, r) => s + r.d2, 0) / rows.length).toFixed(1)}%`);
console.log('\nCOVERAGE JSON:', JSON.stringify(coverage));
console.log('HEAD:', head, 'DATE:', new Date().toISOString());
