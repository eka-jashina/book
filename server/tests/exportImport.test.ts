import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { cleanDatabase, createAuthenticatedAgent, createCsrfAgent } from './helpers.js';

const app = createApp();

describe('Export/Import API', () => {
  beforeEach(async () => { await cleanDatabase(); });

  // ─── Export ────────────────────────────────────────────────────────

  it('should export empty config', async () => {
    const { agent } = await createAuthenticatedAgent(app);
    const res = await agent.get('/api/v1/export').expect(200);
    expect(res.body.data.books).toEqual([]);
    expect(res.body.data.readingFonts).toEqual([]);
    // Registration auto-creates default global settings
    expect(res.body.data.globalSettings).toEqual({
      fontMin: 14,
      fontMax: 22,
      settingsVisibility: {
        fontSize: true, theme: true, font: true,
        fullscreen: true, sound: true, ambient: true,
      },
    });
  });

  it('should include Content-Disposition header', async () => {
    const { agent } = await createAuthenticatedAgent(app);
    const res = await agent.get('/api/v1/export').expect(200);
    expect(res.headers['content-disposition']).toContain('attachment');
  });

  it('should export books with chapters', async () => {
    const { agent } = await createAuthenticatedAgent(app);
    const bookRes = await agent.post('/api/v1/books').send({ title: 'My Book', author: 'Me' }).expect(201);
    await agent.post(`/api/v1/books/${bookRes.body.data.id}/chapters`).send({ title: 'Ch 1', htmlContent: '<p>Hi</p>' }).expect(201);
    const res = await agent.get('/api/v1/export').expect(200);
    expect(res.body.data.books).toHaveLength(1);
    expect(res.body.data.books[0].chapters).toHaveLength(1);
  });

  it('should export book with appearance and sounds', async () => {
    const { agent } = await createAuthenticatedAgent(app);
    const bookRes = await agent.post('/api/v1/books').send({ title: 'Styled' }).expect(201);
    const bookId = bookRes.body.data.id;

    // Update appearance
    await agent.patch(`/api/v1/books/${bookId}/appearance/light`).send({ coverBgStart: '#ff0000' }).expect(200);
    // Update sounds
    await agent.patch(`/api/v1/books/${bookId}/sounds`).send({ pageFlip: 'custom/flip.mp3' }).expect(200);

    const res = await agent.get('/api/v1/export').expect(200);
    expect(res.body.data.books[0].appearance.light.coverBgStart).toBe('#ff0000');
    expect(res.body.data.books[0].sounds.pageFlip).toBe('custom/flip.mp3');
  });

  it('should export book with ambients and decorative font', async () => {
    const { agent } = await createAuthenticatedAgent(app);
    const bookRes = await agent.post('/api/v1/books').send({ title: 'Full' }).expect(201);
    const bookId = bookRes.body.data.id;

    // Add ambient
    await agent.post(`/api/v1/books/${bookId}/ambients`).send({ ambientKey: 'rain', label: 'Rain' }).expect(201);
    // Add decorative font
    await agent.put(`/api/v1/books/${bookId}/decorative-font`).send({ name: 'Fancy', fileUrl: 'fonts/fancy.woff2' }).expect(200);

    const res = await agent.get('/api/v1/export').expect(200);
    expect(res.body.data.books[0].ambients.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.books[0].decorativeFont).toEqual({ name: 'Fancy', fileUrl: 'fonts/fancy.woff2' });
  });

  it('should export reading fonts', async () => {
    const { agent } = await createAuthenticatedAgent(app);
    await agent.post('/api/v1/fonts').send({ fontKey: 'custom', label: 'Custom Font', family: 'CustomFont' }).expect(201);

    const res = await agent.get('/api/v1/export').expect(200);
    expect(res.body.data.readingFonts).toHaveLength(1);
    expect(res.body.data.readingFonts[0].fontKey).toBe('custom');
  });

  it('should not leak data between users', async () => {
    const { agent: agent1 } = await createAuthenticatedAgent(app);
    await agent1.post('/api/v1/books').send({ title: 'User1 Book' }).expect(201);

    const { agent: agent2 } = await createAuthenticatedAgent(app, { email: 'user2@test.com' });
    const res = await agent2.get('/api/v1/export').expect(200);
    expect(res.body.data.books).toHaveLength(0);
  });

  // ─── Import ───────────────────────────────────────────────────────

  it('should import books and fonts', async () => {
    const { agent } = await createAuthenticatedAgent(app);
    const importData = {
      books: [{ title: 'Imported', author: 'A', cover: { bg: '', bgMobile: '', bgMode: 'default', bgCustomUrl: null }, chapters: [{ title: 'Ch 1', position: 0, filePath: null, hasHtmlContent: false, bg: '', bgMobile: '' }], defaultSettings: null, appearance: null, sounds: null, ambients: [], decorativeFont: null }],
      readingFonts: [{ fontKey: 'georgia', label: 'Georgia', family: 'Georgia', builtin: true, enabled: true, fileUrl: null, position: 0 }],
      globalSettings: { fontMin: 12, fontMax: 28, settingsVisibility: { fontSize: true, theme: true, font: true, fullscreen: false, sound: true, ambient: false } },
    };
    const res = await agent.post('/api/v1/import').send(importData).expect(200);
    expect(res.body.data.imported.books).toBe(1);
    expect(res.body.data.imported.fonts).toBe(1);

    const exp = await agent.get('/api/v1/export').expect(200);
    expect(exp.body.data.books).toHaveLength(1);
    expect(exp.body.data.readingFonts).toHaveLength(1);
    expect(exp.body.data.globalSettings?.fontMin).toBe(12);
  });

  it('should import book with full appearance', async () => {
    const { agent } = await createAuthenticatedAgent(app);
    const importData = {
      books: [{
        title: 'Styled Import', author: 'B',
        cover: { bg: '', bgMobile: '', bgMode: 'default', bgCustomUrl: null },
        chapters: [],
        defaultSettings: { font: 'arial', fontSize: 16, theme: 'dark', soundEnabled: false, soundVolume: 0.5, ambientType: 'rain', ambientVolume: 0.8 },
        appearance: {
          fontMin: 12, fontMax: 24,
          light: { coverBgStart: '#aaa', coverBgEnd: '#bbb', coverText: '#ccc', coverBgImageUrl: null, pageTexture: 'default', customTextureUrl: null, bgPage: '#fff', bgApp: '#eee' },
          dark: { coverBgStart: '#111', coverBgEnd: '#222', coverText: '#ddd', coverBgImageUrl: null, pageTexture: 'none', customTextureUrl: null, bgPage: '#1e1e1e', bgApp: '#121212' },
        },
        sounds: { pageFlip: 'sounds/custom.mp3', bookOpen: 'sounds/open.mp3', bookClose: 'sounds/close.mp3' },
        ambients: [{ ambientKey: 'rain', label: 'Rain', shortLabel: 'Rain', icon: '🌧', fileUrl: null, visible: true, builtin: true, position: 0 }],
        decorativeFont: { name: 'Fancy', fileUrl: 'fonts/fancy.woff2' },
      }],
      readingFonts: [],
      globalSettings: null,
    };
    const res = await agent.post('/api/v1/import').send(importData).expect(200);
    expect(res.body.data.imported.books).toBe(1);

    const exp = await agent.get('/api/v1/export').expect(200);
    const book = exp.body.data.books[0];
    expect(book.appearance.fontMin).toBe(12);
    expect(book.appearance.light.coverBgStart).toBe('#aaa');
    expect(book.sounds.pageFlip).toBe('sounds/custom.mp3');
    expect(book.ambients).toHaveLength(1);
    expect(book.decorativeFont.name).toBe('Fancy');
    expect(book.defaultSettings.font).toBe('arial');
    expect(book.defaultSettings.theme).toBe('dark');
  });

  it('should import multiple books', async () => {
    const { agent } = await createAuthenticatedAgent(app);
    const makeBook = (title: string) => ({
      title, author: '', cover: { bg: '', bgMobile: '', bgMode: 'default', bgCustomUrl: null },
      chapters: [], defaultSettings: null, appearance: null, sounds: null, ambients: [], decorativeFont: null,
    });
    const importData = {
      books: [makeBook('Book A'), makeBook('Book B'), makeBook('Book C')],
      readingFonts: [],
      globalSettings: null,
    };
    const res = await agent.post('/api/v1/import').send(importData).expect(200);
    expect(res.body.data.imported.books).toBe(3);

    const exp = await agent.get('/api/v1/export').expect(200);
    expect(exp.body.data.books).toHaveLength(3);
  });

  it('should import global settings visibility flags', async () => {
    const { agent } = await createAuthenticatedAgent(app);
    const importData = {
      books: [],
      readingFonts: [],
      globalSettings: {
        fontMin: 10, fontMax: 30,
        settingsVisibility: { fontSize: false, theme: false, font: true, fullscreen: false, sound: false, ambient: true },
      },
    };
    await agent.post('/api/v1/import').send(importData).expect(200);

    const exp = await agent.get('/api/v1/export').expect(200);
    expect(exp.body.data.globalSettings.fontMin).toBe(10);
    expect(exp.body.data.globalSettings.fontMax).toBe(30);
    expect(exp.body.data.globalSettings.settingsVisibility.fontSize).toBe(false);
    expect(exp.body.data.globalSettings.settingsVisibility.ambient).toBe(true);
  });

  // ─── Validation ───────────────────────────────────────────────────

  it('should reject invalid payload', async () => {
    const { agent } = await createAuthenticatedAgent(app);
    await agent.post('/api/v1/import').send({ invalid: 'data' }).expect(400);
  });

  it('should reject empty body', async () => {
    const { agent } = await createAuthenticatedAgent(app);
    await agent.post('/api/v1/import').send({}).expect(400);
  });

  // ─── Auth ─────────────────────────────────────────────────────────

  it('should require authentication for export', async () => {
    await request(app).get('/api/v1/export').expect(401);
  });

  it('should require authentication for import', async () => {
    const { agent } = await createCsrfAgent(app);
    await agent.post('/api/v1/import').send({ books: [] }).expect(401);
  });
});
