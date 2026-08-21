# API de Usuários — projeto base

Projeto base da disciplina de **Frameworks para API e Padrões de Projeto**.

Uma API REST de usuários com autenticação por token (JWT) e autorização por
permissões (RBAC). O código está comentado explicando o *porquê* de cada
decisão — a ideia é que ele sirva de material de leitura, não só de ponto de
partida.

**Stack:** TypeScript · Express 5 · Prisma 7 · PostgreSQL 17 (Docker)

> **É aluno da disciplina e vai construir seu sistema em cima desta base?**
> Comece por aqui para colocar o projeto no ar, e depois siga o
> **[Guia do aluno](CONTRIBUTING.md)** — ele cobre o fork, como adicionar uma
> funcionalidade nova ponta a ponta e como receber as correções da base.

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

Ao final, ele também gera o *client* do Prisma — o código TypeScript já tipado
que a aplicação usa para falar com o banco. Esse client não vem no repositório
(é gerado a partir do `prisma/schema.prisma`), e é o script `postinstall` que
cuida disso para você.

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

Abra <http://localhost:3000/health> no navegador. Deve responder:

```json
{ "status": "ok" }
```

(É um `GET` público, então o navegador serve. Para o resto da API você vai
precisar de um cliente HTTP — veja [Testando a API](#testando-a-api).)

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

### Roteiro completo no Postman ou no Bruno

Use o cliente que preferir — [Postman](https://www.postman.com/downloads/) ou
[Bruno](https://www.usebruno.com/downloads). Os dois fazem a mesma coisa aqui;
o Bruno tem a vantagem de salvar as requisições como arquivos de texto, que dá
para versionar no Git junto com o projeto.

#### Prepare o ambiente (uma vez só)

Crie um **Environment** (Postman: canto superior direito → *Environments*;
Bruno: aba *Environments* da coleção) com duas variáveis:

| Variável | Valor |
|---|---|
| `baseUrl` | `http://localhost:3000` |
| `token` | *(deixe vazio — será preenchido no login)* |

Usar `{{baseUrl}}` nas URLs em vez de digitar o endereço evita ter que editar
tudo se a porta mudar.

#### Os requests, nesta ordem

Com o servidor rodando (`npm run dev`), monte e dispare um de cada vez. A
coluna da direita é o que **deve** acontecer — se vier outra coisa, algo está
errado.

**1. Listar sem token**

| | |
|---|---|
| Método e URL | `GET {{baseUrl}}/users` |
| Auth | nenhuma |
| **Esperado** | **401** — `{"message":"Token não informado"}` |

**2. Login como admin**

| | |
|---|---|
| Método e URL | `POST {{baseUrl}}/users/login` |
| Body | aba *Body* → **raw / JSON** (Postman) ou **JSON** (Bruno) |
| | `{"email":"eduardo@example.com","password":"password123"}` |
| **Esperado** | **200** — um objeto com o campo `token` |

Copie o valor do `token` e cole na variável `token` do Environment. (Na seção
seguinte tem como fazer isso automaticamente.)

> Se esquecer de marcar o body como **JSON**, o cliente manda como texto puro,
> a API não consegue interpretar e você recebe um 400. É o tropeço mais comum
> aqui.

**3. Listar com o token do admin**

| | |
|---|---|
| Método e URL | `GET {{baseUrl}}/users` |
| Auth | aba *Auth* → tipo **Bearer Token** → valor `{{token}}` |
| **Esperado** | **200** — a lista de usuários |

Repare que **nenhum usuário traz o campo `password`** na resposta. Nem o hash.

**4. A parte interessante — o mesmo endpoint com um usuário comum**

Refaça o passo 2 trocando o email por `user@example.com`, salve esse token, e
repita o passo 3 com ele.

| | |
|---|---|
| **Esperado** | **403** — `{"message":"Acesso negado: permissão 'users:list' necessária"}` |

Pare um segundo aqui: o token é perfeitamente **válido** — a API sabe quem é a
pessoa. O que falta é **permissão**. É exatamente essa a diferença entre 401 e
403, e é o coração do [RBAC](#o-modelo-de-permissões-rbac).

**5. Criar um usuário novo**

| | |
|---|---|
| Método e URL | `POST {{baseUrl}}/users` |
| Auth | nenhuma — o cadastro é público |
| Body (JSON) | `{"name":"Fulano","email":"fulano@example.com","password":"senhaforte123"}` |
| **Esperado** | **201** — o usuário criado, com a role `User` e **sem** o campo `password` |

Vale testar os erros também: repita o mesmo request (**409**, email duplicado) e
tente com `"password":"123"` (**400**, senha curta demais).

#### Guardando o token automaticamente

Copiar e colar o token a cada login cansa rápido — e ele expira em 1 hora. Os
dois clientes sabem preencher a variável sozinhos.

**No Postman**, no request de login, aba *Scripts* → *Post-response*:

```js
pm.environment.set("token", pm.response.json().token);
```

**No Bruno**, no request de login, aba *Script* → *Post Response*:

```js
bru.setEnvVar("token", res.body.token);
```

A partir daí, todo request que usar `{{token}}` pega o valor mais recente:
basta refazer o login quando expirar.

#### Confirmando que a senha virou hash

Isso não é um request — é uma olhada direta no banco:

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
<summary><b>Cannot find module '../generated/prisma/client'</b></summary>

O client do Prisma não foi gerado. Ele **não vem no repositório** de propósito:
é código gerado a partir do `prisma/schema.prisma`, e versionar código gerado
só causa conflito.

Normalmente o `npm install` já o gera sozinho (pelo script `postinstall`). Se
essa mensagem apareceu, gere na mão:

```bash
npx prisma generate
```

Apesar do nome parecido, **isto não tem relação com o pacote
`@prisma/client`** das dependências. O que falta é o diretório
`src/generated/prisma`, não um pacote do npm — reinstalar as dependências não
resolve.
</details>

<details>
<summary><b>Connection url is empty</b> · <b>Variável de ambiente DATABASE_URL não definida</b></summary>

Falta o arquivo `.env`. Volte ao passo 2:

```bash
cp .env.example .env
```

A primeira mensagem vem dos comandos do Prisma (`db:migrate`, `db:seed`,
`db:studio`); a segunda, da aplicação ao iniciar. A causa é a mesma.
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

**RBAC** é a sigla de *Role-Based Access Control* — controle de acesso baseado
em cargos. É o desenho que responde à pergunta "essa pessoa pode fazer isso?"
sem espalhar regra de acesso pelo código inteiro.

#### O problema que ele resolve

A forma ingênua de controlar acesso é perguntar quem a pessoa é:

```ts
// NÃO é assim que este projeto faz
if (usuario.cargo === 'Admin') { ... }
```

Funciona no começo. O problema aparece depois, e sempre da mesma forma: essa
comparação se multiplica. Vira `if` em dez controllers diferentes. Aí o
professor pede um cargo novo — um "Bibliotecário Chefe", um "Mecânico Sênior" —
e você precisa achar os dez lugares e mudar todos para
`=== 'Admin' || === 'ChefeDeAlgumaCoisa'`. Esquecer um é criar um furo de
segurança silencioso, que ninguém percebe até alguém acessar o que não devia.

A causa do problema: o código está perguntando **quem a pessoa é**, quando o
que importa é **o que ela pode fazer**.

#### A ideia: separar cargo de poder

O RBAC introduz uma camada no meio. Pense em um prédio com chaves:

| Conceito | No prédio | No sistema |
|---|---|---|
| **Permission** | uma chave que abre **uma** porta | `livros:write` — uma ação concreta |
| **Role** | o molho de chaves de um cargo | `Bibliotecario` — um conjunto de permissões |
| **User** | a pessoa que recebe o molho | quem faz login |

A porta não pergunta o cargo de quem chegou. Ela pergunta **se a pessoa tem a
chave**. Quem decide quais chaves cada cargo carrega é outra pessoa, em outro
lugar — e mudar isso não exige trocar nenhuma fechadura.

Traduzindo para as tabelas do banco, são duas relações N:N:

```
User  ──N:N──▶  Role  ──N:N──▶  Permission

Eduardo         Admin           users:list, users:write, users:read
                User            users:read
```

**N:N nos dois lados** porque uma pessoa pode acumular cargos (o Eduardo é
`Admin` *e* `User`), e uma mesma permissão pode pertencer a vários cargos.

#### Como isso aparece no código

A rota declara a **permissão** que exige — nunca o cargo:

```ts
router.get('/', authenticate, requirePermission('users:list'), getAllUsers);
```

E o middleware, a cada requisição, percorre o caminho
`usuário → roles → permissões`, achata tudo numa lista de nomes e verifica se a
permissão pedida está lá. Está em [`src/middleware/auth.ts`](src/middleware/auth.ts).

#### Por que o rodeio compensa

Liberar a listagem de usuários para um "Moderador" novo, neste desenho, é
**uma linha** no mapa de permissões:

```ts
Moderador: ['users:list'],
```

Nenhuma rota muda. Nenhum controller muda. Nenhum `if` novo. E como cada rota
declara sua exigência ali mesmo, dá para **auditar o controle de acesso da API
inteira** lendo os arquivos de rota — sem caçar condicional escondida no meio
da regra de negócio.

O mapa de cargos e permissões vive em [`prisma/seed.ts`](prisma/seed.ts):

| Role | Permissões |
|---|---|
| `Admin` | `users:list`, `users:write`, `users:read` |
| `User` | `users:read` |

> `users:read` e `users:write` já estão modeladas mas ainda não são exigidas por
> nenhuma rota. São o ponto de partida para os exercícios da disciplina.

#### A convenção dos nomes

Os nomes seguem o padrão `recurso:ação` — `users:list`, `livros:write`,
`prontuarios:read`. Não é exigência do código, é convenção: mantém os nomes
previsíveis e agrupa visualmente as permissões de um mesmo recurso quando a
lista cresce. Vale seguir no seu domínio.

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
