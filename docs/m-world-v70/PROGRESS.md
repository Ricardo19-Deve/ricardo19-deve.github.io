# M World V70 — desempenho e telemóvel

## Objetivo

Tornar a M mais leve no telemóvel e mais barata em todos os ecrãs **sem mudar o aspeto no desktop**.
Decisões do autor (19/11/2026): pode instalar-se o gltf-transform como ferramenta de desenvolvimento e
o telemóvel pode usar uma versão mais leve da M (menos triângulos, 4 influências por vértice).

## Implementado

- **Modelo para telemóvel** (`assets/m-v7-web/m-mobile.bin`, gerado por `tools/m-assets/build.mjs` a partir
  das partes originais V6, que continuam a ser a fonte verificada):
  corpo simplificado com meshoptimizer para 38 528 triângulos (35% dos 110 084; bordas e costuras UV fixas),
  as 4 influências mais fortes de cada vértice (renormalizadas), posições/normais/tangentes/UV quantizadas
  (`KHR_mesh_quantization`) e todos os buffers comprimidos com `EXT_meshopt_compression`.
  Mantém os 31 ossos, os 10 ossos da cauda, os morph targets (incluindo o corretivo dos ombros),
  os 6 clips, os materiais e as malhas dos olhos, pálpebras e pestanas.
- **Desktop inalterado:** continua a carregar as 19 partes originais com 14 influências. A compressão meshopt
  do modelo completo foi medida e não compensa: com o gzip que o GitHub Pages já aplica, transfere ~9,6 MB
  contra ~9,7 MB hoje.
- **Escolha da variante:** `modelVariant()` usa o mesmo limite do tamanho do canvas, `(max-width:720px)`.
  A regra "31 ossos e 14 influências" mantém-se no desktop; no telemóvel exige 31 ossos e no máximo 4.
- **Leitor GLB com meshopt:** `readGLB` descodifica as vistas comprimidas com o `MeshoptDecoder` do three.js
  antes de ler as influências originais, como antes, sem passar pela normalização do GLTFLoader.
- **Ritmo de frames** (`frameIntervalMs` em `m-world-quality.mjs`): no máximo 60 frames por segundo
  (ecrãs a 120 Hz fazem metade do trabalho), 30 enquanto a M dorme ou está parada num cartão (exceto durante
  o scroll, para continuar presa ao cartão) e 20 quando está totalmente fora do ecrã. Os intervalos ficam
  dentro do passo de 50 ms do controlador, por isso o relógio da M não abranda. Com movimento reduzido, os
  frames continuam a ser desenhados a pedido.
- **Densidade de píxeis:** no telemóvel no máximo 2× (1,5× com frames lentos sustentados), em vez de 2×;
  no desktop o mínimo com frames lentos passa de 1,75× para 1,5×, o máximo continua 2–2,5×.

## Medições (Chromium com GPU Intel Arc via ANGLE/D3D11, Playwright; telemóvel emulado 390×844 a 3×)

| | Antes (main) | Depois |
| --- | --- | --- |
| Modelo descarregado no telemóvel | 19 pedidos, 16,9 MB (≈9,9 MB com gzip) | 1 pedido, 7,0 MB (≈5,8 MB com gzip) |
| Triângulos desenhados no telemóvel | 155 022 | 83 466 |
| Influências por vértice no telemóvel | 14 (4 conjuntos) | 4 (1 conjunto) |
| Canvas no telemóvel | 416×416 px | 416 px (312 px só com frames lentos sustentados) |
| Frames da M por segundo a dormir | ~60 (desktop) / ~53 (telemóvel) | 30 / 30 |
| Desktop: modelo, influências, resolução | 16,9 MB, 14, 544×544 | igual |

Notas honestas: com a CPU do telemóvel emulada 4× mais lenta, o tempo de trabalho por frame da M variou entre
execuções (≈11–15 ms) porque é dominado pela lógica de comportamento, não pela geometria. A GPU desta máquina
é rápida, por isso a poupança de triângulos, influências e píxeis não aparece nos tempos medidos; deve notar-se
em telemóveis reais (aquecimento, bateria), mas **não foi verificado num telemóvel**.

## Verificação

- `node --test *.test.mjs scripts/*.test.mjs m-ai/*.test.mjs`: todos aprovados, incluindo
  `m-world-v70-performance.test.mjs` (modelo móvel, regra de influências por variante, limites de densidade,
  ritmo de frames e descodificação meshopt no leitor GLB).
- Os smoke tests de browser aceitam agora 4 influências apenas quando `modelVariant` é `mobile`.
- Capturas antes/depois em desktop (1440×900) e telemóvel emulado comparadas visualmente: sem diferenças no
  desktop; no telemóvel a M mantém olhos, pestanas, orelhas e cauda sem artefactos visíveis.

## Reconstruir o modelo do telemóvel

```bash
cd tools/m-assets && npm install && npm run build
```
Atualizar `M_MOBILE_MODEL.size` em `m-world-3d.mjs` se o tamanho mudar (o teste V70 confirma-o).
