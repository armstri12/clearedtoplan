import assert from 'node:assert';
import test from 'node:test';
import { buildBriefingMarkdown } from '../briefing/export.js';
import { buildDemoBriefingSnapshot } from '../fixtures/demoSnapshots.js';

test('buildBriefingMarkdown assembles headings, route, and weather snippets', () => {
  const snapshot = buildDemoBriefingSnapshot();
  const markdown = buildBriefingMarkdown(snapshot);

  assert.match(markdown, /^# /);
  assert.ok(markdown.includes('## Route & Timing'));
  assert.ok(markdown.includes('KJYO'));
  assert.ok(markdown.includes('KHEF'));
  assert.ok(markdown.includes('METAR'));
  assert.ok(markdown.includes('TAF'));
  assert.ok(markdown.includes('Performance & Loading'));
});
