// ============================================================================
// CONTROLLER DE VISTORIAS
//
// Mesma divisão de responsabilidades do controller de usuários: os middlewares
// já resolveram "quem é você" e "você pode listar vistorias"; aqui fica a regra
// de negócio.
//
// A NOVIDADE DESTE ARQUIVO é uma pergunta que o RBAC sozinho não responde:
// "esta vistoria é SUA?". Veja o bloco sobre posse mais abaixo.
// ============================================================================

import path from 'node:path';

import type { Request, Response } from 'express';

import { badRequest, conflict, notFound, unauthorized } from '../lib/errors';
import { prisma } from '../lib/prisma';
import { UPLOAD_DIR, removerArquivo } from '../lib/upload';
import type { AuthUser } from '../types/auth';

/** Status inicial de toda vistoria criada. */
const STATUS_INICIAL = 'RASCUNHO';

/**
 * Permissão que dá acesso às vistorias de TODO MUNDO.
 *
 * Quem não a tem enxerga apenas as próprias — é o que separa o vistoriador de
 * campo de um futuro auditor.
 */
const PERMISSAO_VER_TODAS = 'vistorias:list';

/** Campos de vistoria que podem sair numa resposta. Mesmo raciocínio do
 *  `publicUserSelect`: listamos o que INCLUIR, para que um campo sensível
 *  adicionado ao schema amanhã não vaze sozinho. */
const vistoriaSelect = {
  id: true,
  titulo: true,
  descricao: true,
  status: true,
  createdAt: true,
  vistoriador: { select: { id: true, name: true } },
  fotos: {
    select: { id: true, comentario: true, contentType: true, tamanhoBytes: true, createdAt: true },
    orderBy: { id: 'asc' },
  },
} as const;

/**
 * Devolve o usuário autenticado, ou falha se ele não estiver lá.
 *
 * `req.user` é opcional no tipo (veja src/types/express.d.ts) porque nas rotas
 * públicas ninguém foi autenticado. Como estes controllers só rodam atrás do
 * `authenticate`, ele sempre existe na prática — mas em vez de calar o
 * TypeScript com `!` ou `as`, checamos de verdade. Se um dia alguém registrar
 * uma dessas rotas sem o `authenticate`, o resultado é um erro claro em vez de
 * um acesso liberado em silêncio.
 */
function usuarioAutenticado(req: Request): AuthUser {
  if (!req.user) {
    throw unauthorized('Rota autenticada: use o middleware authenticate antes');
  }

  return req.user;
}

/**
 * Lê um id numérico vindo da URL.
 *
 * Tudo em `req.params` é string, e o Prisma espera um Int no `where`. Sem esta
 * conversão o TypeScript reclamaria; sem a validação, `/vistorias/abc` viraria
 * `NaN` e produziria um erro de banco (500) em vez de um 400 honesto.
 */
function idDaUrl(req: Request, nome: string): number {
  const valor = Number(req.params[nome]);

  if (!Number.isInteger(valor) || valor <= 0) {
    throw badRequest(`Parâmetro "${nome}" inválido`);
  }

  return valor;
}

// ---------------------------------------------------------------------------
// POSSE (ownership) — POR QUE ISTO NÃO É UMA PERMISSÃO
//
// `requirePermission('vistorias:read')` responde "você pode ler vistorias?".
// Ela NÃO responde "você pode ler ESTA vistoria?", porque a resposta depende do
// registro concreto, e o middleware roda antes de qualquer consulta ao banco.
//
// Ou seja: permissão é sobre o TIPO de ação; posse é sobre a LINHA. As duas
// coisas se somam — a permissão passa no middleware, a posse é conferida aqui
// dentro, depois de carregar o registro.
//
// Quem tem 'vistorias:list' pula a checagem de posse: é justamente esse o
// significado dessa permissão.
// ---------------------------------------------------------------------------

/** Filtro de listagem: as próprias vistorias, ou todas para quem pode ver tudo. */
function filtroDeAcesso(usuario: AuthUser) {
  // Objeto vazio = sem filtro = todas as linhas.
  return usuario.permissions.includes(PERMISSAO_VER_TODAS)
    ? {}
    : { vistoriadorId: usuario.id };
}

/**
 * Carrega uma vistoria garantindo que o usuário tem acesso a ela.
 *
 * REPARE NO 404 quando a vistoria existe mas é de outra pessoa. Um 403 ali
 * responderia "existe, mas não é sua" — e isso deixaria qualquer um descobrir
 * quantas vistorias o sistema tem, e quais ids existem, só variando o número na
 * URL. Mesmo raciocínio da mensagem única no login: não confirmamos a
 * existência de um recurso para quem não pode vê-lo.
 */
async function buscarVistoriaComAcesso(id: number, usuario: AuthUser) {
  const vistoria = await prisma.vistoria.findFirst({
    where: { id, ...filtroDeAcesso(usuario) },
    select: vistoriaSelect,
  });

  if (!vistoria) {
    throw notFound('Vistoria não encontrada');
  }

  return vistoria;
}

/**
 * POST /vistorias — cria uma vistoria.
 *
 * O vistoriador é sempre o usuário do token. NÃO existe um campo
 * "vistoriadorId" no corpo: aceitá-lo deixaria qualquer um registrar vistoria
 * em nome de outra pessoa.
 */
export async function criarVistoria(req: Request, res: Response) {
  const usuario = usuarioAutenticado(req);
  const { titulo, descricao } = req.body ?? {};

  if (typeof titulo !== 'string' || titulo.trim() === '') {
    throw badRequest('Campo "titulo" é obrigatório');
  }
  if (descricao !== undefined && typeof descricao !== 'string') {
    throw badRequest('Campo "descricao" deve ser texto');
  }

  const vistoria = await prisma.vistoria.create({
    data: {
      titulo: titulo.trim(),
      descricao: descricao?.trim() || null,
      status: STATUS_INICIAL,
      vistoriadorId: usuario.id,
    },
    select: vistoriaSelect,
  });

  res.status(201).json(vistoria);
}

/**
 * GET /vistorias — lista as vistorias visíveis para quem chamou.
 */
export async function listarVistorias(req: Request, res: Response) {
  const usuario = usuarioAutenticado(req);

  const vistorias = await prisma.vistoria.findMany({
    where: filtroDeAcesso(usuario),
    select: vistoriaSelect,
    orderBy: { createdAt: 'desc' }, // mais recentes primeiro, que é o que o app mostra
  });

  res.json(vistorias);
}

/**
 * GET /vistorias/:id — detalhe de uma vistoria, com as fotos.
 */
export async function obterVistoria(req: Request, res: Response) {
  const usuario = usuarioAutenticado(req);

  res.json(await buscarVistoriaComAcesso(idDaUrl(req, 'id'), usuario));
}

/**
 * POST /vistorias/:id/fotos — anexa uma foto, com comentário opcional.
 *
 * Esta rota recebe `multipart/form-data`, não JSON: o campo "foto" traz o
 * arquivo e o campo "comentario" o texto. Quem lê esse formato é o middleware
 * `uploadFoto` (src/lib/upload.ts), que roda antes deste controller.
 */
export async function anexarFoto(req: Request, res: Response) {
  const usuario = usuarioAutenticado(req);
  const vistoriaId = idDaUrl(req, 'id');

  const arquivo = req.file;

  if (!arquivo) {
    throw badRequest('Envie a imagem no campo "foto" de um formulário multipart');
  }

  // A PARTIR DAQUI O ARQUIVO JÁ ESTÁ EM DISCO. O multer grava enquanto lê o
  // corpo da requisição, então toda falha daqui para baixo precisa apagá-lo —
  // senão cada tentativa recusada deixa um arquivo órfão ocupando espaço, sem
  // nenhuma linha no banco apontando para ele.
  try {
    // Confere posse ANTES de gravar: sem isso, alguém poderia anexar fotos a
    // uma vistoria de outra pessoa só sabendo o id dela.
    await buscarVistoriaComAcesso(vistoriaId, usuario);

    const { comentario } = req.body ?? {};

    if (comentario !== undefined && typeof comentario !== 'string') {
      throw badRequest('Campo "comentario" deve ser texto');
    }

    const foto = await prisma.vistoriaFoto.create({
      data: {
        vistoriaId,
        comentario: comentario?.trim() || null,
        arquivo: arquivo.filename, // só o NOME vai para o banco
        contentType: arquivo.mimetype,
        tamanhoBytes: arquivo.size,
      },
      select: { id: true, comentario: true, contentType: true, tamanhoBytes: true, createdAt: true },
    });

    res.status(201).json(foto);
  } catch (error) {
    await removerArquivo(arquivo.filename);
    throw error; // o erro original segue para o error handler, intacto
  }
}

/**
 * GET /vistorias/:id/fotos/:fotoId/arquivo — baixa o binário da foto.
 *
 * A imagem NÃO é servida por `express.static`: isso deixaria a pasta inteira
 * pública, e qualquer um com o nome do arquivo veria a foto de qualquer
 * vistoria. Passando por aqui, o download herda a autenticação e a mesma
 * checagem de posse do resto do controller.
 */
export async function baixarFoto(req: Request, res: Response) {
  const usuario = usuarioAutenticado(req);
  const vistoriaId = idDaUrl(req, 'id');
  const fotoId = idDaUrl(req, 'fotoId');

  await buscarVistoriaComAcesso(vistoriaId, usuario);

  // O `vistoriaId` no where não é redundante: sem ele, o id de uma foto de
  // outra vistoria funcionaria desde que a vistoria da URL fosse sua.
  const foto = await prisma.vistoriaFoto.findFirst({
    where: { id: fotoId, vistoriaId },
    select: { arquivo: true, contentType: true },
  });

  if (!foto) {
    throw notFound('Foto não encontrada');
  }

  res.type(foto.contentType);

  // `res.sendFile` exige caminho absoluto e cuida dos headers de cache e de
  // requisições parciais (o que permite o vídeo/imagem carregar aos pedaços).
  res.sendFile(path.join(UPLOAD_DIR, foto.arquivo));
}

/**
 * PATCH /vistorias/:id/finalizar — muda o status para FINALIZADA.
 *
 * Existe para a vistoria ter um ciclo de vida mínimo: enquanto está em
 * RASCUNHO o vistoriador ainda está anexando fotos em campo; finalizada, ela
 * vira o registro que o leitor/auditor vai consultar.
 */
export async function finalizarVistoria(req: Request, res: Response) {
  const usuario = usuarioAutenticado(req);
  const id = idDaUrl(req, 'id');

  const vistoria = await buscarVistoriaComAcesso(id, usuario);

  if (vistoria.status === 'FINALIZADA') {
    // 409: a requisição está correta, mas conflita com o estado atual do
    // recurso — o mesmo raciocínio do email já cadastrado.
    throw conflict('Esta vistoria já foi finalizada');
  }

  res.json(
    await prisma.vistoria.update({
      where: { id },
      data: { status: 'FINALIZADA' },
      select: vistoriaSelect,
    }),
  );
}
