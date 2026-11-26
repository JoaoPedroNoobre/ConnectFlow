# ConnectFlow

Projeto acadêmico de atendimento com HTML, CSS, JavaScript, Node.js, Supabase e Gemini.

## Quatro telas

- **Dashboard** acompanha a lista e os estados dos atendimentos.
- **WhatsApp** recebe mensagens de texto, mostra o histórico e permite assumir, devolver à IA, resolver ou reabrir conversas.
- **Agente de IA** configura o assistente, permite editar o catálogo e oferece uma prévia.
- **Configurações** reúne os dados da empresa e as preferências do painel.

## Desenvolvimento local

Use Node.js 22 ou superior. Copie `.env.example` para `.env` e configure as chaves localmente. Execute `node --env-file=.env scripts/servidor.js` e abra [http://localhost:5173](http://localhost:5173). O modo padrão é `WHATSAPP_MODE=simulado`.

No simulador, crie um atendimento e use **Simular** para digitar como cliente. O Supabase e o Gemini podem ser reais, conforme as credenciais locais. A Meta fica fora do fluxo. Os testes executados com `npm test` usam respostas simuladas e não precisam de credenciais reais.

## Piloto real na Meta e no Render

1. **Supabase.** Revise e aplique, com autorização, a migração em `supabase/migrations/`. Ela preserva registros existentes e acrescenta canal, revisões, identificadores da Meta, confirmação de envio, configuração compartilhada e uma função transacional de entrada. A função fica restrita a `service_role`. Confira os privilégios já existentes de leitura e escrita e o acesso da Data API.
2. **Render.** Crie um Web Service Node com uma instância, comando de início `npm start`, porta fornecida em `PORT` e verificação `/health`. Defina `CONNECTFLOW_HOSTED=1`, `PANEL_ORIGIN` com a origem HTTPS exata e sem barra final, `PANEL_USER` e uma senha forte e exclusiva em `PANEL_PASSWORD`. Use o gerenciador de variáveis do Render para as chaves. Mantenha uma única instância, inclusive durante mudanças de versão: pare a instância antiga antes de iniciar outra em modo real. O servidor local continua em `127.0.0.1`.
3. **Meta.** Com aprovação, configure o app de teste da WhatsApp Cloud API, a versão da Graph API, o ID do número de teste, seu token de acesso e o App Secret. Configure o callback HTTPS `/webhooks/whatsapp` com o mesmo token de verificação do servidor e assine o campo `messages`. Valide primeiro com o número de teste da Meta.
4. **Painel.** Defina `WHATSAPP_MODE=real` e `CONNECTFLOW_EMPRESA_ID` para a empresa piloto existente. Use um número e um painel por instalação. Entre pelo navegador, salve os dados da empresa e do agente, e só então ative a IA. Configurações que comandam a IA real ficam no Supabase.

## Limites do piloto

- O piloto recebe e envia texto. Anexos, áudio e templates estão fora do fluxo. O envio respeita as regras da janela de atendimento da Meta.
- No modo real, somente conversas recebidas pela Cloud API enviam respostas para a Meta. Atendimentos manuais ou anteriores à migração continuam como conversas internas.
- O painel recebe notificações por SSE, reconecta e relê os dados. **Aceita pela Meta** significa que a API retornou um ID. **Entregue** ou **Lida** depende da confirmação posterior no webhook.
- Uma recusa ou falha de confirmação retorna erro ao formulário. Se houve tentativa registrada, ela aparece no histórico com o estado correspondente. Em caso de confirmação pendente ou incerta, confira o histórico antes de reenviar.
- A gravação da entrada e a deduplicação são transacionais no banco. A resposta do Gemini é processada no servidor após a entrada, em memória. Uma reinicialização nesse intervalo pode deixar uma conversa sem resposta automática. As tentativas de envio com confirmação incerta não são reenviadas automaticamente.
- Pausar ou assumir impede respostas que ainda não passaram pela última checagem. Um envio já submetido à Meta pode concluir enquanto a mudança aguarda a fila. A proteção da fila cobre uma única instância, com alterações de status e pausa feitas pelo painel. Escalar o serviço exige coordenação durável entre instâncias.
- Use um banco separado no simulador. O banco do piloto deve ficar ligado apenas à instância real durante o atendimento.
- A migração, o recebimento e o envio reais, o uso de um número e a hospedagem ficam **PENDENTES DE VALIDAÇÃO REAL**.

Referências: [WhatsApp Business Platform](https://developers.facebook.com/documentation/business-messaging/whatsapp/overview/), [Webhooks da Meta](https://developers.facebook.com/docs/graph-api/webhooks/getting-started/) e [Render Web Services](https://render.com/docs/web-services).
