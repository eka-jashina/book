/**
 * Обёртки для всех API-эндпоинтов Flipbook.
 * Абстрагируют URL-конструирование и заголовки.
 *
 * Маршруты соответствуют server/src/app.ts (API v1).
 */

import http from 'k6/http';
import { API_V1, API_HEALTH } from './config.js';
import { authHeaders } from './auth.js';

// ── Health ──────────────────────────────────────────────────
export function healthCheck() {
  return http.get(API_HEALTH);
}

// ── Books ───────────────────────────────────────────────────
export function listBooks(csrf) {
  return http.get(`${API_V1}/books`, { headers: authHeaders(csrf) });
}

export function createBook(csrf, data) {
  return http.post(`${API_V1}/books`, JSON.stringify(data), {
    headers: authHeaders(csrf),
  });
}

export function getBook(csrf, bookId) {
  return http.get(`${API_V1}/books/${bookId}`, { headers: authHeaders(csrf) });
}

export function updateBook(csrf, bookId, data) {
  return http.patch(`${API_V1}/books/${bookId}`, JSON.stringify(data), {
    headers: authHeaders(csrf),
  });
}

export function deleteBook(csrf, bookId) {
  return http.del(`${API_V1}/books/${bookId}`, null, {
    headers: authHeaders(csrf),
  });
}

// ── Chapters ────────────────────────────────────────────────
export function listChapters(csrf, bookId) {
  return http.get(`${API_V1}/books/${bookId}/chapters`, {
    headers: authHeaders(csrf),
  });
}

export function createChapter(csrf, bookId, data) {
  return http.post(`${API_V1}/books/${bookId}/chapters`, JSON.stringify(data), {
    headers: authHeaders(csrf),
  });
}

export function getChapterContent(csrf, bookId, chapterId) {
  return http.get(`${API_V1}/books/${bookId}/chapters/${chapterId}/content`, {
    headers: authHeaders(csrf),
  });
}

// ── Progress ────────────────────────────────────────────────
export function getProgress(csrf, bookId) {
  return http.get(`${API_V1}/books/${bookId}/progress`, {
    headers: authHeaders(csrf),
  });
}

export function saveProgress(csrf, bookId, data) {
  return http.put(`${API_V1}/books/${bookId}/progress`, JSON.stringify(data), {
    headers: authHeaders(csrf),
  });
}

// ── Appearance ──────────────────────────────────────────────
export function getAppearance(csrf, bookId) {
  return http.get(`${API_V1}/books/${bookId}/appearance`, {
    headers: authHeaders(csrf),
  });
}

export function updateAppearance(csrf, bookId, data) {
  return http.patch(`${API_V1}/books/${bookId}/appearance`, JSON.stringify(data), {
    headers: authHeaders(csrf),
  });
}

// ── Sounds ──────────────────────────────────────────────────
export function getSounds(csrf, bookId) {
  return http.get(`${API_V1}/books/${bookId}/sounds`, {
    headers: authHeaders(csrf),
  });
}

// ── Ambients ────────────────────────────────────────────────
export function listAmbients(csrf, bookId) {
  return http.get(`${API_V1}/books/${bookId}/ambients`, {
    headers: authHeaders(csrf),
  });
}

export function createAmbient(csrf, bookId, data) {
  return http.post(`${API_V1}/books/${bookId}/ambients`, JSON.stringify(data), {
    headers: authHeaders(csrf),
  });
}

// ── Fonts ───────────────────────────────────────────────────
export function listFonts(csrf) {
  return http.get(`${API_V1}/fonts`, { headers: authHeaders(csrf) });
}

export function createFont(csrf, data) {
  return http.post(`${API_V1}/fonts`, JSON.stringify(data), {
    headers: authHeaders(csrf),
  });
}

// ── Settings ────────────────────────────────────────────────
export function getSettings(csrf) {
  return http.get(`${API_V1}/settings`, { headers: authHeaders(csrf) });
}

export function updateSettings(csrf, data) {
  return http.patch(`${API_V1}/settings`, JSON.stringify(data), {
    headers: authHeaders(csrf),
  });
}

// ── Profile ─────────────────────────────────────────────────
export function getProfile(csrf) {
  return http.get(`${API_V1}/profile`, { headers: authHeaders(csrf) });
}

// ── Export/Import ───────────────────────────────────────────
export function exportConfig(csrf) {
  return http.get(`${API_V1}/export`, { headers: authHeaders(csrf) });
}

// ── Public (без аутентификации) ─────────────────────────────
export function discoverBooks(limit, offset) {
  const params = [];
  if (limit) params.push(`limit=${limit}`);
  if (offset) params.push(`offset=${offset}`);
  const qs = params.length ? `?${params.join('&')}` : '';
  return http.get(`${API_V1}/public/discover${qs}`);
}

export function getPublicShelf(username) {
  return http.get(`${API_V1}/public/shelves/${username}`);
}

export function getPublicBook(bookId) {
  return http.get(`${API_V1}/public/books/${bookId}`);
}

export function getPublicChapterContent(bookId, chapterId) {
  return http.get(`${API_V1}/public/books/${bookId}/chapters/${chapterId}/content`);
}
