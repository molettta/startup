// ============================================================================
// MONTAGEM DO APP EXPRESS
//
// Este arquivo só monta o app; quem o coloca no ar é o server.ts.
//
// POR QUE separar os dois? Porque assim dá para criar um app em memória num
// teste automatizado, sem ocupar porta nenhuma:
//
//   const response = await request(createApp()).get('/users');
//
// Se o `listen()` estivesse aqui, importar o app num teste subiria um servidor
// de verdade como efeito colateral.
// ============================================================================

import express from 'express';

import { errorHandler, notFoundHandler } from './middleware/error';
import userRoutes from './routes/user.routes';
import vistoriaRoutes from './routes/vistoria.routes';

export function createApp() {
  const app = express();

  // A ORDEM DAS CHAMADAS `app.use` É A ORDEM DE EXECUÇÃO.
  // O Express testa cada middleware registrado, de cima para baixo, até algum
  // responder. Trocar a ordem dos blocos abaixo quebra a aplicação.

  // 1. Parser do corpo da requisição.
  //    Transforma o JSON recebido em objeto e o coloca em `req.body`.
  //    Precisa vir antes das rotas: sem ele, `req.body` é undefined nos
  //    controllers. (Antigamente isso exigia o pacote `body-parser`; desde o
  //    Express 4.16 ele já vem embutido como `express.json()`.)
  app.use(express.json());

  // 2. Rota de health check.
  //    Serve para monitoramento e para checar rapidamente se a API subiu, sem
  //    precisar de token nem de banco.
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // 3. As rotas da aplicação.
  //    O prefixo '/users' é somado aos caminhos definidos no router, então o
  //    '/login' de lá vira '/users/login' aqui.
  app.use('/users', userRoutes);

  //    As rotas de vistoria. Repare que o `express.json()` lá em cima NÃO dá
  //    conta do upload de foto: aquele endpoint recebe multipart/form-data, e
  //    quem lê esse formato é o middleware do multer, registrado na própria
  //    rota (src/lib/upload.ts). Os dois convivem porque cada um só age no
  //    Content-Type que reconhece.
  app.use('/vistorias', vistoriaRoutes);

  // 4. 404 — só chega aqui quem não bateu em nenhuma rota acima.
  //    Por isso precisa ser o penúltimo: registrado antes das rotas, ele
  //    responderia 404 para tudo.
  app.use(notFoundHandler);

  // 5. Tratamento de erros — SEMPRE por último.
  //    O Express reconhece um error handler pela assinatura de 4 parâmetros
  //    (err, req, res, next) e só o aciona quando algo lança ou chama
  //    next(err) em algum ponto acima.
  app.use(errorHandler);

  return app;
}
