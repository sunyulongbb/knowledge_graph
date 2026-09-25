import { expect, test } from 'bun:test';
import { buildJevQuestions } from '../src/server/routes/jev.ts';
import { normalizeClassAnalyses } from '../src/server/routes/schema.ts';

test('buildJevQuestions uses custom angle criteria when present', () => {
  const questions = buildJevQuestions([
    {
      angle: '对华总体态度',
      content: '判断是否支持扩大合作',
      keywords: ['合作', '贸易'],
      category: '外交',
      criteria: {
        '支持合作': '明确支持扩大合作与互惠安排',
        '谨慎观望': '保持观察、低调接触、不急于做出明确承诺',
        '信息不足': '缺乏足够证据',
      },
    },
  ]);

  expect(questions.profile_0).toMatchObject({
    type: 'choice',
    criteria: {
      '支持合作': '明确支持扩大合作与互惠安排',
      '谨慎观望': '保持观察、低调接触、不急于做出明确承诺',
      '信息不足': '缺乏足够证据',
    },
  });
});

test('buildJevQuestions falls back to default criteria when custom ones are missing', () => {
  const questions = buildJevQuestions([
    { angle: '经贸态度', content: '分析经贸偏向', keywords: ['关税'], category: '经济' },
  ]);

  expect(questions.profile_0.criteria).toMatchObject({
    '积极支持': expect.any(String),
    '信息不足': expect.any(String),
  });
});

test('legacy single-object class analyses still hydrate and echo', () => {
  const legacy = {
    angle: '对华总体态度',
    content: '分析在对华议题上的立场',
    keywords: ['中国', '贸易'],
    criteria: {
      '支持合作': '明确支持扩大合作与互惠安排',
      '信息不足': '缺乏足够证据',
    },
  };

  const result = normalizeClassAnalyses(legacy, false);

  expect(result).toEqual([
    {
      angle: '对华总体态度',
      content: '分析在对华议题上的立场',
      keywords: ['中国', '贸易'],
      criteria: {
        '支持合作': '明确支持扩大合作与互惠安排',
        '信息不足': '缺乏足够证据',
      },
    },
  ]);
});
