# Admin Panel Rules (js/admin/**)

## Architecture
- All modules extend `BaseModule` (modules/BaseModule.js)
- Config stored in `AdminConfigStore` (localStorage/IDB) or `ServerAdminConfigStore` (API)
- Config defaults in `AdminConfigDefaults.js` — never hardcode defaults elsewhere
- Config normalization via `AdminConfigMigration.js`
- Large data (font dataUrls, ambient audio) stored in IndexedDB, not localStorage

## Module Pattern
- Each module manages one concern (fonts, sounds, chapters, appearance, etc.)
- Modules receive admin instance in constructor
- Use `adminHelpers.js` for shared helper functions
- File uploads dispatched through `BookUploadManager` and `ChapterFileHandler`

## Parsers
- All parsers extend `BaseParser` (parsers/BaseParser.js)
- Dispatch via `BookParser.js`
- Supported formats: txt, doc, docx, epub, fb2
- OLE2 binary format handled by `OLE2Parser.js` (for .doc)
- Shared utilities in `parserUtils.js`

## Config Structure
```javascript
{
  books: [{ id, cover, chapters, sounds, ambients, appearance, decorativeFont, defaultSettings }],
  activeBookId: "...",
  readingFonts: [{ id, label, family, builtin, enabled, dataUrl }],
  settingsVisibility: { fontSize, theme, font, fullscreen, sound, ambient },
  fontMin: 14, fontMax: 22
}
```

## Important
- Strip data URLs before saving to localStorage (`AdminConfigStrip.js`)
- Always validate/normalize config on load (`AdminConfigMigration.js`)
- Quill editor wrapped via `QuillEditorWrapper.js` — don't use Quill directly
