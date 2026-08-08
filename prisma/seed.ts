// ============================================================================
// SEED — dados iniciais do banco
//
// Um banco recém-criado está vazio, e a API não funciona assim: sem nenhuma
// role e nenhuma permissão cadastradas, ninguém consegue fazer nada. O seed
// popula esse mínimo necessário.
//
// Rode com:  npm run db:seed
//
// Este arquivo é também o lugar onde se define QUEM PODE O QUÊ no sistema —
// veja o mapa ROLE_PERMISSIONS abaixo.
// ============================================================================

import bcrypt from 'bcryptjs';

// Reaproveitamos o mesmo client da aplicação, em vez de criar outro.
import { prisma } from '../src/lib/prisma';

const BCRYPT_ROUNDS = 10;

/**
 * O MAPA DO RBAC: quais permissões cada cargo possui.
 *
 * Esta é a fonte única da verdade do controle de acesso. As rotas exigem
 * permissões (`requirePermission('users:list')`), e é aqui que se decide quais
 * cargos as têm.
 *
 * Para dar acesso a um novo cargo, some a permissão a ele nesta lista e rode o
 * seed de novo — nenhuma linha de código de rota ou controller muda.
 *
 * A convenção "recurso:ação" (users:list, users:write) mantém os nomes legíveis
 * conforme o sistema cresce.
 */
const ROLE_PERMISSIONS = {
  Admin: ['users:list', 'users:write', 'users:read'],
  User: ['users:read'],
} as const;

async function main() {
  // `upsert` = update se existir, create se não existir.
  //
  // É o que torna o seed IDEMPOTENTE: rodar duas vezes dá o mesmo resultado que
  // rodar uma. Com `create` puro, a segunda execução falharia com erro de
  // violação de chave única.
  for (const name of new Set(Object.values(ROLE_PERMISSIONS).flat())) {
    await prisma.permission.upsert({ where: { name }, update: {}, create: { name } });
  }

  // Agora as roles, cada uma já vinculada às suas permissões.
  for (const [roleName, permissions] of Object.entries(ROLE_PERMISSIONS)) {
    await prisma.role.upsert({
      where: { name: roleName },

      // `set` SUBSTITUI a lista inteira de permissões da role. É proposital:
      // se você remover uma permissão do mapa acima e rodar o seed de novo, ela
      // some da role de verdade. Com `connect`, o vínculo antigo continuaria lá.
      update: { permissions: { set: permissions.map((name) => ({ name })) } },

      create: { name: roleName, permissions: { connect: permissions.map((name) => ({ name })) } },
    });
  }

  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'Admin' } });
  const userRole = await prisma.role.findUniqueOrThrow({ where: { name: 'User' } });

  // Hash gerado uma vez e reaproveitado pelos dois usuários, só para o seed não
  // demorar o dobro. Repare que os dois hashes ficam idênticos no banco — o que
  // revela que usam a mesma senha. Numa aplicação real cada usuário teria a
  // sua, e o salt aleatório do bcrypt geraria hashes diferentes mesmo para
  // senhas iguais.
  const password = await bcrypt.hash('password123', BCRYPT_ROUNDS);

  // ATENÇÃO: estas são credenciais de DESENVOLVIMENTO, propositalmente
  // simples e públicas neste arquivo. Nunca faça isso em produção.
  await prisma.user.upsert({
    where: { email: 'eduardo@example.com' },

    // `update: {}` vazio significa "se já existe, não mexa". Assim, rodar o
    // seed de novo não sobrescreve a senha de um usuário que você alterou
    // durante os testes.
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
    // Sair com código 1 faz o comando falhar de verdade. Sem isso, um seed que
    // deu errado terminaria com "sucesso" e o erro passaria despercebido num
    // pipeline de CI.
    process.exit(1);
  })
  // `finally` fecha a conexão nos dois casos, com erro ou sem. Sem isso o
  // processo ficaria pendurado, sem encerrar, por causa da conexão aberta.
  .finally(() => prisma.$disconnect());
