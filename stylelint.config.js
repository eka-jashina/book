/** @type {import('stylelint').Config} */
export default {
  extends: ['stylelint-config-standard'],

  rules: {
    // ── Проект активно использует CSS custom properties ──
    'custom-property-pattern': null,

    // ── Разрешить data-атрибуты в селекторах ─────────────
    'selector-attribute-quotes': 'always',

    // ── Проект использует @property (animatable) ─────────
    'property-no-unknown': [true, {
      ignoreAtRules: ['property'],
    }],

    // ── Вложенность селекторов: допустить вложенность ────
    'no-descending-specificity': null,

    // ── Именование классов: BEM / kebab-case ─────────────
    'selector-class-pattern': [
      '^[a-z][a-z0-9]*(-[a-z0-9]+)*(__[a-z0-9]+(-[a-z0-9]+)*)?(--[a-z0-9]+(-[a-z0-9]+)*)?$',
      { message: 'Expected class selector to be kebab-case or BEM (selector-class-pattern)' },
    ],

    // ── Допустить дублирование свойств (vendor-prefix fallbacks) ─
    'declaration-block-no-duplicate-properties': [true, {
      ignore: ['consecutive-duplicates'],
    }],

    // ── Допустить пустые блоки (используются для override) ─
    'block-no-empty': null,

    // ── Комментарии на русском — не требовать формат ──────
    'comment-empty-line-before': null,

    // ── Допустить id-селекторы (проект активно их использует) ─
    'selector-id-pattern': null,

    // ── Допустить сокращения и длинные значения ──────────
    'shorthand-property-no-redundant-values': true,

    // ── Допустить vendor-prefixes (проект использует -webkit- для 3D transforms) ─
    'property-no-vendor-prefix': [true, {
      ignoreProperties: ['perspective', 'transform-style', 'backface-visibility', 'appearance'],
    }],
    'value-no-vendor-prefix': [true, {
      ignoreValues: ['box'],
    }],

    // ── Допустить дублирование селекторов (CSS организован по concerns) ─
    'no-duplicate-selectors': null,

    // ── clip используется для accessibility (sr-only), допустить ─
    'property-no-deprecated': [true, {
      ignoreProperties: ['clip'],
    }],

    // ── @import в index.css ──────────────────────────────
    'import-notation': null,

    // ── Допустить alpha-value в обоих форматах ───────────
    'alpha-value-notation': null,

    // ── Допустить оба формата цвета ──────────────────────
    'color-function-notation': null,

    // ── Медиа-запросы: допустить range и prefix нотации ──
    'media-feature-range-notation': null,

    // ── Не требовать generic font family (проект использует CSS vars) ─
    'font-family-no-missing-generic-family-keyword': null,

    // ── Допустить @keyframes любые имена ─────────────────
    'keyframes-name-pattern': null,

    // ── Допустить любые custom property имена (@property) ─
    'at-rule-no-unknown': [true, {
      ignoreAtRules: ['property'],
    }],
  },

  ignoreFiles: ['dist/**', 'node_modules/**', 'coverage/**', 'docs/**'],
};
