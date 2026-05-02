import Input from '@/components/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Building2,
  ChevronDown,
  CreditCard,
  HelpCircle,
  LifeBuoy,
  Lock,
  MessageSquare,
  Search,
  Stethoscope,
  Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

type Category = {
  id: string;
  title: string;
  description: string;
  icon: typeof Building2;
};

type Faq = {
  category: string;
  question: string;
  answer: string;
};

const CATEGORIES: Category[] = [
  {
    id: 'comecando',
    title: 'Começando',
    description: 'Primeiros passos no useAcolhe.',
    icon: HelpCircle,
  },
  {
    id: 'organizacao',
    title: 'Organização',
    description: 'Sua clínica, equipe e cargos.',
    icon: Building2,
  },
  {
    id: 'pacientes',
    title: 'Pacientes & atendimento',
    description: 'Sessões, prontuário e LGPD.',
    icon: Stethoscope,
  },
  {
    id: 'equipe',
    title: 'Equipe',
    description: 'Convites, cargos e auditoria.',
    icon: Users,
  },
  {
    id: 'cobranca',
    title: 'Cobrança',
    description: 'Planos, faturas, cancelamento.',
    icon: CreditCard,
  },
  {
    id: 'conta',
    title: 'Conta & segurança',
    description: 'Senha, e-mail, foto e privacidade.',
    icon: Lock,
  },
];

const FAQS: Faq[] = [
  // ─── Começando ───
  {
    category: 'comecando',
    question: 'Como começo a usar?',
    answer:
      'Após o cadastro e a confirmação do e-mail, você cai direto no Dashboard. Sua primeira organização ("Meu consultório") é criada automaticamente. Comece adicionando pacientes em **Pacientes** e configurando sua agenda.',
  },
  {
    category: 'comecando',
    question: 'O que é uma organização?',
    answer:
      'É o "espaço" onde ficam pacientes, agenda, equipe e cobrança. No plano Free e Pro você normalmente tem só uma — sua clínica. No plano Team dá pra ter até 5 (útil pra quem atende em múltiplos locais).',
  },
  {
    category: 'comecando',
    question: 'Preciso confirmar o e-mail pra usar?',
    answer:
      'Sim. Enviamos um link de confirmação no momento do cadastro. Sem confirmar, algumas ações ficam bloqueadas. Não recebeu? Verifique a caixa de spam ou peça reenvio na tela de login.',
  },

  // ─── Organização ───
  {
    category: 'organizacao',
    question: 'Posso mudar o nome da minha organização?',
    answer:
      'Sim, em **Configurações → Organização → [sua org] → Editar**. Troque nome e identificador. O identificador é a parte da URL (ex: `acme` em `acolhe.app/acme`).',
  },
  {
    category: 'organizacao',
    question: 'Como crio outra organização?',
    answer:
      'Disponível nos planos Pro (até 3) e Team (até 5). Use o seletor de organizações no canto superior da sidebar → "Criar nova organização". O Free permite só 1.',
  },
  {
    category: 'organizacao',
    question: 'Como excluo uma organização?',
    answer:
      'Apenas o owner em plano Team pode excluir. Em **Configurações → Organização → [a org] → Excluir**. A ação é irreversível e remove todos os dados, membros e convites.',
  },

  // ─── Pacientes & atendimento ───
  {
    category: 'pacientes',
    question: 'Quantos pacientes posso cadastrar?',
    answer:
      'Free: até 10 · Pro: até 200 · Team: até 1.000. Os limites contam pacientes ativos por organização. Inativar pacientes não conta no limite.',
  },
  {
    category: 'pacientes',
    question: 'Como funciona o prontuário em relação à LGPD?',
    answer:
      'Tratamos prontuário como dado sensível: somente quem tem permissão `prontuario:read` ou `update` consegue ver. No plano Team você cria cargos personalizados (ex: secretaria sem prontuário). Por padrão, o owner tem tudo e o membro padrão não tem nada.',
  },
  {
    category: 'pacientes',
    question: 'Posso exportar dados de pacientes?',
    answer:
      'Em breve. Por compliance LGPD, planejamos exportação completa em CSV/PDF. Enquanto isso, todos os dados ficam acessíveis na interface.',
  },

  // ─── Equipe ───
  {
    category: 'equipe',
    question: 'Quantos membros posso ter na equipe?',
    answer:
      'Free: 1 (só você) · Pro: 2 (você + 1 convidado) · Team: até 5. Convites pendentes contam no total — se o convite expirar ou for cancelado, a vaga libera.',
  },
  {
    category: 'equipe',
    question: 'Como convido alguém?',
    answer:
      '**Configurações → Membros → Convidar**. Digite o e-mail e escolha o cargo inicial. A pessoa recebe um link por e-mail (válido por 48h). Quando ela aceita, vira membro automaticamente.',
  },
  {
    category: 'equipe',
    question: 'O que são cargos personalizados?',
    answer:
      'Recurso do plano Team. Em **Configurações → Cargos** você cria roles como "Secretaria" ou "Psicólogo Júnior" com permissões específicas. Por exemplo: secretaria com acesso à agenda mas sem ver prontuário.',
  },
  {
    category: 'equipe',
    question: 'Posso ver quem fez o quê na minha organização?',
    answer:
      'Sim — é o **Logs de auditoria** (planos Pro e Team). Mostra todas as ações: criação/edição de pacientes, mudanças de cargo, convites, etc. Apenas o owner tem acesso.',
  },

  // ─── Cobrança ───
  {
    category: 'cobranca',
    question: 'Como funciona o trial?',
    answer:
      'Pro e Team têm 7 dias grátis. Você precisa cadastrar cartão para começar (sem cobrança nesses 7 dias). Cancela a qualquer momento dentro do período sem ser cobrado.',
  },
  {
    category: 'cobranca',
    question: 'Posso cancelar quando quiser?',
    answer:
      'Sim. Em **Cobrança → Cancelar assinatura**. Sua assinatura permanece ativa até o fim do período já pago. Pode reativar antes disso sem perder nada.',
  },
  {
    category: 'cobranca',
    question: 'Posso trocar de plano?',
    answer:
      'Sim. Em **Cobrança → Mudar de plano** (ou direto na página de Planos). A Stripe calcula a diferença proporcional automaticamente — você paga só o ajuste.',
  },
  {
    category: 'cobranca',
    question: 'Como atualizo meu cartão?',
    answer:
      'Em **Cobrança → Forma de pagamento → Gerenciar**. Abre o portal da Stripe com tudo seguro pra você atualizar dados de pagamento, ver faturas e baixar PDFs.',
  },
  {
    category: 'cobranca',
    question: 'O que acontece se o pagamento falhar?',
    answer:
      'Você recebe um e-mail e o status da assinatura vira "Em atraso". Atualize o cartão pelo portal. Se ficar em atraso por muitos dias, o acesso é restrito ao Free até regularizar.',
  },

  // ─── Conta & segurança ───
  {
    category: 'conta',
    question: 'Como mudo minha senha?',
    answer:
      '**Configurações → Perfil → Alterar senha**. Você precisa da senha atual + nova (mínimo 6 caracteres). Esqueceu? Use "Esqueci a senha" na tela de login.',
  },
  {
    category: 'conta',
    question: 'Posso adicionar foto de perfil?',
    answer:
      'Sim. Em **Configurações → Perfil**, clique no avatar. Aceitamos PNG, JPG, WEBP e GIF até 5 MB. A imagem é recortada para um quadrado.',
  },
  {
    category: 'conta',
    question: 'Como mudo meu e-mail?',
    answer:
      'Por enquanto o e-mail não é alterável diretamente. Mande um feedback (com tipo "Dúvida") explicando e te ajudo a migrar.',
  },
  {
    category: 'conta',
    question: 'Meus dados estão seguros?',
    answer:
      'Sim. Senhas com argon2id, sessões via cookies httpOnly + secure em produção, e dados sensíveis (prontuário) com controle de acesso por cargo. Pagamentos via Stripe (PCI-DSS).',
  },
];

function highlight(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const re = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(re);
  return parts.map((p, i) =>
    re.test(p) ? (
      <mark
        key={i}
        className="bg-primary/20 text-foreground px-0.5 rounded-sm"
      >
        {p}
      </mark>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}

/** Render mínimo de markdown inline: **bold** e `code`. */
function renderInline(text: string, query: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) {
      return (
        <strong key={i} className="text-foreground font-semibold">
          {highlight(p.slice(2, -2), query)}
        </strong>
      );
    }
    if (p.startsWith('`') && p.endsWith('`')) {
      return (
        <code
          key={i}
          className="font-mono text-[0.85em] bg-muted px-1 py-0.5 rounded"
        >
          {p.slice(1, -1)}
        </code>
      );
    }
    return <span key={i}>{highlight(p, query)}</span>;
  });
}

// ─── Página ─────────────────────────────────────────────────────────────────

export default function HelpPage() {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const q = search.trim().toLowerCase();

  const filteredFaqs = useMemo(() => {
    if (!q && !activeCategory) return FAQS;
    return FAQS.filter((f) => {
      if (activeCategory && f.category !== activeCategory) return false;
      if (q) {
        return (
          f.question.toLowerCase().includes(q) ||
          f.answer.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [q, activeCategory]);

  const grouped = useMemo(() => {
    const map = new Map<string, Faq[]>();
    for (const f of filteredFaqs) {
      const arr = map.get(f.category) ?? [];
      arr.push(f);
      map.set(f.category, arr);
    }
    return CATEGORIES.filter((c) => map.has(c.id)).map((c) => ({
      category: c,
      items: map.get(c.id) ?? [],
    }));
  }, [filteredFaqs]);

  // Contagem por categoria (sempre baseada em todos os FAQs, não nos filtrados)
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const f of FAQS) {
      map.set(f.category, (map.get(f.category) ?? 0) + 1);
    }
    return map;
  }, []);

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full">
      {/* ── Hero ────────────────────────────────────────────── */}
      <section className="rounded-xl border bg-linear-to-br from-primary/8 via-card to-card p-6 sm:p-8 relative overflow-hidden">
        <div className="absolute -top-12 -right-12 size-48 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="relative flex items-start gap-4 flex-wrap">
          <div className="size-12 rounded-2xl bg-primary/15 flex items-center justify-center">
            <LifeBuoy className="size-6 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold tracking-tight">
              Como podemos ajudar?
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5 max-w-md">
              Respostas pras perguntas mais comuns sobre o useAcolhe. Não
              encontrou? Manda feedback que respondo direto.
            </p>
          </div>
        </div>

        {/* Busca */}
        <div className="relative mt-5 max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none z-10" />
          <Input
            title=""
            className={{
              classNameLabel: 'hidden',
              classNameInput: 'pl-9',
            }}
            register={{
              name: 'search',
              onChange: async (e) => {
                setSearch((e.target as HTMLInputElement).value);
              },
              onBlur: async () => {},
              ref: () => {},
            }}
            inputConfig={{
              value: search,
              placeholder: 'Buscar nas perguntas frequentes…',
            }}
          />
        </div>
      </section>

      {/* ── Categorias ─────────────────────────────────────── */}
      {!q && (
        <section className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <CategoryCard
            id={null}
            title="Tudo"
            description={`${FAQS.length} respostas`}
            icon={LifeBuoy}
            active={!activeCategory}
            onClick={() => setActiveCategory(null)}
          />
          {CATEGORIES.map((c) => (
            <CategoryCard
              key={c.id}
              id={c.id}
              title={c.title}
              description={`${counts.get(c.id) ?? 0} ${
                (counts.get(c.id) ?? 0) === 1 ? 'resposta' : 'respostas'
              }`}
              icon={c.icon}
              active={activeCategory === c.id}
              onClick={() =>
                setActiveCategory(activeCategory === c.id ? null : c.id)
              }
            />
          ))}
        </section>
      )}

      {/* ── FAQs ───────────────────────────────────────────── */}
      <section className="flex flex-col gap-6">
        {grouped.length === 0 && (
          <div className="rounded-xl border bg-card px-6 py-12 text-center">
            <div className="size-12 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
              <Search className="size-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">Nenhum resultado pra "{search}"</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
              Tente outra palavra ou{' '}
              <Link
                to="/feedback"
                className="text-primary hover:underline font-medium"
              >
                manda direto pra gente
              </Link>
              .
            </p>
          </div>
        )}

        {grouped.map(({ category, items }) => {
          const Icon = category.icon;
          return (
            <div
              key={category.id}
              className="rounded-xl border bg-card overflow-hidden"
            >
              <header className="px-6 py-4 border-b flex items-center gap-3">
                <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon className="size-4 text-primary" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold">{category.title}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {category.description}
                  </p>
                </div>
              </header>
              <ul className="divide-y divide-border">
                {items.map((f, idx) => (
                  <FaqItem
                    key={`${f.category}-${idx}`}
                    question={f.question}
                    answer={f.answer}
                    query={q}
                    defaultOpen={!!q}
                  />
                ))}
              </ul>
            </div>
          );
        })}
      </section>

      {/* ── CTA pra feedback ───────────────────────────────── */}
      <section className="rounded-xl border bg-linear-to-br from-primary/5 via-card to-card p-6 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-primary/15 flex items-center justify-center">
            <MessageSquare className="size-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium">Não achou o que procurava?</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Manda direto. Leio pessoalmente e respondo.
            </p>
          </div>
        </div>
        <Link to="/feedback">
          <Button className="gap-2">
            <MessageSquare className="size-4" /> Enviar feedback
          </Button>
        </Link>
      </section>
    </div>
  );
}

// ─── Subcomponentes ─────────────────────────────────────────────────────────

function CategoryCard({
  title,
  description,
  icon: Icon,
  active,
  onClick,
}: {
  id: string | null;
  title: string;
  description: string;
  icon: typeof Building2;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'text-left rounded-xl border bg-card p-4 transition-all cursor-pointer',
        'hover:border-primary/40 hover:shadow-sm',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        active && 'border-primary/50 bg-primary/5 ring-1 ring-primary/20',
      )}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <Icon
          className={cn(
            'size-4',
            active ? 'text-primary' : 'text-muted-foreground',
          )}
        />
      </div>
      <div className="text-sm font-semibold">{title}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
    </button>
  );
}

function FaqItem({
  question,
  answer,
  query,
  defaultOpen,
}: {
  question: string;
  answer: string;
  query: string;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-6 py-4 flex items-center justify-between gap-3 text-left hover:bg-muted/30 transition-colors cursor-pointer"
        aria-expanded={open}
      >
        <span className="text-sm font-medium pr-3">
          {highlight(question, query)}
        </span>
        <ChevronDown
          className={cn(
            'size-4 text-muted-foreground shrink-0 transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>
      {open && (
        <div className="px-6 pb-5 -mt-1 text-sm text-muted-foreground leading-relaxed">
          {renderInline(answer, query)}
        </div>
      )}
    </li>
  );
}
