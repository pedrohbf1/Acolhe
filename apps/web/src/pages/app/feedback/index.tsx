import Input from '@/components/input';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useZodForm } from '@/hooks/useZodForm';
import { cn } from '@/lib/utils';
import {
  schemaFeedback,
  type FeedbackType,
  type SchemaFeedback,
} from '@/schemas/feedback';
import { useMutation } from '@tanstack/react-query';
import {
  Bug,
  CheckCircle2,
  HelpCircle,
  Heart,
  Lightbulb,
  Loader2,
  MessageSquare,
  Send,
} from 'lucide-react';
import { useState } from 'react';
import { Controller } from 'react-hook-form';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3333';

const TYPES: {
  value: FeedbackType;
  label: string;
  description: string;
  icon: typeof Bug;
}[] = [
  {
    value: 'bug',
    label: 'Bug',
    description: 'Algo não funciona como deveria.',
    icon: Bug,
  },
  {
    value: 'suggestion',
    label: 'Sugestão',
    description: 'Ideia pra melhorar o produto.',
    icon: Lightbulb,
  },
  {
    value: 'question',
    label: 'Dúvida',
    description: 'Não sabe como fazer algo.',
    icon: HelpCircle,
  },
  {
    value: 'praise',
    label: 'Elogio',
    description: 'Algo que você curtiu.',
    icon: Heart,
  },
];

export default function FeedbackPage() {
  const { user } = useAuth();
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    formProps,
    formState: { errors },
    control,
    reset,
  } = useZodForm(schemaFeedback, {
    defaultValues: { type: 'suggestion' as FeedbackType },
  });

  const submit = useMutation({
    mutationFn: async (d: SchemaFeedback) => {
      const res = await fetch(`${API_URL}/feedback`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(d),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? `Erro ${res.status}`);
      }
    },
    onSuccess: () => {
      reset({ type: 'suggestion', subject: '', message: '' });
      setSubmitted(true);
    },
  });

  if (submitted) return <SuccessState onNew={() => setSubmitted(false)} />;

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto w-full">
      {/* ── Hero ────────────────────────────────────────────── */}
      <section className="rounded-xl border bg-linear-to-br from-primary/8 via-card to-card p-6 sm:p-7 relative overflow-hidden">
        <div className="absolute -top-12 -right-12 size-48 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="relative flex items-start gap-4 flex-wrap">
          <div className="size-12 rounded-2xl bg-primary/15 flex items-center justify-center">
            <MessageSquare className="size-6 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold tracking-tight">
              Mande um feedback
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Achou um bug? Tem uma sugestão? Conta a gente — leio tudo
              pessoalmente.
            </p>
          </div>
        </div>
      </section>

      {/* ── Form ────────────────────────────────────────────── */}
      <section className="rounded-xl border bg-card p-6">
        <form
          {...formProps((d) => submit.mutate(d))}
          className="flex flex-col gap-5"
        >
          {/* Tipo — radio cards */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              O que é?
            </label>
            <Controller
              control={control}
              name="type"
              render={({ field }) => (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {TYPES.map((t) => {
                    const TypeIcon = t.icon;
                    const selected = field.value === t.value;
                    return (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => field.onChange(t.value)}
                        className={cn(
                          'text-left rounded-lg border p-3 transition-all cursor-pointer',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                          selected
                            ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                            : 'border-border bg-background hover:border-primary/40 hover:bg-muted/30',
                        )}
                      >
                        <TypeIcon
                          className={cn(
                            'size-4 mb-1.5',
                            selected ? 'text-primary' : 'text-muted-foreground',
                          )}
                        />
                        <div
                          className={cn(
                            'text-sm font-medium',
                            selected ? 'text-foreground' : 'text-foreground',
                          )}
                        >
                          {t.label}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5 leading-tight">
                          {t.description}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            />
            {errors.type && (
              <span className="text-xs text-destructive">
                {errors.type.message}
              </span>
            )}
          </div>

          {/* Assunto */}
          <Input
            title="Assunto"
            register={register('subject')}
            error={errors.subject?.message}
            inputConfig={{
              placeholder: 'Resuma em uma frase',
              maxLength: 120,
            }}
          />

          {/* Mensagem */}
          <Input
            title="Mensagem"
            type="textarea"
            register={register('message')}
            error={errors.message?.message}
            inputConfig={{
              placeholder:
                'Descreva com detalhes. Se for bug, conte os passos que levaram até ele.',
              rows: 6,
              maxLength: 4000,
            }}
          />

          {submit.isError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {submit.error instanceof Error
                ? submit.error.message
                : 'Erro ao enviar feedback.'}
            </div>
          )}

          <div className="flex items-center justify-between gap-3 flex-wrap pt-2 border-t">
            <p className="text-xs text-muted-foreground">
              Enviando como{' '}
              <strong className="text-foreground font-medium">
                {user?.name}
              </strong>{' '}
              · {user?.email}
            </p>
            <Button
              type="submit"
              className="gap-2"
              disabled={submit.isPending}
            >
              {submit.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              {submit.isPending ? 'Enviando…' : 'Enviar feedback'}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}

// ─── Success state ──────────────────────────────────────────────────────────

function SuccessState({ onNew }: { onNew: () => void }) {
  return (
    <div className="max-w-md mx-auto w-full">
      <section className="rounded-xl border bg-card p-8 text-center">
        <div className="size-14 mx-auto rounded-2xl bg-emerald-500/15 flex items-center justify-center mb-4">
          <CheckCircle2 className="size-6 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h2 className="text-lg font-semibold">Feedback enviado!</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
          Recebi sua mensagem e leio tudo. Se precisar de resposta, te chamo no
          e-mail cadastrado.
        </p>
        <Button className="mt-5" onClick={onNew}>
          Mandar outro feedback
        </Button>
      </section>
    </div>
  );
}
