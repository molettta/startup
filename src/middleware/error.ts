import type { NextFunction, Request, Response } from 'express';

import { env } from '../config/env';
import { HttpError } from '../lib/errors';

/** 404 para qualquer rota nao registrada. */
export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ message: `Rota nao encontrada: ${req.method} ${req.originalUrl}` });
}

/**
 * Handler central de erros. Erros esperados (HttpError) viram a resposta
 * correspondente; qualquer outro vira 500 generico — o stack trace vai para o
 * log do servidor, nunca para a resposta.
 */
export function errorHandler(err: unknown, _req: Request, res: Response, next: NextFunction) {
  if (res.headersSent) {
    return next(err);
  }

  if (err instanceof HttpError) {
    return res.status(err.status).json({ message: err.message });
  }

  console.error('[erro nao tratado]', err);

  res.status(500).json({
    message: 'Erro interno do servidor',
    // Detalhe so em desenvolvimento, para depuracao local.
    ...(env.isProduction ? {} : { detail: err instanceof Error ? err.message : String(err) }),
  });
}
