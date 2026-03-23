---
name: add-chapter
description: Add a new chapter to a book — content file, backgrounds, and config update.
---

# Add Chapter

## Steps

1. **Create chapter HTML** in `public/content/` (e.g., `part_N.html`)
   - Use semantic HTML structure matching existing chapters
   - Sanitize content — no inline scripts or external resources

2. **Add background images** to `public/images/backgrounds/`
   - Desktop variant: `bg_part_N.webp` (1920px wide)
   - Mobile variant: `bg_part_N_mobile.webp` (768px wide)
   - Use WebP format, optimize with Sharp if needed

3. **Update config** — add chapter entry:
   - If default chapters: update `js/config.js` CHAPTERS array
   - If admin config: chapter will be managed via Account screen UI
   - If server mode: use `POST /api/books/:id/chapters` API

4. **Verify**
   - Run `npm run test:run` to ensure no regressions
   - Check chapter renders correctly in the reader
   - Verify page-flip animations work with new content length
