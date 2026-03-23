/**
 * ACCOUNT SCREEN UI
 *
 * UI-утилиты экрана личного кабинета: toast-уведомления,
 * индикатор сохранения, диалог подтверждения.
 *
 * Выделено из AccountScreen для уменьшения размера основного модуля.
 * Методы привязываются к экземпляру AccountScreen через mixin-паттерн.
 */

import { t } from '@i18n';

/** SVG-пути иконок для типов toast */
const TOAST_ICONS = {
  success: 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
  error: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z',
  warning: 'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z',
};

/**
 * Закешировать DOM-элементы UI-компонентов (toast, save indicator, confirm dialog).
 * @param {HTMLElement} container — корневой контейнер экрана
 * @returns {{ toast, toastMessage, toastIconPath, saveIndicator, saveIndicatorText, confirmDialog, confirmTitle, confirmMessage, confirmOk, confirmCancel }}
 */
export function cacheUIElements(container) {
  return {
    toast: container.querySelector('#toast'),
    toastMessage: container.querySelector('#toastMessage'),
    toastIconPath: container.querySelector('#toastIconPath'),
    saveIndicator: container.querySelector('#saveIndicator'),
    saveIndicatorText: container.querySelector('#saveIndicatorText'),
    confirmDialog: container.querySelector('#confirmDialog'),
    confirmTitle: container.querySelector('#confirmTitle'),
    confirmMessage: container.querySelector('#confirmMessage'),
    confirmOk: container.querySelector('#confirmOk'),
    confirmCancel: container.querySelector('#confirmCancel'),
  };
}

/**
 * Показать toast-уведомление.
 * @param {Object} ui — DOM-элементы из cacheUIElements
 * @param {string} message
 * @param {'success'|'error'|'warning'} [type]
 * @param {{ timer: number|null }} timerRef — объект с текущим таймером (мутируется)
 */
export function showToast(ui, message, type, timerRef) {
  ui.toastMessage.textContent = message;
  ui.toast.hidden = false;

  if (type && TOAST_ICONS[type]) {
    ui.toast.dataset.type = type;
    ui.toastIconPath.setAttribute('d', TOAST_ICONS[type]);
  } else {
    delete ui.toast.dataset.type;
  }

  requestAnimationFrame(() => {
    ui.toast.classList.add('visible');
  });

  clearTimeout(timerRef.timer);
  timerRef.timer = setTimeout(() => {
    ui.toast.classList.remove('visible');
    setTimeout(() => { ui.toast.hidden = true; }, 300);
  }, 2500);
}

/**
 * Показать индикатор «Сохранено».
 * @param {HTMLElement} container — корневой контейнер экрана
 * @param {Object} ui — DOM-элементы из cacheUIElements
 * @param {{ timer: number|null }} timerRef — объект с текущим таймером (мутируется)
 */
export function showSaveIndicator(container, ui, timerRef) {
  const editorView = container.querySelector('.screen-view[data-view="editor"]');
  if (!editorView || !editorView.classList.contains('active')) return;

  ui.saveIndicator.classList.remove('fade-out', 'save-indicator--error');
  ui.saveIndicator.classList.add('visible');
  ui.saveIndicatorText.textContent = t('common.saved');
  ui.saveIndicator.classList.add('save-indicator--saved');
  ui.saveIndicator.classList.remove('save-indicator--saving');

  clearTimeout(timerRef.timer);
  timerRef.timer = setTimeout(() => {
    ui.saveIndicator.classList.add('fade-out');
    setTimeout(() => {
      ui.saveIndicator.classList.remove('visible', 'fade-out', 'save-indicator--saved');
    }, 500);
  }, 2000);
}

/**
 * Показать ошибку сохранения.
 * @param {Object} ui — DOM-элементы из cacheUIElements
 * @param {{ timer: number|null }} timerRef — объект с текущим таймером (мутируется)
 */
export function showSaveError(ui, timerRef) {
  ui.saveIndicator.classList.remove('fade-out', 'save-indicator--saved', 'save-indicator--saving');
  ui.saveIndicator.classList.add('visible', 'save-indicator--error');
  ui.saveIndicatorText.textContent = t('admin.saveError');

  clearTimeout(timerRef.timer);
  timerRef.timer = setTimeout(() => {
    ui.saveIndicator.classList.add('fade-out');
    setTimeout(() => {
      ui.saveIndicator.classList.remove('visible', 'fade-out', 'save-indicator--error');
    }, 500);
  }, 4000);
}

/**
 * Стилизованный диалог подтверждения.
 * @param {Object} ui — DOM-элементы из cacheUIElements
 * @param {string} message
 * @param {Object} [opts]
 * @param {string} [opts.title='Подтверждение']
 * @param {string} [opts.okText='Удалить']
 * @returns {Promise<boolean>}
 */
export function confirm(ui, message, { title = t('common.confirmation'), okText = t('common.delete') } = {}) {
  ui.confirmTitle.textContent = title;
  ui.confirmMessage.textContent = message;
  ui.confirmOk.textContent = okText;

  return new Promise((resolve) => {
    const cleanup = () => {
      ui.confirmOk.removeEventListener('click', onOk);
      ui.confirmCancel.removeEventListener('click', onCancel);
      ui.confirmDialog.removeEventListener('close', onClose);
    };
    const onOk = () => { cleanup(); ui.confirmDialog.close(); resolve(true); };
    const onCancel = () => { cleanup(); ui.confirmDialog.close(); resolve(false); };
    const onClose = () => { cleanup(); resolve(false); };

    ui.confirmOk.addEventListener('click', onOk);
    ui.confirmCancel.addEventListener('click', onCancel);
    ui.confirmDialog.addEventListener('close', onClose);

    ui.confirmDialog.showModal();
  });
}
