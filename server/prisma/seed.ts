import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create demo user
  const passwordHash = await bcrypt.hash('demo1234', 12);
  const user = await prisma.user.upsert({
    where: { email: 'demo@flipbook.app' },
    update: { username: 'demo' },
    create: {
      email: 'demo@flipbook.app',
      passwordHash,
      displayName: 'Demo User',
      username: 'demo',
    },
  });

  // Create global settings for the user
  await prisma.globalSettings.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id },
  });

  // Create default reading fonts
  const defaultFonts = [
    { fontKey: 'georgia', label: 'Georgia', family: 'Georgia, serif', builtin: true },
    { fontKey: 'times', label: 'Times New Roman', family: '"Times New Roman", Times, serif', builtin: true },
    { fontKey: 'palatino', label: 'Palatino', family: '"Palatino Linotype", Palatino, serif', builtin: true },
    { fontKey: 'arial', label: 'Arial', family: 'Arial, Helvetica, sans-serif', builtin: true },
    { fontKey: 'verdana', label: 'Verdana', family: 'Verdana, Geneva, sans-serif', builtin: true },
  ];

  for (let i = 0; i < defaultFonts.length; i++) {
    const font = defaultFonts[i];
    const existing = await prisma.readingFont.findFirst({
      where: { userId: user.id, fontKey: font.fontKey },
    });
    if (!existing) {
      await prisma.readingFont.create({
        data: { userId: user.id, ...font, position: i, enabled: true },
      });
    }
  }

  // Create a sample book
  const existingBook = await prisma.book.findFirst({
    where: { userId: user.id, title: 'Sample Book' },
  });

  if (!existingBook) {
    const book = await prisma.book.create({
      data: {
        userId: user.id,
        title: 'Sample Book',
        author: 'Flipbook Demo',
        position: 0,
      },
    });

    // Create associated records (sequential to avoid FK race conditions)
    await prisma.bookAppearance.create({ data: { bookId: book.id } });
    await prisma.bookSounds.create({ data: { bookId: book.id } });
    await prisma.bookDefaultSettings.create({ data: { bookId: book.id } });

    // Create a sample chapter
    await prisma.chapter.create({
      data: {
        bookId: book.id,
        title: 'Chapter 1',
        position: 0,
        htmlContent: '<article><h2>Welcome to Flipbook</h2><p>This is a sample chapter to demonstrate the e-book reader.</p><p>You can manage your books, chapters, fonts, sounds, and appearance through the admin panel.</p></article>',
      },
    });

    // Create default ambients
    const ambients = [
      { ambientKey: 'none', label: 'None', shortLabel: 'Off', icon: '🔇', builtin: true, visible: true },
      { ambientKey: 'rain', label: 'Rain', shortLabel: 'Rain', icon: '🌧', builtin: true, visible: true },
      { ambientKey: 'fireplace', label: 'Fireplace', shortLabel: 'Fire', icon: '🔥', builtin: true, visible: true },
      { ambientKey: 'cafe', label: 'Café', shortLabel: 'Café', icon: '☕', builtin: true, visible: true },
    ];

    for (let i = 0; i < ambients.length; i++) {
      await prisma.ambient.create({
        data: { bookId: book.id, ...ambients[i], position: i },
      });
    }

    console.log(`Created sample book: "${book.title}" (${book.id})`);
  }

  console.log(`Seeded user: ${user.email} (${user.id})`);
  console.log('Seeding complete.');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
