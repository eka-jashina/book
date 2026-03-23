/**
 * Сценарий администрирования — управление шрифтами, настройками, профилем.
 *
 * Вход → список шрифтов → добавление шрифта → глобальные настройки →
 * профиль → экспорт конфигурации.
 */

import { sleep, group } from 'k6';
import { loginUser } from '../lib/auth.js';
import { generateFont, generateSettingsUpdate } from '../lib/data.js';
import { checkOk, checkCreated } from '../lib/checks.js';
import * as api from '../lib/endpoints.js';

/**
 * @param {{ email: string, password: string }} userData
 */
export function adminFlow(userData) {
  let csrf;

  group('Admin: 01. Авторизация', () => {
    const auth = loginUser(userData.email, userData.password);
    csrf = auth.csrfToken;
  });

  sleep(0.5);

  group('Admin: 02. Список шрифтов', () => {
    const res = api.listFonts(csrf);
    checkOk(res, 'List fonts');
  });

  sleep(0.3);

  group('Admin: 03. Добавление шрифта', () => {
    const res = api.createFont(csrf, generateFont(__VU));
    checkCreated(res, 'Create font');
  });

  sleep(0.3);

  group('Admin: 04. Глобальные настройки', () => {
    const getRes = api.getSettings(csrf);
    checkOk(getRes, 'Get settings');

    const updateRes = api.updateSettings(csrf, generateSettingsUpdate());
    checkOk(updateRes, 'Update settings');
  });

  sleep(0.3);

  group('Admin: 05. Профиль', () => {
    const res = api.getProfile(csrf);
    checkOk(res, 'Get profile');
  });

  sleep(0.3);

  group('Admin: 06. Экспорт конфигурации', () => {
    const res = api.exportConfig(csrf);
    checkOk(res, 'Export config');
  });

  sleep(0.5);
}
