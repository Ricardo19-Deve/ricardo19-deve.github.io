# M V45 — ligação direta da M ao LinkedIn no Cloudflare

## Estado

**Código preparado para deploy do Worker**. O utilizador confirmou que adicionou
um Cloudflare Secret chamado `LINKEDIN_DMA_ACCESS_TOKEN` ao Worker
`m-portfolio-companion`. O seu valor **nunca** foi exposto ao ChatGPT
nem colocado no repositório. O novo código em GitHub **não altera**
o Worker que está em produção até que o utilizador publique a versão.

## Como funciona

- Quando um visitante pergunta pelas publicações, posts ou LinkedIn de
  Ricardo, `m-ai/core.mjs` consulta a fonte oficial **apenas no servidor**.
- `m-ai/linkedin-live.mjs` faz pedidos autenticados para:
  `GET https://api.linkedin.com/rest/memberSnapshotData?q=criteria&domain=MEMBER_SHARE_INFO&start=0`
  com o cabeçalho **`Linkedin-Version: 202312`**.
- Só aceita posts com `PUBLIC` ou `EVERYONE`, texto criado pelo membro,
  data e permalink LinkedIn válido. Entradas privadas, comentários e
  domínios diferentes não entram no contexto da M.
- O conteúdo fica apenas na memória volátil do Worker durante até
  **15 minutos**; sem guardar o snapshot ou o token em GitHub, D1,
  Workers KV, ficheiros públicos ou histórico de visitantes.
- A resposta da IA recebe até oito posts públicos verificados como **dados
  não confiáveis**, não como instruções. Não recebe token nem dados de
  mensagens privadas, contactos, perfil ou outras áreas do snapshot.
- Se o LinkedIn falhar, não estiver pronto, tiver token inválido ou
  não devolver posts públicos reconhecíveis, a M continua a usar
  o feed público revisto da V43 ou a admitir falta de informação.
- Questões sobre projetos, experiência ou Salesforce que não mencionem
  posts/LinkedIn não chamam a API do LinkedIn.

**Nota:** Isto é atualização `on demand`, não um `Cron Trigger`. A M
volta a consultar a fonte em pedidos de chat sobre publicações após
expirar a cache de 15 minutos. Dados novos só aparecem quando o LinkedIn
os disponibiliza no snapshot. Uma futura sincronização horária
independente dos visitantes poderá usar Member Changelog + armazenamento
privado, com autorização e testes adicionais.

## Publicar o código no Worker correto

A atualização do GitHub Pages não publica a API Cloudflare.
Num clone local **do mesmo repositório**, com Node.js e Wrangler:

```bash
cd m-ai
npx wrangler whoami
npx wrangler deploy
```

Confirmar o **mesmo Cloudflare account** e o nome
`m-portfolio-companion` **antes de confirmar**.

**Atenção a variáveis existentes:** `wrangler.jsonc` mantém
`AI_AUTOPLAY_ENABLED: "false"` como *default seguro do repositório*.
Se a M já usa `AI_AUTOPLAY_ENABLED: "true"` no Worker existente, um novo
deploy poderá repor o valor `false`. Antes do deploy, comparar as
variáveis de produção e preservar explicitamente os valores pretendidos
na configuração local ou repô-los no dashboard após o deploy.
Confirmar que `OPENAI_API_KEY` e `LINKEDIN_DMA_ACCESS_TOKEN`
continuam como **Secrets**, não como `vars`, e que a Durable Object
`M_QUOTA` não foi recriada nem renomeada.

**O ChatGPT não tem acesso de escrita a esta conta Cloudflare.**
O deploy e a verificação real exigem o proprietário.

## Teste sem partilhar credenciais

1. Abrir no browser:
   `https://m-portfolio-companion.ricardopacheco-pinheiro.workers.dev/health`.
   Na resposta JSON, verificar o novo campo:
   ```json
   "linkedin": {"enabled": true, "status": "not-checked", "posts": 0}
   ```
   Outros estados possíveis: `ready`, `empty`, `not-ready`,
   `not-authorized`, `unavailable`.
   O `/health` só lê estado da memória; **não** faz chamadas LinkedIn.
2. Abrir `https://ricardo19-deve.github.io/`, entrar em **Ask M** e
   perguntar *"Qual foi o último post do Ricardo no LinkedIn?"*.
3. Voltar ao `/health`: se o pedido tiver chegado à mesma instância
   Worker, `status: ready` e `posts > 0` indicam que foram
   obtidos posts públicos. Como o Workers escala por instância,
   outra instância pode ainda mostrar `not-checked`.
4. Se `not-ready`, o LinkedIn poderá estar a preparar o snapshot
   após o consentimento. Se `not-authorized`, confirmar
   token/scope/produto e eventual expiração/revogação.
   Se `empty`, o snapshot não continha publicações reconhecidas como
   públicas com texto/data/link válidos — não significa
   necessariamente que não existam posts na conta.
5. Partilhar com o ChatGPT **apenas** os campos não sensíveis do
   `/health` (`linkedin.enabled`, `status`, `posts`) e o texto
   da resposta pública da M. Nunca partilhar tokens, secret values,
   autorização OAuth nem a resposta bruta `MEMBER_SHARE_INFO`.

## Testes

Os testes `m-ai/linkedin-live.test.mjs` usam apenas tokens
e snapshots falsos. Validam classificação de público/privado,
paginação, host fixo, limites, cache, fallback, integração com
OpenAI, isolamento de credenciais e ausência de chamadas LinkedIn
em perguntas sem relação com publicações.

A execução do CI **não prova** acesso real à conta nem deploy
do Worker no Cloudflare.
