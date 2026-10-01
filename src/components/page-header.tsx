import Link from "next/link";
import { ChevronLeftIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/** En-tête de page : titre, lien « retour » facultatif et boutons d'action à droite. */
export function PageHeader({
  title,
  description,
  backHref,
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  backHref?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-4 flex flex-wrap items-start justify-between gap-3", className)}>
      <div className="flex min-w-0 items-start gap-1">
        {backHref && (
          <Link
            href={backHref}
            aria-label="Retour"
            className="-ml-2 flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
          >
            <ChevronLeftIcon className="size-5" />
          </Link>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight">{title}</h1>
          {description && <div className="mt-0.5 text-sm text-muted-foreground">{description}</div>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Message affiché quand une liste est vide. */
export function EmptyState({ icon: Icon, title, children }: { icon?: React.ComponentType<{ className?: string }>; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-10 text-center">
      {Icon && <Icon className="size-8 text-muted-foreground" />}
      <p className="font-medium">{title}</p>
      {children && <div className="text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}
