import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const counts = {
    users: await prisma.user.count(),
    roles: await prisma.role.count(),
    permissions: await prisma.permission.count(),
    stores: await prisma.store.count(),
    channels: await prisma.channel.count(),
    posts: await prisma.post.count(),
    messages: await prisma.message.count(),
  };
  
  console.log('\n📊 Database Contents:');
  console.log(JSON.stringify(counts, null, 2));
  
  if (counts.channels === 0) {
    console.log('\n❌ CRITICAL: No channels found! Posts system will not work.');
  }
  
  const channels = await prisma.channel.findMany();
  console.log('\n📺 Channels:');
  if (channels.length === 0) {
    console.log('  NONE - This is why the system is broken!');
  } else {
    console.log(JSON.stringify(channels, null, 2));
  }
}

check().finally(() => prisma.$disconnect());
