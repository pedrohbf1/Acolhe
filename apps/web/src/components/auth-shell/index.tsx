import { type LucideIcon } from "lucide-react";

interface Props {
  icon: LucideIcon;
  title: string;
  description: string;
  children: React.ReactNode;
  /** Conteúdo abaixo do form (ex.: link "já tem conta?") */
  footer?: React.ReactNode;
}

export default function AuthShell({
  icon: Icon,
  title,
  description,
  children,
  footer,
}: Props) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex">
        <div className="size-10 rounded-md bg-primary text-primary-foreground flex items-center justify-center font-bold">
          u
        </div>
      </div>
      <main className="flex items-center justify-center h-full">
        <section className="w-full md:max-w-lg flex flex-col items-center justify-center gap-6">
          <div className="size-25 bg-muted flex items-center justify-center rounded-full">
            <div className="size-20 bg-background rounded-full flex items-center justify-center">
              <Icon size={40} />
            </div>
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
            <p className="text-muted-foreground mt-2">{description}</p>
          </div>

          {children}

          {footer ? (
            <div className="text-sm text-muted-foreground">{footer}</div>
          ) : null}
        </section>
      </main>
    </div>
  );
}
