import { getPrisma } from '../utils/prisma.js';
import { getConfig } from '../config.js';

interface OgMeta {
  title: string;
  description: string;
  url: string;
  image: string | null;
  type: string;
  locale?: string;
}

const SITE_NAME = 'Flipbook';
const DEFAULT_IMAGE_PATH = '/icons/icon-512.png';

function getBaseUrl(): string {
  return getConfig().APP_URL.replace(/\/$/, '');
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Build OG meta tag string to inject into HTML <head>.
 */
export function buildOgTags(meta: OgMeta): string {
  const image = meta.image || `${getBaseUrl()}${DEFAULT_IMAGE_PATH}`;
  const lines = [
    `<meta property="og:type" content="${escapeHtml(meta.type)}">`,
    `<meta property="og:title" content="${escapeHtml(meta.title)}">`,
    `<meta property="og:description" content="${escapeHtml(meta.description)}">`,
    `<meta property="og:url" content="${escapeHtml(meta.url)}">`,
    `<meta property="og:image" content="${escapeHtml(image)}">`,
    `<meta property="og:site_name" content="${SITE_NAME}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${escapeHtml(meta.title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(meta.description)}">`,
    `<meta name="twitter:image" content="${escapeHtml(image)}">`,
  ];
  if (meta.locale) {
    lines.push(`<meta property="og:locale" content="${escapeHtml(meta.locale)}">`);
  }
  return lines.join('\n    ');
}

/**
 * Get OG meta for a public book page.
 */
export async function getBookOgMeta(bookId: string): Promise<OgMeta | null> {
  const prisma = getPrisma();
  const base = getBaseUrl();

  const book = await prisma.book.findUnique({
    where: { id: bookId },
    select: {
      title: true,
      author: true,
      description: true,
      visibility: true,
      deletedAt: true,
      coverBgCustomUrl: true,
      user: { select: { displayName: true } },
    },
  });

  if (!book || book.visibility === 'draft' || book.deletedAt !== null) {
    return null;
  }

  const authorName = book.author || book.user.displayName || '';
  const desc = book.description
    || (authorName ? `${book.title} — ${authorName}` : book.title);

  return {
    type: 'book',
    title: `${book.title} — ${SITE_NAME}`,
    description: desc.slice(0, 200),
    url: `${base}/book/${bookId}`,
    image: book.coverBgCustomUrl || null,
  };
}

/**
 * Get OG meta for an author shelf page.
 */
export async function getShelfOgMeta(username: string): Promise<OgMeta | null> {
  const prisma = getPrisma();
  const base = getBaseUrl();

  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      displayName: true,
      bio: true,
      avatarUrl: true,
      _count: { select: { books: { where: { visibility: 'published', deletedAt: null } } } },
    },
  });

  if (!user) return null;

  const name = user.displayName || username;
  const desc = user.bio || `${name} — ${user._count.books} books on ${SITE_NAME}`;

  return {
    type: 'profile',
    title: `${name} — ${SITE_NAME}`,
    description: desc.slice(0, 200),
    url: `${base}/${username}`,
    image: user.avatarUrl || null,
  };
}

/**
 * Inject OG meta tags into SPA HTML, replacing the static defaults.
 */
export function injectOgTags(html: string, meta: OgMeta): string {
  const ogTags = buildOgTags(meta);

  // Replace the static OG block (between <!-- Open Graph --> and <!-- Twitter Card --> or next section)
  // Also replace static twitter card tags
  let result = html;

  // Remove existing OG tags
  result = result.replace(/<meta property="og:[^"]*" content="[^"]*">\s*/g, '');
  // Remove existing Twitter tags
  result = result.replace(/<meta name="twitter:[^"]*" content="[^"]*">\s*/g, '');
  // Remove OG/Twitter comment markers
  result = result.replace(/\s*<!-- Open Graph -->\s*/g, '\n    ');
  result = result.replace(/\s*<!-- Twitter Card -->\s*/g, '');

  // Inject new tags before </head>
  result = result.replace('</head>', `    ${ogTags}\n  </head>`);

  // Update <title> and description
  result = result.replace(
    /<title>[^<]*<\/title>/,
    `<title>${escapeHtml(meta.title)}</title>`,
  );
  result = result.replace(
    /<meta name="description" content="[^"]*">/,
    `<meta name="description" content="${escapeHtml(meta.description)}">`,
  );

  // Update canonical URL
  result = result.replace(
    /<link rel="canonical" href="[^"]*">/,
    `<link rel="canonical" href="${escapeHtml(meta.url)}">`,
  );

  return result;
}

/**
 * Generate sitemap.xml with public books and author shelves.
 */
export async function generateSitemap(): Promise<string> {
  const prisma = getPrisma();
  const base = getBaseUrl();

  const [books, authors] = await Promise.all([
    prisma.book.findMany({
      where: { visibility: 'published', deletedAt: null },
      select: { id: true, updatedAt: true },
      orderBy: { publishedAt: 'desc' },
      take: 5000,
    }),
    prisma.user.findMany({
      where: {
        username: { not: null },
        books: { some: { visibility: 'published', deletedAt: null } },
      },
      select: { username: true, updatedAt: true },
      take: 5000,
    }),
  ]);

  const urls: string[] = [
    `  <url>
    <loc>${escapeHtml(base)}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>`,
  ];

  for (const book of books) {
    urls.push(`  <url>
    <loc>${escapeHtml(base)}/book/${book.id}</loc>
    <lastmod>${book.updatedAt.toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`);
  }

  for (const author of authors) {
    urls.push(`  <url>
    <loc>${escapeHtml(base)}/${escapeHtml(author.username!)}</loc>
    <lastmod>${author.updatedAt.toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;
}
