/**
 * UTILS INDEX
 * Централизованный экспорт всех утилит.
 */

export { CSSVariables, cssVars } from './CSSVariables.js';
export { MediaQueryManager, mediaQueries } from './MediaQueryManager.js';
export { EventEmitter } from './EventEmitter.js';
export { EventListenerManager } from './EventListenerManager.js';
export { TimerManager } from './TimerManager.js';
export { LRUCache } from './LRUCache.js';
export { TransitionHelper } from './TransitionHelper.js';
export { HTMLSanitizer, sanitizer } from './HTMLSanitizer.js';
export { ErrorHandler } from './ErrorHandler.js';
export { StorageManager } from './StorageManager.js';
export { SoundManager } from '../managers/SoundManager.js';
export { AmbientManager } from '../managers/AmbientManager.js';
export { OfflineIndicator, offlineIndicator } from './OfflineIndicator.js';
export { RateLimiter, rateLimiters } from './RateLimiter.js';
export { ScreenReaderAnnouncer, getAnnouncer, announce, resetAnnouncer } from './ScreenReaderAnnouncer.js';
export {
  sanitizeSetting, sanitizeSettings,
  isValidCSSColor, isValidFontSize, isValidTheme,
  sanitizeFontSize, sanitizeVolume,
} from './SettingsValidator.js';