// ============================================================================
// EXTENSÃO DOS TIPOS DO EXPRESS
//
// O middleware `authenticate` grava o usuário em `req.user`. Só que `Request` é
// um tipo definido pelo Express, e ele não tem essa propriedade — em
// TypeScript, `req.user` daria erro de compilação.
//
// A solução NÃO é usar `any` nem `(req as any).user`. É declarar a propriedade
// nova no tipo existente, técnica chamada *declaration merging*: quando duas
// declarações de uma mesma interface existem, o TypeScript funde as duas em
// vez de uma sobrescrever a outra.
//
// A extensão vale para o projeto inteiro, sem precisar importar nada: basta o
// arquivo estar no `include` do tsconfig.json.
// ============================================================================

import type { AuthUser } from './auth';

declare global {
  namespace Express {
    interface Request {
      /**
       * Preenchido pelo middleware `authenticate`.
       *
       * É opcional (`?`) porque nas rotas públicas — login e cadastro —
       * ninguém foi autenticado e a propriedade não existe. O `?` obriga o
       * TypeScript a cobrar uma verificação antes do uso, o que impede
       * esquecer o `authenticate` numa rota e só descobrir em produção.
       */
      user?: AuthUser;
    }
  }
}

// Este `export` vazio faz o arquivo ser tratado como módulo, e não como script
// global — condição para que o `declare global` acima funcione.
export {};
