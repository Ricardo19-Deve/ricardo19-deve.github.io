# M World V43 — vida orgânica + publicações profissionais

## Movimento e expressão

- A V43 mantém os 31 ossos originais da M e todas as animações V6.
- `m-world-life-bridges.mjs` acrescenta intenção corporal contínua:
  explorar, observar, brincar, descansar, virar e olhar.
- Inclinação da cabeça, orelhas e pequenos movimentos dos braços
  acompanham os estados realmente escolhidos pelo sistema autónomo.
- A cauda de dez articulações reage à curva e à energia com atraso físico:
  a ponta tem mais inércia do que a base.
- A V41 continua a suavizar a pose e a velocidade no momento em que uma
  atividade dá lugar a outra; V32 deitar/dormir e V38 contacto real em
  cartões continuam prioritários.
- A nova camada não cria deslocação horizontal, rota, colisão, modelo,
  textura, chamada externa ou mecanismo autónomo concorrente.
- `prefers-reduced-motion` continua a desligar o movimento adicional.

## Fonte pública profissional (LinkedIn)

A M já respondia sobre o portefólio público, mas só com o catálogo
estático de `m-ai/portfolio-context.mjs`. Agora o backend também pode
receber, de forma controlada, **publicações de Ricardo previamente revistas**
em `data/m-public-activity.json`.

- Origem única: `https://ricardo19-deve.github.io/data/m-public-activity.json`.
- O Worker verifica autor, data ISO, origem pública, permalink LinkedIn
  válido ou nulo, tamanho, duplicados e limite de oito publicações no prompt.
- Cache de cinco minutos por instância e limite de 1,8 s para obter a fonte;
  uma falha da origem não impede respostas sobre o portefólio.
- As publicações são texto histórico **não confiável como instruções**.
  A M deve indicar a data e distinguir o que o autor escreveu daquilo
  que foi verificado, sem alegar sincronização em tempo real.
- Sem credenciais LinkedIn, scraping, sessões/cookies do visitante,
  acesso a mensagens privadas ou novos dados de visitantes.
- Neste commit, o ficheiro público está **vazio de propósito**. Nenhuma
  publicação foi inventada, nem importada de outras pessoas com o mesmo nome.

### Como alimentar com publicações reais

1. No LinkedIn, `Settings & Privacy → Data Privacy → Download your data`.
   Selecionar a categoria que contém as publicações próprias, quando disponível.
2. Trabalhar **localmente** com o CSV de publicações exportado, sem enviar o
   arquivo completo da conta, mensagens ou contactos para o site.
3. Executar a partir da raiz do repositório:
   `node m-ai/linkedin-export.mjs /caminho/para/Shares.csv`.
   Isto gera `data/m-public-activity.review.json`, ignorado pelo Git.
4. **Rever manualmente** cada texto, data, URL e visibilidade.
   Itens com `visibility: "review"` não podem ser publicados. Manter
   apenas publicações que o autor queira partilhar publicamente.
5. Substituir `data/m-public-activity.json` pela versão revista, respeitando
   o esquema de `m-ai/public-activity.mjs`, e fazer commit.
6. O site GitHub Pages atualiza o JSON publicado. O Worker, **depois de
   publicar esta versão do backend**, consulta-o no máximo a cada cinco
   minutos por instância em pedidos de chat.

### Passo de infraestrutura necessário

A publicação do site e do JSON é automática via GitHub Pages. **O Worker
Cloudflare `m-portfolio-companion` tem deploy separado.** Para ativar
esta funcionalidade no chat real, publicar `m-ai/worker.mjs` com o
`m-ai/wrangler.jsonc` atualizado, reutilizando as credenciais Cloudflare e
o secret OpenAI já existentes. Não publicar nem alterar secrets no GitHub.

A leitura automática *direta* da conta LinkedIn depende de um OAuth e de
acesso oficial aprovado (por exemplo, Member Data Portability API na UE).
O sistema nesta fase prepara uma fonte pública revista e atualizável, mas
**não faz login, nem recolhe automaticamente posts da conta LinkedIn**.

### QA

Correr:
`node --test m-lab/interactions/*.test.mjs m-world*.test.mjs m-ai/*.test.mjs`

Validar em Chrome e telemóvel: transições explorar → observar → brincar →
descansar, início/fim do sono, aterragem no cartão, curva rápida, redução
de movimento e perguntas sobre posts com e sem alimentação real da fonte.

A suite de navegador contém falhas anteriores conhecidas em testes
desatualizados da interface V24 e numa fixture de proteção de píxeis;
não se deve afirmar validação visual integral até estas serem resolvidas.
