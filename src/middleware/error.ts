// ============================================================================
// TRATAMENTO CENTRAL DE ERROS
//
// Concentrar o tratamento de erros num lugar só resolve dois problemas de uma
// vez: os controllers ficam sem try/catch repetido, e nenhum detalhe interno
// escapa para o cliente por descuido de um handler específico.
//
// Registrados por último no app.ts — veja lá a explicação da ordem.
// ============================================================================

import type { NextFunction, Request, Response } from 'express';

import { env } from '../config/env';
import { HttpError } from '../lib/errors';

/**
 * 404 — chamado quando nenhuma rota bateu com a requisição.
 *
 * Sem isso, o Express responde uma página HTML de erro, o que quebra um cliente
 * que espera JSON.
 */
export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ message: `Rota não encontrada: ${req.method} ${req.originalUrl}` });
}

/**
 * Handler central de erros.
 *
 * A assinatura de QUATRO parâmetros é obrigatória: é assim que o Express
 * distingue um error handler de um middleware comum. Remover o `next`, mesmo
 * sem usá-lo, faz o Express tratar esta função como middleware normal e ela
 * nunca é chamada — um erro sutil e comum.
 *
 * A regra central é a separação entre erro *esperado* e erro *inesperado*:
 *
 *   HttpError  -> nós lançamos de propósito, a mensagem foi escrita para o
 *                 usuário final e pode ser exibida.
 *   qualquer   -> um bug. A mensagem pode conter caminho de arquivo, trecho de
 *   outro erro   SQL ou estrutura interna, então vira um 500 genérico e o
 *                 detalhe fica só no log do servidor.
 */
export function errorHandler(err: unknown, _req: Request, res: Response, next: NextFunction) {
  // Se a resposta já começou a ser enviada, não dá para trocar o status nem o
  // corpo. Nesse caso delegamos ao handler padrão do Express, que encerra a
  // conexão — tentar responder de novo lançaria outro erro.
  if (res.headersSent) {
    return next(err);
  }

  if (err instanceof HttpError) {
    return res.status(err.status).json({ message: err.message });
  }

  // Erro não previsto: registramos o objeto completo (com stack trace) no log
  // do servidor. É aqui que se investiga um 500 — não na resposta HTTP.
  console.error('[erro não tratado]', err);

  res.status(500).json({
    message: 'Erro interno do servidor',

    // O detalhe só acompanha a resposta fora de produção, para facilitar o
    // desenvolvimento. Em produção ele é omitido: mensagens de exceção vazam
    // informação sobre a estrutura interna do sistema para quem a sonda.
    ...(env.isProduction ? {} : { detail: err instanceof Error ? err.message : String(err) }),
  });
}
