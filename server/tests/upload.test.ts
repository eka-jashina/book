import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from '../src/app.js';
import { cleanDatabase, createAuthenticatedAgent, createCsrfAgent } from './helpers.js';

const app = createApp();

describe('Upload API', () => {
  beforeEach(async () => { await cleanDatabase(); });

  // ─── Auth ────────────────────────────────────────────────────────────

  it('should require authentication for all endpoints', async () => {
    const { agent } = await createCsrfAgent(app);
    await agent.post('/api/v1/upload/font').expect(401);
    await agent.post('/api/v1/upload/sound').expect(401);
    await agent.post('/api/v1/upload/image').expect(401);
    await agent.post('/api/v1/upload/book').expect(401);
  });

  // ─── Font upload ─────────────────────────────────────────────────────

  it('should reject font upload without file', async () => {
    const { agent } = await createAuthenticatedAgent(app);
    await agent.post('/api/v1/upload/font').expect(400);
  });

  // ─── Sound upload ────────────────────────────────────────────────────

  it('should reject sound upload without file', async () => {
    const { agent } = await createAuthenticatedAgent(app);
    await agent.post('/api/v1/upload/sound').expect(400);
  });

  // ─── Image upload ────────────────────────────────────────────────────

  it('should reject image upload without file', async () => {
    const { agent } = await createAuthenticatedAgent(app);
    await agent.post('/api/v1/upload/image').expect(400);
  });

  // ─── Book upload / parse ─────────────────────────────────────────────

  it('should reject book upload without file', async () => {
    const { agent } = await createAuthenticatedAgent(app);
    await agent.post('/api/v1/upload/book').expect(400);
  });

  it('should parse uploaded TXT file', async () => {
    const { agent } = await createAuthenticatedAgent(app);
    const content = 'Первый абзац текста.\n\nВторой абзац текста.\n\nТретий абзац.';
    const res = await agent
      .post('/api/v1/upload/book')
      .attach('file', Buffer.from(content, 'utf-8'), { filename: 'test-book.txt', contentType: 'text/plain' })
      .expect(200);

    expect(res.body.data.title).toBe('test-book');
    expect(res.body.data.author).toBe('');
    expect(res.body.data.chapters).toHaveLength(1);
    expect(res.body.data.chapters[0].id).toBe('chapter_1');
    expect(res.body.data.chapters[0].html).toContain('<article>');
    expect(res.body.data.chapters[0].html).toContain('Первый абзац текста.');
    expect(res.body.data.chapters[0].html).toContain('Второй абзац текста.');
  });

  it('should reject empty TXT file', async () => {
    const { agent } = await createAuthenticatedAgent(app);
    const res = await agent
      .post('/api/v1/upload/book')
      .attach('file', Buffer.from('', 'utf-8'), { filename: 'empty.txt', contentType: 'text/plain' })
      .expect(400);

    expect(res.body.error).toBeDefined();
  });

  it('should parse FB2 file', async () => {
    const { agent } = await createAuthenticatedAgent(app);
    const fb2Content = `<?xml version="1.0" encoding="utf-8"?>
<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0">
  <description>
    <title-info>
      <author><first-name>Иван</first-name><last-name>Петров</last-name></author>
      <book-title>Тестовая книга</book-title>
    </title-info>
  </description>
  <body>
    <section>
      <title><p>Глава первая</p></title>
      <p>Текст первой главы.</p>
      <p>Второй абзац первой главы.</p>
    </section>
    <section>
      <title><p>Глава вторая</p></title>
      <p>Текст второй главы.</p>
    </section>
  </body>
</FictionBook>`;

    const res = await agent
      .post('/api/v1/upload/book')
      .attach('file', Buffer.from(fb2Content, 'utf-8'), { filename: 'test.fb2', contentType: 'application/xml' })
      .expect(200);

    expect(res.body.data.title).toBe('Тестовая книга');
    expect(res.body.data.author).toBe('Иван Петров');
    expect(res.body.data.chapters).toHaveLength(2);
    expect(res.body.data.chapters[0].title).toBe('Глава первая');
    expect(res.body.data.chapters[0].html).toContain('Текст первой главы.');
    expect(res.body.data.chapters[1].title).toBe('Глава вторая');
    expect(res.body.data.chapters[1].html).toContain('Текст второй главы.');
  });

  it('should reject unsupported book format', async () => {
    const { agent } = await createAuthenticatedAgent(app);
    const res = await agent
      .post('/api/v1/upload/book')
      .attach('file', Buffer.from('data'), { filename: 'test.pdf', contentType: 'application/octet-stream' })
      .expect(400);

    expect(res.body.error).toBeDefined();
  });

  it('should parse TXT with single paragraph', async () => {
    const { agent } = await createAuthenticatedAgent(app);
    const content = 'Одинокий абзац без разделителей.';
    const res = await agent
      .post('/api/v1/upload/book')
      .attach('file', Buffer.from(content, 'utf-8'), { filename: 'single.txt', contentType: 'text/plain' })
      .expect(200);

    expect(res.body.data.chapters).toHaveLength(1);
    expect(res.body.data.chapters[0].html).toContain('Одинокий абзац');
  });

  it('should handle FB2 with emphasis and strong formatting', async () => {
    const { agent } = await createAuthenticatedAgent(app);
    const fb2Content = `<?xml version="1.0" encoding="utf-8"?>
<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0">
  <description>
    <title-info>
      <book-title>Форматирование</book-title>
    </title-info>
  </description>
  <body>
    <section>
      <title><p>Глава</p></title>
      <p>Текст с <emphasis>курсивом</emphasis> и <strong>жирным</strong>.</p>
    </section>
  </body>
</FictionBook>`;

    const res = await agent
      .post('/api/v1/upload/book')
      .attach('file', Buffer.from(fb2Content, 'utf-8'), { filename: 'fmt.fb2', contentType: 'application/xml' })
      .expect(200);

    expect(res.body.data.chapters[0].html).toContain('<em>курсивом</em>');
    expect(res.body.data.chapters[0].html).toContain('<strong>жирным</strong>');
  });
});
