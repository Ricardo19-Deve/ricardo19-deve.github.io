# M World V40 — emoção expressa no corpo original

## Objetivo

A M já explora, repousa, pousa nos cartões e aprende experiências locais, mas
as emoções continuavam a aparecer sobretudo no rosto. A V40 acrescenta uma
camada física de comportamento emocional **suave e contínua** ao rig original
V6, sem transformar a personagem numa coleção de animações predefinidas.

## Implementado

- **Emoção com consequências físicas:** o motor observa apenas o `affect`
  existente e a energia atual da personagem. Curiosidade, hesitação,
  entusiasmo, satisfação, surpresa e cansaço recebem combinações discretas de
  inclinação da cabeça, peito, braços, orelhas e a cauda de dez ossos.
  `m-world-emotional-body.mjs` não escolhe objetivos nem cria emoções.
- **Transições graduais:** a resposta é filtrada com tempos de subida/descida
  diferentes para evitar mudanças instantâneas de pose. O regresso ao
  neutro acontece por decaimento, sem sequências rígidas repetidas.
- **Individualidade sem perfis de visitantes:** uma pequena assimetria vem
  de uma semente local e temporária. Nenhum nome, prompt, comportamento de
  visitante, geolocalização, histórico de chat ou perfil adicional é criado.
- **Energia coerente:** entusiasmo físico é contido quando a energia é baixa;
  as emoções de descanso recolhem a cabeça e os braços. Ao ler texto, os
  desvios emocionais tornam-se significativamente mais pequenos.
- **Regra de prioridade:** gestos intencionais, sono físico V32, contactos
  reais V38 e `prefers-reduced-motion` suspendem imediatamente a camada.
  A V39 mantém a autoridade das transições de movimento e o planificador
  mantém as coordenadas, profundidade e segurança dos cartões.
- **Modelo preservado:** um `createGestureLayer` adicional aplica ângulos
  pequenos aos ossos originais e desfaz o resultado antes de cada novo frame.
  Não são criados meshes, skins, LOD ou morph targets novos; a animação facial
  original continua a controlar as expressões.
- **Custos e UI:** sem chamadas OpenAI adicionais, sem alterações aos dois
  Workers ou D1. O Ask M continua apenas para perguntas sobre o portefólio;
  o painel ⚙ continua só com Memory e AI play.
- **Cache:** revisão `v45`.

## Validação recomendada

1. Observar a M à procura de um cartão. A curiosidade deve surgir na cabeça
   e nas orelhas, com reações suaves, não uma rotação robótica.
2. Comparar o comportamento de exploração e satisfação após uma aventura.
3. Verificar que a energia baixa torna a postura menos exuberante.
4. Confirmar sono físico, pouso, descolagem e os gestos existentes sem conflito.
5. Verificar a leitura de texto, `prefers-reduced-motion`, iPhone e desktop.
6. No diagnóstico, `MWorld.snapshot().renderer.emotionalBody` mostra
   `mood`, `intensity` e mudanças de estado, sem dados pessoais.

**Limite:** é uma simulação expressiva de emoções, não prova de consciência,
nem treino de um modelo de inteligência artificial. Testes automáticos não
substituem a avaliação estética num navegador real.
