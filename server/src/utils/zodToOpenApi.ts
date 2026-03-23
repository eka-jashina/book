/**
 * Minimal Zod-to-OpenAPI converter.
 * Converts Zod schemas to OpenAPI 3.0 JSON Schema objects.
 */
import type { ZodTypeAny } from 'zod';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ZodDef = any;

export interface OpenApiSchema {
  type?: string;
  format?: string;
  properties?: Record<string, OpenApiSchema>;
  required?: string[];
  items?: OpenApiSchema;
  enum?: string[];
  nullable?: boolean;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  default?: unknown;
}

function convertDef(def: ZodDef): OpenApiSchema {
  const typeName: string = def.typeName;

  switch (typeName) {
    case 'ZodString': {
      const schema: OpenApiSchema = { type: 'string' };
      for (const check of def.checks ?? []) {
        if (check.kind === 'min') schema.minLength = check.value;
        if (check.kind === 'max') schema.maxLength = check.value;
        if (check.kind === 'email') schema.format = 'email';
        if (check.kind === 'uuid') schema.format = 'uuid';
      }
      return schema;
    }

    case 'ZodNumber': {
      const isInt = (def.checks ?? []).some((c: ZodDef) => c.kind === 'int');
      const schema: OpenApiSchema = { type: isInt ? 'integer' : 'number' };
      for (const check of def.checks ?? []) {
        if (check.kind === 'min') schema.minimum = check.value;
        if (check.kind === 'max') schema.maximum = check.value;
      }
      return schema;
    }

    case 'ZodBoolean':
      return { type: 'boolean' };

    case 'ZodEnum':
      return { type: 'string', enum: def.values };

    case 'ZodArray':
      return { type: 'array', items: convertDef(def.type._def) };

    case 'ZodObject': {
      const shape = def.shape();
      const properties: Record<string, OpenApiSchema> = {};
      const required: string[] = [];
      for (const [key, value] of Object.entries(shape)) {
        properties[key] = convertDef((value as ZodTypeAny)._def);
        if (!isOptional(value as ZodTypeAny)) {
          required.push(key);
        }
      }
      const schema: OpenApiSchema = { type: 'object', properties };
      if (required.length > 0) schema.required = required;
      return schema;
    }

    case 'ZodOptional':
      return convertDef(def.innerType._def);

    case 'ZodNullable':
      return { ...convertDef(def.innerType._def), nullable: true };

    case 'ZodDefault':
      return { ...convertDef(def.innerType._def), default: def.defaultValue() };

    case 'ZodEffects':
      return convertDef(def.schema._def);

    default:
      return {};
  }
}

function isOptional(schema: ZodTypeAny): boolean {
  const typeName: string = schema._def.typeName;
  if (typeName === 'ZodOptional') return true;
  if (typeName === 'ZodDefault') return true;
  if (typeName === 'ZodNullable') return isOptional(schema._def.innerType);
  return false;
}

/**
 * Convert a Zod schema to an OpenAPI 3.0 schema object.
 */
export function zodToOpenApi(schema: ZodTypeAny): OpenApiSchema {
  return convertDef(schema._def);
}
