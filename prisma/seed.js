// prisma/seed.js
// Run with: npm run db:seed

import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱  Seeding database...');

  // Clean slate — order matters due to FK constraints
  await prisma.rolePermission.deleteMany();
  await prisma.user.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.role.deleteMany();

  // ── Seed roles ─────────────────────────────────────────────────────────────
  const [adminRole, managerRole, customerRole] = await Promise.all([
    prisma.role.create({ data: { name: 'ADMIN',    description: 'Full system access.' } }),
    prisma.role.create({ data: { name: 'MANAGER',  description: 'Manage resources and view reports.' } }),
    prisma.role.create({ data: { name: 'CUSTOMER', description: 'Standard customer account.' } }),
  ]);
  console.log('✅  Roles created');

  // ── Seed permissions ───────────────────────────────────────────────────────
  const permDefs = [
    // Users
    { name: 'Read Users',    action: 'read',   resource: 'users' },
    { name: 'Create Users',  action: 'create', resource: 'users' },
    { name: 'Update Users',  action: 'update', resource: 'users' },
    { name: 'Delete Users',  action: 'delete', resource: 'users' },
    { name: 'Manage Users',  action: 'manage', resource: 'users' },
    // Roles
    { name: 'Read Roles',    action: 'read',   resource: 'roles' },
    { name: 'Manage Roles',  action: 'manage', resource: 'roles' },
    // Reports
    { name: 'Read Reports',  action: 'read',   resource: 'reports' },
    // Permissions
    { name: 'Manage Permissions', action: 'manage', resource: 'permissions' },
  ];

  const permissions = await Promise.all(
    permDefs.map((p) => prisma.permission.create({ data: p }))
  );
  console.log(`✅  ${permissions.length} permissions created`);

  const perm = Object.fromEntries(
    permissions.map((p) => [`${p.action}:${p.resource}`, p])
  );

  // ── Assign permissions to roles ────────────────────────────────────────────
  // ADMIN gets everything (via restrictTo bypass — no explicit assignment needed)
  // MANAGER: read users, read roles, read reports, manage users
  // CUSTOMER: nothing beyond their own profile

  await prisma.rolePermission.createMany({
    data: [
      { roleId: managerRole.id, permissionId: perm['read:users'].id },
      { roleId: managerRole.id, permissionId: perm['read:roles'].id },
      { roleId: managerRole.id, permissionId: perm['read:reports'].id },
      { roleId: managerRole.id, permissionId: perm['manage:users'].id },
    ],
  });
  console.log('✅  Permissions assigned to MANAGER');

  // ── Seed users ─────────────────────────────────────────────────────────────
  const [admin, manager, customer] = await Promise.all([
    prisma.user.create({
      data: { email: 'admin@example.com',    password: await bcrypt.hash('Admin@1234',    12), roleId: adminRole.id,    isEmailVerified: true },
    }),
    prisma.user.create({
      data: { email: 'manager@example.com',  password: await bcrypt.hash('Manager@1234',  12), roleId: managerRole.id,  isEmailVerified: true },
    }),
    prisma.user.create({
      data: { email: 'customer@example.com', password: await bcrypt.hash('Customer@1234', 12), roleId: customerRole.id, isEmailVerified: true },
    }),
  ]);

  console.log(`✅  Users: ${admin.email}, ${manager.email}, ${customer.email}`);
}

main()
  .catch((err) => { console.error('❌  Seed failed:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
