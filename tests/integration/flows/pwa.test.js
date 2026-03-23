/**
 * INTEGRATION TEST: PWA
 * InstallPrompt (баннер установки), OfflineIndicator (индикатор оффлайна),
 * перехват beforeinstallprompt, состояния сети.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanupIntegrationDOM } from '../../helpers/integrationUtils.js';
import { flushPromises } from '../../helpers/testUtils.js';
import { InstallPrompt } from '../../../js/utils/InstallPrompt.js';
import { OfflineIndicator } from '../../../js/utils/OfflineIndicator.js';

describe('PWA Integration', () => {
  describe('InstallPrompt', () => {
    let prompt;

    const createInstallBannerDOM = () => {
      const banner = document.createElement('div');
      banner.id = 'install-prompt';
      banner.hidden = true;

      const installBtn = document.createElement('button');
      installBtn.className = 'install-prompt__btn--install';
      banner.appendChild(installBtn);

      const dismissBtn = document.createElement('button');
      dismissBtn.className = 'install-prompt__btn--dismiss';
      banner.appendChild(dismissBtn);

      const closeBtn = document.createElement('button');
      closeBtn.className = 'install-prompt__close';
      banner.appendChild(closeBtn);

      document.body.appendChild(banner);
      return banner;
    };

    beforeEach(() => {
      vi.useFakeTimers();
      createInstallBannerDOM();
    });

    afterEach(() => {
      if (prompt) {
        prompt.destroy();
        prompt = null;
      }
      vi.useRealTimers();
      cleanupIntegrationDOM();
      vi.restoreAllMocks();
    });

    it('should initialize without errors', () => {
      prompt = new InstallPrompt();

      expect(prompt.canInstall).toBe(false);
    });

    it('should not show banner if in standalone mode', () => {
      // matchMedia mock returns false for display-mode: standalone by default
      // Override for this test
      const originalMatchMedia = window.matchMedia;
      window.matchMedia = vi.fn((query) => {
        if (query === '(display-mode: standalone)') {
          return { matches: true, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() };
        }
        return originalMatchMedia(query);
      });

      prompt = new InstallPrompt();

      // In standalone mode, no event listeners are added
      expect(prompt.canInstall).toBe(false);

      window.matchMedia = originalMatchMedia;
    });

    it('should capture beforeinstallprompt event', () => {
      prompt = new InstallPrompt();

      const mockEvent = {
        preventDefault: vi.fn(),
        prompt: vi.fn(),
        userChoice: Promise.resolve({ outcome: 'accepted' }),
      };

      window.dispatchEvent(Object.assign(new Event('beforeinstallprompt'), mockEvent));

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(prompt.canInstall).toBe(true);
    });

    it('should notify listeners when install becomes available', () => {
      prompt = new InstallPrompt();
      const listener = vi.fn();
      prompt.onStateChange(listener);

      const mockEvent = {
        preventDefault: vi.fn(),
        prompt: vi.fn(),
        userChoice: Promise.resolve({ outcome: 'accepted' }),
      };
      window.dispatchEvent(Object.assign(new Event('beforeinstallprompt'), mockEvent));

      expect(listener).toHaveBeenCalledWith('available');
    });

    it('should schedule banner show after 30 seconds delay', () => {
      prompt = new InstallPrompt();

      const mockEvent = {
        preventDefault: vi.fn(),
        prompt: vi.fn(),
        userChoice: Promise.resolve({ outcome: 'accepted' }),
      };
      window.dispatchEvent(Object.assign(new Event('beforeinstallprompt'), mockEvent));

      const banner = document.getElementById('install-prompt');
      expect(banner.hidden).toBe(true);

      // Advance timer to 30 seconds
      vi.advanceTimersByTime(30000);

      expect(banner.hidden).toBe(false);
    });

    it('should not show banner if user previously dismissed', () => {
      // Set dismissed state
      localStorage.setItem('flipbook_install_dismissed', 'true');

      prompt = new InstallPrompt();

      const mockEvent = {
        preventDefault: vi.fn(),
        prompt: vi.fn(),
        userChoice: Promise.resolve({ outcome: 'accepted' }),
      };
      window.dispatchEvent(Object.assign(new Event('beforeinstallprompt'), mockEvent));

      vi.advanceTimersByTime(30000);

      const banner = document.getElementById('install-prompt');
      expect(banner.hidden).toBe(true);
    });

    it('should dismiss banner and persist dismissal', () => {
      prompt = new InstallPrompt();

      const mockEvent = {
        preventDefault: vi.fn(),
        prompt: vi.fn(),
        userChoice: Promise.resolve({ outcome: 'accepted' }),
      };
      window.dispatchEvent(Object.assign(new Event('beforeinstallprompt'), mockEvent));

      // Show banner
      vi.advanceTimersByTime(30000);

      const listener = vi.fn();
      prompt.onStateChange(listener);
      // The listener gets 'available' immediately since prompt is available
      listener.mockClear();

      prompt.dismiss();
      vi.advanceTimersByTime(300); // Wait for hide animation

      expect(listener).toHaveBeenCalledWith('dismissed');
      expect(localStorage.getItem('flipbook_install_dismissed')).toBe('true');
    });

    it('should trigger native install prompt on install()', async () => {
      prompt = new InstallPrompt();

      const mockEvent = {
        preventDefault: vi.fn(),
        prompt: vi.fn(),
        userChoice: Promise.resolve({ outcome: 'accepted' }),
      };
      window.dispatchEvent(Object.assign(new Event('beforeinstallprompt'), mockEvent));

      vi.advanceTimersByTime(30000);

      vi.useRealTimers(); // Need real timers for async
      const result = await prompt.install();

      expect(mockEvent.prompt).toHaveBeenCalled();
      expect(result).toBe(true);
      expect(prompt.canInstall).toBe(false); // Prompt consumed

      vi.useFakeTimers();
    });

    it('should return false from install() if no deferred prompt', async () => {
      prompt = new InstallPrompt();

      vi.useRealTimers();
      const result = await prompt.install();
      vi.useFakeTimers();

      expect(result).toBe(false);
    });

    it('should handle appinstalled event', () => {
      prompt = new InstallPrompt();
      const listener = vi.fn();
      prompt.onStateChange(listener);

      const mockEvent = {
        preventDefault: vi.fn(),
        prompt: vi.fn(),
        userChoice: Promise.resolve({ outcome: 'accepted' }),
      };
      window.dispatchEvent(Object.assign(new Event('beforeinstallprompt'), mockEvent));
      listener.mockClear();

      window.dispatchEvent(new Event('appinstalled'));

      expect(listener).toHaveBeenCalledWith('installed');
      expect(prompt.canInstall).toBe(false);
    });

    it('should unsubscribe listener', () => {
      prompt = new InstallPrompt();
      const listener = vi.fn();
      const unsub = prompt.onStateChange(listener);

      unsub();

      const mockEvent = {
        preventDefault: vi.fn(),
        prompt: vi.fn(),
        userChoice: Promise.resolve({ outcome: 'accepted' }),
      };
      window.dispatchEvent(Object.assign(new Event('beforeinstallprompt'), mockEvent));

      // Listener should not be called (was called once during onStateChange if available, but we cleared)
      expect(listener).not.toHaveBeenCalled();
    });

    it('should reset dismissed state', () => {
      localStorage.setItem('flipbook_install_dismissed', 'true');

      prompt = new InstallPrompt();
      prompt.resetDismissed();

      expect(localStorage.getItem('flipbook_install_dismissed')).toBeNull();
    });

    it('should clean up on destroy', () => {
      prompt = new InstallPrompt();
      const removeListenerSpy = vi.spyOn(window, 'removeEventListener');

      prompt.destroy();

      expect(removeListenerSpy).toHaveBeenCalledWith('beforeinstallprompt', expect.any(Function));
      expect(removeListenerSpy).toHaveBeenCalledWith('appinstalled', expect.any(Function));
    });
  });

  describe('OfflineIndicator', () => {
    let indicator;

    const createOfflineDOM = () => {
      const el = document.createElement('div');
      el.id = 'offline-indicator';
      el.hidden = true;
      document.body.appendChild(el);
    };

    beforeEach(() => {
      createOfflineDOM();
      // Default: online
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    });

    afterEach(() => {
      if (indicator) {
        indicator.destroy();
        indicator = null;
      }
      cleanupIntegrationDOM();
      vi.restoreAllMocks();
    });

    it('should start hidden when online', () => {
      indicator = new OfflineIndicator();

      expect(indicator.isOnline).toBe(true);
      expect(indicator.isVisible).toBe(false);
    });

    it('should show indicator when initialized offline', () => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

      indicator = new OfflineIndicator();

      expect(indicator.isOnline).toBe(false);

      const el = document.getElementById('offline-indicator');
      expect(el.hidden).toBe(false);
    });

    it('should show indicator on offline event', () => {
      indicator = new OfflineIndicator();

      window.dispatchEvent(new Event('offline'));

      const el = document.getElementById('offline-indicator');
      expect(el.hidden).toBe(false);
      expect(indicator.isVisible).toBe(true);
    });

    it('should hide indicator on online event', () => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
      indicator = new OfflineIndicator();

      // Go online
      window.dispatchEvent(new Event('online'));

      const el = document.getElementById('offline-indicator');
      expect(el.hidden).toBe(true);
    });

    it('should handle offline → online → offline cycle', () => {
      indicator = new OfflineIndicator();
      const el = document.getElementById('offline-indicator');

      // Go offline
      window.dispatchEvent(new Event('offline'));
      expect(el.hidden).toBe(false);

      // Go online
      window.dispatchEvent(new Event('online'));
      expect(el.hidden).toBe(true);

      // Go offline again
      window.dispatchEvent(new Event('offline'));
      expect(el.hidden).toBe(false);
    });

    it('should support manual show/hide', () => {
      indicator = new OfflineIndicator();
      const el = document.getElementById('offline-indicator');

      indicator.show();
      expect(el.hidden).toBe(false);

      indicator.hide();
      expect(el.hidden).toBe(true);
    });

    it('should not duplicate show when already visible', () => {
      indicator = new OfflineIndicator();

      window.dispatchEvent(new Event('offline'));
      window.dispatchEvent(new Event('offline'));

      // Should not throw, still visible
      expect(indicator.isVisible).toBe(true);
    });

    it('should clean up on destroy', () => {
      indicator = new OfflineIndicator();
      const removeSpy = vi.spyOn(window, 'removeEventListener');

      indicator.destroy();

      expect(removeSpy).toHaveBeenCalledWith('online', expect.any(Function));
      expect(removeSpy).toHaveBeenCalledWith('offline', expect.any(Function));
      expect(indicator.isVisible).toBe(false);
    });
  });

  describe('PWA combined flow', () => {
    it('should handle offline state + install prompt together', () => {
      // Setup DOM
      const offlineEl = document.createElement('div');
      offlineEl.id = 'offline-indicator';
      offlineEl.hidden = true;
      document.body.appendChild(offlineEl);

      const banner = document.createElement('div');
      banner.id = 'install-prompt';
      banner.hidden = true;
      banner.innerHTML = '<button class="install-prompt__btn--install"></button><button class="install-prompt__btn--dismiss"></button>';
      document.body.appendChild(banner);

      vi.useFakeTimers();

      const offlineIndicator = new OfflineIndicator();
      const installPrompt = new InstallPrompt();

      // Start offline
      window.dispatchEvent(new Event('offline'));
      expect(offlineEl.hidden).toBe(false);

      // Install prompt available
      const mockEvent = {
        preventDefault: vi.fn(),
        prompt: vi.fn(),
        userChoice: Promise.resolve({ outcome: 'accepted' }),
      };
      window.dispatchEvent(Object.assign(new Event('beforeinstallprompt'), mockEvent));
      expect(installPrompt.canInstall).toBe(true);

      // Come back online
      window.dispatchEvent(new Event('online'));
      expect(offlineEl.hidden).toBe(true);

      // Install prompt still available
      expect(installPrompt.canInstall).toBe(true);

      offlineIndicator.destroy();
      installPrompt.destroy();
      vi.useRealTimers();
    });
  });
});
