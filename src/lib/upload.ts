// ============================================================================
// UPLOAD DE ARQUIVOS (fotos das vistorias)
//
// Um formulário com arquivo não chega como JSON: o navegador envia
// `multipart/form-data`, um formato que mistura campos de texto e bytes de
// arquivo no mesmo corpo. O `express.json()` registrado no app.ts não sabe ler
// isso — ele ignora o corpo e `req.body` chega vazio.
//
// Quem faz essa leitura é o multer: ele consome o corpo multipart, salva o
// arquivo em disco e devolve os dados dele em `req.file`, com os campos de
// texto em `req.body`.
//
// A REGRA CENTRAL DESTE ARQUIVO: o arquivo vai para o disco, e só o NOME dele
// vai para o banco (veja o model VistoriaFoto no schema.prisma).
// ============================================================================

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';

import { badRequest } from './errors';

/**
 * Pasta onde as fotos ficam gravadas.
 *
 * `process.cwd()` é o diretório de onde o `npm run dev` foi chamado — a raiz do
 * projeto. Não usamos um caminho relativo solto ('./uploads') porque ele seria
 * resolvido a partir de onde o processo rodou, e o mesmo código gravaria em
 * lugares diferentes conforme o terminal.
 *
 * Esta pasta está no .gitignore: são dados de execução, não código.
 *
 * (Em produção isto não serve: cada instância da API teria a sua pasta, e a
 * foto enviada para a instância A não existiria para a instância B — o mesmo
 * problema que apareceu na corrida do cadastro. A solução de verdade é um
 * storage de objeto, S3 ou MinIO. Como só este arquivo conhece o disco, essa
 * troca fica contida aqui.)
 */
export const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

/** Tipos aceitos. Lista de permissão: o que não está aqui é recusado. */
const TIPOS_ACEITOS = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

/** Limite por arquivo. Foto de celular passa fácil de 5MB. */
const TAMANHO_MAXIMO_BYTES = 10 * 1024 * 1024; // 10MB

// `recursive: true` faz a função não reclamar se a pasta já existir — sem isso
// o segundo boot da aplicação quebraria com EEXIST.
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),

  filename: (_req, file, cb) => {
    // O NOME ORIGINAL DO ARQUIVO NÃO É USADO, e isso é proposital.
    //
    // Ele vem do cliente, então é entrada não confiável: um nome como
    // "../../.env" faria o arquivo ser gravado fora da pasta de uploads
    // (*path traversal*). Além disso, dois celulares mandam "IMG_0001.jpg" e um
    // sobrescreveria o outro.
    //
    // Geramos um nome aleatório e mantemos apenas a extensão — que passa pelo
    // `path.extname`, descartando qualquer diretório embutido no caminho.
    const extensao = path.extname(file.originalname).toLowerCase();
    cb(null, `${crypto.randomUUID()}${extensao}`);
  },
});

/** O middleware do multer propriamente dito, envolvido logo abaixo. */
const middlewareMulter = multer({
  storage,
  limits: { fileSize: TAMANHO_MAXIMO_BYTES },

  fileFilter: (_req, file, cb) => {
    if (!TIPOS_ACEITOS.includes(file.mimetype)) {
      // Recusamos ANTES de gravar: o multer interrompe a leitura do corpo em
      // vez de escrever no disco um arquivo que seria descartado em seguida.
      //
      // Repare que o erro vai pelo callback, não por um `throw`: estamos dentro
      // de um callback do multer, e um throw aqui não chegaria ao error handler
      // do Express.
      return cb(badRequest(`Tipo de arquivo não aceito: ${file.mimetype}`));
    }

    cb(null, true);
  },
}).single('foto');

/**
 * Middleware de upload de UMA foto, vinda do campo "foto" do formulário.
 *
 * Usar na rota assim:
 *   router.post('/:id/fotos', authenticate, uploadFoto, anexarFoto)
 *
 * Depois dele, o controller encontra o arquivo em `req.file` e o comentário
 * (campo de texto do mesmo formulário) em `req.body.comentario`.
 *
 * POR QUE ENVOLVER O MULTER em vez de usá-lo direto na rota? Porque os erros
 * dele são `MulterError`, um tipo que o nosso error handler não conhece — um
 * arquivo acima do limite viraria "500 Erro interno do servidor", quando o
 * problema é do cliente e a resposta certa é 400. Traduzimos aqui, e assim o
 * resto do projeto continua sem precisar saber que o multer existe.
 */
export function uploadFoto(req: Request, res: Response, next: NextFunction) {
  middlewareMulter(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      // O código é estável entre versões; a mensagem, não. Mesma lógica do
      // P2002 do Prisma no controller de usuários.
      if (error.code === 'LIMIT_FILE_SIZE') {
        const limiteMb = TAMANHO_MAXIMO_BYTES / 1024 / 1024;
        return next(badRequest(`Foto acima do limite de ${limiteMb}MB`));
      }

      return next(badRequest(`Falha no upload: ${error.code}`));
    }

    // Erros que nós mesmos criamos no fileFilter já são HttpError e passam
    // direto; qualquer outra coisa segue como erro inesperado, para virar 500.
    next(error);
  });
}

/**
 * Apaga um arquivo de upload, ignorando o caso de ele já não existir.
 *
 * Serve para não deixar lixo no disco quando a gravação no banco falha depois
 * do upload já ter acontecido — veja o uso no controller de vistoria.
 */
export async function removerArquivo(nomeArquivo: string) {
  // `force: true` faz a função não lançar quando o arquivo não está lá. É o que
  // queremos: esta limpeza roda em caminho de erro, e um erro aqui esconderia o
  // erro original, que é o que realmente interessa.
  await fs.promises.rm(path.join(UPLOAD_DIR, nomeArquivo), { force: true });
}
