import { useRef, useState } from 'react';
import { Search } from 'lucide-react';
import Input from '@/components/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AdminUser } from '@/lib/admin-api';
import ModalBuscarUser from './modal-buscar-user';

function initials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

interface Props {
  value: AdminUser | null;
  onChange: (user: AdminUser) => void;
  onClear?: () => void;
  /** When true, users with a custom plan can't be picked. Default: false. */
  filterCustomPlan?: boolean;
  /** Optional label above the input. */
  label?: string;
  required?: boolean;
  error?: string;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * Input de seleção de usuário que abre um modal completo de busca.
 *
 * Atalhos com foco no input:
 *   - F1 → abre modal vazio
 *   - Backspace / Delete → limpa seleção
 *   - Qualquer caractere → abre modal já com a busca pré-preenchida
 */
export default function InputUser({
  value,
  onChange,
  onClear,
  filterCustomPlan = false,
  label = 'Usuário',
  required,
  error,
  placeholder = 'Pressione F1 ou digite para buscar',
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const [initialSearch, setInitialSearch] = useState('');
  const focusReturnRef = useRef<HTMLButtonElement>(null);

  const openModal = (search = '') => {
    if (disabled) return;
    setInitialSearch(search);
    setOpen(true);
  };

  // Captura F1, Backspace e qualquer caractere imprimível pra abrir o modal
  // já com a busca pré-preenchida — mesmo padrão do <input-pessoa> da
  // mineracaoCorrenteza.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (disabled) return;
    if ((e.key === 'Backspace' || e.key === 'Delete') && value) {
      e.preventDefault();
      onClear?.();
      return;
    }
    if (e.key === 'F1') {
      e.preventDefault();
      openModal();
      return;
    }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      openModal(e.key);
    }
  };

  return (
    <>
      {value ? (
        // ── Usuário selecionado: card-display com botão "Trocar" ──────────
        <div className="w-full flex flex-col gap-1">
          {label && (
            <label className="gap-1 flex text-muted-foreground w-fit text-sm">
              {required && <span className="text-primary">*</span>}
              {label}
            </label>
          )}
          <div className="flex items-center gap-2">
            <button
              ref={focusReturnRef}
              type="button"
              onClick={() => openModal()}
              onKeyDown={handleKeyDown}
              disabled={disabled}
              className={cn(
                'flex flex-1 items-center gap-2.5 rounded-lg border border-border bg-background px-2.5 py-2 pr-14 text-left transition-colors hover:bg-muted/40 focus:outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary relative',
                disabled && 'opacity-60 cursor-not-allowed',
              )}
            >
              <Avatar size="sm">
                <AvatarImage src={value.image ?? ''} alt={value.name} />
                <AvatarFallback className="text-[10px]">
                  {initials(value.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{value.name}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {value.email}
                </div>
              </div>
              <kbd className="hidden sm:inline-flex absolute right-3 top-1/2 -translate-y-1/2 shrink-0 items-center px-1.5 py-0.5 text-[10px] font-mono border rounded text-muted-foreground border-border bg-muted pointer-events-none">
                F1
              </kbd>
            </button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              tabIndex={-1}
              onClick={() => openModal()}
              disabled={disabled}
              aria-label="Buscar outro usuário"
            >
              <Search className="size-4" />
            </Button>
          </div>
          {error && <span className="text-destructive text-xs">{error}</span>}
        </div>
      ) : (
        // ── Sem seleção: usa <Input/> readonly com hint do F1 ─────────────
        <div className="w-full flex items-end gap-2">
          <div className="flex-1 relative">
            <Input
              title={label ?? ''}
              required={required}
              error={error}
              className={{
                classNameInput: 'pr-14 cursor-pointer',
                classNameLabel: label ? '' : 'hidden',
              }}
              register={{
                name: 'inputUser',
                onChange: async () => {},
                onBlur: async () => {},
                ref: () => {},
              }}
              inputConfig={{
                value: '',
                placeholder,
                readOnly: true,
                disabled,
                onClick: () => openModal(),
                onKeyDown: handleKeyDown,
              }}
            />
            <kbd className="hidden sm:inline-flex absolute right-3 top-[calc(50%+10px)] -translate-y-1/2 shrink-0 items-center px-1.5 py-0.5 text-[10px] font-mono border rounded text-muted-foreground border-border bg-muted pointer-events-none">
              F1
            </kbd>
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            tabIndex={-1}
            onClick={() => openModal()}
            disabled={disabled}
            aria-label="Buscar usuário"
          >
            <Search className="size-4" />
          </Button>
        </div>
      )}

      <ModalBuscarUser
        open={open}
        onOpenChange={setOpen}
        initialSearch={initialSearch}
        filterCustomPlan={filterCustomPlan}
        onSelect={(u) => {
          onChange(u);
          setOpen(false);
          setTimeout(() => focusReturnRef.current?.focus(), 50);
        }}
      />
    </>
  );
}
