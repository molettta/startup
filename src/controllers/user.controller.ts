// ============================================================================
// CONTROLLER DE USUÁRIOS
//
// O controller é onde vive a regra de cada endpoint. Ele recebe o `req` já
// autenticado e autorizado pelos middlewares, conversa com o banco pelo Prisma
// e monta a resposta.
//
// O que ele NÃO faz:
//   - checar permissão  -> isso é dos middlewares (src/middleware/auth.ts)
//   - tratar erro       -> isso é do error handler (src/middleware/error.ts)
//   - montar SQL        -> isso é do Prisma
// ============================================================================

import bcrypt from 'bcryptjs';
import type { Request, Response } from 'express';
import jwt, { type SignOptions } from 'jsonwebtoken';

import { env } from '../config/env';
import { Prisma } from '../generated/prisma/client';
import { badRequest, conflict, unauthorized } from '../lib/errors';
import { prisma } from '../lib/prisma';
import type { JwtPayload } from '../types/auth';

/**
 * Custo do bcrypt: o hash é calculado 2^10 = 1024 vezes.
 *
 * Essa lentidão é o recurso de segurança, não um defeito. Um hash rápido
 * (MD5, SHA-256) permitiria testar bilhões de senhas por segundo caso o banco
 * vazasse; com bcrypt cada tentativa custa ~100ms. Subir o número dobra o custo
 * a cada +1 — para o atacante e para o seu servidor, então não exagere.
 */
const BCRYPT_ROUNDS = 10;

/** Role atribuída a todo cadastro novo. Ninguém vira Admin se cadastrando. */
const DEFAULT_ROLE = 'User';

/**
 * Mensagem de email duplicado, usada nos DOIS pontos que detectam o conflito
 * (a consulta prévia e o erro do banco). Uma constante só garante que o cliente
 * receba a mesma resposta nos dois caminhos.
 */
const EMAIL_CONFLICT_MESSAGE = 'Já existe um usuário com esse email';

/**
 * Código do Prisma para violação de restrição única (*unique constraint*).
 *
 * Os erros do Prisma são identificados por código, não pela mensagem: a
 * mensagem é texto livre e muda entre versões, enquanto o código é estável e
 * documentado. Ler `error.code` é a forma correta de distinguir um erro de
 * banco esperado de um bug de verdade.
 */
const PRISMA_UNIQUE_VIOLATION = 'P2002';

/**
 * Campos que podem sair numa resposta da API.
 *
 * Usamos `select` (lista o que INCLUIR) em vez de devolver o objeto inteiro e
 * apagar o que não queremos. A diferença importa: com `select`, um campo
 * sensível adicionado ao schema no futuro fica de fora por padrão. Na abordagem
 * oposta, ele vazaria até alguém lembrar de removê-lo.
 *
 * É por isso que `password` não aparece aqui — e nem poderia.
 */
const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  createdAt: true,
  roles: { select: { name: true } },
} as const;

// NOTA SOBRE ERROS: não há try/catch nas funções abaixo, e isso é intencional.
// A partir do Express 5, uma Promise rejeitada dentro de um handler async é
// encaminhada automaticamente para o error handler registrado no app.ts.
// (No Express 4 isso não acontecia: sem try/catch em cada handler, o request
// ficava pendurado para sempre.)
// Na prática: para responder com erro, basta lançar (`throw badRequest(...)`).

/**
 * GET /users — lista todos os usuários.
 *
 * A rota já passou por `authenticate` e `requirePermission('users:list')`,
 * então aqui não sobra nenhuma checagem de acesso.
 */
export async function getAllUsers(_req: Request, res: Response) {
  const users = await prisma.user.findMany({
    select: publicUserSelect,
    orderBy: { id: 'asc' }, // ordem previsível: sem isso o banco não garante nenhuma
  });

  res.json(users);
}

/**
 * POST /users — cadastro público de um novo usuário.
 */
export async function createUser(req: Request, res: Response) {
  // `req.body ?? {}` evita quebrar quando o cliente não manda corpo nenhum:
  // sem isso, desestruturar `undefined` lançaria um TypeError e viraria um 500
  // — quando na verdade o erro é do cliente (400).
  const { name, email, password } = req.body ?? {};

  // VALIDAÇÃO DE ENTRADA. Nunca confie no que chega pela rede: o cliente pode
  // ser um curl, não o seu front-end. Checamos o tipo (`typeof`) porque JSON
  // aceita qualquer coisa — mandar `"password": 12345` é perfeitamente possível.
  //
  // Em um projeto maior isso é feito com uma biblioteca de schema (Zod, Yup,
  // class-validator), que valida e infere os tipos de uma vez só. Aqui está na
  // mão para deixar visível o que uma validação precisa cobrir.
  if (typeof name !== 'string' || name.trim() === '') {
    throw badRequest('Campo "name" é obrigatório');
  }
  if (typeof email !== 'string' || !email.includes('@')) {
    throw badRequest('Campo "email" é obrigatório e deve ser um email válido');
  }
  if (typeof password !== 'string' || password.length < 8) {
    throw badRequest('Campo "password" é obrigatório e deve ter ao menos 8 caracteres');
  }

  // Normalizamos o email antes de gravar. Sem isso, "Fulano@Gmail.com" e
  // "fulano@gmail.com" viram duas contas diferentes — o índice @unique compara
  // texto exato e não perceberia a duplicidade.
  const normalizedEmail = email.trim().toLowerCase();

  if (await prisma.user.findUnique({ where: { email: normalizedEmail } })) {
    // 409 Conflict: a requisição está correta, mas colide com o estado atual
    // do servidor. Diferente de 400, que é "sua requisição está malformada".
    throw conflict(EMAIL_CONFLICT_MESSAGE);
  }

  const user = await prisma.user
    .create({
      data: {
        name: name.trim(),
        email: normalizedEmail,

        // O HASH é gerado aqui. A senha em texto puro existe apenas nesta
        // variável, em memória, e nunca chega ao banco.
        password: await bcrypt.hash(password, BCRYPT_ROUNDS),

        // `connect` vincula a um registro que JÁ existe (a role criada pelo
        // seed). Se fosse `create`, o Prisma tentaria criar uma role nova.
        roles: { connect: { name: DEFAULT_ROLE } },
      },
      select: publicUserSelect, // a resposta sai sem o campo password
    })
    // A verificação lá em cima resolve o caso do dia a dia, mas existe uma
    // janela entre ela e este `create`: dois cadastros do mesmo email chegando
    // ao mesmo tempo passam os dois pela consulta antes de qualquer um gravar.
    // Isso se chama *condição de corrida* (race condition), e nenhuma quantidade
    // de verificação prévia a elimina — quem garante a unicidade de fato é o
    // índice @unique do banco, que rejeita o segundo INSERT.
    //
    // Sem este tratamento, o perdedor da corrida receberia um 500 ("erro interno
    // do servidor"), quando na verdade o erro é dele e a resposta certa continua
    // sendo o mesmo 409 de cima.
    //
    // Usamos `.catch()` no lugar de um try/catch em volta para não precisar
    // tirar o `const user` daqui: como o handler abaixo SEMPRE lança, o
    // TypeScript entende que ele não produz valor nenhum e mantém o tipo do
    // `create`.
    .catch((error: unknown) => {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === PRISMA_UNIQUE_VIOLATION
      ) {
        throw conflict(EMAIL_CONFLICT_MESSAGE);
      }

      // Qualquer outro erro é repassado sem alteração: só o error handler
      // decide o que fazer com o que não sabemos tratar. Engolir o erro aqui o
      // transformaria em um cadastro que "deu certo" sem ter criado nada.
      throw error;
    });

  // 201 Created é a resposta correta para "criei um recurso novo" — 200 seria
  // apenas "deu certo".
  res.status(201).json(user);
}

/**
 * POST /users/login — troca email + senha por um token JWT.
 */
export async function login(req: Request, res: Response) {
  const { email, password } = req.body ?? {};

  if (typeof email !== 'string' || typeof password !== 'string') {
    throw badRequest('Campos "email" e "password" são obrigatórios');
  }

  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
  });

  // A MESMA mensagem para "email não existe" e "senha errada".
  // Se respondêssemos "usuário não encontrado" num caso e "senha inválida" no
  // outro, a tela de login viraria um verificador de cadastro: dá para
  // descobrir quais emails existem no sistema só testando um por um.
  const invalid = unauthorized('Email ou senha inválidos');

  if (!user) {
    // Comparação descartada de propósito, contra *ataque de temporização*.
    // Sem ela, um email inexistente responderia na hora e um email real
    // demoraria ~100ms (o custo do bcrypt) — e essa diferença de tempo
    // entregaria a informação que a mensagem genérica acima esconde.
    // O segundo argumento é um hash inválido qualquer, só para gastar o tempo.
    await bcrypt.compare(password, '$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva');
    throw invalid;
  }

  // bcrypt.compare re-hasheia a senha enviada usando o salt embutido no hash
  // guardado e compara os resultados. Não existe caminho de volta: o hash do
  // banco jamais é "descriptografado".
  if (!(await bcrypt.compare(password, user.password))) {
    throw invalid;
  }

  // Só o id vai dentro do token. Lembre-se: o conteúdo de um JWT é público.
  // Nome, email e permissões são buscados no banco pelo `authenticate` a cada
  // request, o que mantém o token pequeno e os dados sempre atualizados.
  const payload: JwtPayload = { userId: user.id };

  // O cast é necessário porque os tipos do jsonwebtoken esperam um formato
  // literal ('1h', '7d') em `expiresIn`, e o nosso valor vem do .env como
  // string comum — só o TypeScript reclama, o valor é o mesmo.
  const options = { expiresIn: env.jwtExpiresIn } as SignOptions;

  res.json({ token: jwt.sign(payload, env.jwtSecret, options) });
}
