import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import { env } from '../config/env';
import { forbidden, unauthorized } from '../lib/errors';
import { prisma } from '../lib/prisma';
import type { JwtPayload } from '../types/auth';

function extractToken(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}

/**
 * Valida o JWT do header Authorization e carrega o usuario com suas roles e
 * permissoes em `req.user`.
 */
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  const token = extractToken(req.header('Authorization'));
  if (!token) {
    throw unauthorized('Token nao informado');
  }

  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, env.jwtSecret) as JwtPayload;
  } catch {
    // Nao repassamos o detalhe do erro nem o token para o cliente.
    throw unauthorized('Token invalido ou expirado');
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    include: { roles: { include: { permissions: true } } },
  });

  if (!user) {
    throw unauthorized('Usuario do token nao existe mais');
  }

  req.user = {
    id: user.id,
    name: user.name,
    email: user.email,
    roles: user.roles.map((role) => role.name),
    permissions: [
      ...new Set(user.roles.flatMap((role) => role.permissions.map((p) => p.name))),
    ],
  };

  next();
}

/**
 * Exige uma permissao concreta, resolvida a partir das roles do usuario.
 * Substitui a checagem antiga `role.name === 'Admin'` codificada no controller.
 */
export function requirePermission(permission: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw unauthorized('Rota autenticada: use o middleware authenticate antes');
    }
    if (!req.user.permissions.includes(permission)) {
      throw forbidden(`Acesso negado: permissao '${permission}' necessaria`);
    }
    next();
  };
}
