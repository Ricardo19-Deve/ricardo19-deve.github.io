# M Companion — GitHub → Cloudflare auto deploy (V45)

## O que já existia

A raiz do repositório tem um `wrangler.toml` para **outro Worker**:
`ricardo19-deve-github-io`, a API de analytics.

**Não modificar nem reutilizar a configuração da raiz para publicar a M.**
A M usa `m-ai/wrangler.jsonc`, com nome
`m-portfolio-companion`, mesmo account ID do Worker atualmente aberto
no dashboard e Durable Object `M_QUOTA`.

## Preparado no repositório

- `m-ai/wrangler.jsonc` mantém `name=m-portfolio-companion`,
  `M_QUOTA` e `keep_vars: true`.
- Foi removido o valor predefinido `AI_AUTOPLAY_ENABLED: false` do
  ficheiro para não sobrescrever acidentalmente a configuração de
  produção que foi ativada no Cloudflare. Preservar a configuração
  que estiver no dashboard.
- `.github/workflows/m-companion-cloudflare-deploy.yml` testa o backend
  em qualquer push relevante à `main` e publica via
  `wrangler deploy --keep-vars` **apenas se** existir o GitHub Actions
  Secret `CLOUDFLARE_API_TOKEN`. Caso contrário, avisa no resumo
  da execução e **não tenta um deploy**.
- O workflow usa `m-ai` como raiz do Wrangler, verifica `/health` e
  falha se a nova implementação não conseguir encontrar o token LinkedIn
  na configuração de produção.
- Os secrets do Worker no Cloudflare (`OPENAI_API_KEY`,
  `LINKEDIN_DMA_ACCESS_TOKEN`) **não precisam nem devem ser copiados**
  para o GitHub. Segundo a documentação oficial, Wrangler preserva
  secrets existentes ao fazer deploy.

## Opção recomendada: Cloudflare Workers Builds (sem segredo GitHub)

O GitHub não consegue, por si só, ligar um novo Worker à conta Cloudflare.
A associação do `m-portfolio-companion` tem de ser feita **uma vez** em:

1. Cloudflare Dashboard → Workers & Pages → `m-portfolio-companion`.
2. **Settings → Builds → Connect**.
3. GitHub: `Ricardo19-Deve/ricardo19-deve.github.io`.
4. Branch de produção: `main`.
5. **Root directory: `m-ai`** (não a raiz do repositório).
6. Deploy command: `npx wrangler deploy --keep-vars`.
7. Build command: pode ficar vazio (Worker JavaScript com módulos ES
   nativos, sem etapa de compilação personalizada).
8. Guardar a integração. O Cloudflare pode propor publicar
   imediatamente; confirmar nome e configurações primeiro.

Depois, cada commit relevante em `main` poderá acionar o build do
**Worker correto**, sem tocar no de analytics. É preciso confirmar no
Cloudflare que a opção de build automático está realmente ativa e que
o primeiro deploy terminou com sucesso. Reexecutar o build do último
commit ou publicar uma alteração se o Cloudflare não processar o commit
anterior à ligação.

Referência:
https://developers.cloudflare.com/workers/ci-cd/builds/

## Alternativa: deploy via GitHub Actions

Se preferir que o GitHub execute Wrangler:

1. Criar um Cloudflare API Token com permissões mínimas para publicar
   Workers no account do `m-portfolio-companion` e aceder à
   configuração existente de Durable Objects.
2. Em GitHub → Repository → Settings → Secrets and variables → Actions
   → New repository secret, criar **`CLOUDFLARE_API_TOKEN`**.
3. Não colocar o valor do token em ficheiros, commits, issues ou chats.
   O account ID já está identificado no `m-ai/wrangler.jsonc`.
4. GitHub → Actions → **M Companion — Cloudflare production deploy**:
   executar manualmente `Run workflow` se ainda não houver um push
   desde a criação do secret.
5. Confirmar no resumo da execução e em Cloudflare → Deployments
   que a origem é Wrangler, `/health` inclui
   `linkedin.enabled: true` e que a M responde a uma pergunta
   sobre o último post.

Não configurar os dois métodos ao mesmo tempo sem definir um único
processo de publicação para evitar deploys duplicados ou conflitos.

## Segurança / limites

- Um token do LinkedIn guardado no **Cloudflare Worker** não autentica
  um deploy GitHub. São permissões e locais distintos.
- GitHub Pages e Worker de analytics têm pipelines diferentes do
  Worker de respostas da M.
- A integração live da V45 consulta publicações públicas **quando
  perguntada**, com cache de até 15 minutos, não cria uma tarefa horária.
- A API LinkedIn pode responder `not-ready`, `not-authorized`,
  `empty` ou `unavailable`. Nunca inventar posts.
- Se o Worker não mostrar a secção `linkedin` no `/health`,
  continua a correr uma versão anterior da API.
