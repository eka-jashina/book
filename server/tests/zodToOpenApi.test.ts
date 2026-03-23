import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { zodToOpenApi } from '../src/utils/zodToOpenApi.js';

describe('zodToOpenApi', () => {
  describe('primitive types', () => {
    it('should convert ZodString to { type: "string" }', () => {
      expect(zodToOpenApi(z.string())).toEqual({ type: 'string' });
    });

    it('should convert ZodNumber to { type: "number" }', () => {
      expect(zodToOpenApi(z.number())).toEqual({ type: 'number' });
    });

    it('should convert ZodBoolean to { type: "boolean" }', () => {
      expect(zodToOpenApi(z.boolean())).toEqual({ type: 'boolean' });
    });

    it('should convert ZodNumber.int() to { type: "integer" }', () => {
      expect(zodToOpenApi(z.number().int())).toEqual({ type: 'integer' });
    });
  });

  describe('string constraints', () => {
    it('should include minLength', () => {
      const schema = zodToOpenApi(z.string().min(3));
      expect(schema).toMatchObject({ type: 'string', minLength: 3 });
    });

    it('should include maxLength', () => {
      const schema = zodToOpenApi(z.string().max(100));
      expect(schema).toMatchObject({ type: 'string', maxLength: 100 });
    });

    it('should include email format', () => {
      const schema = zodToOpenApi(z.string().email());
      expect(schema).toMatchObject({ type: 'string', format: 'email' });
    });

    it('should include uuid format', () => {
      const schema = zodToOpenApi(z.string().uuid());
      expect(schema).toMatchObject({ type: 'string', format: 'uuid' });
    });
  });

  describe('number constraints', () => {
    it('should include minimum', () => {
      const schema = zodToOpenApi(z.number().min(0));
      expect(schema).toMatchObject({ type: 'number', minimum: 0 });
    });

    it('should include maximum', () => {
      const schema = zodToOpenApi(z.number().max(100));
      expect(schema).toMatchObject({ type: 'number', maximum: 100 });
    });
  });

  describe('enum', () => {
    it('should convert ZodEnum to string enum', () => {
      const schema = zodToOpenApi(z.enum(['light', 'dark', 'bw']));
      expect(schema).toEqual({ type: 'string', enum: ['light', 'dark', 'bw'] });
    });
  });

  describe('array', () => {
    it('should convert ZodArray with items', () => {
      const schema = zodToOpenApi(z.array(z.string()));
      expect(schema).toEqual({ type: 'array', items: { type: 'string' } });
    });

    it('should handle nested arrays', () => {
      const schema = zodToOpenApi(z.array(z.array(z.number())));
      expect(schema).toEqual({
        type: 'array',
        items: { type: 'array', items: { type: 'number' } },
      });
    });
  });

  describe('object', () => {
    it('should convert ZodObject with properties and required', () => {
      const schema = zodToOpenApi(
        z.object({
          title: z.string(),
          page: z.number(),
        }),
      );
      expect(schema).toEqual({
        type: 'object',
        properties: {
          title: { type: 'string' },
          page: { type: 'number' },
        },
        required: ['title', 'page'],
      });
    });

    it('should exclude optional fields from required', () => {
      const schema = zodToOpenApi(
        z.object({
          name: z.string(),
          bio: z.string().optional(),
        }),
      );
      expect(schema.required).toEqual(['name']);
      expect(schema.properties).toHaveProperty('bio');
    });

    it('should exclude fields with defaults from required', () => {
      const schema = zodToOpenApi(
        z.object({
          theme: z.string().default('light'),
        }),
      );
      expect(schema.required).toBeUndefined();
      expect(schema.properties!.theme).toMatchObject({ type: 'string', default: 'light' });
    });
  });

  describe('nullable', () => {
    it('should add nullable: true', () => {
      const schema = zodToOpenApi(z.string().nullable());
      expect(schema).toEqual({ type: 'string', nullable: true });
    });
  });

  describe('optional', () => {
    it('should unwrap optional', () => {
      const schema = zodToOpenApi(z.string().optional());
      expect(schema).toEqual({ type: 'string' });
    });
  });

  describe('default', () => {
    it('should include default value', () => {
      const schema = zodToOpenApi(z.number().default(42));
      expect(schema).toMatchObject({ type: 'number', default: 42 });
    });
  });

  describe('effects (transform/refine)', () => {
    it('should unwrap effects to underlying schema', () => {
      const schema = zodToOpenApi(z.string().transform((s) => s.toUpperCase()));
      expect(schema).toEqual({ type: 'string' });
    });
  });

  describe('complex nested schema', () => {
    it('should handle a realistic API schema', () => {
      const bookSchema = z.object({
        title: z.string().min(1).max(200),
        description: z.string().optional(),
        visibility: z.enum(['draft', 'published']).default('draft'),
        chapters: z.array(
          z.object({
            title: z.string(),
            content: z.string(),
          }),
        ),
      });

      const result = zodToOpenApi(bookSchema);

      expect(result.type).toBe('object');
      expect(result.properties!.title).toMatchObject({
        type: 'string',
        minLength: 1,
        maxLength: 200,
      });
      expect(result.properties!.visibility).toMatchObject({
        type: 'string',
        enum: ['draft', 'published'],
        default: 'draft',
      });
      expect(result.properties!.chapters).toMatchObject({
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            content: { type: 'string' },
          },
        },
      });
      // title and chapters are required; description is optional; visibility has default
      expect(result.required).toEqual(['title', 'chapters']);
    });
  });
});
