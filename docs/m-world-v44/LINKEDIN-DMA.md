# M V44 — integração oficial LinkedIn (DMA Member), fase de preparação

A documentação enviada pelo proprietário foi confirmada a **6 de novembro de 2026**:

- [Member API (guia principal)](https://learn.microsoft.com/en-us/linkedin/dma/member-data-portability/member-data-portability-member/?view=li-dma-data-portability-2026-08)
- [Snapshot API](https://learn.microsoft.com/en-us/linkedin/dma/member-data-portability/shared/member-snapshot-api?view=li-dma-data-portability-2026-08)
- [Snapshot domains](https://learn.microsoft.com/en-us/linkedin/dma/member-data-portability/shared/snapshot-domain?view=li-dma-data-portability-2026-08)
- [Changelog API](https://learn.microsoft.com/en-us/linkedin/dma/member-data-portability/shared/member-changelog-api?view=li-dma-data-portability-2026-08)

## Objetivo

Manter atualizada a M com as **publicações públicas do próprio Ricardo**,
sem scraping e sem acesso a mensagens, contactos, pesquisas, credenciais,
convites ou informação privada. O sistema de perguntas da M continua a
usar o feed validado criado na V43.

## Passos do proprietário, sem partilhar secrets

1. Abrir [LinkedIn Developers](https://www.linkedin.com/developers/apps/).
2. Criar uma aplicação e escolher **Member Data Portability (Member) Default
   Company**, a página especial disponibilizada pelo LinkedIn. Não criar
   outra Company Page, nem usar a página do empregador.
3. No separador **Products**, pedir **Member Data Portability API (Member)**
   e aceitar os termos. A documentação oficial indica que essa ação
   aprovisiona o produto para esta modalidade de titular.
4. Em **OAuth Token Tools** criar um token para essa aplicação com scope
   **`r_dma_portability_self_serve`**, concluindo login e consentimento.
   O consentimento está disponível apenas para membros situados no EEE
   e na Suíça.
5. **Não colar o token ou Client Secret em chats, issues, capturas, GitHub,
   ficheiros públicos, browser JS ou no feed.** O importador lê o token
   apenas de uma variável de ambiente privada.

## O que o código já faz

`m-ai/linkedin-dma-member.mjs` usa estritamente:

```text
GET https://api.linkedin.com/rest/memberSnapshotData?q=criteria&domain=MEMBER_SHARE_INFO&start=0
Authorization: Bearer <secreto disponível apenas em runtime>
Linkedin-Version: 202312
```

**Atenção:** a documentação de 2026 informa que a Snapshot API só aceita
`Linkedin-Version: 202312`; não usar `202608` ou `202611`.

- Percorre apenas páginas de `MEMBER_SHARE_INFO` e valida cada URL de
  continuação (sem redirecionamentos para outros hosts/domínios).
- Lê apenas `Date`, `ShareCommentary`, `ShareLink` e `Visibility`
  (e variantes exportadas conhecidas).
- Permite apenas `PUBLIC`/`EVERYONE` **com texto, data e permalink
  LinkedIn válido**. Exclui dados privados e visibilidade desconhecida.
- Deduplica, limita tamanho e seleciona até 48 posts para um **ficheiro
  local de revisão**, não para publicação automática.
- Trata um `404 No data found` na primeira página como
  `not-ready`: o LinkedIn pode ainda estar a construir o snapshot
  após o consentimento. Não substitui o feed público por uma lista vazia.
- Bloqueia o consumo ilimitado de páginas, respostas demasiado grandes,
  outros domínios, redirecionamentos e URLs falsas.
- Preserva `data/m-public-activity.json` e o atual Worker intactos.

Com a aplicação autorizada, executar **no ambiente local do proprietário**,
com a variável `LINKEDIN_DMA_ACCESS_TOKEN` configurada como segredo:

```bash
node m-ai/linkedin-dma-member.mjs
```

O resultado, `data/m-public-activity.review.json`, é ignorado pelo Git.
O proprietário revê textos, URLs, datas e visibilidade antes de copiar o
conteúdo aprovado para `data/m-public-activity.json`.

## Fase seguinte — sincronização automática real, ainda não ativa

Desenho recomendado, depois do primeiro token válido:

1. **Snapshot inicial**: importar `MEMBER_SHARE_INFO` e limitar os factos
   que a M conhece a posts realmente públicos.
2. **Cloudflare Worker com Cron Trigger** (por exemplo 1 vez/hora):
   consultar `GET /rest/memberChangeLogs?q=memberAndApplication`,
   guardando o último `processedAt` em armazenamento privado.
   A documentação recomenda `count=10` e cerca de uma consulta por hora.
   `startTime` é inclusivo: deduplicar usando IDs de eventos e não
   avançar o cursor se uma página/processamento falhar. Os eventos ficam
   disponíveis apenas durante 28 dias.
3. **Reconciliação periódica com Snapshot** para confirmar novos posts,
   edições, remoções e estados públicos, em vez de assumir que todos os
   eventos são publicações e não atividades privadas. Não armazenar nem
   transmitir `processedActivity` completo com conteúdo pessoal.
4. **Base privada de posts públicos** (Cloudflare KV/D1/R2 a decidir);
   o backend Ask M consulta apenas uma projeção sanitizada, com datas,
   texto limitado e URL verificadas. Nenhuma credencial para frontend.
5. **Renovação de autorização**: o token pode expirar ou ser revogado.
   Não presumir disponibilidade de refresh programático para o produto
   self-serve sem confirmar os scopes e a resposta OAuth reais.
   Parar e alertar o proprietário se houver erro 401/403.

Esta arquitetura está **desenhada, não implementada nem ativada**.
Requer consentimento LinkedIn, criação/revisão de recursos Cloudflare,
configuração de secrets, testes reais e deploy separado do Worker.
Uma atualização do código GitHub Pages por si só **não** atualiza o
Worker `m-portfolio-companion` no Cloudflare.

## Regressão e revisão de segurança

```bash
node --test m-ai/*.test.mjs m-world*.test.mjs
```

Os testes V44 usam **respostas simuladas**. Não realizámos chamadas
reais ao LinkedIn e não temos acesso ao token do titular.
