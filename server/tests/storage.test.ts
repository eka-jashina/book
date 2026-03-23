import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSend = vi.fn();

// Mock @aws-sdk/client-s3 before importing storage
vi.mock('@aws-sdk/client-s3', () => {
  class MockS3Client {
    send = mockSend;
  }
  class MockPutObjectCommand {
    constructor(public params: unknown) {}
  }
  class MockDeleteObjectCommand {
    constructor(public params: unknown) {}
  }
  class MockGetObjectCommand {
    constructor(public params: unknown) {}
  }
  class MockHeadObjectCommand {
    constructor(public params: unknown) {}
  }
  return {
    S3Client: MockS3Client,
    PutObjectCommand: MockPutObjectCommand,
    DeleteObjectCommand: MockDeleteObjectCommand,
    GetObjectCommand: MockGetObjectCommand,
    HeadObjectCommand: MockHeadObjectCommand,
  };
});

vi.mock('../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  generateFileKey,
  getPublicUrl,
  extractKeyFromUrl,
  uploadFile,
  deleteFile,
  fileExists,
  deleteFileByUrl,
} from '../src/utils/storage.js';

describe('Storage utilities', () => {
  describe('generateFileKey', () => {
    it('should generate key with folder prefix', () => {
      const key = generateFileKey('images', 'photo.jpg');
      expect(key).toMatch(/^images\/[0-9a-f-]+\.jpg$/);
    });

    it('should use file extension from original name', () => {
      const key = generateFileKey('fonts', 'MyFont.woff2');
      expect(key).toMatch(/\.woff2$/);
    });

    it('should generate unique keys', () => {
      const key1 = generateFileKey('sounds', 'audio.mp3');
      const key2 = generateFileKey('sounds', 'audio.mp3');
      expect(key1).not.toBe(key2);
    });

    it('should handle filenames without extension', () => {
      const key = generateFileKey('misc', 'noext');
      expect(key).toMatch(/^misc\/[0-9a-f-]+\.noext$/);
    });

    it('should handle filenames with multiple dots', () => {
      const key = generateFileKey('docs', 'my.file.name.pdf');
      expect(key).toMatch(/\.pdf$/);
    });
  });

  describe('getPublicUrl', () => {
    it('should construct public URL from key', () => {
      const url = getPublicUrl('images/abc-123.jpg');
      expect(url).toBe('http://localhost:9000/flipbook-test/images/abc-123.jpg');
    });
  });

  describe('extractKeyFromUrl', () => {
    it('should extract key from valid public URL', () => {
      const key = extractKeyFromUrl('http://localhost:9000/flipbook-test/images/abc.jpg');
      expect(key).toBe('images/abc.jpg');
    });

    it('should return null for unrelated URL', () => {
      const key = extractKeyFromUrl('https://example.com/images/abc.jpg');
      expect(key).toBeNull();
    });

    it('should return null for empty string', () => {
      const key = extractKeyFromUrl('');
      expect(key).toBeNull();
    });

    it('should handle URL with query parameters', () => {
      const key = extractKeyFromUrl('http://localhost:9000/flipbook-test/file.jpg?v=1');
      expect(key).toBe('file.jpg');
    });

    it('should handle nested paths', () => {
      const key = extractKeyFromUrl('http://localhost:9000/flipbook-test/a/b/c/file.png');
      expect(key).toBe('a/b/c/file.png');
    });
  });

  describe('uploadFile', () => {
    beforeEach(() => {
      mockSend.mockReset();
    });

    it('should upload buffer and return key + url', async () => {
      mockSend.mockResolvedValue({});

      const result = await uploadFile(Buffer.from('data'), 'test/file.txt', 'text/plain');

      expect(result).toHaveProperty('key', 'test/file.txt');
      expect(result).toHaveProperty('url');
      expect(result.url).toContain('test/file.txt');
      expect(mockSend).toHaveBeenCalledTimes(1);
    });
  });

  describe('deleteFile', () => {
    beforeEach(() => {
      mockSend.mockReset();
    });

    it('should send delete command', async () => {
      mockSend.mockResolvedValue({});

      await expect(deleteFile('test/file.txt')).resolves.toBeUndefined();
      expect(mockSend).toHaveBeenCalledTimes(1);
    });
  });

  describe('fileExists', () => {
    beforeEach(() => {
      mockSend.mockReset();
    });

    it('should return true when HeadObject succeeds', async () => {
      mockSend.mockResolvedValue({});

      const result = await fileExists('test/file.txt');
      expect(result).toBe(true);
    });

    it('should return false when HeadObject throws', async () => {
      mockSend.mockRejectedValue(new Error('NotFound'));

      const result = await fileExists('missing/file.txt');
      expect(result).toBe(false);
    });
  });

  describe('deleteFileByUrl', () => {
    beforeEach(() => {
      mockSend.mockReset();
    });

    it('should delete file when URL matches S3 prefix', async () => {
      mockSend.mockResolvedValue({});

      await expect(
        deleteFileByUrl('http://localhost:9000/flipbook-test/images/photo.jpg'),
      ).resolves.toBeUndefined();
      expect(mockSend).toHaveBeenCalled();
    });

    it('should do nothing when URL does not match S3 prefix', async () => {
      await deleteFileByUrl('https://other-server.com/file.jpg');
      expect(mockSend).not.toHaveBeenCalled();
    });
  });
});
