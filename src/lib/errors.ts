// ============================================================================
// ERROS COM STATUS HTTP
//
// A ideia: qualquer ponto do código consegue responder com o status certo
// apenas lançando um erro, sem precisar do objeto `res` em mãos.
//
//   throw badRequest('Campo "email" é obrigatório');   -> 400
//   throw unauthorized('Token inválido');              -> 401
//
// Quem transforma isso numa resposta HTTP é o errorHandler
// (src/middleware/error.ts). Este arquivo só define o vocabulário.
// ============================================================================

/**
 * Erro que carrega um status HTTP e uma mensagem segura para o cliente.
 *
 * A distinção que importa: só a `message` de um HttpError chega ao cliente.
 * Qualquer outro tipo de erro vira um 500 genérico. Estender `Error` é o que
 * permite ao errorHandler separar os dois casos com um `instanceof`.
 */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    // Sem isto, `err.name` seria "Error" e o log ficaria menos informativo.
    this.name = 'HttpError';
  }
}

// Atalhos para os status usados no projeto. Nomear cada um evita espalhar
// números soltos (`new HttpError(409, ...)`) pelo código — e evita a troca
// silenciosa de 401 por 403, que é o engano mais comum da lista.

/** 400 — a requisição está malformada (campo faltando, tipo errado). */
export const badRequest = (message: string) => new HttpError(400, message);

/** 401 — não sabemos quem você é: token ausente, inválido ou expirado. */
export const unauthorized = (message: string) => new HttpError(401, message);

/** 403 — sabemos quem você é, e você não tem permissão para isto. */
export const forbidden = (message: string) => new HttpError(403, message);

/** 404 — o recurso pedido não existe. */
export const notFound = (message: string) => new HttpError(404, message);

/** 409 — a requisição é válida, mas conflita com o estado atual (email já cadastrado). */
export const conflict = (message: string) => new HttpError(409, message);
