import { createApp } from './app';
import { env } from './config/env';
import { prisma } from './lib/prisma';

async function main() {
  // So aceita requests depois que o banco respondeu.
  await prisma.$connect();
  console.log('Conexao com o banco estabelecida.');

  const server = createApp().listen(env.port, () => {
    console.log(`Servidor rodando em http://localhost:${env.port}`);
  });

  const shutdown = async (signal: string) => {
    console.log(`\n${signal} recebido, encerrando...`);
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch(async (error) => {
  console.error('Falha ao iniciar a aplicacao:', error);
  await prisma.$disconnect();
  process.exit(1);
});
