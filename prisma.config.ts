// ============================================================================
// CONFIGURAÇÃO DO PRISMA CLI
//
// Usado pelos comandos de linha de comando (`prisma migrate`, `prisma db seed`,
// `prisma studio`) — não pela aplicação em si. A aplicação se conecta pelo
// adapter em src/lib/prisma.ts.
//
// Até o Prisma 6 essa configuração ficava espalhada entre o schema.prisma e uma
// chave "prisma" no package.json. No Prisma 7 ela foi centralizada aqui.
// ============================================================================

// Carrega o .env para que o `env('DATABASE_URL')` abaixo encontre o valor.
// O client gerado não lê o .env sozinho: isso é responsabilidade da aplicação.
import 'dotenv/config';

import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',

  migrations: {
    // Onde ficam os arquivos SQL versionados de cada migration.
    path: 'prisma/migrations',

    // Comando que `npx prisma db seed` executa.
    // Usamos `tsx` porque o seed é TypeScript e o Node não executa .ts direto.
    //
    // ATENÇÃO: no Prisma 7, `prisma migrate reset` NÃO roda o seed sozinho
    // (nas versões anteriores rodava). É por isso que o script `db:reset` no
    // package.json encadeia o seed explicitamente.
    seed: 'tsx prisma/seed.ts',
  },

  datasource: {
    // A connection string vem do ambiente, nunca escrita aqui — este arquivo
    // é versionado no Git.
    url: env('DATABASE_URL'),
  },
});
