import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFragment } from 'parse5';
import { validateBlogAuthors, isApprovedComingSoon } from './seo-audit-rules.mjs';

test('single and multiple authors are validated without allowing missing coauthors or incorrect affiliations', () => {
  const authors = Object.fromEntries(['first', 'second'].map(id => [id, {name:{zh:id,en:id},role:{zh:'经理',en:'Manager'}}]));
  for (const language of ['zh','en']) for (const ids of [['first'],['first','second']]) {
    const people = ids.map(id => ({'@type':'Person','@id':`https://example.com/#person-${id}`,name:id,jobTitle:authors[id].role[language],url:`https://example.com${language === 'en' ? '/en' : ''}/contact/#${id}`,worksFor:{'@id':'org'}}));
    const input = {blog:{authorId:ids[0],coauthorIds:ids.slice(1)},authors,language,origin:'https://example.com',organizationId:'org',schemaAuthor:people.length === 1 ? people[0] : people,bylines:ids.map(id=>({name:id,role:authors[id].role[language]})),metaAuthor:ids[0]};
    assert.deepEqual(validateBlogAuthors(input), []);
    const bad = structuredClone(input);
    if (Array.isArray(bad.schemaAuthor)) bad.schemaAuthor.pop();
    else bad.schemaAuthor.worksFor['@id'] = 'wrong-org';
    assert.ok(validateBlogAuthors(bad).length > 0);
    assert.ok(validateBlogAuthors({...input,bylines:[]}).length > 0);
  }
});

test('only intentional labels on registered upcoming cards are exempt from placeholder checks', () => {
  const check = (html, value) => {
    const doc = parseFragment(html);
    let text;
    const walk = node => {if(node.nodeName === '#text') text = node;node.childNodes?.forEach(walk);};
    walk(doc);
    return isApprovedComingSoon(text, value, new Set(['planned-product']));
  };
  const card = label => `<article class="series-product-card is-upcoming" data-product-slug="planned-product">${label}</article>`;
  assert.equal(check(card('<span class="series-product-code">COMING SOON</span>'),'COMING SOON'), true);
  assert.equal(check(card('<span class="sku-card-link is-disabled" aria-disabled="true">COMING SOON</span>'),'COMING SOON'), true);
  assert.equal(check(card('<p>COMING SOON</p>'),'COMING SOON'), false);
  assert.equal(check(card('<span class="series-product-code">TODO COMING SOON</span>'),'TODO COMING SOON'), false);
  assert.equal(check('<article class="is-upcoming" data-product-slug="unknown"><span class="series-product-code">COMING SOON</span></article>','COMING SOON'), false);
});
