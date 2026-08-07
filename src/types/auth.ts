/** Usuario autenticado, ja com roles e permissoes carregadas pelo middleware. */
export interface AuthUser {
  id: number;
  name: string;
  email: string;
  roles: string[];
  permissions: string[];
}

/** Payload que assinamos no JWT. */
export interface JwtPayload {
  userId: number;
}
