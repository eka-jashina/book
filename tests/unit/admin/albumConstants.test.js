import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  LAYOUT_IMAGE_COUNT,
  IMAGE_MAX_DIMENSION,
  IMAGE_QUALITY,
  IMAGE_MAX_FILE_SIZE,
  ROTATION_VALUES,
  DEFAULT_FILTER_INTENSITY,
  getFrameOptions,
  getFilterOptions,
  getPageSlots,
  computeFilterStyle,
} from '../../../js/admin/modules/albumConstants.js';

describe('albumConstants', () => {
  describe('LAYOUT_IMAGE_COUNT', () => {
    it('maps layout "1" to 1 image', () => {
      expect(LAYOUT_IMAGE_COUNT['1']).toBe(1);
    });

    it('maps layout "2" to 2 images', () => {
      expect(LAYOUT_IMAGE_COUNT['2']).toBe(2);
    });

    it('maps layout "2h" to 2 images', () => {
      expect(LAYOUT_IMAGE_COUNT['2h']).toBe(2);
    });

    it('maps layout "3" to 3 images', () => {
      expect(LAYOUT_IMAGE_COUNT['3']).toBe(3);
    });

    it('maps layout "3r" to 3 images', () => {
      expect(LAYOUT_IMAGE_COUNT['3r']).toBe(3);
    });

    it('maps layout "3t" to 3 images', () => {
      expect(LAYOUT_IMAGE_COUNT['3t']).toBe(3);
    });

    it('maps layout "3b" to 3 images', () => {
      expect(LAYOUT_IMAGE_COUNT['3b']).toBe(3);
    });

    it('maps layout "4" to 4 images', () => {
      expect(LAYOUT_IMAGE_COUNT['4']).toBe(4);
    });

    it('has exactly 8 layout entries', () => {
      expect(Object.keys(LAYOUT_IMAGE_COUNT)).toHaveLength(8);
    });

    it('returns undefined for unknown layouts', () => {
      expect(LAYOUT_IMAGE_COUNT['5']).toBeUndefined();
      expect(LAYOUT_IMAGE_COUNT['unknown']).toBeUndefined();
    });
  });

  describe('IMAGE_MAX_DIMENSION', () => {
    it('equals 1920', () => {
      expect(IMAGE_MAX_DIMENSION).toBe(1920);
    });
  });

  describe('IMAGE_QUALITY', () => {
    it('equals 0.85', () => {
      expect(IMAGE_QUALITY).toBe(0.85);
    });
  });

  describe('IMAGE_MAX_FILE_SIZE', () => {
    it('equals 10 MB in bytes', () => {
      expect(IMAGE_MAX_FILE_SIZE).toBe(10 * 1024 * 1024);
    });
  });

  describe('ROTATION_VALUES', () => {
    it('contains [0, 90, 180, 270]', () => {
      expect(ROTATION_VALUES).toEqual([0, 90, 180, 270]);
    });

    it('has exactly 4 values', () => {
      expect(ROTATION_VALUES).toHaveLength(4);
    });
  });

  describe('DEFAULT_FILTER_INTENSITY', () => {
    it('equals 100', () => {
      expect(DEFAULT_FILTER_INTENSITY).toBe(100);
    });
  });

  describe('getFrameOptions()', () => {
    it('returns an array of 6 options', () => {
      const options = getFrameOptions();
      expect(options).toHaveLength(6);
    });

    it('each option has id and label properties', () => {
      const options = getFrameOptions();
      for (const option of options) {
        expect(option).toHaveProperty('id');
        expect(option).toHaveProperty('label');
        expect(typeof option.id).toBe('string');
        expect(typeof option.label).toBe('string');
      }
    });

    it('contains the correct frame ids in order', () => {
      const ids = getFrameOptions().map((o) => o.id);
      expect(ids).toEqual(['none', 'thin', 'shadow', 'polaroid', 'rounded', 'double']);
    });

    it('has non-empty translated labels', () => {
      const options = getFrameOptions();
      for (const option of options) {
        expect(option.label.length).toBeGreaterThan(0);
      }
    });

    it('has "Polaroid" as a hardcoded label for the polaroid frame', () => {
      const options = getFrameOptions();
      const polaroid = options.find((o) => o.id === 'polaroid');
      expect(polaroid.label).toBe('Polaroid');
    });

    it('returns a new array each call', () => {
      const a = getFrameOptions();
      const b = getFrameOptions();
      expect(a).not.toBe(b);
      expect(a).toEqual(b);
    });
  });

  describe('getFilterOptions()', () => {
    it('returns an array of 6 options', () => {
      const options = getFilterOptions();
      expect(options).toHaveLength(6);
    });

    it('each option has id and label properties', () => {
      const options = getFilterOptions();
      for (const option of options) {
        expect(option).toHaveProperty('id');
        expect(option).toHaveProperty('label');
        expect(typeof option.id).toBe('string');
        expect(typeof option.label).toBe('string');
      }
    });

    it('contains the correct filter ids in order', () => {
      const ids = getFilterOptions().map((o) => o.id);
      expect(ids).toEqual(['none', 'grayscale', 'sepia', 'contrast', 'warm', 'cool']);
    });

    it('has non-empty translated labels', () => {
      const options = getFilterOptions();
      for (const option of options) {
        expect(option.label.length).toBeGreaterThan(0);
      }
    });

    it('returns a new array each call', () => {
      const a = getFilterOptions();
      const b = getFilterOptions();
      expect(a).not.toBe(b);
      expect(a).toEqual(b);
    });
  });

  describe('getPageSlots()', () => {
    it('returns slots matching layout image count for layout "1"', () => {
      const page = { layout: '1', images: ['img1.jpg'] };
      const slots = getPageSlots(page);
      expect(slots).toEqual(['img1.jpg']);
    });

    it('returns slots matching layout image count for layout "2"', () => {
      const page = { layout: '2', images: ['a.jpg', 'b.jpg'] };
      const slots = getPageSlots(page);
      expect(slots).toEqual(['a.jpg', 'b.jpg']);
    });

    it('returns slots matching layout image count for layout "4"', () => {
      const page = { layout: '4', images: ['a', 'b', 'c', 'd'] };
      const slots = getPageSlots(page);
      expect(slots).toEqual(['a', 'b', 'c', 'd']);
    });

    it('fills missing images with null', () => {
      const page = { layout: '3', images: ['only-one.jpg'] };
      const slots = getPageSlots(page);
      expect(slots).toEqual(['only-one.jpg', null, null]);
    });

    it('fills all nulls when images array is empty', () => {
      const page = { layout: '2h', images: [] };
      const slots = getPageSlots(page);
      expect(slots).toEqual([null, null]);
    });

    it('defaults to 1 slot for unknown layout', () => {
      const page = { layout: 'unknown', images: ['x.jpg'] };
      const slots = getPageSlots(page);
      expect(slots).toEqual(['x.jpg']);
    });

    it('defaults to 1 slot with null for unknown layout and no images', () => {
      const page = { layout: 'xyz', images: [] };
      const slots = getPageSlots(page);
      expect(slots).toEqual([null]);
    });

    it('ignores extra images beyond the layout count', () => {
      const page = { layout: '1', images: ['a', 'b', 'c'] };
      const slots = getPageSlots(page);
      expect(slots).toEqual(['a']);
    });

    it('handles layout "3r" with partial images', () => {
      const page = { layout: '3r', images: ['x', 'y'] };
      const slots = getPageSlots(page);
      expect(slots).toEqual(['x', 'y', null]);
    });

    it('handles layout "3t" correctly', () => {
      const page = { layout: '3t', images: ['a', 'b', 'c'] };
      const slots = getPageSlots(page);
      expect(slots).toEqual(['a', 'b', 'c']);
    });

    it('handles layout "3b" correctly', () => {
      const page = { layout: '3b', images: ['a', 'b', 'c'] };
      const slots = getPageSlots(page);
      expect(slots).toEqual(['a', 'b', 'c']);
    });
  });

  describe('computeFilterStyle()', () => {
    describe('no filter / none', () => {
      it('returns empty string for null filter', () => {
        expect(computeFilterStyle(null, 100)).toBe('');
      });

      it('returns empty string for undefined filter', () => {
        expect(computeFilterStyle(undefined, 100)).toBe('');
      });

      it('returns empty string for empty string filter', () => {
        expect(computeFilterStyle('', 100)).toBe('');
      });

      it('returns empty string for "none" filter', () => {
        expect(computeFilterStyle('none', 100)).toBe('');
      });
    });

    describe('unknown filter', () => {
      it('returns empty string for unknown filter name', () => {
        expect(computeFilterStyle('blur', 100)).toBe('');
      });

      it('returns empty string for any unrecognized filter', () => {
        expect(computeFilterStyle('vintage', 50)).toBe('');
      });
    });

    describe('grayscale filter', () => {
      it('returns full grayscale at intensity 100', () => {
        expect(computeFilterStyle('grayscale', 100)).toBe('grayscale(1)');
      });

      it('returns half grayscale at intensity 50', () => {
        expect(computeFilterStyle('grayscale', 50)).toBe('grayscale(0.5)');
      });

      it('returns no grayscale at intensity 0', () => {
        expect(computeFilterStyle('grayscale', 0)).toBe('grayscale(0)');
      });
    });

    describe('sepia filter', () => {
      it('returns sepia(0.75) at intensity 100', () => {
        expect(computeFilterStyle('sepia', 100)).toBe('sepia(0.75)');
      });

      it('returns sepia(0.375) at intensity 50', () => {
        expect(computeFilterStyle('sepia', 50)).toBe('sepia(0.375)');
      });

      it('returns sepia(0) at intensity 0', () => {
        expect(computeFilterStyle('sepia', 0)).toBe('sepia(0)');
      });
    });

    describe('contrast filter', () => {
      it('returns contrast(1.35) at intensity 100', () => {
        expect(computeFilterStyle('contrast', 100)).toBe('contrast(1.35)');
      });

      it('returns contrast(1.175) at intensity 50', () => {
        expect(computeFilterStyle('contrast', 50)).toBe('contrast(1.175)');
      });

      it('returns contrast(1) at intensity 0', () => {
        expect(computeFilterStyle('contrast', 0)).toBe('contrast(1)');
      });
    });

    describe('warm filter', () => {
      it('returns correct warm style at intensity 100', () => {
        expect(computeFilterStyle('warm', 100)).toBe('saturate(1.3) hue-rotate(-10deg)');
      });

      it('returns correct warm style at intensity 50', () => {
        expect(computeFilterStyle('warm', 50)).toBe('saturate(1.15) hue-rotate(-5deg)');
      });

      it('returns correct warm style at intensity 0', () => {
        expect(computeFilterStyle('warm', 0)).toBe('saturate(1) hue-rotate(0deg)');
      });
    });

    describe('cool filter', () => {
      it('returns correct cool style at intensity 100', () => {
        expect(computeFilterStyle('cool', 100)).toBe('saturate(1.1) hue-rotate(15deg) brightness(1.05)');
      });

      it('returns correct cool style at intensity 50', () => {
        expect(computeFilterStyle('cool', 50)).toBe('saturate(1.05) hue-rotate(7.5deg) brightness(1.025)');
      });

      it('returns correct cool style at intensity 0', () => {
        expect(computeFilterStyle('cool', 0)).toBe('saturate(1) hue-rotate(0deg) brightness(1)');
      });
    });

    describe('intensity clamping', () => {
      it('clamps negative intensity to 0', () => {
        expect(computeFilterStyle('grayscale', -50)).toBe('grayscale(0)');
      });

      it('clamps intensity above 100 to 100', () => {
        expect(computeFilterStyle('grayscale', 200)).toBe('grayscale(1)');
      });

      it('clamps large negative intensity to 0', () => {
        expect(computeFilterStyle('sepia', -1000)).toBe('sepia(0)');
      });

      it('clamps intensity of 101 to 100', () => {
        expect(computeFilterStyle('contrast', 101)).toBe('contrast(1.35)');
      });
    });

    describe('undefined/null intensity', () => {
      it('uses DEFAULT_FILTER_INTENSITY when intensity is undefined', () => {
        expect(computeFilterStyle('grayscale', undefined)).toBe('grayscale(1)');
      });

      it('uses DEFAULT_FILTER_INTENSITY when intensity is null', () => {
        // null ?? DEFAULT_FILTER_INTENSITY => DEFAULT_FILTER_INTENSITY (100)
        // But Math.max(0, Math.min(100, null)) => Math.max(0, Math.min(100, 0)) => 0
        // Actually: intensity ?? DEFAULT_FILTER_INTENSITY => null is nullish, so 100
        expect(computeFilterStyle('grayscale', null)).toBe('grayscale(1)');
      });

      it('defaults to full intensity for sepia with no intensity arg', () => {
        expect(computeFilterStyle('sepia')).toBe('sepia(0.75)');
      });
    });
  });
});
