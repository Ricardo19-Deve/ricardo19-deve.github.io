# M World V71 — uma sesta natural

## Objetivo

O autor achou que a M não adormecia de forma natural (19/11/2026). Na V32 o palco inteiro tombava cerca de
76° para o lado como um bloco rígido, encolhia e "respirava" com uma escala de todo o corpo.

## Implementado

- **`m-world-sleep.mjs`** (novo): a sesta é uma função pura da idade, com 21 s em quatro fases:
  | Fase | Fração | O que se vê |
  | --- | --- | --- |
  | A adormecer | 0–20% | espreguiçar com o dorso arqueado, duas piscadelas pesadas (a primeira fecha ~70%) |
  | A aninhar-se | 20–34% | cabeça desce e inclina, coluna e joelhos dobram, patas recolhem sob o queixo, cauda desce e enrola-se em anel à volta do corpo, olhos fecham |
  | A dormir | 34–80% | respiração lenta no peito (~14 por minuto, a partir dos segundos reais), um suspiro mais fundo, uma orelha que estremece e a ponta da cauda que mexe |
  | A acordar | 80–100% | piscadela sonolenta, cabeça sobe, braços esticam-se, a cauda solta-se e tudo volta à pose acordada |
- Os perfis de curvatura da cauda foram afinados com capturas do rig original. A cauda sai sempre do
  mesmo lado do corpo, por isso o enrolar não é espelhado; o rolamento do corpo é.
- **`m-world-acting.mjs`**: o gesto `sleep` usa `sampleSleep`; `GESTURE_DURATIONS.sleep` passa de 12,4 s
  para 21 s e as fases do gesto seguem a mesma linha temporal.
- **`m-world-rest-pose.mjs`**: o palco só faz um rolamento suave (0,26 rad, era 1,33), um assentar
  ligeiro (escala 0,93, era 0,78) e uma subida quase invisível em cada respiração.
- **Modelo do telemóvel** (`assets/m-v7-web/m-mobile-v71.bin`): na V70 a quantização de POSITION
  acrescentava uma escala ao nó da malha, mas os morph targets ficavam por quantizar e eram reduzidos a
  quase nada. Resultado: no telemóvel as pálpebras não fechavam e as expressões não mexiam. Agora os
  alvos de POSITION são quantizados com POSITION (normais e tangentes dos alvos ficam em float; quantizá-las
  escurecia a cara). 7,39 MB (≈5,97 MB com gzip; V70: 7,01/5,8 MB). O ficheiro mudou de nome para os
  browsers não usarem a versão em cache.
- Revisão de cache `v=68`.

## Contratos alterados

- `m-world-v32-rest-rhythm.test.mjs`: os dois testes da inclinação de 76° foram substituídos pelos do
  novo palco (rolamento suave, sem escala de respiração).
- `m-world-acting.test.mjs`: a sesta pode durar até 24 s (os outros gestos continuam < 14 s); o teste das
  pálpebras segue a nova linha temporal (duas piscadelas pesadas, fechadas durante o sono, piscadela ao
  acordar).
- Mantidos: ombros < 0,25 rad, cancelamento sem saltos (≤ 0,035 rad por frame), cabeça ≥ 0,25 rad durante
  o sono, movimento reduzido sem sesta, 30 fps durante o sono (V70).

## Verificação

- `node --test *.test.mjs scripts/*.test.mjs m-ai/*.test.mjs`: 774/774. Novo
  `m-world-v71-sleep.test.mjs` (fases, curvatura, cauda não espelhada, pálpebras, ritmo da respiração,
  continuidade e declive zero nos limites, movimento reduzido, morph targets do modelo do telemóvel).
- Capturas Chromium (Playwright, ANGLE/D3D11) em desktop 1440×900 e telemóvel 390×844, ambos os lados:
  contact sheets `m-phase2-shots/final-{desktop,mobile}-sheet.png` (fora do repositório).
- Não verificado: telemóvel real, e a regra de escolha do sítio da sesta (não mudou; no telemóvel a
  cauda pode passar por trás de texto, que continua desenhado à frente pelas máscaras de oclusão).
