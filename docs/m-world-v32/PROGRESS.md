# M World V32 — descanso incorporado e ritmo do mundo

## Objetivo
Substituir o antigo "dormir = fechar os olhos enquanto flutua" por uma ação física com início, repouso e despertar. Reforçar a ligação ao ambiente real sem recolher dados pessoais nem criar custos de IA.

## Implementação

- **Deitar-se realmente:** novo `m-world-rest-pose.mjs` faz a transformação do *stage* da M até aproximadamente 76° de inclinação lateral. A escala reduz temporariamente para respeitar a área do modelo V6, e o corpo desce visualmente durante o sono. A transição usa entradas e saídas suaves, respiração delicada e regresso à postura normal.
- **O rig original mantém-se:** `m-world-acting.mjs` combina a inclinação com poses existentes nos braços, pernas, pescoço, cabeça, orelhas, cauda e morphs de pálpebras. Não substituímos a M por uma imagem, mesh simplificado, outro GLB ou animação genérica. Mantém 31 ossos e skin de alta qualidade.
- **Procurar espaço para dormir:** quando a M decide dormir e a página não está a ser lida, é encaminhada para um ponto de preparação existente (`planGestureStage`) que evita o texto protegido. Se não há espaço, não executa um sono inseguro. Durante leitura só repousa no lugar se a área inteira do corpo estiver livre.
- **Ritmo diário real:** `m-world-world-rhythm.mjs` usa o relógio local do navegador para categorizar manhã, dia, noite e fim do dia, aplicando pequenos pesos à probabilidade de observar, explorar, brincar e descansar. Aos fins de semana há pequena variedade adicional. Isto afeta prioridades, não obriga a M a repetir uma rotina.
- **História + aprendizagem existentes:** o módulo de experiências locais V31 continua a registar apenas ações efetivamente concluídas. A V32 alimenta decisões com o ritmo temporal real, sem reescrever a memória ou inventar conquistas.
- **Privacidade e acessibilidade:** sem geolocalização, IPs, microfone, câmara, meteorologia de terceiros, perfis de visitantes nem novos pedidos à OpenAI. `prefers-reduced-motion` desliga a postura animada. Não se altera o Worker OpenAI, os limites de IA nem a D1 de analytics.

## Limites desta fase

"Aprender com o mundo" aqui significa reagir a sinais de contexto real e ao resultado da própria experiência no mesmo navegador. **Não** significa ainda pesquisar automaticamente notícias, prever o tempo, aceder à localização do utilizador, re-treinar um modelo de IA ou partilhar memórias entre visitantes. Para fontes externas teremos de acrescentar consentimento e validação de segurança, mantendo o contador de visitas isolado.

## QA

- Verificar física de deitar, manter posição durante várias respirações, acordar e levantar sem saltos nem recortes.
- Regressão da leitura protegida, cartões arredondados, 3D depth front/behind, mobile, Chrome, Safari e reduced motion.
- Comparar comportamentos ao longo do dia e à noite, sem afirmações deterministas sobre cada visita.
- Os testes automatizados não substituem visualização real do movimento 3D num navegador.

Código da V32: `m-world-rest-pose.mjs`, `m-world-world-rhythm.mjs`, `m-world-acting.mjs`, `m-world-3d.mjs`, `scroll-buddy.js`, `m-world-autonomy.mjs`.
