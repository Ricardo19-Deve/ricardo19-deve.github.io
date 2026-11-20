# M World V72 — cauda aconchegada, viagens fluidas e momentos de pausa

## Objetivo

O autor pediu (19/11/2026) uma sesta com a cauda encostada ao corpo em vez de um arco, menos movimento
"robótico" e mais animações de corpo inteiro quando a M está parada.

## Implementado

- **Cauda na sesta** (`m-world-sleep.mjs`): `SLEEP_TAIL_WRAP` substitui os perfis da V71. A raiz desce ao
  lado do corpo e o resto da cauda dobra-se por baixo da M e enrola-se junto às patas, sem o arco aberto.
  Afinado com capturas do rig original para os dois lados.
- **Sombra cinzenta por baixo dos olhos**: aparece também com a cabeça direita e os olhos fechados fora da
  sesta. É o sombreado das pálpebras fechadas nas texturas originais (a pálpebra esquerda usa uma textura
  mais escura do que a direita). Ficou como está.
- **Viagens sem para-arranca** (`m-world-spatial.mjs`): `travelEase` deixa de abrandar até zero em cada
  ponto intermédio. Entre dois segmentos em movimento (aproximação, chegada, revelação, recuperação) a
  velocidade passa de um para o outro sem descontinuidade; só abranda onde a rota para mesmo (pausas e
  antecipação).
- **Momentos de pausa** (`m-world-idle-moments.mjs`, novo): cinco animações de corpo inteiro com pose
  aditiva no mesmo contrato dos gestos (±0,9 rad, ombros < 0,25 rad):
  | Momento | Duração | O que se vê |
  | --- | --- | --- |
  | `ear-scratch` | 3,4 s | coça a orelha, a pata de trás pedala ao mesmo ritmo, a cabeça inclina-se |
  | `face-wash` | 4,4 s | lava a cara com três passagens, a cabeça esfrega-se na pata, olhos fechados |
  | `look-around` | 4,8 s | olha devagar para um lado (piscadela na viragem, orelhas rodam), pausa, depois para o outro |
  | `tail-catch` | 4,6 s | repara na cauda, que vem para a frente por baixo dela, abraça-a e solta-a a abanar |
  | `shake-off` | 2,6 s | sacode-se como um cão molhado; cabeça, orelhas e cauda seguem com atraso |
  Todos os canais começam e acabam em zero com declive zero; orelhas e cauda vêm com atraso de fase.
- **Agendador**: o primeiro momento chega após 12–20 s de calma, depois 22–40 s entre momentos, o mesmo
  momento nunca volta antes de 75 s nem duas vezes seguidas. Bloqueado durante gestos, viagens ou rotas
  ativas, leitura, sesta e limites físicos do desempenho. Num cartão só `face-wash` e `look-around`; com
  pouca energia (< 0,45) também. Se algo interromper, o momento continua a mexer e desvanece em 0,4 s.
  Movimento reduzido: desligado.
- **Integração** (`m-world-3d.mjs`, `scroll-buddy.js`): o momento junta-se à pose do gesto na camada de
  gestos, entra nas amostras de enquadramento e usa as piscadelas e o rosto. Enquanto dura, o
  controlador não começa uma rota nova. O diagnóstico mostra `renderer.idleMoment` (com `blockedBy`) e a
  página de depuração tem `MWorld.playIdle(nome)`.
- Revisão de cache `v=69`.

## Contratos alterados

- A cauda da sesta já não é igual nos dois lados: só a componente lateral (Y) é espelhada com o lado
  para onde a M se inclina (`m-world-v71-sleep.test.mjs` atualizado).
- A camada de gestos aplica `gestureLayer.apply(lastIdle.active?mergePoses(...):lastVisualGesture.pose)`
  (`m-world-3d.test.mjs` e `m-world-v35-embodied-intent.test.mjs` atualizados).
- `sampleCardAction` usa `travelEase`: a velocidade nas junções entre segmentos em movimento deixa de
  ser zero.
- `avatar.update` recebe `routeActive`; `MWorld.playGesture` respeita `side` quando é ±1.

## Verificação

- `node --test *.test.mjs scripts/*.test.mjs m-ai/*.test.mjs`: 786/786 (774 + 12 novos em
  `m-world-v72-motion.test.mjs`: declive zero nos limites, sem saltos a 30 fps, limites do rig, movimento
  reduzido, primeiro atraso, intervalo, sem repetição, filtros de cartão e energia, desvanecer ao
  interromper, continuidade de `travelEase`, cauda da sesta).
- Capturas Chromium (Playwright, ANGLE/D3D11) em desktop 1440×900 e telemóvel 390×844 (dpr 2, isMobile),
  fora do repositório em `m-phase3-shots/`: `idle-*/{desktop,mobile}-sheet.png`,
  `sleep-v72/{desktop,mobile}-sheet.png`, `route-{perch,orbit}/{desktop,mobile}-sheet.png`,
  `tail-v72-side*`.
- Não verificado: telemóvel real. Os braços do rig são curtos, por isso nos momentos com as patas
  (`ear-scratch`, `face-wash`) o que se lê é sobretudo cabeça, olhos, orelhas e cauda (tal como no `wave`).
