import { readFileSync, existsSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
const root = 'dist/kofutela/browser';
const pages = [
  '',
  'features',
  'landlords',
  'about',
  'security',
  'help',
  'contact',
  'privacy',
  'terms',
];
test('every public page has meaningful prerendered HTML, unique title, metadata and canonical', () => {
  const titles = new Set();
  for (const page of pages) {
    const html = readFileSync(`${root}/${page ? page + '/' : ''}index.html`, 'utf8');
    const title = html.match(/<title>(.*?)<\/title>/s)?.[1];
    assert.ok(title, page);
    assert.ok(!titles.has(title), `Duplicate title: ${page}`);
    titles.add(title);
    assert.match(html, /<h1[^>]*>/);
    assert.match(html, /name="description"/);
    assert.match(html, /property="og:image"/);
    assert.match(html, /rel="canonical"/);
    assert.ok(html.includes(`https://kofutela.web.app/${page}`));
    assert.match(html, /application\/ld\+json/);
    assert.ok(!html.includes('noindex'), page);
  }
});
test('private and demo shells are noindex and never contain real account records', () => {
  for (const path of [
    'app',
    'app/rent',
    'admin',
    'super-admin',
    'join',
    'login',
    'signup',
    'reset',
    'demo',
  ]) {
    const html = readFileSync(`${root}/${path}/index.html`, 'utf8');
    assert.match(html, /noindex, nofollow/);
    assert.ok(!html.includes('owner@example.test'));
    assert.ok(!html.includes('Test portfolio'));
    assert.ok(!html.includes('Local-test-only'));
  }
});
test('discovery and error assets are present, with private paths excluded', () => {
  for (const file of [
    'robots.txt',
    'sitemap.xml',
    'llms.txt',
    'social-card.png',
    '404.html',
    'favicon.svg',
  ])
    assert.ok(existsSync(`${root}/${file}`), file);
  const sitemap = readFileSync(`${root}/sitemap.xml`, 'utf8');
  assert.equal((sitemap.match(/<loc>/g) || []).length, pages.length);
  assert.ok(!sitemap.includes('/app'));
  const robots = readFileSync(`${root}/robots.txt`, 'utf8');
  assert.match(robots, /User-agent: GPTBot\nDisallow: \//);
  assert.match(robots, /User-agent: OAI-SearchBot/);
  assert.match(robots, /Disallow: \/app/);
});
