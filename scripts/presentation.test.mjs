import test from 'node:test';
import assert from 'node:assert/strict';
import { youtubeEmbed } from '../src/utils/video.mjs';
import { glossarySchemaDescription, glossaryMetaDescription, publishedTerms } from '../src/utils/glossary.mjs';

test('YouTube embeds use a validated video ID with a local-poster friendly watch fallback', () => {
  assert.deepEqual(youtubeEmbed('https://www.youtube.com/embed/ITKhuZj8qho'), {
    src: 'https://www.youtube-nocookie.com/embed/ITKhuZj8qho?autoplay=1&rel=0',
    watch: 'https://www.youtube.com/watch?v=ITKhuZj8qho'
  });
  for (const value of ['javascript:alert(1)', 'https://evil.example/embed/ITKhuZj8qho', 'http://www.youtube.com/embed/ITKhuZj8qho', 'https://www.youtube.com/embed/not-an-id']) {
    assert.throws(() => youtubeEmbed(value));
  }
});

test('GMP Schema retains the complete visible definition while search metadata remains separate', () => {
  const gmp = publishedTerms.find(term => term.slug === 'gmp');
  const definition = glossarySchemaDescription(gmp, 'en');
  assert.ok(definition.length > 180);
  assert.ok(definition.includes('Different product categories, countries and regions'));
  assert.ok(!/\[\d+\]/.test(definition));
  assert.ok(glossaryMetaDescription(gmp, 'en').length <= 180);
  for (const term of publishedTerms) for (const lang of ['zh', 'en']) {
    const result = glossarySchemaDescription(term, lang);
    assert.ok(result.length > 0, `${term.slug} ${lang}`);
    for (const paragraph of term.definition?.[lang] || []) {
      const normalized = paragraph.replace(/\s+/g, ' ').trim().replace(/\[\d+\]/g, '').replace(/^\*\s*/, '');
      assert.ok(result.includes(normalized), `${term.slug} ${lang}: missing definition content`);
    }
  }
});
