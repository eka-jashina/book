import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  readPageImageFile,
  cropPageImage,
  resetCrop,
  rotatePageImage,
  distributeBulkFiles,
  processBulkFiles,
  bulkUploadToPage,
} from '../../../js/admin/modules/AlbumImageProcessor.js';

vi.mock('@i18n', () => ({
  t: (key) => key,
}));

function createMockManager(pages = []) {
  return {
    _albumPages: pages,
    _isDirty: false,
    _cropper: { crop: vi.fn() },
    _module: {
      _showToast: vi.fn(),
      _validateFile: vi.fn(() => true),
    },
    _compressImage: vi.fn(async () => 'data:image/jpeg;base64,compressed'),
    store: { uploadImage: vi.fn().mockResolvedValue(null) },
    _renderAlbumPages: vi.fn(),
    _getSlotElement: vi.fn(() => ({
      classList: { add: vi.fn(), remove: vi.fn() },
    })),
  };
}

function createPage(layout = '4', images = []) {
  return { layout, images };
}

function createImage(dataUrl = 'data:image/jpeg;base64,test', opts = {}) {
  return {
    dataUrl,
    originalDataUrl: opts.originalDataUrl || dataUrl,
    caption: opts.caption || '',
    frame: opts.frame || 'none',
    filter: opts.filter || 'none',
    filterIntensity: opts.filterIntensity ?? 100,
    rotation: opts.rotation || 0,
  };
}

function createFakeFile(name = 'photo.jpg', type = 'image/jpeg') {
  return { name, type, size: 1024 };
}

describe('AlbumImageProcessor', () => {
  // ── readPageImageFile ──────────────────────────────────────────────

  describe('readPageImageFile', () => {
    it('sets image data, marks dirty and renders on success', async () => {
      const page = createPage('4', []);
      const manager = createMockManager([page]);
      const file = createFakeFile();

      await readPageImageFile(manager, file, 0, 0);

      expect(manager._compressImage).toHaveBeenCalledWith(file);
      expect(manager._isDirty).toBe(true);
      expect(page.images[0]).toEqual(
        expect.objectContaining({
          dataUrl: 'data:image/jpeg;base64,compressed',
          originalDataUrl: 'data:image/jpeg;base64,compressed',
          caption: '',
          frame: 'none',
          filter: 'none',
          rotation: 0,
        }),
      );
      expect(manager._renderAlbumPages).toHaveBeenCalled();
    });

    it('preserves existing caption and frame from previous image', async () => {
      const page = createPage('4', [
        createImage('data:old', { caption: 'My photo', frame: 'polaroid' }),
      ]);
      const manager = createMockManager([page]);

      await readPageImageFile(manager, createFakeFile(), 0, 0);

      expect(page.images[0].caption).toBe('My photo');
      expect(page.images[0].frame).toBe('polaroid');
    });

    it('adds loading class to slot element', async () => {
      const slotEl = { classList: { add: vi.fn(), remove: vi.fn() } };
      const manager = createMockManager([createPage()]);
      manager._getSlotElement.mockReturnValue(slotEl);

      await readPageImageFile(manager, createFakeFile(), 0, 0);

      expect(slotEl.classList.add).toHaveBeenCalledWith('loading');
    });

    it('shows toast and removes loading on compress error', async () => {
      const slotEl = { classList: { add: vi.fn(), remove: vi.fn() } };
      const manager = createMockManager([createPage()]);
      manager._getSlotElement.mockReturnValue(slotEl);
      manager._compressImage.mockRejectedValue(new Error('fail'));

      await readPageImageFile(manager, createFakeFile(), 0, 0);

      expect(slotEl.classList.remove).toHaveBeenCalledWith('loading');
      expect(manager._module._showToast).toHaveBeenCalledWith('admin.album.processingError');
      expect(manager._isDirty).toBe(false);
    });

    it('handles null page safely (page deleted during compression)', async () => {
      const manager = createMockManager([createPage()]);
      // Page exists when called but simulate deletion during compress
      manager._compressImage.mockImplementation(async () => {
        manager._albumPages[0] = undefined;
        return 'data:image/jpeg;base64,compressed';
      });

      // Should not throw
      await readPageImageFile(manager, createFakeFile(), 0, 0);

      expect(manager._isDirty).toBe(false);
      expect(manager._renderAlbumPages).not.toHaveBeenCalled();
    });

    it('handles null slot element gracefully', async () => {
      const manager = createMockManager([createPage()]);
      manager._getSlotElement.mockReturnValue(null);

      // Should not throw
      await readPageImageFile(manager, createFakeFile(), 0, 0);

      expect(manager._compressImage).toHaveBeenCalled();
    });
  });

  // ── cropPageImage ──────────────────────────────────────────────────

  describe('cropPageImage', () => {
    it('updates dataUrl with cropped result and preserves originalDataUrl', async () => {
      const originalUrl = 'data:image/jpeg;base64,b3JpZ2luYWw=';
      const croppedOnce = 'data:image/jpeg;base64,Y3JvcHBlZE9uY2U=';
      const croppedNew = 'data:image/jpeg;base64,Y3JvcHBlZE5ldw==';
      const img = createImage(croppedOnce, { originalDataUrl: originalUrl });
      const page = createPage('1', [img]);
      const manager = createMockManager([page]);
      manager._cropper.crop.mockResolvedValue(croppedNew);

      await cropPageImage(manager, 0, 0);

      expect(manager._cropper.crop).toHaveBeenCalledWith(originalUrl);
      expect(page.images[0].dataUrl).toBe(croppedNew);
      expect(page.images[0].originalDataUrl).toBe(originalUrl);
      expect(manager._isDirty).toBe(true);
      expect(manager._renderAlbumPages).toHaveBeenCalled();
    });

    it('sets originalDataUrl if not already present', async () => {
      const currentUrl = 'data:image/jpeg;base64,Y3VycmVudA==';
      const croppedUrl = 'data:image/jpeg;base64,Y3JvcHBlZA==';
      const img = { dataUrl: currentUrl, caption: '', frame: 'none', filter: 'none', rotation: 0 };
      const page = createPage('1', [img]);
      const manager = createMockManager([page]);
      manager._cropper.crop.mockResolvedValue(croppedUrl);

      await cropPageImage(manager, 0, 0);

      expect(page.images[0].originalDataUrl).toBe(currentUrl);
    });

    it('does nothing when user cancels crop (returns null)', async () => {
      const img = createImage('data:test');
      const page = createPage('1', [img]);
      const manager = createMockManager([page]);
      manager._cropper.crop.mockResolvedValue(null);

      await cropPageImage(manager, 0, 0);

      expect(page.images[0].dataUrl).toBe('data:test');
      expect(manager._isDirty).toBe(false);
      expect(manager._renderAlbumPages).not.toHaveBeenCalled();
    });

    it('does nothing when image has no dataUrl', async () => {
      const page = createPage('1', [{ caption: '' }]);
      const manager = createMockManager([page]);

      await cropPageImage(manager, 0, 0);

      expect(manager._cropper.crop).not.toHaveBeenCalled();
    });

    it('does nothing when image slot is empty', async () => {
      const page = createPage('1', []);
      const manager = createMockManager([page]);

      await cropPageImage(manager, 0, 0);

      expect(manager._cropper.crop).not.toHaveBeenCalled();
    });

    it('does nothing when page does not exist', async () => {
      const manager = createMockManager([]);

      await cropPageImage(manager, 5, 0);

      expect(manager._cropper.crop).not.toHaveBeenCalled();
    });

    it('shows toast on crop error', async () => {
      const img = createImage('data:test');
      const page = createPage('1', [img]);
      const manager = createMockManager([page]);
      manager._cropper.crop.mockRejectedValue(new Error('crop failed'));

      await cropPageImage(manager, 0, 0);

      expect(manager._module._showToast).toHaveBeenCalledWith('admin.album.cropError');
    });

    it('handles page deleted during cropping', async () => {
      const img = createImage('data:test');
      const page = createPage('1', [img]);
      const manager = createMockManager([page]);
      manager._cropper.crop.mockImplementation(async () => {
        manager._albumPages[0] = undefined;
        return 'data:cropped';
      });

      await cropPageImage(manager, 0, 0);

      expect(manager._isDirty).toBe(false);
      expect(manager._renderAlbumPages).not.toHaveBeenCalled();
    });
  });

  // ── resetCrop ──────────────────────────────────────────────────────

  describe('resetCrop', () => {
    it('restores dataUrl from originalDataUrl', () => {
      const img = createImage('data:cropped', { originalDataUrl: 'data:original' });
      const page = createPage('1', [img]);
      const manager = createMockManager([page]);

      resetCrop(manager, 0, 0);

      expect(img.dataUrl).toBe('data:original');
      expect(manager._isDirty).toBe(true);
      expect(manager._renderAlbumPages).toHaveBeenCalled();
    });

    it('does nothing when dataUrl already equals originalDataUrl', () => {
      const img = createImage('data:same', { originalDataUrl: 'data:same' });
      const page = createPage('1', [img]);
      const manager = createMockManager([page]);

      resetCrop(manager, 0, 0);

      expect(manager._isDirty).toBe(false);
      expect(manager._renderAlbumPages).not.toHaveBeenCalled();
    });

    it('does nothing when no originalDataUrl', () => {
      const img = { dataUrl: 'data:test' };
      const page = createPage('1', [img]);
      const manager = createMockManager([page]);

      resetCrop(manager, 0, 0);

      expect(manager._isDirty).toBe(false);
      expect(manager._renderAlbumPages).not.toHaveBeenCalled();
    });

    it('does nothing when page does not exist', () => {
      const manager = createMockManager([]);

      resetCrop(manager, 5, 0);

      expect(manager._isDirty).toBe(false);
      expect(manager._renderAlbumPages).not.toHaveBeenCalled();
    });

    it('does nothing when image slot is empty', () => {
      const page = createPage('1', []);
      const manager = createMockManager([page]);

      resetCrop(manager, 0, 0);

      expect(manager._isDirty).toBe(false);
    });
  });

  // ── rotatePageImage ────────────────────────────────────────────────

  describe('rotatePageImage', () => {
    it('cycles rotation 0 → 90 → 180 → 270 → 0', () => {
      const img = createImage('data:test', { rotation: 0 });
      const page = createPage('1', [img]);
      const manager = createMockManager([page]);

      rotatePageImage(manager, 0, 0);
      expect(img.rotation).toBe(90);

      rotatePageImage(manager, 0, 0);
      expect(img.rotation).toBe(180);

      rotatePageImage(manager, 0, 0);
      expect(img.rotation).toBe(270);

      rotatePageImage(manager, 0, 0);
      expect(img.rotation).toBe(0);
    });

    it('marks dirty and renders on each rotation', () => {
      const img = createImage('data:test');
      const page = createPage('1', [img]);
      const manager = createMockManager([page]);

      rotatePageImage(manager, 0, 0);

      expect(manager._isDirty).toBe(true);
      expect(manager._renderAlbumPages).toHaveBeenCalled();
    });

    it('does nothing when image has no dataUrl', () => {
      const page = createPage('1', [{ caption: '' }]);
      const manager = createMockManager([page]);

      rotatePageImage(manager, 0, 0);

      expect(manager._isDirty).toBe(false);
      expect(manager._renderAlbumPages).not.toHaveBeenCalled();
    });

    it('does nothing when image slot is empty', () => {
      const page = createPage('1', []);
      const manager = createMockManager([page]);

      rotatePageImage(manager, 0, 0);

      expect(manager._isDirty).toBe(false);
    });

    it('does nothing when page does not exist', () => {
      const manager = createMockManager([]);

      rotatePageImage(manager, 5, 0);

      expect(manager._isDirty).toBe(false);
      expect(manager._renderAlbumPages).not.toHaveBeenCalled();
    });

    it('handles image with undefined rotation (treats as 0)', () => {
      const img = { dataUrl: 'data:test' };
      const page = createPage('1', [img]);
      const manager = createMockManager([page]);

      rotatePageImage(manager, 0, 0);

      expect(img.rotation).toBe(90);
    });
  });

  // ── distributeBulkFiles ────────────────────────────────────────────

  describe('distributeBulkFiles', () => {
    it('fills empty slots in existing pages', async () => {
      const page = createPage('2', [createImage('data:existing'), undefined]);
      const manager = createMockManager([page]);
      const files = [createFakeFile('a.jpg')];

      await distributeBulkFiles(manager, files);

      expect(manager._module._validateFile).toHaveBeenCalledWith(files[0], expect.any(Object));
      expect(manager._compressImage).toHaveBeenCalledTimes(1);
      expect(manager._renderAlbumPages).toHaveBeenCalled();
    });

    it('creates new pages for overflow files', async () => {
      // Page with all slots filled
      const page = createPage('1', [createImage('data:full')]);
      const manager = createMockManager([page]);
      const files = [createFakeFile('a.jpg'), createFakeFile('b.jpg')];

      await distributeBulkFiles(manager, files);

      // Should have created a new page with layout '4'
      expect(manager._albumPages.length).toBeGreaterThan(1);
      expect(manager._albumPages[1].layout).toBe('4');
    });

    it('filters out invalid files via _validateFile', async () => {
      const manager = createMockManager([createPage('4', [])]);
      manager._module._validateFile
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true);

      const files = [createFakeFile('a.jpg'), createFakeFile('b.jpg'), createFakeFile('c.jpg')];

      await distributeBulkFiles(manager, files);

      // Only 2 valid files should be processed
      expect(manager._compressImage).toHaveBeenCalledTimes(2);
    });

    it('does nothing when all files are invalid', async () => {
      const manager = createMockManager([createPage('4', [])]);
      manager._module._validateFile.mockReturnValue(false);

      await distributeBulkFiles(manager, [createFakeFile()]);

      expect(manager._compressImage).not.toHaveBeenCalled();
      expect(manager._renderAlbumPages).not.toHaveBeenCalled();
    });

    it('distributes across multiple existing pages before creating new ones', async () => {
      const pages = [
        createPage('1', [createImage()]),  // full
        createPage('2', [createImage()]),  // 1 empty slot
        createPage('1', []),               // 1 empty slot
      ];
      const manager = createMockManager(pages);
      const files = [createFakeFile('a.jpg'), createFakeFile('b.jpg')];

      await distributeBulkFiles(manager, files);

      // 2 empty slots across pages, 2 files — no new pages needed
      expect(manager._albumPages.length).toBe(3);
      expect(manager._compressImage).toHaveBeenCalledTimes(2);
    });

    it('creates multiple new pages when many files overflow', async () => {
      const manager = createMockManager([]); // no existing pages
      // 6 files, layout '4' = 4 slots per page => 2 pages needed
      const files = Array.from({ length: 6 }, (_, i) => createFakeFile(`${i}.jpg`));

      await distributeBulkFiles(manager, files);

      // Should create 2 new pages (4 + 2)
      expect(manager._albumPages.length).toBe(2);
      expect(manager._compressImage).toHaveBeenCalledTimes(6);
    });
  });

  // ── processBulkFiles ──────────────────────────────────────────────

  describe('processBulkFiles', () => {
    it('processes files into specified slots', async () => {
      const page = createPage('4', []);
      const manager = createMockManager([page]);
      const files = [createFakeFile('a.jpg'), createFakeFile('b.jpg')];
      const slots = [
        { pageIndex: 0, imageIndex: 0 },
        { pageIndex: 0, imageIndex: 1 },
      ];

      await processBulkFiles(manager, files, slots);

      expect(page.images[0].dataUrl).toBe('data:image/jpeg;base64,compressed');
      expect(page.images[1].dataUrl).toBe('data:image/jpeg;base64,compressed');
      expect(manager._isDirty).toBe(true);
      expect(manager._renderAlbumPages).toHaveBeenCalled();
    });

    it('adds loading class to slot elements', async () => {
      const slotEl = { classList: { add: vi.fn(), remove: vi.fn() } };
      const manager = createMockManager([createPage('4', [])]);
      manager._getSlotElement.mockReturnValue(slotEl);

      await processBulkFiles(manager, [createFakeFile()], [{ pageIndex: 0, imageIndex: 0 }]);

      expect(slotEl.classList.add).toHaveBeenCalledWith('loading');
    });

    it('handles compress error for individual files gracefully', async () => {
      const page = createPage('4', []);
      const manager = createMockManager([page]);
      const slotEl = { classList: { add: vi.fn(), remove: vi.fn() } };
      manager._getSlotElement.mockReturnValue(slotEl);

      manager._compressImage
        .mockResolvedValueOnce('data:image/jpeg;base64,ok')
        .mockRejectedValueOnce(new Error('compress failed'));

      const files = [createFakeFile('a.jpg'), createFakeFile('b.jpg')];
      const slots = [
        { pageIndex: 0, imageIndex: 0 },
        { pageIndex: 0, imageIndex: 1 },
      ];

      await processBulkFiles(manager, files, slots);

      // First file succeeded
      expect(page.images[0].dataUrl).toBe('data:image/jpeg;base64,ok');
      // Second file failed — slot should have loading removed
      expect(slotEl.classList.remove).toHaveBeenCalledWith('loading');
      // Render still called at the end
      expect(manager._renderAlbumPages).toHaveBeenCalled();
    });

    it('skips deleted pages during processing', async () => {
      const page = createPage('4', []);
      const manager = createMockManager([page]);
      manager._compressImage.mockImplementation(async () => {
        manager._albumPages[0] = undefined;
        return 'data:image/jpeg;base64,compressed';
      });

      await processBulkFiles(manager, [createFakeFile()], [{ pageIndex: 0, imageIndex: 0 }]);

      expect(manager._isDirty).toBe(false);
    });

    it('preserves existing caption and frame from previous image in slot', async () => {
      const page = createPage('4', [
        createImage('data:old', { caption: 'Keep me', frame: 'shadow', filter: 'sepia' }),
      ]);
      const manager = createMockManager([page]);

      await processBulkFiles(manager, [createFakeFile()], [{ pageIndex: 0, imageIndex: 0 }]);

      expect(page.images[0].caption).toBe('Keep me');
      expect(page.images[0].frame).toBe('shadow');
      expect(page.images[0].filter).toBe('sepia');
    });
  });

  // ── bulkUploadToPage ──────────────────────────────────────────────

  describe('bulkUploadToPage', () => {
    it('shows toast when no empty slots available', () => {
      const page = createPage('1', [createImage('data:full')]);
      const manager = createMockManager([page]);

      bulkUploadToPage(manager, 0);

      expect(manager._module._showToast).toHaveBeenCalledWith('admin.album.noEmptySlots');
    });

    it('does nothing when page does not exist', () => {
      const manager = createMockManager([]);

      bulkUploadToPage(manager, 5);

      expect(manager._module._showToast).not.toHaveBeenCalled();
    });

    it('identifies correct number of empty slots', () => {
      // Layout '4' = 4 slots, 2 filled => 2 empty
      const page = createPage('4', [createImage(), undefined, createImage()]);
      const manager = createMockManager([page]);

      // We can't easily test the file input flow, but we can verify
      // no toast is shown (meaning empty slots were found)
      bulkUploadToPage(manager, 0);

      expect(manager._module._showToast).not.toHaveBeenCalled();
    });

    it('treats slots with no dataUrl as empty', () => {
      const page = createPage('2', [{ caption: 'no image' }, createImage()]);
      const manager = createMockManager([page]);

      bulkUploadToPage(manager, 0);

      // Should not show toast — slot 0 has no dataUrl so it's empty
      expect(manager._module._showToast).not.toHaveBeenCalled();
    });
  });
});
