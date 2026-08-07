import bcrypt from 'bcryptjs';

import { prisma } from '../src/lib/prisma';

const BCRYPT_ROUNDS = 10;

/** Quais permissoes cada role tem. Fonte unica da verdade do RBAC. */
const ROLE_PERMISSIONS = {
  Admin: ['users:list', 'users:write', 'users:read'],
  User: ['users:read'],
} as const;

async function main() {
  // upsert deixa o seed idempotente: pode rodar de novo sem duplicar nada.
  for (const name of new Set(Object.values(ROLE_PERMISSIONS).flat())) {
    await prisma.permission.upsert({ where: { name }, update: {}, create: { name } });
  }

  for (const [roleName, permissions] of Object.entries(ROLE_PERMISSIONS)) {
    await prisma.role.upsert({
      where: { name: roleName },
      update: { permissions: { set: permissions.map((name) => ({ name })) } },
      create: { name: roleName, permissions: { connect: permissions.map((name) => ({ name })) } },
    });
  }

  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'Admin' } });
  const userRole = await prisma.role.findUniqueOrThrow({ where: { name: 'User' } });

  const password = await bcrypt.hash('password123', BCRYPT_ROUNDS);

  await prisma.user.upsert({
    where: { email: 'eduardo@example.com' },
    update: {},
    create: {
      name: 'Eduardo',
      email: 'eduardo@example.com',
      password,
      roles: { connect: [{ id: adminRole.id }, { id: userRole.id }] },
    },
  });

  await prisma.user.upsert({
    where: { email: 'user@example.com' },
    update: {},
    create: {
      name: 'User User',
      email: 'user@example.com',
      password,
      roles: { connect: [{ id: userRole.id }] },
    },
  });

  console.log('Banco populado com sucesso.');
  console.log('  admin: eduardo@example.com / password123');
  console.log('  user:  user@example.com / password123');
}

main()
  .catch((error) => {
    console.error('Erro ao popular o banco:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
