/**
 * INTEGRATION TEST: Event System
 * Тестирование EventController и взаимодействия с делегатами
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createFullBookDOM,
  cleanupIntegrationDOM,
} from '../../helpers/integrationUtils.js';

import { EventController } from '../../../js/core/EventController.js';
import { EventListenerManager } from '../../../js/utils/EventListenerManager.js';
import { Direction } from '../../../js/config.js';

describe('Event System Integration', () => {
  let dom;
  let eventController;
  let eventManager;
  let bookElement;

  // Mock callbacks
  let onFlip;
  let onTOCClick;
  let onOpen;
  let onSettings;
  let isBusy;
  let isOpened;

  beforeEach(() => {
    dom = createFullBookDOM();
    eventManager = new EventListenerManager();

    // Create book element
    bookElement = document.createElement('div');
    bookElement.className = 'book';
    document.body.appendChild(bookElement);

    // Initialize mock callbacks
    onFlip = vi.fn();
    onTOCClick = vi.fn();
    onOpen = vi.fn();
    onSettings = vi.fn();
    isBusy = vi.fn().mockReturnValue(false);
    isOpened = vi.fn().mockReturnValue(true);

    eventController = new EventController({
      book: bookElement,
      eventManager,
      onFlip,
      onTOCClick,
      onOpen,
      onSettings,
      isBusy,
      isOpened,
    });
  });

  afterEach(() => {
    eventController?.destroy();
    eventManager?.clear();
    cleanupIntegrationDOM();
    vi.restoreAllMocks();
  });

  describe('Navigation Button Events', () => {
    let nextBtn, prevBtn, tocBtn, continueBtn;

    beforeEach(() => {
      nextBtn = document.createElement('button');
      nextBtn.id = 'next-btn';
      prevBtn = document.createElement('button');
      prevBtn.id = 'prev-btn';
      tocBtn = document.createElement('button');
      tocBtn.id = 'toc-btn';
      continueBtn = document.createElement('button');
      continueBtn.id = 'continue-btn';

      document.body.appendChild(nextBtn);
      document.body.appendChild(prevBtn);
      document.body.appendChild(tocBtn);
      document.body.appendChild(continueBtn);

      eventController.bind({
        nextBtn,
        prevBtn,
        tocBtn,
        continueBtn,
      });
    });

    it('should call onFlip(NEXT) when next button clicked', () => {
      nextBtn.click();

      expect(onFlip).toHaveBeenCalledWith(Direction.NEXT);
    });

    it('should call onFlip(PREV) when prev button clicked', () => {
      prevBtn.click();

      expect(onFlip).toHaveBeenCalledWith(Direction.PREV);
    });

    it('should call onTOCClick when TOC button clicked', () => {
      tocBtn.click();

      expect(onTOCClick).toHaveBeenCalled();
    });

    it('should call onOpen when continue button clicked', () => {
      continueBtn.click();

      expect(onOpen).toHaveBeenCalledWith(true);
    });

    it('should hide continue button after click', () => {
      continueBtn.click();

      expect(continueBtn.hidden).toBe(true);
    });

    it('should NOT navigate when busy', () => {
      isBusy.mockReturnValue(true);

      nextBtn.click();
      prevBtn.click();

      expect(onFlip).not.toHaveBeenCalled();
    });
  });

  describe('Keyboard Navigation', () => {
    beforeEach(() => {
      eventController.bind({});
    });

    it('should call onFlip(NEXT) on ArrowRight', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'ArrowRight',
        bubbles: true,
      });
      document.dispatchEvent(event);

      expect(onFlip).toHaveBeenCalledWith(Direction.NEXT);
    });

    it('should call onFlip(PREV) on ArrowLeft', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'ArrowLeft',
        bubbles: true,
      });
      document.dispatchEvent(event);

      expect(onFlip).toHaveBeenCalledWith(Direction.PREV);
    });

    it('should call onTOCClick(0) on Home key when book is open', () => {
      isOpened.mockReturnValue(true);

      const event = new KeyboardEvent('keydown', {
        key: 'Home',
        bubbles: true,
      });
      document.dispatchEvent(event);

      expect(onTOCClick).toHaveBeenCalledWith(0);
    });

    it('should call onTOCClick(-1) on End key when book is open', () => {
      isOpened.mockReturnValue(true);

      const event = new KeyboardEvent('keydown', {
        key: 'End',
        bubbles: true,
      });
      document.dispatchEvent(event);

      expect(onTOCClick).toHaveBeenCalledWith(-1);
    });

    it('should NOT navigate on Home/End when book is closed', () => {
      isOpened.mockReturnValue(false);

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));

      expect(onTOCClick).not.toHaveBeenCalled();
    });

    it('should toggle debug on Ctrl+D', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'd',
        ctrlKey: true,
        bubbles: true,
      });
      document.dispatchEvent(event);

      expect(onSettings).toHaveBeenCalledWith('debug', 'toggle');
    });

    it('should NOT navigate when busy', () => {
      isBusy.mockReturnValue(true);

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));

      expect(onFlip).not.toHaveBeenCalled();
    });
  });

  describe('TOC Click Events', () => {
    beforeEach(() => {
      // Create TOC structure inside book
      const toc = document.createElement('ul');
      toc.className = 'toc';

      const li1 = document.createElement('li');
      li1.dataset.chapter = '0';
      li1.textContent = 'Chapter 1';

      const li2 = document.createElement('li');
      li2.dataset.chapter = '1';
      li2.textContent = 'Chapter 2';

      toc.appendChild(li1);
      toc.appendChild(li2);
      bookElement.appendChild(toc);

      eventController.bind({});
    });

    it('should navigate to chapter on TOC item click', () => {
      const li = bookElement.querySelector('.toc li[data-chapter="1"]');
      li.click();

      expect(onTOCClick).toHaveBeenCalledWith(1);
    });

    it('should navigate on Enter key press on TOC item', () => {
      const li = bookElement.querySelector('.toc li[data-chapter="0"]');

      const event = new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
      });
      li.dispatchEvent(event);

      expect(onTOCClick).toHaveBeenCalledWith(0);
    });

    it('should navigate on Space key press on TOC item', () => {
      const li = bookElement.querySelector('.toc li[data-chapter="1"]');

      const event = new KeyboardEvent('keydown', {
        key: ' ',
        bubbles: true,
      });
      li.dispatchEvent(event);

      expect(onTOCClick).toHaveBeenCalledWith(1);
    });
  });

  describe('Settings Controls', () => {
    let increaseBtn, decreaseBtn, fontSelect, fontSizeValue;

    beforeEach(() => {
      increaseBtn = document.createElement('button');
      increaseBtn.id = 'increase-btn';
      decreaseBtn = document.createElement('button');
      decreaseBtn.id = 'decrease-btn';
      fontSelect = document.createElement('select');
      fontSelect.innerHTML = '<option value="georgia">Georgia</option><option value="inter">Inter</option>';
      fontSizeValue = document.createElement('span');
      fontSizeValue.textContent = '18';

      document.body.appendChild(increaseBtn);
      document.body.appendChild(decreaseBtn);
      document.body.appendChild(fontSelect);
      document.body.appendChild(fontSizeValue);

      eventController.bind({
        increaseBtn,
        decreaseBtn,
        fontSelect,
        fontSizeValue,
      });
    });

    it('should increase font size on increase button click', () => {
      increaseBtn.click();

      expect(onSettings).toHaveBeenCalledWith('fontSize', 'increase');
    });

    it('should decrease font size on decrease button click', () => {
      decreaseBtn.click();

      expect(onSettings).toHaveBeenCalledWith('fontSize', 'decrease');
    });

    it('should change font on select change', () => {
      fontSelect.value = 'inter';
      fontSelect.dispatchEvent(new Event('change'));

      expect(onSettings).toHaveBeenCalledWith('font', 'inter');
    });

    it('должен обновить отображение размера шрифта при увеличении', () => {
      // Симулируем: onSettings изменяет настройки, getFontSize возвращает новое значение
      let currentFontSize = 18;
      eventController.getFontSize = () => currentFontSize;
      onSettings.mockImplementation((key, value) => {
        if (key === 'fontSize' && value === 'increase') {
          currentFontSize = Math.min(currentFontSize + 1, 22);
        }
      });

      increaseBtn.click();

      expect(fontSizeValue.textContent).toBe('19');
    });

    it('должен обновить отображение размера шрифта при уменьшении', () => {
      // Симулируем: onSettings изменяет настройки, getFontSize возвращает новое значение
      let currentFontSize = 18;
      eventController.getFontSize = () => currentFontSize;
      onSettings.mockImplementation((key, value) => {
        if (key === 'fontSize' && value === 'decrease') {
          currentFontSize = Math.max(currentFontSize - 1, 14);
        }
      });

      decreaseBtn.click();

      expect(fontSizeValue.textContent).toBe('17');
    });
  });

  describe('Theme Segmented Control', () => {
    let themeSegmented;

    beforeEach(() => {
      themeSegmented = document.createElement('div');
      themeSegmented.className = 'theme-segmented';
      themeSegmented.innerHTML = `
        <button class="theme-segment" data-theme="light" aria-checked="true">Light</button>
        <button class="theme-segment" data-theme="dark" aria-checked="false">Dark</button>
        <button class="theme-segment" data-theme="bw" aria-checked="false">B&W</button>
      `;
      document.body.appendChild(themeSegmented);

      eventController.bind({ themeSegmented });
    });

    it('should change theme on segment click', () => {
      const darkSegment = themeSegmented.querySelector('[data-theme="dark"]');
      darkSegment.click();

      expect(onSettings).toHaveBeenCalledWith('theme', 'dark');
    });

    it('should update segment active states', () => {
      const darkSegment = themeSegmented.querySelector('[data-theme="dark"]');
      darkSegment.click();

      expect(darkSegment.dataset.active).toBe('true');
      expect(darkSegment.getAttribute('aria-checked')).toBe('true');

      const lightSegment = themeSegmented.querySelector('[data-theme="light"]');
      expect(lightSegment.dataset.active).toBe('false');
      expect(lightSegment.getAttribute('aria-checked')).toBe('false');
    });
  });

  describe('Sound Controls', () => {
    let soundToggle, volumeSlider, pageVolumeControl;

    beforeEach(() => {
      soundToggle = document.createElement('input');
      soundToggle.type = 'checkbox';
      soundToggle.checked = true;

      volumeSlider = document.createElement('input');
      volumeSlider.type = 'range';
      volumeSlider.min = '0';
      volumeSlider.max = '100';
      volumeSlider.value = '50';

      pageVolumeControl = document.createElement('div');
      pageVolumeControl.className = 'page-volume-control';

      document.body.appendChild(soundToggle);
      document.body.appendChild(volumeSlider);
      document.body.appendChild(pageVolumeControl);

      eventController.bind({ soundToggle, volumeSlider, pageVolumeControl });
    });

    it('should toggle sound on checkbox change', () => {
      soundToggle.checked = false;
      soundToggle.dispatchEvent(new Event('change'));

      expect(onSettings).toHaveBeenCalledWith('soundEnabled', false);
    });

    // Volume control disabled state теперь управляется через CSS :has()
    // JS больше не переключает .disabled класс на pageVolumeControl

    it('should set volume on slider input', () => {
      volumeSlider.value = '70';
      volumeSlider.dispatchEvent(new Event('input'));

      expect(onSettings).toHaveBeenCalledWith('soundVolume', 0.7);
    });
  });

  describe('Ambient Controls', () => {
    let ambientPills, ambientVolume, ambientVolumeWrapper;

    beforeEach(() => {
      ambientPills = document.createElement('div');
      ambientPills.className = 'ambient-pills';
      ambientPills.innerHTML = `
        <button class="ambient-pill" data-type="none" aria-checked="true">None</button>
        <button class="ambient-pill" data-type="rain" aria-checked="false">Rain</button>
        <button class="ambient-pill" data-type="fireplace" aria-checked="false">Fireplace</button>
      `;

      ambientVolume = document.createElement('input');
      ambientVolume.type = 'range';
      ambientVolume.min = '0';
      ambientVolume.max = '100';
      ambientVolume.value = '50';

      ambientVolumeWrapper = document.createElement('div');
      ambientVolumeWrapper.className = 'ambient-volume-wrapper';

      document.body.appendChild(ambientPills);
      document.body.appendChild(ambientVolume);
      document.body.appendChild(ambientVolumeWrapper);

      eventController.bind({ ambientPills, ambientVolume, ambientVolumeWrapper });
    });

    it('should change ambient type on pill click', () => {
      const rainPill = ambientPills.querySelector('[data-type="rain"]');
      rainPill.click();

      expect(onSettings).toHaveBeenCalledWith('ambientType', 'rain');
    });

    it('should update pill active states', () => {
      const rainPill = ambientPills.querySelector('[data-type="rain"]');
      rainPill.click();

      expect(rainPill.dataset.active).toBe('true');
      expect(rainPill.getAttribute('aria-checked')).toBe('true');

      const nonePill = ambientPills.querySelector('[data-type="none"]');
      expect(nonePill.dataset.active).toBe('false');
    });

    it('should show volume wrapper when ambient is active', () => {
      const rainPill = ambientPills.querySelector('[data-type="rain"]');
      rainPill.click();

      expect(ambientVolumeWrapper.classList.contains('visible')).toBe(true);
    });

    it('should hide volume wrapper when ambient is none', () => {
      // First activate rain
      ambientPills.querySelector('[data-type="rain"]').click();
      // Then switch to none
      ambientPills.querySelector('[data-type="none"]').click();

      expect(ambientVolumeWrapper.classList.contains('visible')).toBe(false);
    });

    it('should set ambient volume on slider input', () => {
      ambientVolume.value = '80';
      ambientVolume.dispatchEvent(new Event('input'));

      expect(onSettings).toHaveBeenCalledWith('ambientVolume', 0.8);
    });
  });

  describe('Fullscreen Control', () => {
    let fullscreenBtn;

    beforeEach(() => {
      fullscreenBtn = document.createElement('button');
      fullscreenBtn.className = 'fullscreen-btn';
      document.body.appendChild(fullscreenBtn);

      eventController.bind({ fullscreenBtn });
    });

    it('should toggle fullscreen on button click', () => {
      fullscreenBtn.click();

      expect(onSettings).toHaveBeenCalledWith('fullscreen', 'toggle');
    });
  });

  describe('Event Cleanup', () => {
    it('should clear bound handlers on destroy', () => {
      eventController.bind({});
      eventController.destroy();

      expect(eventController._boundHandlers).toEqual({});
    });
  });
});
