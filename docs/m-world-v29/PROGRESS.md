# M V29 — vida autónoma, perguntas e analytics privado

## Estado
Branch: `feat/m-world-v29-autonomy-chat-analytics`. Ainda não há publicação do Worker D1 nem segredo criado nesta sessão. O serviço analytics permanece **desativado** no site enquanto `m-analytics-config.mjs` tiver o endpoint vazio. Não foram recolhidas visitas por este mecanismo.

## Alterações M
- Profundidade: por detrás, apenas a geometria real dos cards é usada para o recorte visual. Rectângulos de texto internos mantêm-se como restrições da navegação e como último recurso de leitura quando a M está à frente. Sem modificar o modelo V6.
- Micromovimento: respiração subtil, antecipação e recuperação após movimentos com limites explícitos. Gestos manuais e `prefers-reduced-motion` mantêm prioridade.
- Painel público: apenas perguntas sugeridas, mensagens e envio de pergunta. Os comandos de expressão/jogo deixaram de estar acessíveis aos visitantes. Diagnósticos técnicos existentes apenas quando `?m-debug=1`.
- Toda a vida e acções da M continuam geridas pelo agendador autónomo já existente; o chat pode originar uma reacção contextual a perguntas, mas os visitantes não escolhem movimentos.

## Analytics privados Cloudflare D1

Registam-se somente dados agregados: visualizações por dia, sessões estimadas por dia e visualizações por página. D1 guarda hashes de identificadores aleatórios por separador e por dia por até 35 dias (para deduplicação). Não são guardados IPs, User-Agents, referrers, nomes, emails ou mensagens de chat. O cliente respeita sinais Do Not Track e Global Privacy Control. Uma sessão por separador não equivale a uma pessoa única.

### Passos necessários no Cloudflare (ainda por fazer)

1. Instalar `wrangler` e autenticar na **conta Cloudflare proprietária**: `npx wrangler login`.
2. Em `analytics/`, criar D1: `npx wrangler d1 create m-portfolio-analytics --location weur`. Guardar o `database_id` apresentado.
3. Copiar `analytics/wrangler.toml.example` para `analytics/wrangler.toml`; substituir `REPLACE_WITH_UUID_FROM_WRANGLER_D1_CREATE` pelo ID real.
4. Executar dentro de `analytics/`: `npx wrangler d1 migrations apply m-portfolio-analytics --remote`.
5. Criar a chave privada de acesso de alta entropia usando o password manager e configurar no Worker: `npx wrangler secret put ADMIN_TOKEN`. Nunca colocar a chave no repo, site ou mensagem pública.
6. Publicar em `analytics/`: `npx wrangler deploy`. Copiar o URL final real de `workers.dev` (não inventar o subdomínio).
7. Editar `m-analytics-config.mjs` para usar exactamente `https://<worker-real>.workers.dev/api/visit`; fazer deploy do site GitHub Pages depois.
8. Verificar `https://<worker-real>.workers.dev/health` para o estado; abrir `https://<worker-real>.workers.dev/admin` para introduzir a chave em cada sessão e visualizar contagens.
9. Recomendado: proteger também `/admin*` por Cloudflare Access com identidade autorizada, manter WAF para reduzir spam e publicar nota de privacidade no portefólio antes da ativação.

**Atenção:** `ADMIN_TOKEN` deve ser configurado antes de expor o dashboard. O endpoint público `/api/visit` não necessita dessa chave, mas só admite a origem oficial por CORS. CORS não é proteção forte contra robôs que forjem pedidos; números são indicativos, não métricas auditadas. A chave do proprietário nunca aparece no JavaScript público.

### Diagnóstico após publicação
- Em Chrome, testar M com movimento, depth front/back, leitura do texto, idle, scroll e hover. Verificar Safari/iPhone.
- Com `?m-debug=1`, os diagnósticos tradicionais ficam acessíveis **só para QA**, não como interface pública.
- Conferir `/api/summary` sem chave: deve devolver 401. Com chave via dashboard deve apresentar séries diárias.
- Confirmar `fetch` `/api/visit` apenas se `m-analytics-config.mjs` estiver configurado e DNT/GPC não estiverem ativos.
- O Cloudflare Worker da OpenAI `m-portfolio-companion` não é alterado.

## Notas de compatibilidade
O código continua sem dependências npm novas no cliente, preserva os 31 ossos, as 19 partes do GLB, o sistema de profundidade e os limites de pedidos IA existentes. Nenhum novo acesso pago OpenAI.
