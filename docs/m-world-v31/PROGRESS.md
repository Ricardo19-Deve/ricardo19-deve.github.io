# M World V31 — vida própria, variedade e aprendizagem segura

## O problema identificado
O arranque da página usava os mesmos valores fixos em três motores independentes:
`MLifeV16({seed:18421})`, `MWorldBrain({seed:18421})` e `createAutonomy({seed:18425})`. Com a mesma página, davam quase sempre as mesmas escolhas e os mesmos gestos iniciais.

## Implementado
1. **Novo início por visita** — `makeLivingSeed()` obtém entropia local de `crypto.getRandomValues` e deriva três sementes diferentes. A M deixa de repetir o mesmo arranque sem precisar de enviar dados para a rede. Mantemos explicitamente sementes determinísticas para testes.
2. **Prólogo variado** — a primeira ação autónoma da sessão pode privilegiar exploração, brincadeira ou observação. É uma preferência suave, não um comando. A M continua a respeitar a leitura, os inputs, os limites de energia, `prefers-reduced-motion`, a estabilidade da cena e o plano de profundidade.
3. **Mais repertório emocional** — quando decide inspecionar, espreitar, pousar ou contornar um cartão, escolhe entre gestos existentes e apropriados (curious, nod, shy, wink, playful, surprised). Mantém todos os ossos, texturas, morph targets e animações V6; não inventa movimentos incompatíveis.
4. **Memória de experiências concluídas** — um módulo local novo, `m-world-growth.mjs`, guarda apenas categorias de decisões que chegaram mesmo ao fim, resultados, um histórico circular e contadores limitados. Preferências por famílias menos praticadas e desempenhos que resultaram criam variedade em sessões posteriores.
5. **Continuidade entre dias** — datas de calendário de Lisboa e um nível resumido acompanham a progressão neste navegador. Nunca são atribuídas vitórias a intenções pendentes, falhadas ou canceladas.
6. **Controlo e privacidade** — a preferência existente *Remember M* controla esta nova memória. Desligá-la apaga o histórico V31; *Reset memory* também o limpa. Dados guardados apenas no `localStorage` do navegador, **nunca no Cloudflare D1**. Não são guardados nomes, IP, texto, prompts, URL, identidade de visitantes ou dados analíticos.
7. **Qualidade e cache** — todos os imports próprios da M e `m-world.css` usam `v=36`, preservando o código de analytics. Há testes para consentimento, aleatoriedade, decisões seguras e regressão de profundidade.

## Limites honestos
A V31 **não treina os pesos de um modelo de linguagem** nem partilha inteligência entre browsers ou pessoas. É uma memória de hábitos e experiências locais que influencia as próximas decisões. A IA OpenAI existente continua sujeita ao mesmo Worker e aos mesmos limites de pedidos; não foram acrescentadas chamadas à API ou alterações à D1.

A validação física em Chrome desktop e Safari/iPhone é obrigatória antes de dar os movimentos visuais como finais. Verificar que as animações e a profundidade continuam a funcionar e que o início varia após várias atualizações. O objetivo é vida autónoma com moderação, sem reduzir a legibilidade do portefólio.
