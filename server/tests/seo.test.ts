import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from '../src/app.js';
import { cleanDatabase, createAuthenticatedAgent } from './helpers.js';
import { buildOgTags, getBookOgMeta, getShelfOgMeta, injectOgTags, generateSitemap } from '../src/services/seo.service.js';

const app = createApp();

describe('SEO Service', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  // ── buildOgTags ──────────────────────────────────────────────

  describe('buildOgTags', () => {
    it('should generate OG and Twitter meta tags', () => {
      const meta = {
        title: 'Test Book',
        description: 'A great book',
        url: 'http://localhost:3000/book/123',
        image: 'http://example.com/cover.jpg',
        type: 'book',
      };

      const result = buildOgTags(meta);

      expect(result).toContain('og:type');
      expect(result).toContain('content="book"');
      expect(result).toContain('og:title');
      expect(result).toContain('content="Test Book"');
      expect(result).toContain('og:description');
      expect(result).toContain('content="A great book"');
      expect(result).toContain('og:url');
      expect(result).toContain('og:image');
      expect(result).toContain('content="http://example.com/cover.jpg"');
      expect(result).toContain('og:site_name');
      expect(result).toContain('twitter:card');
      expect(result).toContain('twitter:title');
      expect(result).toContain('twitter:description');
      expect(result).toContain('twitter:image');
    });

    it('should use default image when image is null', () => {
      const meta = {
        title: 'No Cover',
        description: 'desc',
        url: 'http://localhost:3000/book/1',
        image: null,
        type: 'book',
      };

      const result = buildOgTags(meta);

      expect(result).toContain('/icons/icon-512.png');
    });

    it('should escape HTML special characters', () => {
      const meta = {
        title: 'Book <script>alert("xss")</script>',
        description: 'A "great" book & more',
        url: 'http://localhost:3000/book/1',
        image: null,
        type: 'book',
      };

      const result = buildOgTags(meta);

      expect(result).not.toContain('<script>');
      expect(result).toContain('&lt;script&gt;');
      expect(result).toContain('&amp; more');
      expect(result).toContain('&quot;great&quot;');
    });

    it('should include locale when provided', () => {
      const meta = {
        title: 'Test',
        description: 'desc',
        url: 'http://localhost:3000',
        image: null,
        type: 'book',
        locale: 'ru_RU',
      };

      const result = buildOgTags(meta);

      expect(result).toContain('og:locale');
      expect(result).toContain('ru_RU');
    });

    it('should not include locale when not provided', () => {
      const meta = {
        title: 'Test',
        description: 'desc',
        url: 'http://localhost:3000',
        image: null,
        type: 'book',
      };

      const result = buildOgTags(meta);

      expect(result).not.toContain('og:locale');
    });
  });

  // ── getBookOgMeta ────────────────────────────────────────────

  describe('getBookOgMeta', () => {
    it('should return meta for a published book', async () => {
      const { agent } = await createAuthenticatedAgent(app);

      const bookRes = await agent
        .post('/api/v1/books')
        .send({ title: 'Public Book', author: 'Author Name' })
        .expect(201);
      const bookId = bookRes.body.data.id;

      // Publish the book
      await agent
        .patch(`/api/v1/books/${bookId}`)
        .send({ visibility: 'published' })
        .expect(200);

      const meta = await getBookOgMeta(bookId);

      expect(meta).not.toBeNull();
      expect(meta!.title).toContain('Public Book');
      expect(meta!.type).toBe('book');
      expect(meta!.url).toContain(`/book/${bookId}`);
    });

    it('should return null for a draft book', async () => {
      const { agent } = await createAuthenticatedAgent(app);

      const bookRes = await agent
        .post('/api/v1/books')
        .send({ title: 'Draft Book' })
        .expect(201);

      const meta = await getBookOgMeta(bookRes.body.data.id);

      expect(meta).toBeNull();
    });

    it('should return null for a deleted book', async () => {
      const { agent } = await createAuthenticatedAgent(app);

      const bookRes = await agent
        .post('/api/v1/books')
        .send({ title: 'Deleted Book' })
        .expect(201);
      const bookId = bookRes.body.data.id;

      await agent
        .patch(`/api/v1/books/${bookId}`)
        .send({ visibility: 'published' })
        .expect(200);

      await agent.delete(`/api/v1/books/${bookId}`).expect(204);

      const meta = await getBookOgMeta(bookId);

      expect(meta).toBeNull();
    });

    it('should return null for non-existent book', async () => {
      const meta = await getBookOgMeta('00000000-0000-0000-0000-000000000000');
      expect(meta).toBeNull();
    });

    it('should use description when available', async () => {
      const { agent } = await createAuthenticatedAgent(app);

      const bookRes = await agent
        .post('/api/v1/books')
        .send({ title: 'Book With Desc', author: 'Author' })
        .expect(201);
      const bookId = bookRes.body.data.id;

      await agent
        .patch(`/api/v1/books/${bookId}`)
        .send({ visibility: 'published', description: 'Custom description text' })
        .expect(200);

      const meta = await getBookOgMeta(bookId);

      expect(meta!.description).toBe('Custom description text');
    });

    it('should truncate long descriptions to 200 chars', async () => {
      const { agent } = await createAuthenticatedAgent(app);

      const longDesc = 'A'.repeat(300);
      const bookRes = await agent
        .post('/api/v1/books')
        .send({ title: 'Long Desc Book', author: 'Author' })
        .expect(201);
      const bookId = bookRes.body.data.id;

      await agent
        .patch(`/api/v1/books/${bookId}`)
        .send({ visibility: 'published', description: longDesc })
        .expect(200);

      const meta = await getBookOgMeta(bookId);

      expect(meta!.description).toHaveLength(200);
    });
  });

  // ── getShelfOgMeta ───────────────────────────────────────────

  describe('getShelfOgMeta', () => {
    it('should return meta for user with username', async () => {
      const username = `seouser-${Date.now()}`;
      await createAuthenticatedAgent(app, { username });

      const meta = await getShelfOgMeta(username);

      expect(meta).not.toBeNull();
      expect(meta!.type).toBe('profile');
      expect(meta!.url).toContain(`/${username}`);
    });

    it('should return null for non-existent username', async () => {
      const meta = await getShelfOgMeta('nonexistent-user-xyz');
      expect(meta).toBeNull();
    });

    it('should include bio when available', async () => {
      const username = `biouser-${Date.now()}`;
      const { agent } = await createAuthenticatedAgent(app, { username });

      await agent
        .put('/api/v1/profile')
        .send({ bio: 'I love reading books' })
        .expect(200);

      const meta = await getShelfOgMeta(username);

      expect(meta!.description).toBe('I love reading books');
    });

    it('should use displayName in title', async () => {
      const username = `dispuser-${Date.now()}`;
      await createAuthenticatedAgent(app, {
        username,
        displayName: 'Display Name',
      });

      const meta = await getShelfOgMeta(username);

      expect(meta!.title).toContain('Display Name');
    });
  });

  // ── injectOgTags ─────────────────────────────────────────────

  describe('injectOgTags', () => {
    const sampleHtml = `<!DOCTYPE html>
<html>
<head>
  <title>Flipbook</title>
  <meta name="description" content="Default description">
  <link rel="canonical" href="http://localhost:3000/">
</head>
<body></body>
</html>`;

    it('should inject OG tags before </head>', () => {
      const meta = {
        title: 'My Book',
        description: 'Book description',
        url: 'http://localhost:3000/book/123',
        image: 'http://example.com/img.jpg',
        type: 'book',
      };

      const result = injectOgTags(sampleHtml, meta);

      expect(result).toContain('og:title');
      expect(result).toContain('content="My Book"');
      expect(result).toContain('og:description');
      // Tags should be before </head>
      const headEnd = result.indexOf('</head>');
      const ogTitle = result.indexOf('og:title');
      expect(ogTitle).toBeLessThan(headEnd);
    });

    it('should update <title> tag', () => {
      const meta = {
        title: 'Custom Title',
        description: 'desc',
        url: 'http://localhost:3000/book/1',
        image: null,
        type: 'book',
      };

      const result = injectOgTags(sampleHtml, meta);

      expect(result).toContain('<title>Custom Title</title>');
      expect(result).not.toContain('<title>Flipbook</title>');
    });

    it('should update meta description', () => {
      const meta = {
        title: 'Title',
        description: 'New description',
        url: 'http://localhost:3000/book/1',
        image: null,
        type: 'book',
      };

      const result = injectOgTags(sampleHtml, meta);

      expect(result).toContain('content="New description"');
      expect(result).not.toContain('content="Default description"');
    });

    it('should update canonical URL', () => {
      const meta = {
        title: 'Title',
        description: 'desc',
        url: 'http://localhost:3000/book/abc',
        image: null,
        type: 'book',
      };

      const result = injectOgTags(sampleHtml, meta);

      expect(result).toContain('href="http://localhost:3000/book/abc"');
    });
  });

  // ── generateSitemap ──────────────────────────────────────────

  describe('generateSitemap', () => {
    it('should generate valid XML sitemap', async () => {
      const xml = await generateSitemap();

      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
      expect(xml).toContain('</urlset>');
    });

    it('should always include the root URL', async () => {
      const xml = await generateSitemap();

      expect(xml).toContain('<priority>1.0</priority>');
      expect(xml).toContain('<changefreq>daily</changefreq>');
    });

    it('should include published books', async () => {
      const { agent } = await createAuthenticatedAgent(app);

      const bookRes = await agent
        .post('/api/v1/books')
        .send({ title: 'Sitemap Book' })
        .expect(201);

      await agent
        .patch(`/api/v1/books/${bookRes.body.data.id}`)
        .send({ visibility: 'published' })
        .expect(200);

      const xml = await generateSitemap();

      expect(xml).toContain(`/book/${bookRes.body.data.id}`);
    });

    it('should not include draft books', async () => {
      const { agent } = await createAuthenticatedAgent(app);

      const bookRes = await agent
        .post('/api/v1/books')
        .send({ title: 'Draft Sitemap Book' })
        .expect(201);

      const xml = await generateSitemap();

      expect(xml).not.toContain(`/book/${bookRes.body.data.id}`);
    });

    it('should include author shelves with published books', async () => {
      const username = `sitemapauthor-${Date.now()}`;
      const { agent } = await createAuthenticatedAgent(app, { username });

      const bookRes = await agent
        .post('/api/v1/books')
        .send({ title: 'Published' })
        .expect(201);

      await agent
        .patch(`/api/v1/books/${bookRes.body.data.id}`)
        .send({ visibility: 'published' })
        .expect(200);

      const xml = await generateSitemap();

      expect(xml).toContain(`/${username}`);
    });

    it('should not include deleted books', async () => {
      const { agent } = await createAuthenticatedAgent(app);

      const bookRes = await agent
        .post('/api/v1/books')
        .send({ title: 'Deleted Sitemap Book' })
        .expect(201);
      const bookId = bookRes.body.data.id;

      await agent
        .patch(`/api/v1/books/${bookId}`)
        .send({ visibility: 'published' })
        .expect(200);

      await agent.delete(`/api/v1/books/${bookId}`).expect(204);

      const xml = await generateSitemap();

      expect(xml).not.toContain(`/book/${bookId}`);
    });
  });
});
