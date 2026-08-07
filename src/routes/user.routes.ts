import { Router } from 'express';

import { createUser, getAllUsers, login } from '../controllers/user.controller';
import { authenticate, requirePermission } from '../middleware/auth';

const router = Router();

router.post('/login', login);

// Cadastro publico: o usuario entra com a role padrao "User".
router.post('/', createUser);

// Listar todos os usuarios exige a permissao 'users:list', que so a role Admin tem.
router.get('/', authenticate, requirePermission('users:list'), getAllUsers);

export default router;
