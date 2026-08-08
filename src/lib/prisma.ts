// ============================================================================
// CLIENT DO PRISMA (instância única)
//
// Todo acesso ao banco no projeto passa por este `prisma` exportado.
//
// POR QUE UMA INSTÂNCIA SÓ? Cada PrismaClient abre um pool de conexões com o
// banco. Criar um por request esgotaria o limite de conexões do PostgreSQL em
// pouco tempo. Como o Node só executa o corpo de um módulo na primeira vez que
// ele é importado, exportar a instância daqui garante que todos os arquivos
// compartilham a mesma — é o padrão Singleton, obtido de graça pelo sistema de
// módulos.
// ============================================================================

import { PrismaPg } from '@prisma/adapter-pg';

// O client vem de src/generated/prisma, e não de node_modules: desde o
// Prisma 7 ele é gerado dentro do projeto (veja o `output` no schema.prisma).
// Esse código é gerado a partir do schema — nunca edite esses arquivos à mão,
// e rode `npx prisma generate` depois de mudar o schema.
import { PrismaClient } from '../generated/prisma/client';
import { env } from '../config/env';

// O *driver adapter* é a camada que fala o protocolo do PostgreSQL. A partir do
// Prisma 7 ele é explícito: você escolhe o driver e passa a connection string a
// ele, em vez de o Prisma resolver isso sozinho por uma URL no schema.
const adapter = new PrismaPg({ connectionString: env.databaseUrl });

export const prisma = new PrismaClient({ adapter });
