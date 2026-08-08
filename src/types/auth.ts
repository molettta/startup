// ============================================================================
// TIPOS DA AUTENTICAÇÃO
// ============================================================================

/**
 * O usuário autenticado, como o middleware `authenticate` o entrega em
 * `req.user`.
 *
 * Repare que roles e permissões são `string[]`, e não as entidades do Prisma:
 * o middleware achata a estrutura aninhada do banco numa lista simples de
 * nomes. Assim o `requirePermission` faz um `.includes()` e pronto, sem
 * precisar navegar por `user.roles[i].permissions[j].name`.
 *
 * Repare também no que NÃO está aqui: `password`. O tipo torna impossível
 * vazar o hash por acidente a partir de `req.user`.
 */
export interface AuthUser {
  id: number;
  name: string;
  email: string;
  roles: string[];
  permissions: string[];
}

/**
 * O conteúdo que assinamos dentro do JWT.
 *
 * Só o id, de propósito: o conteúdo de um JWT é legível por qualquer um que
 * tenha o token (veja o comentário em middleware/auth.ts). O resto dos dados é
 * buscado no banco a cada request.
 */
export interface JwtPayload {
  userId: number;
}
