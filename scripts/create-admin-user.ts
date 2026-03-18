import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';

const prisma = new PrismaClient();

// Use service role key for admin operations, or anon key for user creation
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  console.log('Creating admin user for Vishal Sharma...\n');

  const email = 'sharma.vs004@gmail.com';
  const password = 'Test123';

  // Step 1: Create user in Supabase Auth
  console.log('Creating user in Supabase Auth...');
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        firstName: 'Vishal',
        lastName: 'Sharma',
      },
      // Auto-confirm email for development
      emailRedirectTo: undefined,
    },
  });

  if (authError) {
    // If user already exists, try to sign in to get the user ID
    if (authError.message.includes('already registered')) {
      console.log('User already exists in Supabase Auth, signing in...');
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (signInError) {
        console.error('❌ Error signing in:', signInError.message);
        console.log('\nIf you need to reset the password, go to:');
        console.log('https://supabase.com/dashboard/project/agelyuwscfuepwbgiilc/auth/users');
        process.exit(1);
      }
      
      if (signInData.user) {
        await createOrUpdateDatabaseUser(signInData.user.id, email);
      }
    } else {
      console.error('❌ Error creating Supabase Auth user:', authError.message);
      process.exit(1);
    }
  } else if (authData.user) {
    console.log('✅ User created in Supabase Auth');
    await createOrUpdateDatabaseUser(authData.user.id, email);
  }
}

async function createOrUpdateDatabaseUser(supabaseUserId: string, email: string) {
  // Step 2: Get or create ADMIN role
  let adminRole = await prisma.role.findUnique({ where: { name: 'ADMIN' } });
  
  if (!adminRole) {
    console.log('Creating ADMIN role...');
    adminRole = await prisma.role.create({
      data: {
        name: 'ADMIN',
        description: 'Full system administrator',
      },
    });
  }

  // Step 3: Check if user already exists in database
  const existingUser = await prisma.user.findUnique({
    where: { id: supabaseUserId },
  });

  if (existingUser) {
    console.log('✅ User already exists in database');
    console.log('   Email:', email);
    console.log('   Name:', existingUser.firstName, existingUser.lastName);
    console.log('   Role: ADMIN');
    console.log('\nYou can now login at http://localhost:3000/login');
    return;
  }

  // Check if there's a user with the same email but different ID (from old script)
  const oldUser = await prisma.user.findUnique({
    where: { email },
  });

  if (oldUser) {
    console.log('Found old user record with different ID, updating...');
    await prisma.user.update({
      where: { email },
      data: {
        id: supabaseUserId,
        roleId: adminRole.id,
        profileCompletedAt: new Date(),
      },
    });
    console.log('✅ User updated successfully!');
  } else {
    // Create new user in database with Supabase Auth ID
    await prisma.user.create({
      data: {
        id: supabaseUserId,
        email,
        firstName: 'Vishal',
        lastName: 'Sharma',
        roleId: adminRole.id,
        active: true,
        profileCompletedAt: new Date(),
      },
    });
    console.log('✅ User created in database');
  }

  console.log('   Email: sharma.vs004@gmail.com');
  console.log('   Password: Test123');
  console.log('   Name: Vishal Sharma');
  console.log('   Role: ADMIN');
  console.log('\nYou can now login at http://localhost:3000/login');
}

main()
  .catch((error) => {
    console.error('❌ Error creating admin user:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
