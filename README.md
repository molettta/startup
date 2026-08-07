# startup

Projeto da disciplina de FW API e padrões de projeto.

API REST de usuários com autenticação JWT e autorização RBAC (roles → permissões).

**Stack:** TypeScript · Express 5 · Prisma 7 · PostgreSQL 17 (Docker)

## Como rodar

Requisitos: Node 20+ e Docker.

```bash
npm install
cp .env.example .env
npm run db:up
npm run db:migrate
npm run db:seed
npm run dev
```

A API sobe em `http://localhost:3000`.

> O Postgres do compose usa a porta **5433** no host, para não conflitar com outro
> Postgres que já esteja usando a 5432. Ajuste `POSTGRES_PORT` e `DATABASE_URL` no
> `.env` se quiser outra porta.

### Usuários criados pelo seed

| Email | Senha | Roles |
|---|---|---|
| `eduardo@example.com` | `password123` | Admin, User |
| `user@example.com` | `password123` | User |

## Endpoints

| Método | Rota | Acesso |
|---|---|---|
| `GET` | `/health` | público |
| `POST` | `/users` | público (cadastro — entra com a role `User`) |
| `POST` | `/users/login` | público — devolve o JWT |
| `GET` | `/users` | requer JWT + permissão `users:list` |

```bash
# login
TOKEN=$(curl -s -X POST http://localhost:3000/users/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"eduardo@example.com","password":"password123"}' | jq -r .token)

# listar usuários
curl http://localhost:3000/users -H "Authorization: Bearer $TOKEN"
```

## Autorização

O controle de acesso não olha o nome da role. As rotas declaram a **permissão**
que exigem, e o middleware resolve as permissões a partir das roles do usuário:

```ts
router.get('/', authenticate, requirePermission('users:list'), getAllUsers);
```

O mapa de roles → permissões fica em [`prisma/seed.ts`](prisma/seed.ts):

| Role | Permissões |
|---|---|
| `Admin` | `users:list`, `users:write`, `users:read` |
| `User` | `users:read` |

`users:read` e `users:write` já estão modeladas e são o ponto de extensão para
novas rotas — hoje só `users:list` é exigida por uma rota.

## Estrutura

```
docker-compose.yml        Postgres 17
prisma/
  schema.prisma           modelos User, Role, Permission
  migrations/             histórico versionado do banco
  seed.ts                 dados iniciais (senhas com bcrypt)
prisma.config.ts          config do Prisma 7 (schema, migrations, seed)
src/
  server.ts               bootstrap: conecta no banco, sobe o listener
  app.ts                  monta o app Express (isolado, testável)
  config/env.ts           lê e valida as variáveis de ambiente no boot
  lib/prisma.ts           PrismaClient singleton (adapter pg)
  lib/errors.ts           HttpError + helpers de status
  routes/                 definição das rotas
  controllers/            regra de cada endpoint
  middleware/auth.ts      authenticate + requirePermission
  middleware/error.ts     404 e handler central de erros
  types/                  AuthUser, JwtPayload, augment de Express.Request
  generated/prisma/       client gerado pelo Prisma (não versionado)
```

## Scripts

| Script | O que faz |
|---|---|
| `npm run dev` | servidor em watch mode (tsx) |
| `npm run build` | gera o client Prisma e compila para `dist/` |
| `npm start` | roda o build de produção |
| `npm run typecheck` | checagem de tipos sem emitir |
| `npm run db:up` / `db:down` | sobe / derruba o Postgres |
| `npm run db:migrate` | cria e aplica migration |
| `npm run db:seed` | popula o banco (idempotente) |
| `npm run db:reset` | recria o banco do zero e reaplica o seed |
| `npm run db:studio` | abre o Prisma Studio |
