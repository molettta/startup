// ============================================================================
// ROTAS DE /users
//
// Um Router é um mini-app do Express: agrupa rotas relacionadas em um arquivo
// e é montado sob um prefixo no app.ts (`app.use('/users', userRoutes)`).
// Os caminhos aqui são relativos a esse prefixo — '/login' vira '/users/login'.
//
// Repare que este arquivo permite auditar o controle de acesso da API inteira
// de uma olhada: cada rota declara, ali mesmo, o que exige de quem chama.
// ============================================================================

import { Router } from 'express';

import { createUser, getAllUsers, login } from '../controllers/user.controller';
import { authenticate, requirePermission } from '../middleware/auth';

const router = Router();

// A ordem dos argumentos é a ordem de execução: cada middleware só passa a bola
// para o próximo se chamar next(). Qualquer um deles pode interromper a cadeia.

// POST /users/login — público, por definição: é aqui que se obtém o token.
router.post('/login', login);

// POST /users — cadastro público. O usuário entra com a role padrão "User"
// (definida no controller), então ninguém consegue se cadastrar como Admin.
router.post('/', createUser);

// GET /users — a cadeia completa:
//   authenticate                    valida o token e carrega req.user  (401)
//   requirePermission('users:list') confere a permissão                (403)
//   getAllUsers                     só roda se os dois passarem
//
// Quem tem 'users:list' é decidido em prisma/seed.ts, não aqui. Para liberar
// esta rota a um novo cargo, basta dar a permissão a ele — este arquivo não
// muda.
router.get('/', authenticate, requirePermission('users:list'), getAllUsers);

export default router;
