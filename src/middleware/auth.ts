// ============================================================================
// MIDDLEWARES DE AUTENTICAÇÃO E AUTORIZAÇÃO
//
// São dois conceitos diferentes, e essa distinção é o coração deste arquivo:
//
//   AUTENTICAÇÃO (authenticate)      -> "quem é você?"        -> 401 se falhar
//   AUTORIZAÇÃO  (requirePermission) -> "você pode fazer isso?" -> 403 se falhar
//
// Um middleware no Express é uma função que roda ANTES do controller. Ela pode:
//   - deixar passar, chamando next()
//   - enriquecer o request (é o que fazemos com req.user)
//   - interromper, lançando um erro
//
// Em src/routes/user.routes.ts eles são encadeados nessa ordem:
//   authenticate -> requirePermission('users:list') -> getAllUsers
// ============================================================================

import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import { env } from '../config/env';
import { forbidden, unauthorized } from '../lib/errors';
import { prisma } from '../lib/prisma';
import type { JwtPayload } from '../types/auth';

/**
 * Extrai o token do header `Authorization: Bearer <token>`.
 *
 * Devolve `null` (em vez de lançar) quando o header não existe ou está
 * malformado: decidir o que fazer nesse caso é responsabilidade de quem chama.
 */
function extractToken(header: string | undefined): string | null {
  if (!header) return null;

  const [scheme, token] = header.split(' ');

  // O nome do esquema é case-insensitive na especificação HTTP, então
  // "bearer", "Bearer" e "BEARER" são todos válidos.
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;

  return token;
}

/**
 * AUTENTICAÇÃO — valida o JWT e descobre quem é o usuário.
 *
 * Ao final, `req.user` contém o usuário com suas roles e permissões já
 * resolvidas, prontas para o `requirePermission` consultar.
 *
 * Sobre o JWT: o token é assinado com o JWT_SECRET no login e enviado ao
 * cliente. Ele NÃO é criptografado — qualquer um consegue ler seu conteúdo
 * (teste em jwt.io). O que a assinatura garante é que ninguém *alterou* o
 * token, porque forjar a assinatura exigiria conhecer o segredo.
 * Por isso nunca se coloca dado sensível dentro de um JWT.
 */
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  const token = extractToken(req.header('Authorization'));

  if (!token) {
    throw unauthorized('Token não informado');
  }

  let payload: JwtPayload;
  try {
    // jwt.verify faz duas coisas: confere a assinatura e checa a expiração.
    // Se qualquer uma falhar, ele lança.
    payload = jwt.verify(token, env.jwtSecret) as JwtPayload;
  } catch {
    // Repare que o erro original é descartado de propósito. A mensagem do
    // jsonwebtoken distingue "assinatura inválida" de "token expirado", e
    // devolver isso ao cliente entrega informação útil para quem está
    // tentando atacar a API. Uma resposta genérica basta.
    throw unauthorized('Token inválido ou expirado');
  }

  // O token carrega só o `userId`. Buscamos o usuário no banco a cada request
  // em vez de confiar em dados gravados dentro do token, porque o token vive
  // 1 hora: se as permissões do usuário mudarem nesse intervalo — ou se a
  // conta for excluída — a mudança vale imediatamente.
  //
  // O `include` aninhado traz roles e, dentro de cada role, suas permissões,
  // tudo em uma consulta só. Sem isso cairíamos no problema N+1: uma query
  // para as roles e mais uma para as permissões de cada role.
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    include: { roles: { include: { permissions: true } } },
  });

  if (!user) {
    // Token válido, mas o usuário não existe mais (foi excluído depois que o
    // token foi emitido).
    throw unauthorized('Usuário do token não existe mais');
  }

  // Achatamos roles -> permissões numa lista simples de nomes.
  // O `new Set` remove duplicatas: um usuário que seja Admin *e* User herda
  // "users:read" das duas roles, e ela apareceria duas vezes.
  req.user = {
    id: user.id,
    name: user.name,
    email: user.email,
    roles: user.roles.map((role) => role.name),
    permissions: [
      ...new Set(user.roles.flatMap((role) => role.permissions.map((p) => p.name))),
    ],
  };

  // next() passa a bola para o próximo middleware da cadeia.
  // Esquecer de chamá-lo é o bug clássico de middleware: o request simplesmente
  // trava até o cliente desistir, sem erro nenhum no log.
  next();
}

/**
 * AUTORIZAÇÃO — exige uma permissão específica.
 *
 * Isto é uma *fábrica* de middlewares: `requirePermission` não é o middleware,
 * ela RETORNA um. Esse padrão existe para parametrizar o middleware na hora de
 * montar a rota:
 *
 *   router.get('/',       authenticate, requirePermission('users:list'), getAllUsers);
 *   router.delete('/:id', authenticate, requirePermission('users:write'), deleteUser);
 *
 * É o que substitui o antigo `if (role.name === 'Admin')` escrito dentro do
 * controller. Duas vantagens: a regra de acesso fica visível na definição da
 * rota (dá para auditar a API inteira lendo o arquivo de rotas), e o controller
 * volta a cuidar só da sua regra de negócio.
 */
export function requirePermission(permission: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    // Rede de segurança contra erro de programação: se esta função rodar sem o
    // `authenticate` antes dela na rota, req.user está vazio. Sem esta guarda,
    // a rota deixaria qualquer um passar em silêncio.
    if (!req.user) {
      throw unauthorized('Rota autenticada: use o middleware authenticate antes');
    }

    // 403 (e não 401): sabemos quem é o usuário, ele é que não tem permissão.
    // Trocar o token por outro não resolveria — daí a distinção dos códigos.
    if (!req.user.permissions.includes(permission)) {
      throw forbidden(`Acesso negado: permissão '${permission}' necessária`);
    }

    next();
  };
}
