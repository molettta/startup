// ============================================================================
// PONTO DE ENTRADA DA APLICAÇÃO
//
// Responsável pelo ciclo de vida do processo: conectar no banco, subir o
// servidor e desligar tudo com ordem. A montagem do Express fica no app.ts —
// veja lá o motivo da separação.
// ============================================================================

import { createApp } from './app';
import { env } from './config/env';
import { prisma } from './lib/prisma';

async function main() {
  // Conectamos ANTES de aceitar requests, e o `await` é o ponto central aqui.
  // Se o banco estiver fora do ar, queremos falhar agora, com uma mensagem
  // clara, em vez de subir um servidor que responde 500 em toda requisição.
  //
  // (A versão anterior deste projeto sincronizava o banco e chamava listen()
  // em paralelo, o que abria uma janela de tempo em que a API já aceitava
  // requests sem as tabelas existirem.)
  await prisma.$connect();
  console.log('Conexão com o banco estabelecida.');

  const server = createApp().listen(env.port, () => {
    console.log(`Servidor rodando em http://localhost:${env.port}`);
  });

  /**
   * Desligamento ordenado (*graceful shutdown*).
   *
   * Ao receber o sinal de término, paramos de aceitar conexões novas e
   * devolvemos as conexões do banco ao sistema. Sem isso, o PostgreSQL só
   * perceberia a queda por timeout, mantendo conexões ociosas presas nesse
   * intervalo.
   */
  const shutdown = async (signal: string) => {
    console.log(`\n${signal} recebido, encerrando...`);
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  // SIGINT  = Ctrl+C no terminal
  // SIGTERM = o que o Docker envia ao parar um container
  //
  // O `void` antes da chamada é intencional: sinaliza ao TypeScript que
  // ignorar a Promise devolvida é proposital, já que um handler de sinal não
  // pode ser async.
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

// Se qualquer coisa falhar na inicialização, registramos o erro e saímos com
// código diferente de zero — é assim que Docker, CI e orquestradores sabem que
// o processo não subiu.
main().catch(async (error) => {
  console.error('Falha ao iniciar a aplicação:', error);
  await prisma.$disconnect();
  process.exit(1);
});
