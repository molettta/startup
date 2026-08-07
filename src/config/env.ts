import 'dotenv/config';

/**
 * Le uma variavel de ambiente obrigatoria. Falha no boot (e nao no meio de um
 * request) quando ela nao existe.
 */
function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(
      `Variavel de ambiente ${name} nao definida. Copie .env.example para .env e preencha.`,
    );
  }
  return value;
}

function optional(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.trim() !== '' ? value : fallback;
}

export const env = {
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: optional('JWT_EXPIRES_IN', '1h'),
  port: Number(optional('PORT', '3000')),
  isProduction: process.env.NODE_ENV === 'production',
} as const;

if (Number.isNaN(env.port)) {
  throw new Error(`PORT invalida: ${process.env.PORT}`);
}
