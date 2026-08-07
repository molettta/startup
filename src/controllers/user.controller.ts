import bcrypt from 'bcryptjs';
import type { Request, Response } from 'express';
import jwt, { type SignOptions } from 'jsonwebtoken';

import { env } from '../config/env';
import { badRequest, conflict, unauthorized } from '../lib/errors';
import { prisma } from '../lib/prisma';
import type { JwtPayload } from '../types/auth';

const BCRYPT_ROUNDS = 10;
const DEFAULT_ROLE = 'User';

/** Campos publicos de um usuario — nunca inclui `password`. */
const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  createdAt: true,
  roles: { select: { name: true } },
} as const;

// Express 5 encaminha rejeicoes de handlers async para o error handler
// automaticamente, entao nao ha try/catch aqui.

export async function getAllUsers(_req: Request, res: Response) {
  const users = await prisma.user.findMany({
    select: publicUserSelect,
    orderBy: { id: 'asc' },
  });
  res.json(users);
}

export async function createUser(req: Request, res: Response) {
  const { name, email, password } = req.body ?? {};

  if (typeof name !== 'string' || name.trim() === '') {
    throw badRequest('Campo "name" e obrigatorio');
  }
  if (typeof email !== 'string' || !email.includes('@')) {
    throw badRequest('Campo "email" e obrigatorio e deve ser um email valido');
  }
  if (typeof password !== 'string' || password.length < 8) {
    throw badRequest('Campo "password" e obrigatorio e deve ter ao menos 8 caracteres');
  }

  const normalizedEmail = email.trim().toLowerCase();

  if (await prisma.user.findUnique({ where: { email: normalizedEmail } })) {
    throw conflict('Ja existe um usuario com esse email');
  }

  const user = await prisma.user.create({
    data: {
      name: name.trim(),
      email: normalizedEmail,
      password: await bcrypt.hash(password, BCRYPT_ROUNDS),
      // Todo cadastro novo entra com a role padrao, sem privilegio administrativo.
      roles: { connect: { name: DEFAULT_ROLE } },
    },
    select: publicUserSelect,
  });

  res.status(201).json(user);
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body ?? {};

  if (typeof email !== 'string' || typeof password !== 'string') {
    throw badRequest('Campos "email" e "password" sao obrigatorios');
  }

  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
  });

  // Mensagem unica para email inexistente e senha errada: nao revela quais
  // emails estao cadastrados.
  const invalid = unauthorized('Email ou senha invalidos');

  if (!user) {
    // Compara mesmo assim para nao vazar a existencia do email pelo tempo de resposta.
    await bcrypt.compare(password, '$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva');
    throw invalid;
  }

  if (!(await bcrypt.compare(password, user.password))) {
    throw invalid;
  }

  const payload: JwtPayload = { userId: user.id };
  const options = { expiresIn: env.jwtExpiresIn } as SignOptions;

  res.json({ token: jwt.sign(payload, env.jwtSecret, options) });
}
