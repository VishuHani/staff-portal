import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Creating admin user with profile fields...\n');

  // Get admin role and store
  const adminRole = await prisma.role.findUnique({ where: { name: 'ADMIN' } });
  const mainStore = await prisma.store.findUnique({ where: { code: 'MAIN' } });

  if (!adminRole) {
    console.error('❌ Admin role not found');
    return;
  }

  // Check if user already exists
  const existing = await prisma.user.findUnique({
    where: { email: 'sharma.vs004@gmail.com' }
  });

  if (existing) {
    console.log('⚠️  User already exists, updating profile fields...');
    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: {
        firstName: 'Vishal',
        lastName: 'Sharma',
        profileCompletedAt: null, // Force profile completion on next login
      },
      include: { role: true, store: true, venues: true }
    });
    console.log('✅ User profile updated:');
    console.log(JSON.stringify(updated, null, 2));
    return;
  }

  // Create admin user with profile fields
  const hashedPassword = await bcrypt.hash('Test123', 10);

  const user = await prisma.user.create({
    data: {
      id: '8b91a2c4-0b0a-4c83-809c-2d05d79ef3bc', // Original ID from Supabase Auth
      email: 'sharma.vs004@gmail.com',
      password: hashedPassword,
      firstName: 'Vishal',
      lastName: 'Sharma',
      profileCompletedAt: null, // Force profile completion on next login
      roleId: adminRole.id,
      storeId: mainStore?.id || null,
      active: true,
    },
    include: { role: true, store: true, venues: true }
  });

  console.log('✅ Admin user created:');
  console.log(JSON.stringify(user, null, 2));
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
