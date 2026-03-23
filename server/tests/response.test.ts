import { describe, it, expect, vi } from 'vitest';
import type { Response } from 'express';
import { ok, created } from '../src/utils/response.js';

function createMockRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

describe('Response helpers', () => {
  describe('ok()', () => {
    it('should send 200 with data envelope', () => {
      const res = createMockRes();
      ok(res, { id: 1, name: 'Test' });

      expect(res.json).toHaveBeenCalledWith({ data: { id: 1, name: 'Test' } });
      // ok() doesn't call res.status — Express defaults to 200
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should include meta when provided', () => {
      const res = createMockRes();
      ok(res, [1, 2, 3], { total: 100, page: 1 });

      expect(res.json).toHaveBeenCalledWith({
        data: [1, 2, 3],
        meta: { total: 100, page: 1 },
      });
    });

    it('should not include meta key when meta is undefined', () => {
      const res = createMockRes();
      ok(res, 'hello');

      const call = (res.json as any).mock.calls[0][0];
      expect(call).toEqual({ data: 'hello' });
      expect(call).not.toHaveProperty('meta');
    });

    it('should handle null data', () => {
      const res = createMockRes();
      ok(res, null);

      expect(res.json).toHaveBeenCalledWith({ data: null });
    });
  });

  describe('created()', () => {
    it('should send 201 with data envelope', () => {
      const res = createMockRes();
      created(res, { id: 'new-id', title: 'New Book' });

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ data: { id: 'new-id', title: 'New Book' } });
    });

    it('should handle empty object data', () => {
      const res = createMockRes();
      created(res, {});

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ data: {} });
    });
  });
});
