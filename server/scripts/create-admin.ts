// Creates (or resets the password of) an admin account from the command line.
// This replaces the old client-side super admin bootstrap.
//
//   npm run create-admin -- --email you@example.com --name "Your Name" [--role super_admin]
//
// The password is read from the ADMIN_PASSWORD environment variable, or a random
// one is generated and printed once. The account must change it on first sign-in.
import crypto from 'crypto';
import { sql } from 'drizzle-orm';
import { db, t, closeDb } from '../db';
import { hashPassword } from '../auth';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

const email = arg('email')?.trim().toLowerCase();
const name = arg('name')?.trim();
const role = (arg('role') ?? 'super_admin') as 'normal_admin' | 'expert_admin' | 'super_admin';

if (!email || !name || !['normal_admin', 'expert_admin', 'super_admin'].includes(role)) {
  console.error('Usage: npm run create-admin -- --email you@example.com --name "Your Name" [--role super_admin]');
  process.exit(1);
}

const generated = !process.env.ADMIN_PASSWORD;
const password = process.env.ADMIN_PASSWORD || crypto.randomBytes(12).toString('base64url');
const { hash, salt } = await hashPassword(password);

const [existing] = await db.select().from(t.users).where(sql`lower(${t.users.email}) = ${email}`).limit(1);
if (existing) {
  await db
    .update(t.users)
    .set({ role, status: 'active', passwordAlgo: 'scrypt', passwordHash: hash, passwordSalt: salt, mustChangePassword: true })
    .where(sql`${t.users.id} = ${existing.id}`);
  console.log(`Updated ${email} (${existing.id}) → ${role}, password reset.`);
} else {
  const id = `admin_${crypto.randomUUID()}`;
  await db.insert(t.users).values({
    id,
    email,
    displayName: name,
    role,
    passwordAlgo: 'scrypt',
    passwordHash: hash,
    passwordSalt: salt,
    mustChangePassword: true,
  });
  console.log(`Created ${role} ${email} (${id}).`);
}
if (generated) console.log(`Temporary password: ${password}`);
await closeDb();
process.exit(0);
