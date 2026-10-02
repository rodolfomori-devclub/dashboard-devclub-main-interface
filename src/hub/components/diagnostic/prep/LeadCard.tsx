import { UserRound } from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { ReadyWorkspace } from '@/components/diagnostic/WorkspaceFrame';
import { patchLead, patchSession, type LeadFields, type SessionFields } from '@/lib/diagnostic/workspace';
import { hasPhone, isHttpUrl } from '@/lib/diagnostic/prepChecklist';
import { ApplicationAnswers } from './ApplicationAnswers';
import { PREP_SECTION } from './anchors';
import { Field } from './fields';
import { PrepCard } from './PrepCard';

const warnHint = (text: string) => <span className="text-amber-400">{text}</span>;

/** Contato, cargo, dados da sessao e respostas da aplicacao. */
export function LeadCard({ api }: { api: ReadyWorkspace }) {
  const { ws } = api;
  const { lead, session } = ws;
  // Depois de enviado, o que o lead recebeu fica travado (o hook recusa a mudanca).
  const leadLocked = !api.canEdit || api.frozen;
  const sessionLocked = !api.canEdit;
  const setLead = (p: Partial<LeadFields>) => api.update((w) => patchLead(w, p));
  const setSession = (p: Partial<SessionFields>) => api.update((w) => patchSession(w, p));

  const phoneOff = lead.whatsapp.trim() !== '' && !hasPhone(lead.whatsapp);
  const roomOff = session.room_url.trim() !== '' && !isHttpUrl(session.room_url);

  return (
    <PrepCard
      id={PREP_SECTION.lead}
      icon={UserRound}
      title="Lead"
      description="O que ele respondeu na aplicação. Ajuste se ele corrigir alguma coisa."
      actions={
        ws.leadScore ? (
          <span className="text-[11px] rounded border border-border px-1.5 py-0.5 text-muted-foreground">
            Aplicação {ws.leadScore}
          </span>
        ) : null
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="prep-lead-name" label="Nome">
          <Input
            id="prep-lead-name"
            value={lead.name}
            onChange={(e) => setLead({ name: e.target.value })}
            disabled={leadLocked}
            className="h-9"
          />
        </Field>
        <Field
          id="prep-lead-whatsapp"
          label="WhatsApp"
          hint={phoneOff ? warnHint('Confira o número: DDD e número.') : 'É por onde o diagnóstico chega depois da call.'}
        >
          <Input
            id="prep-lead-whatsapp"
            value={lead.whatsapp}
            inputMode="tel"
            placeholder="(11) 91234-5678"
            onChange={(e) => setLead({ whatsapp: e.target.value })}
            disabled={leadLocked}
            className="h-9"
          />
        </Field>
        <Field id="prep-lead-role" label="Cargo">
          <Input
            id="prep-lead-role"
            value={lead.job_title}
            placeholder="Ex.: Analista Financeira Sênior"
            onChange={(e) => setLead({ job_title: e.target.value })}
            disabled={leadLocked}
            className="h-9"
          />
        </Field>
        <Field id="prep-lead-time" label="Tempo no cargo" hint="Como ele disse. Vai no topo do diagnóstico.">
          <Input
            id="prep-lead-time"
            value={lead.time_in_role_text}
            placeholder="Ex.: 4 anos"
            onChange={(e) => setLead({ time_in_role_text: e.target.value })}
            disabled={leadLocked}
            className="h-9"
          />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,160px)_minmax(0,120px)_minmax(0,1fr)]">
        <Field id="prep-session-date" label="Data da sessão">
          <Input
            id="prep-session-date"
            type="date"
            value={session.scheduled_date ?? ''}
            onChange={(e) => setSession({ scheduled_date: e.target.value || null })}
            disabled={sessionLocked}
            className="h-9"
          />
        </Field>
        <Field id="prep-session-time" label="Horário">
          <Input
            id="prep-session-time"
            type="time"
            value={(session.scheduled_time ?? '').slice(0, 5)}
            onChange={(e) => setSession({ scheduled_time: e.target.value || null })}
            disabled={sessionLocked}
            className="h-9"
          />
        </Field>
        <Field
          id="prep-session-room"
          label="Link da sala"
          hint={roomOff ? warnHint('Confira o link: ele começa com https://') : undefined}
        >
          <Input
            id="prep-session-room"
            type="url"
            value={session.room_url}
            placeholder="https://meet.google.com/..."
            onChange={(e) => setSession({ room_url: e.target.value })}
            disabled={sessionLocked}
            className="h-9"
          />
        </Field>
      </div>

      <ApplicationAnswers api={api} readOnly={leadLocked} />
    </PrepCard>
  );
}
