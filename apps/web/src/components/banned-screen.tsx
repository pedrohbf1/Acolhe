import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { LogOut, ShieldAlert } from 'lucide-react';

/**
 * Tela full-screen que substitui toda a UI quando o usuário foi banido.
 *
 * Decisão de UX:
 *   - Banimento NÃO revoga sessão imediatamente. O usuário banido segue
 *     "logado" só pra ver esta tela com motivo e observação. Após logout
 *     (manual ou expiração), não consegue voltar (sign-in bloqueado).
 *   - Foco em transparência: motivo + observação visíveis. Data do banimento
 *     e expiração (se houver) também.
 */
export function BannedScreen() {
  const { user, logout } = useAuth();

  if (!user) return null;

  const reason = user.banReason ?? 'Motivo não informado';
  const observation = user.banObservation;
  const bannedAt = user.bannedAt ? new Date(user.bannedAt) : null;
  const expiresAt = user.banExpires ? new Date(user.banExpires) : null;
  const isPermanent = !expiresAt;

  return (
    <div className="fixed inset-0 z-[100] bg-background flex items-center justify-center p-4 sm:p-8 overflow-y-auto">
      <div className="w-full max-w-xl">
        <div className="rounded-2xl border-2 border-destructive/40 bg-card overflow-hidden shadow-2xl">
          {/* Header avermelhado */}
          <div className="bg-destructive/10 px-6 sm:px-8 py-6 border-b border-destructive/20">
            <div className="flex items-center gap-3">
              <div className="size-12 rounded-2xl bg-destructive/20 flex items-center justify-center">
                <ShieldAlert className="size-6 text-destructive" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-destructive">
                  Sua conta foi suspensa
                </h1>
                <p className="text-sm text-destructive/80 mt-0.5">
                  O acesso ao useAcolhe foi temporariamente bloqueado.
                </p>
              </div>
            </div>
          </div>

          {/* Conteúdo */}
          <div className="px-6 sm:px-8 py-6 flex flex-col gap-5">
            {/* Motivo */}
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                Motivo
              </div>
              <div className="text-sm font-medium bg-muted/40 rounded-lg p-3 border">
                {reason}
              </div>
            </div>

            {/* Observação */}
            {observation && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                  Observação
                </div>
                <div className="text-sm leading-relaxed bg-muted/40 rounded-lg p-3 border whitespace-pre-wrap">
                  {observation}
                </div>
              </div>
            )}

            {/* Datas */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              {bannedAt && (
                <div>
                  <div className="text-muted-foreground uppercase tracking-wide font-semibold">
                    Suspensa em
                  </div>
                  <div className="text-sm font-medium mt-0.5">
                    {format(bannedAt, "d 'de' MMM, yyyy", { locale: ptBR })}
                  </div>
                </div>
              )}
              <div>
                <div className="text-muted-foreground uppercase tracking-wide font-semibold">
                  {isPermanent ? 'Tipo' : 'Expira em'}
                </div>
                <div className="text-sm font-medium mt-0.5">
                  {isPermanent
                    ? 'Permanente'
                    : format(expiresAt!, "d 'de' MMM, yyyy", { locale: ptBR })}
                </div>
              </div>
            </div>

            {/* Contato */}
            <div className="rounded-lg bg-muted/40 border p-3 text-xs text-muted-foreground leading-relaxed">
              Acredita que isso foi um engano? Entre em contato pelo e-mail
              cadastrado da sua conta:{' '}
              <strong className="text-foreground">{user.email}</strong>. Vamos
              revisar manualmente.
            </div>

            {/* Logout */}
            <Button
              variant="outline"
              className="gap-2 w-full"
              onClick={() => logout()}
            >
              <LogOut className="size-4" />
              Sair da conta
            </Button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground/70 text-center mt-4">
          useAcolhe · Suporte
        </p>
      </div>
    </div>
  );
}
