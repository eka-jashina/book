# Frontend Rules (js/**, css/**)

## Stack
- Vanilla JavaScript (ES Modules), no frameworks
- CSS with custom properties (design tokens in `css/variables.css`)
- Vite bundler with path aliases (@, @utils, @managers, @core, @i18n, @css)

## JavaScript Best Practices

### Class Structure
Follow the established order in every class:
```javascript
export class MyComponent extends BaseDelegate {
  constructor(deps) {
    super(deps);
    // 1. Validate dependencies
    // 2. Initialize private state
  }

  // ═══════════════════════════════════════════
  // ПУБЛИЧНЫЕ МЕТОДЫ
  // ═══════════════════════════════════════════

  async doSomething() {
    this._assertAlive();           // Always check if destroyed
    // ...business logic
  }

  // ═══════════════════════════════════════════
  // ВНУТРЕННИЕ МЕТОДЫ
  // ═══════════════════════════════════════════

  _helperMethod() { /* ... */ }

  destroy() {
    // Clear timers, listeners, nullify references
    super.destroy();
  }
}
```

### Naming
- **Files:** PascalCase for classes (`NavigationDelegate.js`), camelCase for utilities (`configHelpers.js`)
- **Classes:** PascalCase + semantic suffix — `BookController`, `NavigationDelegate`, `SettingsManager`
- **Methods:** camelCase public (`flip()`), `_camelCase` private (`_executeFlip()`)
- **Constants:** `SCREAMING_SNAKE_CASE` or `Object.freeze({ KEY: 'value' })`
- **Section dividers:** Full-width `═` lines with Russian labels

### Dependency Injection
- All dependencies passed as single `deps` object
- Document deps with JSDoc `@param {Object} deps`
- Validate immediately via `_validateRequiredDependencies(deps)`
- Never rely on global state (except `getConfig()` singleton)

### Error Handling
```javascript
try {
  await this.animator.runFlip(direction, () => { ... });
  if (this.isDestroyed) return;     // Check after every await
  // Continue...
} catch (error) {
  if (this.isDestroyed) return;     // Ignore errors if destroyed
  console.error('Context:', error); // Log with context
  this.stateMachine.forceTransitionTo(BookState.OPENED); // Recover to safe state
}
```
- Check `this.isDestroyed` after every `await` — component may be destroyed during async op
- In catch: ignore errors if destroyed, recover to safe state otherwise
- No silent `catch {}` — at minimum log the error
- Use `AbortController` for cancellable operations

### EventEmitter
- `on()` returns unsubscribe function — store and call in `destroy()`
- Errors in handlers are logged but don't break other handlers
- Always `destroy()` to clear all listeners

### Rate Limiting
- Use `rateLimiters.navigation.tryAction()` before heavy operations
- Silently return (no error) when rate-limited

### Settings
- Always `sanitizeSetting(key, value, defaultValue)` before saving
- Skip update if value unchanged: `if (oldValue === sanitized) return`
- Debounced server sync with dirty flag for authenticated users

## CSS Best Practices

### Variables (`variables.css`)
- Name format: `--semantic-component-detail` (e.g., `--timing-lift`, `--pod-bg`)
- Group by category with section dividers (Russian labels)
- Every timing, size, color, shadow → custom property

### Class Naming
- kebab-case, hierarchical (NOT BEM): `.book-wrap`, `.nav-btn`, `.nav-row`
- State via data attributes: `[data-state="opened"]`, `[data-theme="dark"]`
- State classes for internal use: `.is-active`, `.is-disabled`, `.is-hidden`

### Pod Architecture (controls/)
- Pod = self-contained UI component with own variables scope
- Pod-specific vars in `pod-variables.css`: `--pod-bg`, `--pod-border`, `--pod-btn-bg`
- Children are simple: `.navigation-pod` → `.nav-row` → `.nav-btn` (no pod prefix on children)

### Themes
- All theme values are CSS variable overrides in `[data-theme="..."]` selectors
- Same variable names, different values per theme — no duplication
- Test all three themes: light, dark, bw

## Resource Cleanup (CRITICAL)
- All event listeners tracked via `EventListenerManager` and removed on destroy
- Timers managed via `TimerManager` — cleared on destroy
- Components MUST have `destroy()` methods that nullify all references
- EventEmitter listeners cleaned up on component teardown

## i18n
- Use `data-i18n="key"` attributes for translatable DOM elements
- Supports: `data-i18n-html`, `data-i18n-placeholder`, `data-i18n-aria-label`, `data-i18n-title`
- Never hardcode user-visible strings — use translation keys

## State Machine
- Book states: CLOSED → OPENING → OPENED ↔ FLIPPING → CLOSING → CLOSED
- All transitions validated by `BookStateMachine.js`
- Never bypass state machine — use controller methods
- On error: `forceTransitionTo()` to recover to safe state

## Common Mistakes to Avoid
- `element.innerHTML = userContent` → use `HTMLSanitizer.sanitize(userContent)` first
- `document.addEventListener(...)` without cleanup → use `EventListenerManager.add(...)`
- `setTimeout(...)` without cleanup → use `TimerManager.set(...)`
- `new FontFace(...)` with unvalidated URL → validate font source first
- Hardcoded strings like `"Загрузка..."` → use `t('loading')` from i18n
- Magic numbers in CSS like `margin: 16px` → define `--spacing-md` in `variables.css`
- Direct `fetch()` calls → use `ApiClient` for API requests (handles auth, errors, retries)
- `== null` or `== undefined` → use strict `=== null` or `=== undefined`
- Missing `this.isDestroyed` check after `await` → component may be gone
- `console.log()` for debugging → remove before committing, use `DebugPanel` for dev tools
