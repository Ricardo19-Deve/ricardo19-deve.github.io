# M World V42 — variedade orgânica sem loops de gestos

## Objetivo

A M deve escolher o que fazer de forma autónoma, mas sem parecer que reproduz
sempre as mesmas sequências. A variedade que já existia para o início de uma
visita tinha um limite: a paleta de gestos era selecionada apenas quando o
`opening` estava ativo ou existiam pesos de aprendizagem persistidos.

## Implementado

- **Paleta autónoma ao longo de toda a visita:** inspecionar, espreitar,
  orbitar e pousar continuam a escolher apenas gestos originais do rig V6,
  mas não dependem do primeiro gesto da sessão para variar.
- **Memória breve do corpo:** `recentGestures` recorda no máximo oito
  gestos de cenas efetivamente **concluídas**. A M evita repetir exatamente
  o gesto concluído mais recente e reduz o peso dos gestos recorrentes.
- **Sem aprendizagem falsa:** escolher ou aceitar uma ação não conta como
  experiência. Falhas e cancelamentos não são registados como gestos realizados.
- **Direção emocional coerente:** as variantes selecionadas preservam o
  mapeamento de gestos para expressões reais, sem mudar a decisão autónoma
  nem a temporização das animações.
- **Compatibilidade:** a política continua determinística por semente, 
  mantém perfis de teste sem hábitos intactos, e conserva segurança, 
  autorizações de movimento reduzido, planos de cartão e a V41.
- **Sem perfis de visitantes:** não há novos cookies, persistent storage, 
  leituras de mensagens, rede, telemetria pessoal ou chamadas AI. A memória 
  curta fica no decisor da visita e pode ser limpa.
- **Cache:** revisão `v47` para o código público atualizado.

## Validação

Testes V42 cobrem visitas extensas, ausência de repetição consecutiva,
reprodutibilidade por semente, variação entre visitas, limites de memória e
ausência de aprendizagem a partir de intenções não executadas.

### Verificação visual recomendada

1. Visitar a página e deixar a M explorar várias zonas de projetos sem interagir.
2. Confirmar que as cenas sucessivas não repetem sempre o mesmo gesto final.
3. Verificar que a mudança para cada novo gesto continua suave com a V41.
4. Repetir com a memória desligada e o AI play desligado: a vida local deve continuar.
5. Verificar `prefers-reduced-motion`, telemóvel, descanso, pouso e leitura.

**Limite:** estas escolhas são simulação comportamental autónoma de curto prazo,
não consciência nem aprendizagem automática de modelos na Internet.
