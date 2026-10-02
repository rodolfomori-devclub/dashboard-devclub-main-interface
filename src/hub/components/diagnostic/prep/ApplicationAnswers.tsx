import { Check } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { ReadyWorkspace } from '@/components/diagnostic/WorkspaceFrame';
import { patchLead, type LeadFields } from '@/lib/diagnostic/workspace';
import { applicationOptions, graduationOptions, investmentOptions } from '@/lib/diagnostic/prepChecklist';
import type { Graduation, InvestmentAnswer } from '@diag/types.ts';
import { ChoiceSelect, Field, Notice } from './fields';
import { PrepSubheading } from './PrepCard';

type ChoiceKey = 'area' | 'career_moment' | 'time_in_role' | 'last_promotion' | 'trigger_event' | 'ai_frequency' | 'goal_12m';

/** Campo do lead -> id da pergunta da aplicacao no conteudo. */
const SINGLE: { key: ChoiceKey; question: string; label: string }[] = [
  { key: 'area', question: 'area', label: 'Área' },
  { key: 'career_moment', question: 'momento', label: 'Momento profissional' },
  { key: 'time_in_role', question: 'tempo_cargo', label: 'Tempo no cargo (faixa)' },
  { key: 'last_promotion', question: 'ultima_promocao', label: 'Última promoção ou aumento' },
  { key: 'trigger_event', question: 'gatilho', label: 'O que o fez aplicar' },
  { key: 'ai_frequency', question: 'frequencia_ia', label: 'Frequência de uso de IA' },
  { key: 'goal_12m', question: 'objetivo', label: 'Onde quer estar em 12 meses' },
];

const asOptions = (values: string[]) => values.map((v) => ({ value: v, label: v }));

/** Respostas da aplicacao, editaveis com as opcoes do formulario. */
export function ApplicationAnswers({ api, readOnly }: { api: ReadyWorkspace; readOnly: boolean }) {
  const { ws, content } = api;
  const lead = ws.lead;
  const setLead = (p: Partial<LeadFields>) => api.update((w) => patchLead(w, p));
  const toggleUse = (use: string) =>
    api.update((w) => {
      const current = w.lead.ai_uses;
      return patchLead(w, { ai_uses: current.includes(use) ? current.filter((u) => u !== use) : [...current, use] });
    });

  const useOptions = applicationOptions(content, 'usos_ia');
  const uses = [...useOptions, ...lead.ai_uses.filter((u) => !useOptions.includes(u))];

  return (
    <div className="space-y-3 border-t border-border/60 pt-4">
      <PrepSubheading>Respostas da aplicação</PrepSubheading>
      <div className="grid gap-3 sm:grid-cols-2">
        {SINGLE.map((f) => (
          <Field key={f.key} id={`prep-app-${f.key}`} label={f.label}>
            <ChoiceSelect
              id={`prep-app-${f.key}`}
              value={lead[f.key]}
              options={asOptions(applicationOptions(content, f.question))}
              onChange={(v) => setLead({ [f.key]: v } as Partial<LeadFields>)}
              disabled={readOnly}
            />
          </Field>
        ))}
        <Field id="prep-app-investment" label="Consegue investir agora, se tiver bolsa?">
          <ChoiceSelect
            id="prep-app-investment"
            value={lead.investment_answer}
            options={investmentOptions(content)}
            onChange={(v) => setLead({ investment_answer: v as InvestmentAnswer })}
            disabled={readOnly}
          />
        </Field>
      </div>

      <Field id="prep-app-graduation" label="Tem graduação concluída?">
        <ChoiceSelect
          id="prep-app-graduation"
          value={lead.graduation_status}
          options={graduationOptions(content)}
          onChange={(v) => setLead({ graduation_status: v as Graduation })}
          emptyLabel="Não confirmada"
          disabled={readOnly}
          className="sm:max-w-[calc(50%-0.375rem)]"
        />
      </Field>
      {lead.graduation_status === 'cursando' && (
        <Notice tone="warn">
          Cursando graduação: nesta call não se apresenta a pós nem a bolsa. A pessoa recebe o diagnóstico e o plano.
        </Notice>
      )}
      {lead.graduation_status === '' && (
        <Notice tone="warn">Confirme a graduação: muda o que você pode mostrar no fim da call.</Notice>
      )}

      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">Para que usa IA hoje</p>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Usos de IA">
          {uses.map((use) => {
            const on = lead.ai_uses.includes(use);
            return (
              <button
                key={use}
                type="button"
                aria-pressed={on}
                disabled={readOnly}
                onClick={() => toggleUse(use)}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                  on ? 'border-primary/60 bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:text-foreground',
                )}
              >
                {on && <Check className="h-3 w-3" />}
                {use}
              </button>
            );
          })}
        </div>
      </div>

      <Field
        id="prep-app-phrase"
        label="Frase dele: o que quer diferente daqui a um ano"
        hint="As palavras dele, como escreveu. Bom ponto de partida para abrir a conversa."
      >
        <Textarea
          id="prep-app-phrase"
          rows={2}
          value={lead.free_phrase}
          onChange={(e) => setLead({ free_phrase: e.target.value })}
          disabled={readOnly}
          placeholder="Opcional na aplicação"
          className="text-sm"
        />
      </Field>
    </div>
  );
}
