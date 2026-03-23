---
name: add-language
description: Add a new i18n language to the project. Provide the language code (e.g., ja, ko, zh).
---

# Add Language

## Steps

1. **Create locale file** `js/i18n/locales/{code}.js`
   - Copy structure from `js/i18n/locales/en.js`
   - Translate all keys to the target language
   - Export the translation object as default

2. **Register locale** in `js/i18n/locales/index.js`
   - Import the new locale: `import {code} from './{code}.js'`
   - Add to the exported locales object

3. **Add to LANGUAGES array** in `js/i18n/index.js`
   - Add entry: `{ code: '{code}', name: '{Native Name}', flag: '{emoji}' }`
   - Place alphabetically by code

4. **Verify**
   - Run `npm run test:run -- --grep i18n` to check i18n tests
   - Switch to the new language in the UI settings
   - Verify all screens have translations (landing, bookshelf, reader, account)
   - Check `data-i18n` attributes render correctly
