import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Cartao da preparacao: titulo, explicacao curta e acoes no canto. */
export function PrepCard({
  id,
  icon: Icon,
  title,
  description,
  actions,
  className,
  children,
}: {
  id: string;
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={cn('glass-card p-4 md:p-5 space-y-4 scroll-mt-6', className)}>
      <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3">
        <div className="flex-1 min-w-0">
          <h3 id={`${id}-title`} className="section-title flex items-center gap-2">
            <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
            {title}
          </h3>
          {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-2 flex-wrap sm:justify-end shrink-0">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

/** Subtitulo dentro de um cartao (secoes do roteiro, da oferta). */
export function PrepSubheading({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <h4 className="text-sm font-semibold text-foreground flex-1 min-w-0">{children}</h4>
      {actions}
    </div>
  );
}
