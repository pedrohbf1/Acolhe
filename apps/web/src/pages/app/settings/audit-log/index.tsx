import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import { RESOURCE_LABELS } from "@/lib/permissions";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  Lock,
  Scroll,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

interface AuditLogItem {
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId: string;
  metadata: unknown;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  } | null;
}

interface AuditLogResponse {
  items: AuditLogItem[];
  total: number;
  page: number;
  limit: number;
}

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3333";

const ACTION_BADGES: Record<string, { label: string; className: string }> = {
  create: {
    label: "criar",
    className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  },
  update: {
    label: "editar",
    className: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  },
  delete: {
    label: "excluir",
    className: "bg-red-500/10 text-red-700 dark:text-red-400",
  },
  add: {
    label: "adicionar",
    className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  },
  remove: {
    label: "remover",
    className: "bg-red-500/10 text-red-700 dark:text-red-400",
  },
  accept: {
    label: "aceitar",
    className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  },
  reject: {
    label: "recusar",
    className: "bg-red-500/10 text-red-700 dark:text-red-400",
  },
  cancel: {
    label: "cancelar",
    className: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
  auto_create: {
    label: "auto-criar",
    className: "bg-muted text-muted-foreground",
  },
  update_role: {
    label: "alterar cargo",
    className: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  },
};

const RESOURCE_OPTIONS = [
  { value: "", label: "Todos os recursos" },
  ...Object.entries(RESOURCE_LABELS).map(([value, label]) => ({
    value,
    label,
  })),
];

const ACTION_OPTIONS = [
  { value: "", label: "Todas as ações" },
  ...Object.entries(ACTION_BADGES).map(([value, { label }]) => ({
    value,
    label,
  })),
];

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function AuditLogSettingsPage() {
  const features = usePlanFeatures();
  const [page, setPage] = useState(1);
  const [resource, setResource] = useState("");
  const [action, setAction] = useState("");
  const limit = 25;

  const { data, isLoading, error } = useQuery<AuditLogResponse>({
    queryKey: ["audit-logs", page, resource, action],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        ...(resource ? { resource } : {}),
        ...(action ? { action } : {}),
      });
      const res = await fetch(`${API_URL}/audit-logs?${params}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      return res.json();
    },
    enabled: features.canViewAuditLogs,
  });

  if (!features.canViewAuditLogs) {
    return (
      <section className="rounded-xl border bg-card p-8 text-center">
        <div className="size-14 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
          <Lock className="size-6 text-primary" />
        </div>
        <h2 className="text-lg font-semibold">
          Logs de auditoria estão no plano Team
        </h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
          Veja tudo o que cada membro da sua equipe fez na organização —
          quando, de onde e o que mudou. Essencial para clínicas com vários
          profissionais.
        </p>
        <Link to="/pricing">
          <Button className="mt-5">Ver plano Team</Button>
        </Link>
      </section>
    );
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / limit)) : 1;

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-xl border bg-card overflow-hidden">
        <header className="p-6 border-b flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Scroll className="size-4" />
              Logs de auditoria
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Tudo o que rola na sua organização. Apenas o owner tem acesso.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Filter className="size-3.5" />
              Filtros
            </div>
            <select
              value={resource}
              onChange={(e) => {
                setResource(e.target.value);
                setPage(1);
              }}
              className="text-xs border border-border rounded-md px-2 py-1.5 bg-background"
            >
              {RESOURCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              value={action}
              onChange={(e) => {
                setAction(e.target.value);
                setPage(1);
              }}
              className="text-xs border border-border rounded-md px-2 py-1.5 bg-background"
            >
              {ACTION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </header>

        {isLoading && (
          <div className="p-8 text-sm text-muted-foreground text-center">
            Carregando…
          </div>
        )}

        {error && (
          <div className="p-8 text-sm text-destructive text-center">
            Erro ao carregar logs. Verifique se você é o owner desta
            organização.
          </div>
        )}

        {data && data.items.length === 0 && (
          <div className="p-12 text-center text-sm text-muted-foreground">
            Nenhum evento registrado{(resource || action) && " com esses filtros"}.
          </div>
        )}

        {data && data.items.length > 0 && (
          <ul className="divide-y divide-border">
            {data.items.map((item) => (
              <LogRow key={item.id} item={item} />
            ))}
          </ul>
        )}

        {data && data.total > 0 && (
          <footer className="px-6 py-3 border-t flex items-center justify-between text-sm">
            <div className="text-xs text-muted-foreground">
              Página {data.page} de {totalPages} — {data.total} evento
              {data.total === 1 ? "" : "s"}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </footer>
        )}
      </section>
    </div>
  );
}

function LogRow({ item }: { item: AuditLogItem }) {
  const badge = ACTION_BADGES[item.action] ?? {
    label: item.action,
    className: "bg-muted text-muted-foreground",
  };
  const userName = item.user?.name ?? "Usuário removido";
  const userEmail = item.user?.email ?? "";
  const resourceLabel = RESOURCE_LABELS[item.resource] ?? item.resource;
  const [expanded, setExpanded] = useState(false);

  return (
    <li className="px-6 py-4">
      <div className="flex items-start gap-3">
        <Avatar className="size-9 mt-0.5">
          <AvatarImage src={item.user?.image ?? ""} alt={userName} />
          <AvatarFallback className="text-xs">
            {initials(userName) || "?"}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">{userName}</span>
            <span
              className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${badge.className}`}
            >
              {badge.label}
            </span>
            <span className="text-sm text-muted-foreground">
              em <strong className="font-medium">{resourceLabel}</strong>
            </span>
            <span className="text-xs text-muted-foreground ml-auto">
              {format(new Date(item.createdAt), "d MMM, HH:mm", {
                locale: ptBR,
              })}
            </span>
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {userEmail}
            {item.ip && <> · {item.ip}</>}
          </div>
          {!!item.metadata && (
            <button
              type="button"
              className="text-xs text-primary hover:underline mt-1.5"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? "Ocultar detalhes" : "Ver detalhes"}
            </button>
          )}
          {expanded && (
            <pre className="mt-2 text-[11px] bg-muted/50 rounded-md p-2 overflow-x-auto max-h-48 text-muted-foreground">
              {JSON.stringify(item.metadata, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </li>
  );
}
