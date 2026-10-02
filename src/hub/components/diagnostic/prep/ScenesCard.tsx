import { ArrowDown, ArrowUp, Lock, MonitorUp, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import type { ReadyWorkspace } from '@/components/diagnostic/WorkspaceFrame';
import { patchPrepConfig } from '@/lib/diagnostic/workspace';
import { sceneMeta, sceneOrder, type SceneEntry, type SceneId } from '@/lib/diagnostic/presentation';
import { sceneStatus } from '@/lib/diagnostic/leadView';
import { moveScene, scenesForConfig, setSceneEnabled } from '@/lib/diagnostic/prepChecklist';
import { PREP_SECTION } from './anchors';
import { Notice } from './fields';
import { PrepCard } from './PrepCard';

/** O que o lead ve em cada cena, numa linha (plano 1.3). */
const SCENE_LINE: Record<SceneId, string> = {
  abertura: 'A pauta em 4 passos e o que ele leva da sessão.',
  momento:
    'Cargo, área, tempo no cargo, última promoção, o que o fez aplicar, a frase que escreveu na aplicação, o objetivo e a nota de decisão (0 a 10) que deu ao SDR. Só o que ele respondeu.',
  tempo: 'As tarefas e as horas por semana dele, com a conta do ano.',
  mercado: 'Até 2 reportagens: veículo, data, manchete e o dado. Fecha no positivo.',
  montando: 'O diagnóstico sendo montado, bloco a bloco, sem nenhuma nota.',
  palavras: 'A frase dele sobre daqui a um ano, entre aspas.',
  objetivo: 'Onde ele quer chegar e o que pesa mais para ele.',
  devolutiva: 'As frases dele, ponto forte, o que trava, o Índice, as barras e o mapa.',
  plano: 'Os 3 movimentos de 90 dias, o compromisso com data e o material de presente.',
  caminho: 'Os 12 meses e até 3 pares "sua trava, como a pós resolve". Só com permissão.',
  proximo: 'Dois caminhos: ver a bolsa agora ou conversar no dia do compromisso.',
  bolsa: 'Preço de tabela, valor com bolsa, formas de pagamento, bolsas e validade. Só se ele pedir.',
  encerramento: 'O compromisso com data, o que chega no WhatsApp e o seu contato.',
};

/** Cenas que dependem do que se prepara antes; as outras abrem com o que acontece na call. */
const PREP_DEPENDENT: SceneId[] = ['momento', 'tempo', 'mercado', 'objetivo'];
const NOT_FOR_STUDENTS: SceneId[] = ['caminho', 'bolsa'];

/** Cenas da janela compartilhada: ligar, desligar e ordenar. */
export function ScenesCard({ api }: { api: ReadyWorkspace }) {
  const { ws } = api;
  const readOnly = !api.canEdit;
  const prep = ws.diagnosis.prep_config;
  const entries = sceneOrder(prep);
  const status = sceneStatus({ ws, model: api.model, content: api.content, offer: api.offer });

  // Sempre a partir do estado mais novo; grava a lista inteira, na ordem.
  const write = (fn: (current: SceneEntry[]) => SceneEntry[]) =>
    api.update((w) => {
      const current = sceneOrder(w.diagnosis.prep_config);
      const next = fn(current);
      return next === current ? w : patchPrepConfig(w, { scenes: scenesForConfig(next) });
    });
  const move = (id: SceneId, delta: number) =>
    write((current) => moveScene(current, current.findIndex((s) => s.id === id), delta));
  const restore = () => api.update((w) => (w.diagnosis.prep_config.scenes.length ? patchPrepConfig(w, { scenes: [] }) : w));

  return (
    <PrepCard
      id={PREP_SECTION.scenes}
      icon={MonitorUp}
      title="Tela do lead"
      description="As cenas da janela que você compartilha, na ordem da call. Cada uma só entra quando você avança no cockpit."
      actions={
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="gap-1.5 text-muted-foreground"
          onClick={restore}
          disabled={readOnly || prep.scenes.length === 0}
        >
          <RotateCcw className="h-3.5 w-3.5" /> Restaurar padrão
        </Button>
      }
    >
      <Notice>
        Abertura, Seu momento, Onde seu tempo vai, Nas suas palavras e Onde você quer chegar começam desligadas: no
        playbook, o começo da call é olho no olho, a tela entra nas reportagens (pedindo permissão para compartilhar) e
        volta na devolutiva.
      </Notice>

      <ol className="space-y-1.5">
        {entries.map((entry, i) => {
          const meta = sceneMeta(entry.id);
          const st = status[entry.id];
          let issue: string | null = null;
          if (entry.enabled && !api.model.eligible && NOT_FOR_STUDENTS.includes(entry.id)) {
            issue = 'Não abre nesta call: ele está cursando graduação.';
          } else if (entry.enabled && PREP_DEPENDENT.includes(entry.id) && st && !st.ready) {
            issue = st.reason;
          }
          return (
            <li
              key={entry.id}
              className={cn(
                'flex items-start gap-3 rounded-md border p-2.5',
                entry.enabled ? 'border-border/60' : 'border-border/40 bg-muted/20',
              )}
            >
              <span className="w-5 shrink-0 pt-0.5 text-xs tabular-nums text-muted-foreground">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className={cn('text-sm font-medium', entry.enabled ? 'text-foreground' : 'text-muted-foreground')}>{meta.label}</p>
                <p className="text-xs text-muted-foreground">{SCENE_LINE[entry.id]}</p>
                {issue && <p className="text-xs text-amber-400 mt-0.5">{issue}</p>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {meta.alwaysOn ? (
                  <span className="inline-flex items-center gap-1.5 pr-1" title="Devolutiva, plano e encerramento ficam sempre ligados">
                    <Lock className="h-3 w-3 text-muted-foreground" />
                    <span className="hidden sm:inline text-[11px] text-muted-foreground">sempre ligada</span>
                    <Switch checked disabled aria-label={`${meta.label}: sempre ligada`} />
                  </span>
                ) : (
                  <Switch
                    checked={entry.enabled}
                    onCheckedChange={(v) => write((current) => setSceneEnabled(current, entry.id, v))}
                    disabled={readOnly}
                    aria-label={`Mostrar a cena ${meta.label}`}
                  />
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => move(entry.id, -1)}
                  disabled={readOnly || i === 0}
                  aria-label={`Subir ${meta.label}`}
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => move(entry.id, 1)}
                  disabled={readOnly || i === entries.length - 1}
                  aria-label={`Descer ${meta.label}`}
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </Button>
              </div>
            </li>
          );
        })}
      </ol>
    </PrepCard>
  );
}
