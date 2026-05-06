import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Sparkles } from 'lucide-react';
import Input from '@/components/input';
import Modal from '@/components/modal';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { adminApi, type AdminUser } from '@/lib/admin-api';
import { cn } from '@/lib/utils';

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
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelect: (user: AdminUser) => void;
  initialSearch?: string;
  /** Quando true, usuários com customPlan já atribuído são desabilitados. */
  filterCustomPlan?: boolean;
}

export default function ModalBuscarUser({
  open,
  onOpenChange,
  onSelect,
  initialSearch = '',
  filterCustomPlan = false,
}: Props) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Debounce 250ms — evita disparar request a cada tecla
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  // Reset ao abrir — DialogContent já move o foco para o primeiro input visível,
  // que é exatamente o nosso campo de busca.
  useEffect(() => {
    if (open) {
      setSearch(initialSearch);
      setDebouncedSearch(initialSearch);
      setSelectedIndex(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users-search-modal', debouncedSearch],
    queryFn: () =>
      adminApi.listUsers({
        page: 1,
        limit: 25,
        search: debouncedSearch || undefined,
      }),
    enabled: open,
    placeholderData: (prev) => prev,
  });

  const users = data?.data ?? [];

  // Reset índice quando lista muda
  useEffect(() => {
    setSelectedIndex(0);
  }, [users.length, debouncedSearch]);

  // Mantém item selecionado visível
  useEffect(() => {
    itemRefs.current[selectedIndex]?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const handleSelect = useCallback(
    (user: AdminUser) => {
      if (filterCustomPlan && user.customPlan) return;
      onSelect(user);
      onOpenChange(false);
    },
    [onSelect, onOpenChange, filterCustomPlan],
  );

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, users.length - 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (users.length > 0) handleSelect(users[selectedIndex]);
      return;
    }
    if (e.key === 'Escape') {
      onOpenChange(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Buscar usuário"
      description="Use ↑↓ para navegar, Enter para selecionar."
      size="lg"
    >
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none z-10" />
          <Input
            title=""
            className={{
              classNameLabel: 'hidden',
              classNameInput: 'pl-9',
            }}
            register={{
              name: 'userSearchModal',
              onChange: async (e) =>
                setSearch((e.target as HTMLInputElement).value),
              onBlur: async () => {},
              ref: () => {},
            }}
            inputConfig={{
              value: search,
              placeholder: 'Nome ou e-mail...',
              onKeyDown: handleSearchKeyDown,
            }}
          />
        </div>

        <div className="flex flex-col max-h-72 overflow-y-auto rounded-lg border divide-y divide-border">
          {isLoading && users.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Carregando…
            </p>
          ) : users.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {debouncedSearch
                ? `Nenhum usuário com "${debouncedSearch}"`
                : 'Nenhum usuário encontrado.'}
            </p>
          ) : (
            users.map((user, index) => {
              const blocked = filterCustomPlan && !!user.customPlan;
              return (
                <button
                  key={user.id}
                  ref={(el) => {
                    itemRefs.current[index] = el;
                  }}
                  type="button"
                  disabled={blocked}
                  onClick={() => handleSelect(user)}
                  onMouseEnter={() => !blocked && setSelectedIndex(index)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 text-left transition-colors focus:outline-none',
                    !blocked && 'cursor-pointer',
                    !blocked && index === selectedIndex
                      ? 'bg-muted/50'
                      : !blocked && 'hover:bg-muted/40',
                    blocked && 'opacity-50 cursor-not-allowed',
                  )}
                >
                  <Avatar size="default">
                    <AvatarImage src={user.image ?? ''} alt={user.name} />
                    <AvatarFallback className="text-xs">
                      {initials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-sm font-medium leading-tight truncate">
                      {user.name}
                    </span>
                    <span className="text-xs text-muted-foreground truncate">
                      {user.email}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {user.banned && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-destructive/15 text-destructive tracking-wide">
                        BANIDO
                      </span>
                    )}
                    {user.role === 'super_admin' && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/15 text-primary tracking-wide">
                        SUPER
                      </span>
                    )}
                    {user.customPlan && (
                      <span
                        className={cn(
                          'text-[10px] font-medium px-1.5 py-0.5 rounded inline-flex items-center gap-1',
                          blocked
                            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                            : 'bg-muted text-muted-foreground',
                        )}
                      >
                        <Sparkles className="size-3" />
                        {user.customPlan.name}
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          {users.length > 0 && (
            <>
              {users.length} {users.length === 1 ? 'resultado' : 'resultados'}
              {data && data.total > users.length && ` de ${data.total}`}
            </>
          )}
        </p>
      </div>
    </Modal>
  );
}
