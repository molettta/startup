// ============================================================================
// VARIÁVEIS DE AMBIENTE
//
// Configuração que muda entre máquinas (senha do banco, segredo do JWT, porta)
// não pode ficar no código: mudaria a cada ambiente e, no caso das senhas,
// acabaria versionada no Git. A convenção é lê-la do ambiente, com um arquivo
// .env — que fica FORA do controle de versão — para o desenvolvimento local.
//
// Este módulo faz duas coisas importantes:
//   1. valida tudo no START da aplicação, não no meio de um request;
//   2. centraliza o acesso, para que `process.env` não apareça espalhado pelo
//      código (onde qualquer variável é `string | undefined` e um erro de
//      digitação no nome passa despercebido).
// ============================================================================

// Este import lê o arquivo .env e joga o conteúdo em process.env.
// Precisa ser a PRIMEIRA coisa a rodar: qualquer módulo que leia uma variável
// antes disso encontraria undefined.
import 'dotenv/config';

/**
 * Lê uma variável obrigatória e falha imediatamente se ela não existir.
 *
 * Falhar no boot é deliberado. Sem essa checagem, um JWT_SECRET ausente só
 * apareceria quando alguém tentasse fazer login — como um erro 500 obscuro, em
 * produção, longe da causa. Aqui o servidor simplesmente não sobe, e a
 * mensagem diz exatamente o que fazer.
 *
 * Esse padrão tem nome: *fail fast*.
 */
function required(name: string): string {
  const value = process.env[name];

  // Checamos string vazia além de undefined: `JWT_SECRET=` no .env define a
  // variável com valor vazio, o que passaria por um teste de existência.
  if (!value || value.trim() === '') {
    throw new Error(
      `Variável de ambiente ${name} não definida. Copie .env.example para .env e preencha.`,
    );
  }

  return value;
}

/** Lê uma variável opcional, com valor padrão quando ela não está definida. */
function optional(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.trim() !== '' ? value : fallback;
}

/**
 * Configuração da aplicação, já validada e tipada.
 *
 * Importe daqui (`env.jwtSecret`) em vez de ler `process.env.JWT_SECRET`
 * direto: aqui o tipo é `string`, não `string | undefined`, então o TypeScript
 * para de exigir checagem de nulo em cada uso.
 */
export const env = {
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: optional('JWT_EXPIRES_IN', '1h'),
  port: Number(optional('PORT', '3000')),

  // NODE_ENV=production é a convenção que várias bibliotecas usam para ligar
  // otimizações e desligar saída de depuração.
  isProduction: process.env.NODE_ENV === 'production',
} as const; // `as const` impede que outro módulo altere a configuração em runtime

// Number('abc') devolve NaN em vez de lançar, então a validação vem depois.
if (Number.isNaN(env.port)) {
  throw new Error(`PORT inválida: ${process.env.PORT}`);
}
