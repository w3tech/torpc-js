import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { dropServiceFields } from '../src/rules/drop_service_fields.ts';

/**
 * Raw receipt of the conformance vector
 * `conformance/golden/eth_getTransactionReceipt/hex-strip-and-drop-service.json`,
 * inlined so the test stays self-contained in the published package.
 */
function goldenRawReceipt(): Record<string, unknown> {
  return {
    transactionHash: '0x86c1b59e6f8c0c9f5a8e2d4b3c7a1e9d0f5b2c8a4e7d1f9c3b5a8e2d4b3c7a1e9',
    blockHash: '0xc4a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8',
    blockNumber: '0x148a3f6',
    transactionIndex: '0x2a',
    from: '0x742d35cc6f8e6c0a4f6c3b8a4e7d1f9c3b5a8e2d',
    to: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    contractAddress: null,
    cumulativeGasUsed: '0x4a9e3f',
    effectiveGasPrice: '0x4a817c800',
    gasUsed: '0xa410',
    logs: [
      {
        address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        topics: [
          '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
          '0x000000000000000000000000742d35cc6f8e6c0a4f6c3b8a4e7d1f9c3b5a8e2d',
          '0x0000000000000000000000008ba1f109551bd432803012645ac136ddd64dba72',
        ],
        data: '0x000000000000000000000000000000000000000000000000000000003b9aca00',
        blockHash: '0xc4a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8',
        blockNumber: '0x148a3f6',
        transactionHash: '0x86c1b59e6f8c0c9f5a8e2d4b3c7a1e9d0f5b2c8a4e7d1f9c3b5a8e2d4b3c7a1e9',
        transactionIndex: '0x2a',
        blockTimestamp: '0x6a05ca1f',
        logIndex: '0x4c',
        removed: false,
      },
    ],
    logsBloom: `0x${'0'.repeat(512)}`,
    status: '0x1',
    type: '0x2',
  };
}

describe('drop_service', () => {
  it('drops the three receipt-level service fields and nothing else', () => {
    const out = dropServiceFields(goldenRawReceipt());

    assert.deepEqual(Object.keys(out).sort(), [
      'blockHash',
      'blockNumber',
      'contractAddress',
      'effectiveGasPrice',
      'from',
      'gasUsed',
      'logs',
      'status',
      'to',
      'transactionHash',
      'transactionIndex',
    ]);
  });

  it('KEEPS receipt-level transactionIndex: the spec renames it to tx_index and keeps it', () => {
    // Regression: an earlier version dropped it, which contradicts
    // specs/methods/eth_getTransactionReceipt.md §2 and the conformance vector
    // eth_getTransactionReceipt/hex-strip-and-drop-service, whose T1 output
    // carries "tx_index": "42" (that is 0x2a in decimal).
    const out = dropServiceFields(goldenRawReceipt());
    assert.equal(out.transactionIndex, '0x2a');
  });

  it('drops the per-log position and bookkeeping fields, including blockTimestamp', () => {
    const out = dropServiceFields(goldenRawReceipt());
    const logs = out.logs as Record<string, unknown>[];

    assert.equal(logs.length, 1);
    assert.deepEqual(Object.keys(logs[0]!).sort(), ['address', 'data', 'topics']);
  });

  it('keeps removed when it is true, drops it when it is false', () => {
    const reorged = {
      logs: [{ address: '0xabc', removed: true }, { address: '0xdef', removed: false }],
    };
    const out = dropServiceFields(reorged);
    const logs = out.logs as Record<string, unknown>[];

    assert.equal(logs[0]!.removed, true);
    assert.equal('removed' in logs[1]!, false);
  });

  it('passes unenumerated fields through verbatim, including chain extensions', () => {
    const opStyle = {
      gasUsed: '0xa410',
      l1Fee: '0x1c2f',
      l1GasUsed: '0x640',
      depositNonce: '0x7',
      logs: [],
    };
    const out = dropServiceFields(opStyle);

    assert.equal(out.l1Fee, '0x1c2f');
    assert.equal(out.l1GasUsed, '0x640');
    assert.equal(out.depositNonce, '0x7');
  });

  it('does not mutate its input', () => {
    const raw = goldenRawReceipt();
    dropServiceFields(raw);

    assert.equal(raw.logsBloom !== undefined, true);
    assert.equal((raw.logs as Record<string, unknown>[])[0]!.logIndex, '0x4c');
  });

  it('leaves a non-object log element alone instead of throwing', () => {
    const out = dropServiceFields({ logs: [null, 'oops', 42] });
    assert.deepEqual(out.logs, [null, 'oops', 42]);
  });
});
