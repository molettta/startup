# API de Usuários — projeto base

Projeto base da disciplina de **Frameworks para API e Padrões de Projeto**.

Uma API REST de usuários com autenticação por token (JWT) e autorização por
permissões (RBAC). O código está comentado explicando o *porquê* de cada
decisão — a ideia é que ele sirva de material de leitura, não só de ponto de
partida.

**Stack:** TypeScript · Express 5 · Prisma 7 · PostgreSQL 17 (Docker)

---

## Sumário

- [Antes de começar](#antes-de-começar)
- [Como rodar](#como-rodar)
- [Testando a API](#testando-a-api)
- [Deu erro?](#deu-erro)
- [Como o projeto funciona](#como-o-projeto-funciona)
- [Como estender](#como-estender)
- [Referência de comandos](#referência-de-comandos)

---

## Antes de começar

Você precisa de duas coisas instaladas:

| O quê | Versão | Como conferir | Onde baixar |
|---|---|---|---|
| Node.js | 20 ou superior | `node -v` | [nodejs.org](https://nodejs.org) |
| Docker | qualquer recente | `docker --version` | [docker.com/get-started](https://www.docker.com/get-started/) |

O Docker precisa estar **em execução**, não só instalado. No Windows e no macOS
isso significa abrir o Docker Desktop e esperar o ícone parar de animar. Para
confirmar:

```bash
docker info
```

Se esse comando imprimir várias linhas de informação, está tudo certo. Se
reclamar que não conseguiu conectar, o Docker não está rodando.

> **Você não precisa instalar o PostgreSQL.** Ele sobe em um container, e o
> passo 3 abaixo cuida disso.

---

## Como rodar

Cinco passos. Rode um de cada vez e confira a saída esperada de cada um.

### 1. Instalar as dependências

```bash
npm install
```

### 2. Criar o arquivo de configuração

```bash
cp .env.example .env
```

No Windows, se o `cp` não existir no seu terminal, use:

```bash
copy .env.example .env
```

Isso cria o `.env`, onde ficam a senha do banco e o segredo usado para assinar
os tokens. **Esse arquivo não vai para o Git** (está no `.gitignore`), e é
justamente por isso que ele não vem pronto no repositório — cada pessoa tem o
seu. Os valores padrão já funcionam para desenvolvimento local.

### 3. Subir o banco de dados

```bash
npm run db:up
```

Isso baixa a imagem do PostgreSQL (só na primeira vez, pode demorar um pouco) e
sobe o container. Confira se ele está de pé:

```bash
docker ps
```

Você deve ver uma linha com o nome `fweapi-db` e status `Up ... (healthy)`. Se
aparecer `(health: starting)`, espere alguns segundos — o Postgres ainda está
inicializando.

### 4. Criar as tabelas

```bash
npm run db:migrate
```

Esse comando lê o `prisma/schema.prisma`, gera o SQL correspondente e o aplica
no banco. Ao final, ele também gera o *client* do Prisma — o código TypeScript
já tipado que a aplicação usa para consultar o banco.

### 5. Popular com dados iniciais

```bash
npm run db:seed
```

Cria as roles, as permissões e dois usuários de teste. Saída esperada:

```
Banco populado com sucesso.
  admin: eduardo@example.com / password123
  user:  user@example.com / password123
```

### Pronto — agora é só rodar

```bash
npm run dev
```

```
Conexão com o banco estabelecida.
Servidor rodando em http://localhost:3000
```

O servidor reinicia sozinho a cada arquivo salvo. Para parar, `Ctrl+C`.

Confira que está no ar:

```bash
curl http://localhost:3000/health
```

Deve responder `{"status":"ok"}`.

### Nas próximas vezes

Depois da primeira configuração, o dia a dia é só:

```bash
npm run db:up && npm run dev
```

---

## Testando a API

### Usuários criados pelo seed

| Email | Senha | Roles | Pode listar usuários? |
|---|---|---|---|
| `eduardo@example.com` | `password123` | Admin, User | sim |
| `user@example.com` | `password123` | User | **não** (403) |

### Endpoints

| Método | Rota | Acesso |
|---|---|---|
| `GET` | `/health` | público |
| `POST` | `/users` | público — cadastro |
| `POST` | `/users/login` | público — devolve o token |
| `GET` | `/users` | exige token **e** a permissão `users:list` |

### Roteiro completo pelo terminal

Com o servidor rodando, abra **outro** terminal e execute na ordem.

**1. Tentar listar sem token — deve dar 401:**

```bash
curl -i http://localhost:3000/users
```

**2. Fazer login como admin e guardar o token:**

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/users/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"eduardo@example.com","password":"password123"}' \
  | sed -E 's/.*"token":"([^"]+)".*/\1/')
echo $TOKEN
```

**3. Listar os usuários com o token — deve dar 200:**

```bash
curl -s http://localhost:3000/users -H "Authorization: Bearer $TOKEN"
```

Repare que **nenhum usuário traz o campo `password`** na resposta.

**4. A parte interessante — o mesmo endpoint com um usuário comum:**

```bash
TOKEN_USER=$(curl -s -X POST http://localhost:3000/users/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"user@example.com","password":"password123"}' \
  | sed -E 's/.*"token":"([^"]+)".*/\1/')

curl -i http://localhost:3000/users -H "Authorization: Bearer $TOKEN_USER"
```

Responde **403 Forbidden**: o token é válido (sabemos quem é), mas essa pessoa
não tem a permissão `users:list`. Essa é a diferença entre 401 e 403.

**5. Criar um usuário novo:**

```bash
curl -s -X POST http://localhost:3000/users \
  -H 'Content-Type: application/json' \
  -d '{"name":"Fulano","email":"fulano@example.com","password":"senhaforte123"}'
```

**6. Confirmar que a senha foi hasheada:**

```bash
docker exec fweapi-db psql -U postgres -d fweapi \
  -c 'SELECT email, password FROM "User";'
```

Nenhuma senha aparece legível — todas viram um hash começando com `$2b$10$`.
Nem quem tem acesso ao banco consegue descobrir a senha de alguém.

### Vendo o banco pela interface gráfica

```bash
npm run db:studio
```

Abre o Prisma Studio no navegador, onde dá para navegar e editar as tabelas.

---

## Deu erro?

<details>
<summary><b>Cannot find module './generated/prisma/client'</b></summary>

O client do Prisma ainda não foi gerado. Ele não vai para o Git de propósito —
é código gerado.

```bash
npx prisma generate
```
</details>

<details>
<summary><b>Variável de ambiente DATABASE_URL não definida</b></summary>

Falta o arquivo `.env`. Volte ao passo 2:

```bash
cp .env.example .env
```
</details>

<details>
<summary><b>Bind for 0.0.0.0:5433 failed: port is already allocated</b></summary>

Outra coisa já está usando a porta 5433 na sua máquina. Escolha outra — por
exemplo 5434 — e altere **as duas linhas** no `.env`:

```
POSTGRES_PORT=5434
DATABASE_URL="postgresql://postgres:postgres@localhost:5434/fweapi?schema=public"
```

Depois `npm run db:up` de novo. Esquecer de mudar a `DATABASE_URL` junto é o
erro mais comum aqui: o container sobe, mas a aplicação continua procurando o
banco na porta antiga.
</details>

<details>
<summary><b>Can't reach database server / ECONNREFUSED</b></summary>

A aplicação não achou o banco. Verifique, nesta ordem:

1. O container está de pé? `docker ps` deve mostrar `fweapi-db` como `healthy`.
   Se não estiver, `npm run db:up`.
2. O Docker está rodando? `docker info`.
3. A porta na `DATABASE_URL` do `.env` é a mesma do `POSTGRES_PORT`?
</details>

<details>
<summary><b>Cannot use import statement outside a module</b></summary>

Você rodou um arquivo `.ts` direto com `node`. O Node não executa TypeScript —
use os scripts do projeto (`npm run dev`) ou o `tsx`:

```bash
npx tsx src/server.ts
```
</details>

<details>
<summary><b>Mudei o schema.prisma e nada aconteceu</b></summary>

Alterar o schema não altera o banco sozinho. É preciso gerar a migration:

```bash
npm run db:migrate
```

Ele pergunta um nome para a mudança (por exemplo `add_campo_telefone`), aplica
no banco e regenera o client.
</details>

<details>
<summary><b>Quero começar do zero</b></summary>

Apaga o banco inteiro, recria as tabelas e roda o seed:

```bash
npm run db:reset
```

Para apagar até o volume do Docker (recomeço completo):

```bash
docker compose down -v && npm run db:up && npm run db:migrate && npm run db:seed
```
</details>

---

## Como o projeto funciona

### O caminho de uma requisição

```
GET /users
  |
  v
express.json()                  transforma o corpo JSON em req.body
  |
  v
authenticate                    valida o token, carrega req.user     -> 401
  |
  v
requirePermission('users:list') confere a permissão                  -> 403
  |
  v
getAllUsers                     consulta o banco e responde
  |
  v
errorHandler                    só entra em ação se algo lançar erro
```

### Autenticação e autorização

São coisas diferentes, e o projeto as separa em middlewares distintos:

| | Pergunta | Middleware | Falha com |
|---|---|---|---|
| **Autenticação** | quem é você? | `authenticate` | 401 |
| **Autorização** | você pode fazer isso? | `requirePermission` | 403 |

### O modelo de permissões (RBAC)

```
Usuário  --N:N-->  Role  --N:N-->  Permission
Eduardo            Admin           users:list, users:write, users:read
                   User            users:read
```

As rotas **não perguntam qual é o cargo do usuário**. Elas exigem uma permissão
concreta:

```ts
router.get('/', authenticate, requirePermission('users:list'), getAllUsers);
```

Isso importa: liberar essa rota para um cargo novo — um "Moderador", digamos —
não exige mexer em nenhuma rota nem em nenhum controller. Basta dar a permissão
ao cargo. O mapa de cargos e permissões está em
[`prisma/seed.ts`](prisma/seed.ts).

| Role | Permissões |
|---|---|
| `Admin` | `users:list`, `users:write`, `users:read` |
| `User` | `users:read` |

> `users:read` e `users:write` já estão modeladas mas ainda não são exigidas por
> nenhuma rota. São o ponto de partida para os exercícios da disciplina.

### Estrutura dos arquivos

```
docker-compose.yml        Postgres em container
prisma.config.ts          configuração do Prisma CLI
prisma/
  schema.prisma           os modelos — fonte da verdade do banco
  migrations/             histórico versionado das mudanças do banco
  seed.ts                 dados iniciais + mapa de roles e permissões
src/
  server.ts               ponto de entrada: conecta no banco e sobe o servidor
  app.ts                  monta o Express (separado para permitir testes)
  config/env.ts           lê e valida as variáveis de ambiente no boot
  lib/prisma.ts           instância única do PrismaClient
  lib/errors.ts           HttpError e atalhos por status (badRequest, ...)
  routes/                 quais rotas existem e o que cada uma exige
  controllers/            a regra de cada endpoint
  middleware/auth.ts      authenticate e requirePermission
  middleware/error.ts     404 e tratamento central de erros
  types/                  tipos próprios e extensão do Request do Express
  generated/prisma/       client gerado pelo Prisma (não versionado)
```

Boa ordem de leitura para entender o projeto:
`schema.prisma` → `app.ts` → `user.routes.ts` → `middleware/auth.ts` →
`user.controller.ts`.

---

## Como estender

### Adicionar um endpoint

Suponha `DELETE /users/:id`.

**1.** Escreva o handler em `src/controllers/user.controller.ts`:

```ts
export async function deleteUser(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) throw badRequest('id inválido');

  await prisma.user.delete({ where: { id } });
  res.status(204).send();
}
```

**2.** Registre a rota com a permissão que ela exige, em
`src/routes/user.routes.ts`:

```ts
router.delete('/:id', authenticate, requirePermission('users:write'), deleteUser);
```

Pronto. Como `users:write` já pertence ao Admin, ele já pode usar o endpoint.

### Criar uma permissão nova

Some ao mapa em `prisma/seed.ts` e rode `npm run db:seed`:

```ts
const ROLE_PERMISSIONS = {
  Admin:     ['users:list', 'users:write', 'users:read'],
  Moderador: ['users:list'],
  User:      ['users:read'],
} as const;
```

### Adicionar um campo ou um modelo

Edite `prisma/schema.prisma` e rode:

```bash
npm run db:migrate
```

Ele pede um nome para a migration, aplica a mudança e regenera o client — os
tipos do TypeScript passam a refletir o campo novo na hora.

---

## Referência de comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | servidor em modo desenvolvimento, reinicia ao salvar |
| `npm run build` | gera o client do Prisma e compila para `dist/` |
| `npm start` | roda a versão compilada (produção) |
| `npm run typecheck` | verifica os tipos sem gerar arquivos |
| `npm run db:up` | sobe o container do Postgres |
| `npm run db:down` | derruba o container (os dados ficam salvos) |
| `npm run db:migrate` | cria e aplica uma migration |
| `npm run db:seed` | popula o banco (pode rodar quantas vezes quiser) |
| `npm run db:reset` | apaga tudo, recria as tabelas e roda o seed |
| `npm run db:studio` | abre a interface gráfica do banco |

---

## Para saber mais

- [Documentação do Prisma](https://www.prisma.io/docs)
- [Express 5](https://expressjs.com/)
- [Introdução a JWT](https://jwt.io/introduction) — cole um token seu lá e veja
  que o conteúdo é legível por qualquer um
- [OWASP: armazenamento de senhas](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
