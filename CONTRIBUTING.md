# Guia do aluno

Este repositório é a **base** para o trabalho da disciplina. Ele já traz
cadastro, login com token e controle de permissões funcionando — você parte
daqui e constrói o seu sistema em cima.

Se ainda não rodou o projeto, comece pelo [README](README.md). Este guia é
sobre o **fluxo de trabalho**: como pegar sua cópia, como adicionar uma
funcionalidade nova e como receber as correções que o professor fizer na base.

## Sumário

- [1. Preparando sua cópia](#1-preparando-sua-cópia)
- [2. O ciclo do dia a dia](#2-o-ciclo-do-dia-a-dia)
- [3. Adicionando uma funcionalidade](#3-adicionando-uma-funcionalidade)
- [4. Recebendo correções da base](#4-recebendo-correções-da-base)
- [5. Quando dá conflito](#5-quando-dá-conflito)
- [6. Armadilhas comuns](#6-armadilhas-comuns)
- [7. Antes de entregar](#7-antes-de-entregar)

---

## 1. Preparando sua cópia

### Faça o fork

No GitHub, abra o repositório da base e clique em **Fork**. Isso cria uma cópia
**sua**, independente, na sua conta. Você tem permissão total nela.

### Clone o seu fork

```bash
git clone https://github.com/SEU-USUARIO/startup.git
cd startup
```

### Conecte de volta na base

Este passo é rápido, você faz **uma vez só**, e é o que vai permitir receber
correções depois. Sem ele, sua cópia fica isolada para sempre.

```bash
git remote add upstream https://github.com/molettta/startup.git
```

Confira:

```bash
git remote -v
```

Você deve ver dois endereços:

| Remote | Aponta para | Serve para |
|---|---|---|
| `origin` | o **seu** fork | salvar o seu trabalho |
| `upstream` | a base do professor | puxar correções |

> Você **nunca** dá push no `upstream` — não tem permissão, e não é para ter.
> A comunicação nesse sentido é sempre você **puxando**.

### Rode o projeto

Siga o [README](README.md). Em resumo:

```bash
npm install
cp .env.example .env
npm run db:up
npm run db:migrate
npm run db:seed
npm run dev
```

---

## 2. O ciclo do dia a dia

**Sempre comece puxando** as novidades da base (detalhes na
[seção 4](#4-recebendo-correções-da-base)):

```bash
git fetch upstream && git merge upstream/main
```

Trabalhe em uma branch, não direto na `main`:

```bash
git checkout -b emprestimo-de-livros
```

Faça o trabalho, commite em pedaços que façam sentido:

```bash
git add .
git commit -m "Adiciona model Livro e migration"
```

E suba para o **seu** fork:

```bash
git push origin emprestimo-de-livros
```

> **Por que branch e não `main` direto?** Porque se algo der errado, você
> abandona a branch e sua `main` continua funcionando. E porque é assim que se
> trabalha fora da faculdade.

---

## 3. Adicionando uma funcionalidade

O caminho é sempre o mesmo, nesta ordem. O exemplo abaixo adiciona empréstimo
de livros a uma biblioteca — adapte para o seu domínio (oficina, restaurante,
prontuário...).

### Passo 1 — Modele os dados

Abra `prisma/schema.prisma` e adicione seus models no final do arquivo:

```prisma
model Livro {
  id          Int          @id @default(autoincrement())
  titulo      String
  autor       String
  isbn        String       @unique
  emprestimos Emprestimo[]
}

model Emprestimo {
  id          Int       @id @default(autoincrement())
  livro       Livro     @relation(fields: [livroId], references: [id])
  livroId     Int
  pessoa      User      @relation(fields: [pessoaId], references: [id])
  pessoaId    Int
  retiradoEm  DateTime  @default(now())
  devolvidoEm DateTime?
}
```

Repare que `Emprestimo` se liga ao `User` que **já existe** na base — você
reaproveita o cadastro e o login prontos, em vez de criar uma tabela de pessoas
do zero.

Toda relação tem dois lados. Como `Emprestimo` aponta para `User`, o `User`
precisa declarar o lado inverso:

```prisma
model User {
  // ... campos que já existiam ...
  emprestimos Emprestimo[]
}
```

> Esqueceu o lado inverso? O Prisma avisa com uma mensagem clara ao rodar a
> migration. Não é um erro grave, é só completar.

### Passo 2 — Aplique no banco

```bash
npm run db:migrate
```

Ele pede um nome para a migration — use algo descritivo, como
`adiciona-livros`. Esse comando faz três coisas de uma vez: gera o SQL, aplica
no banco e **regenera os tipos**. A partir daqui `prisma.livro` existe e o
autocomplete conhece os campos.

### Passo 3 — Escreva a regra de negócio

Crie `src/services/livro.service.ts`. É aqui que fica o que o sistema *faz* —
separado do Express, o que torna a regra fácil de ler e de testar:

```ts
import { conflict, notFound } from '../lib/errors';
import { prisma } from '../lib/prisma';

export async function listarLivros() {
  return prisma.livro.findMany({ orderBy: { titulo: 'asc' } });
}

export async function criarLivro(dados: { titulo: string; autor: string; isbn: string }) {
  if (await prisma.livro.findUnique({ where: { isbn: dados.isbn } })) {
    throw conflict('Já existe um livro com esse ISBN');
  }
  return prisma.livro.create({ data: dados });
}

export async function emprestar(livroId: number, pessoaId: number) {
  const livro = await prisma.livro.findUnique({ where: { id: livroId } });
  if (!livro) {
    throw notFound('Livro não encontrado');
  }
  return prisma.emprestimo.create({ data: { livroId, pessoaId } });
}
```

Os helpers `conflict` e `notFound` vêm de `src/lib/errors.ts` e viram a
resposta HTTP certa automaticamente. Você **não** precisa de `try/catch`: veja
o comentário no topo de `src/controllers/user.controller.ts`.

### Passo 4 — Exponha pela web

Crie `src/controllers/livro.controller.ts`. O controller lê o request, valida a
entrada e devolve a resposta — nada de regra de negócio aqui:

```ts
import type { Request, Response } from 'express';

import { badRequest, unauthorized } from '../lib/errors';
import * as livroService from '../services/livro.service';

export async function getAllLivros(_req: Request, res: Response) {
  res.json(await livroService.listarLivros());
}

export async function createLivro(req: Request, res: Response) {
  const { titulo, autor, isbn } = req.body ?? {};

  if (typeof titulo !== 'string' || titulo.trim() === '') {
    throw badRequest('Campo "titulo" é obrigatório');
  }
  if (typeof autor !== 'string' || autor.trim() === '') {
    throw badRequest('Campo "autor" é obrigatório');
  }
  if (typeof isbn !== 'string' || isbn.trim() === '') {
    throw badRequest('Campo "isbn" é obrigatório');
  }

  res.status(201).json(await livroService.criarLivro({ titulo, autor, isbn }));
}

export async function emprestarLivro(req: Request, res: Response) {
  if (!req.user) {
    throw unauthorized('Rota autenticada');
  }

  const livroId = Number(req.params.id);
  if (Number.isNaN(livroId)) {
    throw badRequest('id inválido');
  }

  res.status(201).json(await livroService.emprestar(livroId, req.user.id));
}
```

**Valide tudo que vem do cliente.** Quem chama sua API pode ser um `curl`, não
o seu front-end — `"titulo": 123` é perfeitamente possível.

### Passo 5 — Declare as rotas e quem pode usá-las

Crie `src/routes/livro.routes.ts`:

```ts
import { Router } from 'express';

import { createLivro, emprestarLivro, getAllLivros } from '../controllers/livro.controller';
import { authenticate, requirePermission } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, requirePermission('livros:list'), getAllLivros);
router.post('/', authenticate, requirePermission('livros:write'), createLivro);
router.post('/:id/emprestimos', authenticate, requirePermission('livros:list'), emprestarLivro);

export default router;
```

E registre no `src/app.ts`, junto das rotas de usuário:

```ts
import livroRoutes from './routes/livro.routes';

app.use('/livros', livroRoutes);
```

> A ordem dos `app.use` importa. Registre suas rotas **antes** do
> `notFoundHandler` e do `errorHandler` — veja os comentários no `app.ts`.

### Passo 6 — Crie as permissões

As permissões que você citou nas rotas precisam existir no banco. Abra
`prisma/seed.ts` e adicione ao mapa:

```ts
const ROLE_PERMISSIONS = {
  Admin: ['users:list', 'users:write', 'users:read', 'livros:list', 'livros:write'],
  User: ['users:read', 'livros:list'],
} as const;
```

Rode de novo (o seed é idempotente, pode rodar quantas vezes quiser):

```bash
npm run db:seed
```

Aqui está a vantagem do RBAC: para dar acesso a um cargo novo, você mexe **só
nesse mapa**. Nenhuma rota e nenhum middleware mudam.

### Passo 7 — Teste

Primeiro, o compilador:

```bash
npm run typecheck   # o TypeScript compila?
npm run dev         # sobe
```

Depois, no Postman ou no Bruno. Se ainda não montou o Environment com
`baseUrl` e `token`, o [README](README.md#roteiro-completo-no-postman-ou-no-bruno)
explica — e vale configurar o script que salva o token sozinho, porque você vai
repetir esses testes muitas vezes.

Faça login como `eduardo@example.com` e então:

| Método e URL | Body (JSON) | Esperado |
|---|---|---|
| `POST {{baseUrl}}/livros` | `{"titulo":"Dom Casmurro","autor":"Machado de Assis","isbn":"978-85-01"}` | **201** |
| `GET {{baseUrl}}/livros` | — | **200**, com o livro criado |
| `POST {{baseUrl}}/livros/1/emprestimos` | — | **201** |

Lembre do *Bearer Token* com `{{token}}` na aba *Auth* dos três.

**Agora teste o que deve falhar.** Esta parte não é opcional — um endpoint que
só foi testado no caminho feliz não foi testado:

| O que fazer | Esperado |
|---|---|
| `GET {{baseUrl}}/livros` sem nenhum token | **401** |
| `POST {{baseUrl}}/livros` com o token do `user@example.com` | **403** (ele não tem `livros:write`) |
| `POST {{baseUrl}}/livros` sem o campo `titulo` | **400** |
| `POST {{baseUrl}}/livros` repetindo o mesmo `isbn` | **409** |

Se algum desses devolver **200** ou **201**, você tem um bug: ou faltou
validação no controller, ou faltou `requirePermission` na rota.

> **Dica:** no Bruno, a coleção é salva como arquivos `.bru` dentro de uma
> pasta. Se você guardá-la no repositório, o professor consegue rodar os seus
> testes exatamente como você os montou — e isso conta a favor na entrega.

---

## 4. Recebendo correções da base

Quando o professor corrigir algo na base, **você puxa** — nada chega sozinho no
seu fork.

Commite o que estiver em andamento primeiro (merge com arquivos soltos é dor de
cabeça garantida). Depois:

```bash
git fetch upstream
git merge upstream/main
```

O git traz só o que mudou na base e **não toca no seu trabalho**. Numa
simulação real desse fluxo, um aluno que tinha adicionado o model `Livro` e o
service dele puxou uma correção do professor no `user.controller.ts` e o
resultado foi:

```
Merge made by the 'ort' strategy.
 src/controllers/user.controller.ts | 2 +-
 1 file changed, 1 insertion(+), 1 deletion(-)
```

Correção recebida, `Livro` e service intactos.

Se a base mudou o schema, rode a migration depois do merge:

```bash
npm run db:migrate
```

> **Puxe cedo e com frequência.** Um merge de uma correção pequena é trivial.
> Acumular dois meses de divergência e tentar juntar tudo na véspera da entrega
> é onde a coisa vira pesadelo.

---

## 5. Quando dá conflito

Acontece quando você e a base mexeram **nas mesmas linhas** do mesmo arquivo. O
candidato número um é o `prisma/schema.prisma`, porque todo mundo adiciona
models no final dele.

O git para e marca o arquivo assim:

```prisma
<<<<<<< HEAD
model Livro {
  ...
=======
model AuditLog {
  ...
>>>>>>> upstream/main
}
```

Lendo isso:

- entre `<<<<<<< HEAD` e `=======` → **o seu** código
- entre `=======` e `>>>>>>>` → o que veio **da base**

O git não sabe qual manter, então pergunta. Em quase todos os casos do semestre
a resposta é **manter os dois**: apague as três linhas de marcação, ajuste as
chaves para que os dois blocos fiquem completos, e confira o resultado.

Depois:

```bash
npm run typecheck                    # confirme que ficou válido
git add prisma/schema.prisma
git commit -m "Resolve conflito: mantem Livro e AuditLog"
```

Se se perder no meio, dá para voltar ao estado anterior e tentar de novo com
calma:

```bash
git merge --abort
```

---

## 6. Armadilhas comuns

**Não edite `src/generated/`.** É código gerado a partir do schema, não vai
para o Git, e o próximo `npm install` sobrescreve tudo. Para mudar o que tem
ali, mude o `schema.prisma` e rode a migration.

**Campo obrigatório em tabela com dados.** Adicionar `String` (sem `?`) a uma
tabela que já tem linhas faz a migration falhar — o Postgres não sabe o que pôr
nas linhas existentes. Use `String?` ou dê um `@default("...")`.

**Esqueceu de rodar a migration.** Mudou o schema e o código não enxerga o
campo novo? Faltou `npm run db:migrate`.

**`Cannot find module '../generated/prisma/client'`.** Rode `npx prisma
generate`. Isso **não** tem relação com o pacote `@prisma/client` — veja a
seção "Deu erro?" do README.

**Não commite o `.env`.** Ele está no `.gitignore` e deve continuar assim: tem
senha e o segredo dos tokens. Se precisar de uma variável nova, adicione ao
`.env.example` (sem o valor real) para que os outros saibam que ela existe.

**Senha nunca em texto puro.** Se o seu domínio guardar qualquer segredo, use
`bcrypt.hash` — o `user.controller.ts` tem o exemplo pronto.

**Não devolva dados sensíveis.** Use `select` para listar o que **entra** na
resposta, em vez de mandar o objeto inteiro. O `publicUserSelect` no
`user.controller.ts` mostra o padrão e explica o porquê.

---

## 7. Antes de entregar

```bash
npm run typecheck   # compila sem erro?
npm run build       # o build de produção passa?
```

E confira:

- [ ] `git status` limpo — nada esquecido sem commitar
- [ ] O `.env` **não** está no repositório
- [ ] Todas as migrations estão commitadas (`prisma/migrations/`)
- [ ] O `prisma/seed.ts` cria as permissões que as suas rotas exigem
- [ ] Um clone limpo do seu fork roda seguindo o README, do zero
- [ ] Cada endpoint foi testado no caminho feliz **e** nos erros (401, 403, 400)

O último item vale um teste de verdade: clone seu próprio fork numa pasta nova
e siga o README como se fosse outra pessoa. É a forma mais rápida de descobrir
que faltou commitar alguma coisa.
