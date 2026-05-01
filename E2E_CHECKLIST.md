# Checklist E2E — useAcolhe

Roteiro manual pra validar o sistema fim-a-fim. Faz 1 vez por PR grande ou
toda vez que mexer em auth/billing/org. Tempo: ~10min.

## Pré-requisitos

3 terminais rodando em paralelo:

```powershell
# Terminal 1 — API
cd apps/api && bun dev

# Terminal 2 — Web
cd apps/web && bun dev

# Terminal 3 — Stripe CLI (CRUCIAL para webhooks)
stripe listen --forward-to localhost:3333/api/auth/stripe/webhook
```

⚠️ Se o `STRIPE_WEBHOOK_SECRET` no `.env` não bate com o `whsec_…` que o
Stripe CLI imprime, atualiza o `.env` e reinicia o terminal 1.

## Cenário 1 — Solo (Free)

- [ ] **Cadastro:** http://localhost:5173/register → preenche → submete
- [ ] **E-mail de verificação:** chega no inbox? (Resend)
- [ ] **Confirmar e-mail:** clica no link → cai logado em `/`
- [ ] **Dashboard:** mostra "Plano: Free" e card de "Quer time?"
- [ ] **Sidebar:** mostra logo "useAcolhe" (NÃO mostra org switcher)
- [ ] **Settings:** só aparecem 3 abas — Perfil / Organização / Assinatura
- [ ] **Aba Organização:** consegue renomear "Meu consultório" → salvar OK
- [ ] **Aba Organização:** zona de perigo (excluir) NÃO aparece

## Cenário 2 — Upgrade Pro

- [ ] `/pricing` → card "Pro" tem badge **"Mais popular"** (preto)
- [ ] Clica "Assinar Pro" → redireciona pra Stripe Checkout
- [ ] Cartão `4242 4242 4242 4242`, validade `12/30`, CVC `123`, qualquer CEP
- [ ] Volta pra `/configuracoes/billing?success=1`
- [ ] **Banner azul** "Confirmando seu pagamento…" aparece
- [ ] Em ≤ 30s, banner some e aparece a tela de Pro com **status "Em trial"**
- [ ] **Forma de pagamento** mostra "Visa •••• 4242"
- [ ] **Histórico de faturas** mostra fatura inicial (R$ 0,00 do trial ou R$49,90)
- [ ] `/pricing` agora mostra "Pro" com badge **"Esse é meu plano"** (primário, ring)
- [ ] **Sidebar continua sem switcher** (Pro = solo)

## Cenário 3 — Upgrade Team

- [ ] `/pricing` → "Trocar de plano" no card Team
- [ ] Stripe Checkout (proration aplicada)
- [ ] Volta pra `/configuracoes/billing` → plano agora é "Team"
- [ ] **Sidebar:** logo "useAcolhe" vira **OrgSwitcher** com nome "Meu consultório" + "Team"
- [ ] **Settings:** abas novas aparecem — Membros / Cargos / Logs
- [ ] **Sidebar > nav Configurações** mostra os submenus correspondentes

## Cenário 4 — Convite + Membro

- [ ] Settings → Membros → "Convidar membro"
- [ ] E-mail (use outro endereço seu) + role "Membro"
- [ ] Confirma envio → toast OK
- [ ] **E-mail chega** (Resend) com link "Aceitar convite"
- [ ] Em janela anônima, abre link → tela "Você foi convidado"
- [ ] Cria conta nova → confirma e-mail → cai em `/accept-invitation/<id>`
- [ ] Aceita → entra na org como membro
- [ ] Volta pro owner → Settings → Membros: novo membro listado

## Cenário 5 — Cargos custom

- [ ] Owner → Settings → Cargos → "Novo cargo"
- [ ] Nome: "Secretaria"
- [ ] Marca: `paciente:read`, `agenda:create/read/update`, `financeiro:read`
- [ ] **Não marca** `prontuario` (LGPD)
- [ ] Salva → cargo aparece na lista
- [ ] Edita → mexe permissões → salva → diff persistido
- [ ] Excluir → confirma → some

## Cenário 6 — Audit log

- [ ] Owner → Settings → Logs
- [ ] Aparecem entries de tudo que rolou: `create organization`,
      `add member`, `create invitation`, `accept invitation`,
      `create paciente` (se você criou), etc.
- [ ] Filtro por **resource** (member) → só mostra membros
- [ ] Filtro por **action** (create) → só creates
- [ ] Click em "Ver detalhes" → expande JSON do metadata
- [ ] Membro logado tenta acessar `/configuracoes/logs` → vê tela de upsell

## Cenário 7 — Multi-org switching

- [ ] Owner em Team plan → OrgSwitcher → "Criar nova organização"
- [ ] Cria "Clínica Norte"
- [ ] Switcher mostra ambas → click pra alternar
- [ ] Settings → Organização muda nome conforme switcher
- [ ] Audit log filtra automaticamente por org ativa
- [ ] Tenta criar 6ª org → bloqueia (limite Team)

## Cenário 8 — Cancelamento

- [ ] Settings → Assinatura → "Cancelar assinatura"
- [ ] Toast OK → seção mostra "Cancelamento agendado para…"
- [ ] Botão "Reativar assinatura" → toast OK → volta ao normal

## Cenário 9 — Reset de senha

- [ ] Logout → `/forgot-password` → digita e-mail
- [ ] E-mail chega → click "Redefinir senha"
- [ ] Cai em `/reset-password?token=…` → preenche nova senha
- [ ] Loga com a nova senha

## Cenário 10 — Tentativas de bypass (segurança)

- [ ] Membro comum tenta `/configuracoes/cargos` direto pela URL → tela upsell
- [ ] Membro comum tenta `/configuracoes/logs` → tela upsell
- [ ] curl `localhost:3333/audit-logs` sem cookie → 401
- [ ] curl `localhost:3333/audit-logs` como membro não-owner → 403

---

## Testes automatizados disponíveis

```bash
cd apps/api
bun test                 # todos os testes
bun test src/modules     # só os módulos
```

Os tests live com cada módulo (`*.service.test.ts`, etc.) e são unitários
puros — services com repository mockado. Pra adicionar:

1. Cria `<modulo>.service.test.ts` ao lado do service
2. Mocka o repository via construtor
3. `bun:test` → `describe`, `it`, `expect`
