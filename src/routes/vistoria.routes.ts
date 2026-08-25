// ============================================================================
// ROTAS DE /vistorias
//
// Como no user.routes.ts, cada rota declara ali mesmo o que exige de quem
// chama — dá para auditar o controle de acesso das vistorias lendo só este
// arquivo.
//
// Um detalhe que vale reparar: TODAS as rotas aqui passam por `authenticate`.
// Ao contrário de /users, não existe rota pública de vistoria.
// ============================================================================

import { Router } from 'express';

import {
  anexarFoto,
  baixarFoto,
  criarVistoria,
  finalizarVistoria,
  listarVistorias,
  obterVistoria,
} from '../controllers/vistoria.controller';
import { authenticate, requirePermission } from '../middleware/auth';
import { uploadFoto } from '../lib/upload';

const router = Router();

// POST /vistorias — o vistoriador registra uma vistoria nova.
router.post('/', authenticate, requirePermission('vistorias:write'), criarVistoria);

// GET /vistorias — lista.
//
// A permissão exigida é a de LER, não a de listar tudo: quem tem só
// 'vistorias:read' recebe as próprias vistorias, e quem também tem
// 'vistorias:list' recebe as de todo mundo. Essa segunda parte não cabe no
// middleware, porque depende dos registros — quem decide é o controller.
router.get('/', authenticate, requirePermission('vistorias:read'), listarVistorias);

// GET /vistorias/:id — detalhe, já com a lista de fotos.
router.get('/:id', authenticate, requirePermission('vistorias:read'), obterVistoria);

// POST /vistorias/:id/fotos — anexa uma foto (multipart/form-data).
//
// A ORDEM IMPORTA e é o ponto interessante desta linha: `uploadFoto` vem DEPOIS
// dos middlewares de acesso, de propósito. Ele grava o arquivo em disco
// enquanto lê o corpo — colocá-lo antes faria a API aceitar e gravar o upload
// de alguém sem token, só para recusá-lo em seguida.
router.post(
  '/:id/fotos',
  authenticate,
  requirePermission('vistorias:write'),
  uploadFoto,
  anexarFoto,
);

// GET /vistorias/:id/fotos/:fotoId/arquivo — baixa o binário da foto.
router.get(
  '/:id/fotos/:fotoId/arquivo',
  authenticate,
  requirePermission('vistorias:read'),
  baixarFoto,
);

// PATCH /vistorias/:id/finalizar — encerra o rascunho.
//
// PATCH (e não PUT) porque a requisição altera UM campo do recurso, não o
// substitui inteiro.
router.patch('/:id/finalizar', authenticate, requirePermission('vistorias:write'), finalizarVistoria);

export default router;
