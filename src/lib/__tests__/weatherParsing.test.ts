import assert from 'node:assert';
import test from 'node:test';
import { parseIcaoCode } from '../../services/aviationApi.js';
import { fetchMetarFromWorker } from '../../services/weather.js';

test('parseIcaoCode normalizes input and rejects invalid strings', () => {
  assert.strictEqual(parseIcaoCode('kjyo'), 'KJYO');
  assert.strictEqual(parseIcaoCode(' KHEF '), 'KHEF');
  assert.strictEqual(parseIcaoCode('1234'), null);
  assert.strictEqual(parseIcaoCode('KABC1'), null);
});

test('fetchMetarFromWorker rejects when weather API URL is missing', async () => {
  await assert.rejects(
    () => fetchMetarFromWorker('KJYO'),
    /Weather API URL not configured/i,
  );
});
