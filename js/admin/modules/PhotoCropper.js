/**
 * Кадрирование фотографий
 * Полноэкранный оверлей для интерактивного выбора области обрезки.
 * Возвращает Promise<string|null> — data URL кадрированного изображения или null при отмене.
 *
 * Поддерживает:
 * - Перемещение области выделения (drag)
 * - Изменение размера за 8 ручек (углы + стороны)
 * - Touch-события (мобильные устройства)
 * - Сохранение пропорций через зажатый Shift
 */

import { t } from '@i18n';

/** Минимальный размер области выделения (px) */
const MIN_CROP_SIZE = 30;

/** Качество JPEG при сохранении кадрированного изображения */
const CROP_JPEG_QUALITY = 0.92;

/** Идентификаторы ручек */
const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

export class PhotoCropper {
  constructor() {
    this._overlay = null;
    this._resolve = null;
    this._img = null;
    this._imgRect = { x: 0, y: 0, w: 0, h: 0 }; // позиция/размер изображения на экране
    this._crop = { x: 0, y: 0, w: 0, h: 0 };     // область кадрирования (относительно изображения на экране)
    this._drag = null;  // { type: 'move'|handle, startX, startY, startCrop }
    this._naturalW = 0;
    this._naturalH = 0;
    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerMove = this._onPointerMove.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);
  }

  /**
   * Открыть диалог кадрирования
   * @param {string} dataUrl - data URL исходного изображения
   * @returns {Promise<string|null>} data URL кадрированного изображения или null
   */
  crop(dataUrl) {
    return new Promise((resolve) => {
      this._resolve = resolve;
      this._buildOverlay();
      this._loadImage(dataUrl);
    });
  }

  /** Построить DOM оверлея */
  _buildOverlay() {
    if (this._overlay) {
      this._overlay.remove();
    }

    const overlay = document.createElement('div');
    overlay.className = 'photo-cropper';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', t('admin.cropper.ariaLabel'));

    // Контейнер изображения
    const imgContainer = document.createElement('div');
    imgContainer.className = 'photo-cropper__canvas';
    overlay.appendChild(imgContainer);

    // Затемнение вокруг выделения (SVG маска)
    const dimming = document.createElement('div');
    dimming.className = 'photo-cropper__dimming';
    imgContainer.appendChild(dimming);

    // Рамка выделения
    const selection = document.createElement('div');
    selection.className = 'photo-cropper__selection';

    // Ручки изменения размера
    for (const id of HANDLES) {
      const handle = document.createElement('div');
      handle.className = `photo-cropper__handle photo-cropper__handle--${id}`;
      handle.dataset.handle = id;
      selection.appendChild(handle);
    }

    imgContainer.appendChild(selection);

    // Панель кнопок
    const actions = document.createElement('div');
    actions.className = 'photo-cropper__actions';

    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = 'btn btn-primary photo-cropper__btn';
    confirmBtn.textContent = t('admin.cropper.apply');
    confirmBtn.addEventListener('click', () => this._confirm());

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn-secondary photo-cropper__btn';
    cancelBtn.textContent = t('admin.cropper.cancel');
    cancelBtn.addEventListener('click', () => this._cancel());

    actions.appendChild(confirmBtn);
    actions.appendChild(cancelBtn);
    overlay.appendChild(actions);

    this._overlay = overlay;
    this._imgContainer = imgContainer;
    this._dimming = dimming;
    this._selection = selection;

    document.body.appendChild(overlay);

    // События
    imgContainer.addEventListener('pointerdown', this._onPointerDown);
    document.addEventListener('pointermove', this._onPointerMove);
    document.addEventListener('pointerup', this._onPointerUp);
    document.addEventListener('keydown', this._onKeyDown);
  }

  /** Загрузить изображение и инициализировать область кадрирования */
  _loadImage(dataUrl) {
    const img = new Image();
    img.onload = () => {
      this._naturalW = img.naturalWidth;
      this._naturalH = img.naturalHeight;
      this._img = img;

      img.className = 'photo-cropper__img';
      this._imgContainer.insertBefore(img, this._imgContainer.firstChild);

      // Рассчитать позицию изображения на экране после рендера
      requestAnimationFrame(() => {
        this._updateImgRect();
        // Начальная область — всё изображение
        this._crop = { x: 0, y: 0, w: this._imgRect.w, h: this._imgRect.h };
        this._updateSelection();
      });
    };
    img.onerror = () => {
      this._close();
      this._resolve?.(null);
    };
    img.src = dataUrl;
  }

  /** Обновить _imgRect из DOM */
  _updateImgRect() {
    if (!this._img || !this._imgContainer) return;
    const containerRect = this._imgContainer.getBoundingClientRect();
    const imgRect = this._img.getBoundingClientRect();
    this._imgRect = {
      x: imgRect.left - containerRect.left,
      y: imgRect.top - containerRect.top,
      w: imgRect.width,
      h: imgRect.height,
    };
  }

  /** Обновить визуальное состояние выделения и затемнения */
  _updateSelection() {
    const c = this._crop;
    const ir = this._imgRect;

    this._selection.style.left = `${ir.x + c.x}px`;
    this._selection.style.top = `${ir.y + c.y}px`;
    this._selection.style.width = `${c.w}px`;
    this._selection.style.height = `${c.h}px`;

    // SVG-маска для затемнения
    const absX = ir.x + c.x;
    const absY = ir.y + c.y;
    this._dimming.style.clipPath =
      `polygon(0% 0%, 0% 100%, ${absX}px 100%, ${absX}px ${absY}px, ` +
      `${absX + c.w}px ${absY}px, ${absX + c.w}px ${absY + c.h}px, ` +
      `${absX}px ${absY + c.h}px, ${absX}px 100%, 100% 100%, 100% 0%)`;
  }

  // ─── Pointer events ───────────────────────────────────────────────────

  _onPointerDown(e) {
    e.preventDefault();
    const pos = this._getPointerPos(e);
    if (!pos) return;

    const handle = e.target.closest('[data-handle]');
    if (handle) {
      this._drag = {
        type: handle.dataset.handle,
        startX: pos.x,
        startY: pos.y,
        startCrop: { ...this._crop },
      };
      return;
    }

    // Клик внутри выделения → перемещение
    const c = this._crop;
    const ir = this._imgRect;
    const relX = pos.x - ir.x;
    const relY = pos.y - ir.y;

    if (relX >= c.x && relX <= c.x + c.w && relY >= c.y && relY <= c.y + c.h) {
      this._drag = {
        type: 'move',
        startX: pos.x,
        startY: pos.y,
        startCrop: { ...this._crop },
      };
      return;
    }

    // Клик за пределами выделения → новая область
    if (relX >= 0 && relX <= ir.w && relY >= 0 && relY <= ir.h) {
      this._crop = { x: relX, y: relY, w: MIN_CROP_SIZE, h: MIN_CROP_SIZE };
      this._clampCrop();
      this._updateSelection();
      this._drag = {
        type: 'se',
        startX: pos.x,
        startY: pos.y,
        startCrop: { ...this._crop },
      };
    }
  }

  _onPointerMove(e) {
    if (!this._drag) return;
    e.preventDefault();

    const pos = this._getPointerPos(e);
    if (!pos) return;

    const dx = pos.x - this._drag.startX;
    const dy = pos.y - this._drag.startY;
    const sc = this._drag.startCrop;

    if (this._drag.type === 'move') {
      this._crop.x = sc.x + dx;
      this._crop.y = sc.y + dy;
    } else {
      this._resizeCrop(this._drag.type, sc, dx, dy, e.shiftKey);
    }

    this._clampCrop();
    this._updateSelection();
  }

  _onPointerUp() {
    this._drag = null;
  }

  _onKeyDown(e) {
    if (e.key === 'Escape') {
      this._cancel();
    }
  }

  /** Получить координаты указателя относительно контейнера */
  _getPointerPos(e) {
    if (!this._imgContainer) return null;
    const rect = this._imgContainer.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  /** Изменить размер области по конкретной ручке */
  _resizeCrop(handle, sc, dx, dy, keepAspect) {
    const c = this._crop;

    // Горизонтальные компоненты
    const moveLeft = handle.includes('w');
    const moveRight = handle.includes('e');
    const moveTop = handle.includes('n');
    const moveBottom = handle.includes('s');

    if (moveLeft) {
      c.x = sc.x + dx;
      c.w = sc.w - dx;
    }
    if (moveRight) {
      c.w = sc.w + dx;
    }
    if (moveTop) {
      c.y = sc.y + dy;
      c.h = sc.h - dy;
    }
    if (moveBottom) {
      c.h = sc.h + dy;
    }

    // Минимальный размер
    if (c.w < MIN_CROP_SIZE) {
      if (moveLeft) c.x = sc.x + sc.w - MIN_CROP_SIZE;
      c.w = MIN_CROP_SIZE;
    }
    if (c.h < MIN_CROP_SIZE) {
      if (moveTop) c.y = sc.y + sc.h - MIN_CROP_SIZE;
      c.h = MIN_CROP_SIZE;
    }

    // Сохранение пропорций при Shift (для угловых ручек)
    if (keepAspect && (handle.length === 2)) {
      const aspect = sc.w / sc.h;
      const newAspect = c.w / c.h;
      if (newAspect > aspect) {
        c.w = c.h * aspect;
        if (moveLeft) c.x = sc.x + sc.w - c.w;
      } else {
        c.h = c.w / aspect;
        if (moveTop) c.y = sc.y + sc.h - c.h;
      }
    }
  }

  /** Ограничить crop в пределах изображения */
  _clampCrop() {
    const c = this._crop;
    const ir = this._imgRect;

    c.w = Math.max(MIN_CROP_SIZE, Math.min(c.w, ir.w));
    c.h = Math.max(MIN_CROP_SIZE, Math.min(c.h, ir.h));
    c.x = Math.max(0, Math.min(c.x, ir.w - c.w));
    c.y = Math.max(0, Math.min(c.y, ir.h - c.h));
  }

  // ─── Подтверждение / Отмена ────────────────────────────────────────────

  _confirm() {
    const result = this._cropImage();
    this._close();
    this._resolve?.(result);
  }

  _cancel() {
    this._close();
    this._resolve?.(null);
  }

  /** Обрезать изображение на canvas */
  _cropImage() {
    if (!this._img || !this._imgRect.w) return null;

    const ir = this._imgRect;
    const c = this._crop;

    // Перевести координаты из экранных в натуральные
    const scaleX = this._naturalW / ir.w;
    const scaleY = this._naturalH / ir.h;

    const sx = Math.round(c.x * scaleX);
    const sy = Math.round(c.y * scaleY);
    const sw = Math.round(c.w * scaleX);
    const sh = Math.round(c.h * scaleY);

    const canvas = document.createElement('canvas');
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(this._img, sx, sy, sw, sh, 0, 0, sw, sh);

    // Определить формат по src
    const isPng = this._img.src.startsWith('data:image/png');
    return isPng
      ? canvas.toDataURL('image/png')
      : canvas.toDataURL('image/jpeg', CROP_JPEG_QUALITY);
  }

  /** Закрыть оверлей и очистить ресурсы */
  _close() {
    if (this._imgContainer) {
      this._imgContainer.removeEventListener('pointerdown', this._onPointerDown);
    }
    document.removeEventListener('pointermove', this._onPointerMove);
    document.removeEventListener('pointerup', this._onPointerUp);
    document.removeEventListener('keydown', this._onKeyDown);

    this._overlay?.remove();
    this._overlay = null;
    this._imgContainer = null;
    this._dimming = null;
    this._selection = null;
    this._img = null;
    this._drag = null;
  }
}
