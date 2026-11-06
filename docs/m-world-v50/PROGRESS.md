# M World V50 — espontaneidade, expressões e brincadeiras

## Compromisso de privacidade LinkedIn (restrição expressa do proprietário)

**A M só está autorizada a consultar as publicações que o proprietário
partilha publicamente no LinkedIn. Mais nada da conta.**

Isto é um limite do **comportamento do nosso código**. O scope OAuth da
aplicação LinkedIn pode ser mais abrangente do que o que o código utiliza;
portanto, não se deve afirmar que a própria plataforma concede uma
permissão tecnicamente limitada a posts.

- **Único endpoint LinkedIn de produção:** `GET
  /rest/memberSnapshotData?q=criteria&domain=MEMBER_SHARE_INFO`.
- **Só campos necessários de publicações:** texto publicado/partilhado,
  data, visibilidade e permalink LinkedIn, validados no servidor.
- **Só posts públicos:** `PUBLIC` ou `EVERYONE`. Visibilidade restrita,
  desconhecida, conteúdo sem data/texto/link verificados: excluídos.
- **Nunca consultar:** mensagens, contactos, ligações, seguidores,
  visitas ao perfil, pesquisas, reações, comentários, dados de outras
  contas, histórico pessoal ou a Member Changelog API.
- **Sem novo agendamento:** não há sincronização de atividades da conta,
  apenas leitura de posts quando solicitados, com cache.
- **Sem exposição do segredo:** `LINKEDIN_DMA_ACCESS_TOKEN` permanece
  exclusivamente no Cloudflare Worker. Não vai para o browser nem para
  a API de respostas da IA; dados não públicos não entram no prompt.
- **Sem armazenamento persistente de snapshots:** ficam no máximo oito
  publicações verificadas em memória temporária para a resposta.
- O feed alternativo `data/m-public-activity.json` continua vazio até
  existir conteúdo público revisto. Nenhuma publicação é inventada.

Testes `m-ai/linkedin-posts-only.test.mjs` cobrem chamada única ao
domínio de publicações, seleção pública, não transmissão dos dados
extra do snapshot e isolamento do token e de dados privados.

## V50 — sete novos movimentos espontâneos

O novo `m-world-spontaneous-play.mjs` introduz **micro-performances
autónomas**, sem novos assets ou comandos para visitantes:

1. **Olhar duas vezes:** cabeça e orelhas viram-se num pequeno
   sobressalto de curiosidade
2. **Espreitar e esconder-se:** braços fazem uma pequena brincadeira,
   pálpebras fecham parcialmente e a M volta a espreitar
3. **Brincar com a própria cauda:** cabeça tenta acompanhar a curva,
   tórax reage e as dez articulações da cauda seguem com atraso
4. **Pequena dança:** dois tempos alternados de inclinação, braços,
   orelhas e cauda, com expressão alegre
5. **Espreguiçar-se:** cabeça inclina-se, braços abrem, corpo alonga-se,
   pálpebras relaxam
6. **Olhar para cima:** curiosidade no olhar e nas orelhas, com
   seguimento suave da cauda
7. **Abanar as orelhas:** pequena reação assimétrica com expressão
   curiosa e uma resposta secundária da cauda

As ações são selecionadas por um decisor **local, determinístico por
semente**, com intervalos irregulares e memória dos últimos dois
tipos, evitando repetições consecutivas. Não há acesso à Internet,
telemetria, mensagens, localização, memória de visitantes nem IA
extra para decidir estas brincadeiras.

### Segurança e fluidez

- Só acontecem em momentos de repouso real e baixa velocidade da
  personagem; não modificam as rotas nem coordenadas da página.
- **Nunca** substituem um gesto original, o descanso, a posição deitada,
  o contacto real com cartões, leitura, movimento reduzido ou
  um afeto principal ativo.
- Todos os movimentos usam o **rig original V6 de 31 ossos**, em
  adição aos movimentos atuais. Sem novos objetos/imagens.
- V41 suaviza os ossos e o palco quando começam/terminam;
  V28 suaviza as expressões do rosto e das pálpebras.
- `prefers-reduced-motion` impede esta camada.
- O modo de diagnóstico do renderer mostra a última mini-performance
  e contagens de ações concluídas/canceladas.
- `?v=50` em todas as importações principais e no CSS para
  invalidar a cache do browser corretamente.

### Verificações

```bash
node --test m-ai/*.test.mjs m-world*.test.mjs m-lab/interactions/*.test.mjs
```

Testes V50: sete variedades, ausência de ciclos consecutivos,
reprodutibilidade por seed, expressão de rosto e cauda, limites de
movimento, interrupções, redução de movimento, posição deitada,
descanso, contacto real, fase de rota e segurança de dados.

O CI de testes não substitui uma inspeção visual de WebGL em
navegador. Quando publicada a V50, observar a M durante alguns minutos,
especialmente nas mudanças de cena, para confirmar que as miniaturas
não provocam resets nem interferem com os cartões.

## Publicação

GitHub `main` -> GitHub Pages para o portfolio. A ligação Cloudflare
Workers Builds ao mesmo repositório publica separadamente
`m-portfolio-companion` quando forem alterados ficheiros de
`m-ai`. Não modificar os secrets nem a configuração do Worker.
