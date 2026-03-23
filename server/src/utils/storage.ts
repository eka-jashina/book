import { randomUUID } from 'node:crypto';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getConfig } from '../config.js';
import { logger } from './logger.js';

let s3Client: S3Client | null = null;

export function getS3Client(): S3Client {
  if (s3Client) return s3Client;

  const config = getConfig();

  s3Client = new S3Client({
    region: config.S3_REGION,
    endpoint: config.S3_ENDPOINT || undefined,
    forcePathStyle: config.S3_FORCE_PATH_STYLE,
    credentials: {
      accessKeyId: config.S3_ACCESS_KEY,
      secretAccessKey: config.S3_SECRET_KEY,
    },
  });

  return s3Client;
}

export interface UploadResult {
  key: string;
  url: string;
}

/**
 * Upload a file to S3-compatible storage.
 */
export async function uploadFile(
  buffer: Buffer,
  key: string,
  contentType: string,
): Promise<UploadResult> {
  const config = getConfig();
  const client = getS3Client();

  await client.send(
    new PutObjectCommand({
      Bucket: config.S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }),
  );

  const url = `${config.S3_PUBLIC_URL}/${key}`;
  logger.info({ key, contentType }, 'File uploaded to S3');

  return { key, url };
}

/**
 * Delete a file from S3-compatible storage.
 */
export async function deleteFile(key: string): Promise<void> {
  const config = getConfig();
  const client = getS3Client();

  await client.send(
    new DeleteObjectCommand({
      Bucket: config.S3_BUCKET,
      Key: key,
    }),
  );

  logger.info({ key }, 'File deleted from S3');
}

/**
 * Get a file from S3-compatible storage.
 */
export async function getFile(
  key: string,
): Promise<{ body: ReadableStream | null; contentType: string | undefined }> {
  const config = getConfig();
  const client = getS3Client();

  const response = await client.send(
    new GetObjectCommand({
      Bucket: config.S3_BUCKET,
      Key: key,
    }),
  );

  return {
    body: response.Body as ReadableStream | null,
    contentType: response.ContentType,
  };
}

/**
 * Check if a file exists in S3.
 */
export async function fileExists(key: string): Promise<boolean> {
  const config = getConfig();
  const client = getS3Client();

  try {
    await client.send(
      new HeadObjectCommand({
        Bucket: config.S3_BUCKET,
        Key: key,
      }),
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Generate a unique file key for S3 storage.
 * Uses full UUID to avoid collisions under concurrent uploads.
 */
export function generateFileKey(
  folder: string,
  originalName: string,
): string {
  const uuid = randomUUID();
  const ext = originalName.split('.').pop() || '';
  return `${folder}/${uuid}.${ext}`;
}

/**
 * Get the public URL for a given S3 key.
 */
export function getPublicUrl(key: string): string {
  const config = getConfig();
  return `${config.S3_PUBLIC_URL}/${key}`;
}

/**
 * Extract the S3 key from a public URL.
 * Returns null if the URL doesn't match the configured S3_PUBLIC_URL prefix.
 * Uses URL parsing to correctly handle query parameters and fragments.
 */
export function extractKeyFromUrl(url: string): string | null {
  const config = getConfig();
  const prefix = config.S3_PUBLIC_URL + '/';
  if (!url.startsWith(prefix)) return null;

  try {
    const parsed = new URL(url);
    const prefixParsed = new URL(config.S3_PUBLIC_URL);
    // Ensure same origin
    if (parsed.origin !== prefixParsed.origin) return null;
    // Extract key: pathname after the prefix pathname
    const prefixPath = prefixParsed.pathname.replace(/\/$/, '');
    const fullPath = parsed.pathname;
    if (!fullPath.startsWith(prefixPath + '/')) return null;
    return fullPath.slice(prefixPath.length + 1);
  } catch {
    // Fallback for non-URL strings (e.g., relative paths)
    return null;
  }
}

/**
 * Delete a file from S3 by its public URL (best-effort).
 */
export async function deleteFileByUrl(url: string): Promise<void> {
  const key = extractKeyFromUrl(url);
  if (key) await deleteFile(key);
}
