# M World V41 — transições sem micro-reset (original V6)

## Problema observado

A M parecia voltar por um instante ao estado inicial ao passar de uma ação para outra, apesar de cada animação ser suave isoladamente.

A inspeção encontrou duas descontinuidades no renderer: (1) a postura global `performanceStagePoseV15` muda imediatamente quando muda o modo ou a expressão, mesmo que o rig base já use molas; (2) as camadas V35/V38/V39/V40 devolvem poses vazias instantaneamente quando um gesto assume prioridade, provocando a perda imediata dos seus offsets.

## Alteração V41

- `m-world-pose-handoff.mjs`: mola criticamente amortecida analítica com **posição e velocidade preservadas** a cada transição. Os objetivos são funções do comportamento existente, sem agendador novo.
- Handoff independente e reversível para: *living performance*, *surface contact*, *motion continuity* e *emotional body*. Quando uma camada cessa, os offsets anteriores decaem fisicamente, sem `reset` visual.
- Suavização do resultado final do **stage** em rotação, posição e escala: expressão, modo, micromovimento, emoção, sono e pouso deixam de gerar um salto entre frames.
- Desativar o movimento reduzido limpa imediatamente os filtros; `prefers-reduced-motion` continua prioritário.
- Nenhum modelo, osso, textura, morph, rota, plano de colisões, UI, Worker, D1 ou chamada a OpenAI adicional.
- Revisão cache `v46`, para evitar observar uma versão antiga após o deploy.

## Como validar visualmente

1. Observar a M passar de **feliz** para **curiosa**: a cabeça, o tronco e o palco não devem saltar.
2. Observar a sequência **explorar → pousar num cartão → reagir → levantar voo**: cauda e membros devem continuar o percurso sem pose neutra intermédia.
3. Verificar **aproximar → gesto → retomar exploração**, incluindo uma mudança de intenção a meio.
4. Observar o ciclo **deitar → dormir → acordar → explorar**, sem interrupções visuais.
5. Repetir em desktop, telemóvel, 30–120 Hz e com redução de movimento ativa.
6. Se `?m-debug=1`, consultar `MWorld.snapshot().renderer.handoff` para estado dos filtros. Os contadores não contêm dados pessoais.

## Limitação de validação

Os testes automáticos verificam continuidade matemática e integração de fonte, mas não substituem uma inspeção visual em browser real, especialmente durante interação com cartões que estejam a mudar de layout.
