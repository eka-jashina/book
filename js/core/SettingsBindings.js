/**
 * SETTINGS BINDINGS
 * Привязка элементов управления настройками к обработчикам событий.
 *
 * Выделено из EventController для разделения ответственности:
 * - EventController: навигация, клавиатура, touch
 * - SettingsBindings: шрифт, тема, звук, полноэкранный режим
 */

/**
 * Привязать элементы управления настройками
 *
 * @param {Object} elements - DOM-элементы настроек
 * @param {Object} eventManager - EventListenerManager для регистрации слушателей
 * @param {Function} onSettings - Коллбэк изменения настроек (key, value)
 * @param {Function} getFontSize - Получить текущий размер шрифта из настроек
 */
export function bindSettingsControls(elements, eventManager, onSettings, getFontSize) {
  const {
    increaseBtn,
    decreaseBtn,
    fontSizeValue,
    fontSelect,
    languageSelect,
    themeSegmented,
    debugToggle,
    soundToggle,
    volumeSlider,
    ambientPills,
    ambientVolume,
    ambientVolumeWrapper,
    fullscreenBtn
  } = elements;

  // Font size stepper - с обновлением отображаемого значения
  if (increaseBtn) {
    eventManager.add(increaseBtn, "click", () => {
      onSettings("fontSize", "increase");
      updateFontSizeDisplay(fontSizeValue, getFontSize);
    });
  }

  if (decreaseBtn) {
    eventManager.add(decreaseBtn, "click", () => {
      onSettings("fontSize", "decrease");
      updateFontSizeDisplay(fontSizeValue, getFontSize);
    });
  }

  if (fontSelect) {
    eventManager.add(fontSelect, "change", (e) => {
      onSettings("font", e.target.value);
    });
  }

  // Language select
  if (languageSelect) {
    eventManager.add(languageSelect, "change", (e) => {
      onSettings("language", e.target.value);
    });
  }

  // Theme segmented control - клик по сегментам
  if (themeSegmented) {
    eventManager.add(themeSegmented, "click", (e) => {
      const segment = e.target.closest('.theme-segment');
      if (!segment) return;

      const theme = segment.dataset.theme;
      onSettings("theme", theme);

      // Обновить состояние всех сегментов
      const allSegments = themeSegmented.querySelectorAll('.theme-segment');
      allSegments.forEach(s => {
        const isActive = s.dataset.theme === theme;
        s.dataset.active = isActive;
        s.setAttribute('aria-checked', isActive);
      });
    });
  }

  if (debugToggle) {
    eventManager.add(debugToggle, "click", () => {
      onSettings("debug", "toggle");
    });
  }

  // Sound toggle - также обновляет состояние volume control
  if (soundToggle) {
    eventManager.add(soundToggle, "change", (e) => {
      const enabled = e.target.checked;
      onSettings("soundEnabled", enabled);

    });
  }

  if (volumeSlider) {
    eventManager.add(volumeSlider, "input", (e) => {
      const volume = parseFloat(e.target.value) / 100;
      onSettings("soundVolume", volume);
    });
  }

  // Ambient pills - делегирование клика по контейнеру
  if (ambientPills) {
    eventManager.add(ambientPills, "click", (e) => {
      const pill = e.target.closest('.ambient-pill');
      if (!pill) return;

      const type = pill.dataset.type;
      onSettings("ambientType", type);

      // Обновить состояние всех pills
      const allPills = ambientPills.querySelectorAll('.ambient-pill');
      allPills.forEach(p => {
        const isActive = p.dataset.type === type;
        p.dataset.active = isActive;
        p.setAttribute('aria-checked', isActive);
      });

      // Показать/скрыть слайдер громкости
      if (ambientVolumeWrapper) {
        ambientVolumeWrapper.classList.toggle('visible', type !== 'none');
      }
    });
  }

  if (ambientVolume) {
    eventManager.add(ambientVolume, "input", (e) => {
      const volume = parseFloat(e.target.value) / 100;
      onSettings("ambientVolume", volume);
    });
  }

  // Переключение полноэкранного режима
  if (fullscreenBtn) {
    eventManager.add(fullscreenBtn, "click", () => {
      onSettings("fullscreen", "toggle");
    });
  }
}

/**
 * Обновить отображение размера шрифта.
 *
 * Использует getFontSize() как source of truth вместо DOM,
 * чтобы избежать рассинхронизации при программном изменении настроек.
 *
 * @param {HTMLElement} element - Элемент отображения значения
 * @param {Function} getFontSize - Геттер текущего размера шрифта
 */
function updateFontSizeDisplay(element, getFontSize) {
  if (!element) return;

  // Source of truth — настройки, не DOM
  // Значение уже обновлено в SettingsDelegate._handleFontSize()
  element.textContent = getFontSize();
}
