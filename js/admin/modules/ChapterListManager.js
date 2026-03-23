/**
 * Менеджер списка глав
 * CRUD, сортировка (вверх/вниз), рендер карточек, drag&drop-обработка кликов.
 * Извлечён из ChaptersModule для разделения ответственности.
 */
import { t } from '@i18n';

export class ChapterListManager {
  /**
   * @param {import('./ChaptersModule.js').ChaptersModule} host - Родительский модуль
   */
  constructor(host) {
    this._host = host;
  }

  // ═══════════════════════════════════════════
  // РЕНДЕР СПИСКА
  // ═══════════════════════════════════════════

  /**
   * Отрисовать список глав
   */
  async renderChapters() {
    const host = this._host;
    // Перед перерендером — сохранить раскрытую главу
    await host._editor.saveExpandedChapter();

    const chapters = await host.store.getChapters();

    if (chapters.length === 0) {
      host.chaptersList.innerHTML = '';
      host.chaptersEmpty.hidden = false;
      return;
    }

    host.chaptersEmpty.hidden = true;
    const tmpl = document.getElementById('tmpl-admin-chapter-card');
    const frag = document.createDocumentFragment();

    chapters.forEach((ch, i) => {
      frag.appendChild(this._createChapterCard(tmpl, ch, i, chapters.length));
    });

    host.chaptersList.innerHTML = '';
    host.chaptersList.appendChild(frag);

    // Делегирование событий
    host.chaptersList.onclick = (e) => this._handleChapterListClick(e);
  }

  /**
   * Создать DOM-карточку главы из шаблона
   */
  _createChapterCard(tmpl, ch, index, total) {
    const host = this._host;
    const clone = tmpl.content.cloneNode(true);
    const card = clone.querySelector('.chapter-card');
    card.dataset.index = index;

    const header = card.querySelector('.chapter-card-header');
    header.dataset.index = index;

    // Drag-handle
    card.querySelector('.chapter-drag').title = t('admin.chapters.dragHint');

    // Заголовок и мета
    const titleEl = card.querySelector('.chapter-title');
    const isAlbum = !!ch.albumData;
    const isAlbumBook = host._isAlbumBook();

    titleEl.textContent = ch.title || ch.id;
    if (isAlbum && !isAlbumBook) {
      const badge = document.createElement('span');
      badge.className = 'chapter-type-badge chapter-type-badge--album';
      badge.textContent = t('admin.chapters.albumType');
      titleEl.appendChild(badge);
    }

    const metaText = isAlbum
      ? t('admin.chapters.pageCount', { count: ch.albumData.pages?.length || 0 })
      : (ch.htmlContent ? t('admin.chapters.embedded') : (ch.file || ''));
    const metaEl = card.querySelector('.chapter-meta');
    metaEl.textContent = ch.title ? `${ch.id} · ${metaText}` : metaText;

    // Кнопки перемещения
    const upBtn = card.querySelector('.chapter-move-up-btn');
    const downBtn = card.querySelector('.chapter-move-down-btn');

    if (index > 0) {
      upBtn.hidden = false;
      upBtn.dataset.index = index;
      upBtn.title = t('admin.chapters.moveUp');
    }
    if (index < total - 1) {
      downBtn.hidden = false;
      downBtn.dataset.index = index;
      downBtn.title = t('admin.chapters.moveDown');
    }

    // Кнопка удаления
    const deleteBtn = card.querySelector('[data-action="delete"]');
    deleteBtn.dataset.index = index;
    deleteBtn.title = t('common.delete');

    return clone;
  }

  // ═══════════════════════════════════════════
  // ОБРАБОТКА КЛИКОВ
  // ═══════════════════════════════════════════

  async _handleChapterListClick(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;
    const index = parseInt(btn.dataset.index, 10);
    const host = this._host;

    // Не обрабатывать drag-handle
    if (e.target.closest('.chapter-drag')) return;

    switch (action) {
      case 'toggle':
        await host._editor.toggleChapter(index);
        break;
      case 'up':
        e.stopPropagation();
        await host._editor.saveExpandedChapter();
        host._expandedIndex = -1;
        await host.store.moveChapter(index, index - 1);
        await this.renderChapters();
        host._renderJsonPreview();
        host._showToast(t('admin.chapters.orderChanged'));
        break;
      case 'down':
        e.stopPropagation();
        await host._editor.saveExpandedChapter();
        host._expandedIndex = -1;
        await host.store.moveChapter(index, index + 1);
        await this.renderChapters();
        host._renderJsonPreview();
        host._showToast(t('admin.chapters.orderChanged'));
        break;
      case 'delete':
        e.stopPropagation();
        host._confirm(t('admin.chapters.deleteConfirm')).then(async (ok) => {
          if (!ok) return;
          if (host._expandedIndex === index) {
            host._editor.destroyInlineEditor();
            host._expandedIndex = -1;
          } else if (host._expandedIndex > index) {
            host._expandedIndex--;
          }
          await host.store.removeChapter(index);
          await this.renderChapters();
          host._renderJsonPreview();
          host._showToast(t('admin.chapters.deleted'));
        });
        break;
    }
  }

  // ═══════════════════════════════════════════
  // ДОБАВЛЕНИЕ
  // ═══════════════════════════════════════════

  /**
   * Добавить новую главу и раскрыть её для редактирования
   */
  async addNewChapter() {
    const host = this._host;
    const newId = `ch_${Date.now()}`;
    await host.store.addChapter({
      id: newId,
      title: '',
      file: '',
      htmlContent: '',
      bg: '',
      bgMobile: '',
    });
    await this.renderChapters();

    // Раскрыть только что созданную главу
    const newChapters = await host.store.getChapters();
    const newIndex = newChapters.length - 1;
    await host._editor.toggleChapter(newIndex);

    // Прокрутить к новой карточке
    const card = host.chaptersList.querySelector(`.chapter-card[data-index="${newIndex}"]`);
    if (card?.scrollIntoView) card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /**
   * Добавить новый раздел альбома и раскрыть его
   */
  async addNewSection() {
    const host = this._host;
    const sectionId = `album_${Date.now()}`;
    await host.store.addChapter({
      id: sectionId,
      title: '',
      file: '',
      htmlContent: '',
      albumData: {
        title: '',
        hideTitle: true,
        pages: [{ layout: '1', images: [] }],
      },
      bg: '',
      bgMobile: '',
    });
    await this.renderChapters();

    // Раскрыть только что созданный раздел
    const newChapters = await host.store.getChapters();
    const newIndex = newChapters.length - 1;
    await host._editor.toggleChapter(newIndex);

    const card = host.chaptersList.querySelector(`.chapter-card[data-index="${newIndex}"]`);
    if (card?.scrollIntoView) card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}
