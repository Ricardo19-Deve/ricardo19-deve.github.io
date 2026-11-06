# M V51 — naturalidade, variedade e atenção ao mundo

## Evolução implementada

A V51 evolui a **mesma personagem original**, mantendo intacto o GLB V6,
os 31 ossos, o sistema de rotas, as máscaras de profundidade, o descanso
deitada, as interações reais com cartões, os gestos prioritários e o
motor de IA existente.

### Onze pequenas performances

As sete da V50 (olhar duas vezes, espreitar, brincar com a cauda,
dançar, espreguiçar-se, olhar para cima e abanar as orelhas) recebem:

- **Abraço a si própria:** recolhe os braços, sorri suavemente e relaxa
  a cauda.
- **Pequena vénia:** inclina a cabeça e o peito e recupera naturalmente.
- **Observação curiosa:** examina o espaço de um lado ao outro com
  cabeça, orelhas e cauda coordenadas.
- **Celebração discreta:** alterna os braços, inclina-se de forma leve e
  abana a cauda num ritmo curto.

### O que realmente mudou na sensação de vida

- Cada execução pode mudar de **lado**, ter uma **intensidade ligeiramente
  diferente** e durar um pouco mais ou menos, mesmo mantendo a ação.
- O olhar não é inventado: a camada recebe a **atenção do mundo da página**
  já calculada pelo sistema de navegação.
- A direção do corpo e a ponta da cauda acompanham as mudanças do olhar
  e da rotação real, com filtros temporais que impedem estalidos.
- A sequência de brincadeiras evita repetições consecutivas e respeita
  a energia da personagem: ações mais intensas só quando apropriadas.
- Continua sem botões manuais para a M, sem sons, sem novos objetos,
  sem telemetria, sem dados do visitante e sem novos pedidos de IA.
- As onze ações seguem a mesma camada de suavização V41 de ossos e
  posição, e o mesmo sistema V28 de continuidade das expressões.

### Proteções preservadas

O módulo não inicia brincadeiras enquanto a M estiver a dormir,
num gesto principal, em contacto com um cartão, a ler, a atravessar
o ecrã ou quando a preferência de movimento reduzido estiver ativa.
Nunca altera a coordenada X, profundidade, colisão ou planeamento de
rotas. Ângulos dos braços e orelhas ficam limitados à capacidade
expressiva segura do modelo original.

### LinkedIn: restrição permanente

**A M consulta apenas publicações que o proprietário partilha
publicamente.** A integração continua exclusivamente limitada no
código à consulta `MEMBER_SHARE_INFO` e à seleção de posts
`PUBLIC`/`EVERYONE` com data, texto e permalink validados.

Não consultar mensagens, contactos, seguidores, visitas ao perfil,
reações, comentários, páginas de atividade ou outras áreas da conta.
Não acrescentar a Member Changelog API sem autorização explícita.
O OAuth do LinkedIn pode ter um âmbito tecnicamente mais amplo;
essa distinção não altera a restrição de utilização do nosso projeto.

### Verificação

- `node --test m-world*.test.mjs m-ai/*.test.mjs m-lab/interactions/*.test.mjs`
- Testes novos em `m-world-v51-natural-play.test.mjs`: 11 sequências,
  não repetição, sementes, variação corporal, resposta real ao olhar,
  transições filtradas, limitação articular e segurança da navegação.
- `index.html` e importações da M atualizados para `?v=51` para
  impedir que um browser mostre a versão anterior em cache.
- Browser visual: observar transições em atividade, durante movimento
  lento, junto a cartões e nas passagens para o repouso. Os testes
  históricos de Chrome ainda possuem verificações desatualizadas,
  como a procura de um botão de chat já removido.

## Publicação

Depois da integração na `main`, GitHub Pages publica o portefólio.
O Worker `m-portfolio-companion` tem pipeline Cloudflare separado;
nenhum segredo, endpoint, permissão ou lógica LinkedIn foi alterado
nesta V51.
