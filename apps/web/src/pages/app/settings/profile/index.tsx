import Input from "@/components/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useZodForm } from "@/hooks/useZodForm";
import { authClient } from "@/lib/auth-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Camera,
  Loader2,
  Lock,
  Mail,
  Trash2,
  UserCircle,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import z from "zod";

const schema = z.object({
  name: z.string().min(2, "Digite seu nome"),
});
type Schema = z.infer<typeof schema>;

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Digite a senha atual"),
    newPassword: z.string().min(6, "Mínimo de 6 caracteres"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "As senhas não conferem",
  });
type PwSchema = z.infer<typeof passwordSchema>;

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const AVATAR_SIZE = 256;

/**
 * Reduz a imagem para um quadrado AVATAR_SIZE px (center-crop) e devolve um
 * data URL JPEG. Mantém o avatar pequeno o suficiente pra caber em um campo
 * de texto no banco (~20–30 KB).
 */
async function fileToAvatarDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = AVATAR_SIZE;
    canvas.height = AVATAR_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas indisponível");

    const minDim = Math.min(bitmap.width, bitmap.height);
    const sx = (bitmap.width - minDim) / 2;
    const sy = (bitmap.height - minDim) / 2;
    ctx.drawImage(
      bitmap,
      sx,
      sy,
      minDim,
      minDim,
      0,
      0,
      AVATAR_SIZE,
      AVATAR_SIZE,
    );
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    bitmap.close();
  }
}

function initials(name?: string | null) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function ProfileSettingsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Avatar ──────────────────────────────────────────────────────────────
  const updateAvatar = useMutation({
    mutationFn: async (image: string) => {
      const res = await authClient.updateUser({ image });
      if ("error" in res && res.error) throw new Error(res.error.message);
      return res;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["session"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleFile = async (file: File) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Use uma imagem PNG, JPG, WEBP ou GIF.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error("Arquivo muito grande (máx. 5 MB).");
      return;
    }
    try {
      const dataUrl = await fileToAvatarDataUrl(file);
      await updateAvatar.mutateAsync(dataUrl);
      toast.success("Foto atualizada.");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Erro ao processar imagem",
      );
    }
  };

  const removeAvatar = async () => {
    try {
      await updateAvatar.mutateAsync("");
      toast.success("Foto removida.");
    } catch {
      // toast already shown via onError
    }
  };

  // ── Name ────────────────────────────────────────────────────────────────
  const {
    register: regProfile,
    formProps: profileFormProps,
    formState: { errors: profileErrors, isDirty: isNameDirty },
    reset,
  } = useZodForm(schema);

  useEffect(() => {
    if (user?.name) reset({ name: user.name });
  }, [user?.name, reset]);

  const updateName = useMutation({
    mutationFn: async (d: Schema) => {
      const res = await authClient.updateUser({ name: d.name });
      if ("error" in res && res.error) throw new Error(res.error.message);
      return res;
    },
    onSuccess: () => {
      toast.success("Perfil atualizado.");
      qc.invalidateQueries({ queryKey: ["session"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Password ────────────────────────────────────────────────────────────
  const {
    register: regPw,
    formProps: pwFormProps,
    formState: { errors: pwErrors },
    reset: resetPw,
  } = useZodForm(passwordSchema);

  const changePassword = useMutation({
    mutationFn: async (d: PwSchema) => {
      const res = await authClient.changePassword({
        currentPassword: d.currentPassword,
        newPassword: d.newPassword,
      });
      if ("error" in res && res.error) throw new Error(res.error.message);
      return res;
    },
    onSuccess: () => {
      toast.success("Senha alterada.");
      resetPw();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const hasImage = !!user?.image;
  const isUploading = updateAvatar.isPending;

  return (
    <div className="flex flex-col gap-6">
      {/* ── Avatar hero ─────────────────────────────────────── */}
      <section className="rounded-xl border bg-card p-6">
        <div className="flex items-center gap-5 flex-wrap">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={isUploading}
            aria-label="Trocar foto de perfil"
            className="group/avatar relative size-20 rounded-2xl overflow-hidden cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-default"
          >
            <Avatar className="size-20 rounded-2xl">
              <AvatarImage
                src={user?.image ?? ""}
                alt={user?.name ?? "Avatar"}
                className="rounded-2xl"
              />
              <AvatarFallback className="rounded-2xl bg-primary/10 text-primary text-lg font-semibold">
                {initials(user?.name)}
              </AvatarFallback>
            </Avatar>
            <div className="absolute inset-0 rounded-2xl bg-black/50 opacity-0 group-hover/avatar:opacity-100 transition-opacity flex items-center justify-center">
              {isUploading ? (
                <Loader2 className="size-6 text-white animate-spin" />
              ) : (
                <Camera className="size-6 text-white" />
              )}
            </div>
          </button>

          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold truncate">
              {user?.name ?? "Sem nome"}
            </h2>
            <p className="text-sm text-muted-foreground inline-flex items-center gap-1.5 truncate">
              <Mail className="size-3.5 shrink-0" />
              <span className="truncate">{user?.email}</span>
            </p>
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => fileRef.current?.click()}
                disabled={isUploading}
              >
                {isUploading ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Camera className="size-3.5" />
                )}
                {hasImage ? "Trocar foto" : "Adicionar foto"}
              </Button>
              {hasImage && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2 text-muted-foreground hover:text-destructive"
                  onClick={removeAvatar}
                  disabled={isUploading}
                >
                  <Trash2 className="size-3.5" />
                  Remover
                </Button>
              )}
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-4">
          PNG, JPG, WEBP ou GIF até 5 MB. A imagem será recortada em um
          quadrado.
        </p>

        <input
          ref={fileRef}
          type="file"
          accept={ALLOWED_TYPES.join(",")}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = ""; // permite re-selecionar o mesmo arquivo
          }}
        />
      </section>

      {/* ── Conta ──────────────────────────────────────────── */}
      <Card
        icon={<UserCircle className="size-5 text-primary" />}
        title="Informações da conta"
        description="Como você aparece para a equipe e nos seus convites."
      >
        <form
          {...profileFormProps((d) => updateName.mutate(d))}
          className="flex flex-col gap-4"
        >
          <Input
            title="Nome"
            register={regProfile("name")}
            error={profileErrors.name?.message}
            inputSubmit
          />
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">E-mail</span>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
              <span className="text-sm truncate">{user?.email}</span>
              {user?.emailVerified ? (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-primary/15 text-primary tracking-wide shrink-0">
                  VERIFICADO
                </span>
              ) : (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-600 tracking-wide shrink-0">
                  NÃO VERIFICADO
                </span>
              )}
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={updateName.isPending || !isNameDirty}
            >
              {updateName.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </Card>

      {/* ── Senha ──────────────────────────────────────────── */}
      <Card
        icon={<Lock className="size-5 text-primary" />}
        title="Alterar senha"
        description="Use uma senha forte com pelo menos 6 caracteres."
      >
        <form
          {...pwFormProps((d) => changePassword.mutate(d))}
          className="flex flex-col gap-4"
        >
          <Input
            title="Senha atual"
            type="password"
            register={regPw("currentPassword")}
            error={pwErrors.currentPassword?.message}
          />
          <Input
            title="Nova senha"
            type="password"
            register={regPw("newPassword")}
            error={pwErrors.newPassword?.message}
          />
          <Input
            title="Confirmar nova senha"
            type="password"
            register={regPw("confirmPassword")}
            error={pwErrors.confirmPassword?.message}
            inputSubmit
          />
          <div className="flex justify-end">
            <Button type="submit" disabled={changePassword.isPending}>
              {changePassword.isPending ? "Alterando..." : "Alterar senha"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function Card({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-card p-6">
      <header className="flex items-center gap-3 mb-5">
        <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div>
          <h2 className="text-base font-semibold leading-tight">{title}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
        </div>
      </header>
      {children}
    </section>
  );
}
