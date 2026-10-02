import { Link } from 'react-router-dom';
import { CalendarClock, FileCheck2, MonitorPlay, Send, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { DiagnosticSessionItem } from '@/hooks/useDiagnosticData';
import { deliveryClock, formatMinutes, sessionStage } from '@/lib/diagnostic/sessionBuckets';
import { diagnosticPaths } from '@/lib/diagnostic/routes';

const TIME_SP = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
const DATE_SP = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' });

function scheduleLabel(item: DiagnosticSessionItem, todayYmd: string): string {
  if (!item.scheduledDate) return 'Sem data';
  const [y, m, d] = item.scheduledDate.split('-');
  const day = item.scheduledDate === todayYmd ? 'Hoje' : `${d}/${m}${y === todayYmd.slice(0, 4) ? '' : `/${y}`}`;
  const time = item.scheduledTime ? item.scheduledTime.slice(0, 5) : '';
  return time ? `${day}, ${time}` : day;
}

function StageInfo({ item, now }: { item: DiagnosticSessionItem; now: number }) {
  const stage = sessionStage(item);
  if (stage === 'sent') {
    return (
      <div className="text-xs">
        <span className="text-emerald-400 font-medium">Enviado</span>
        {item.sentAt && <span className="text-muted-foreground"> em {DATE_SP.format(new Date(item.sentAt))}</span>}
        {item.indexTotal != null && <span className="text-muted-foreground"> · Índice {item.indexTotal}/25</span>}
        {item.scholarshipStatus === 'closed' && <span className="text-emerald-400 font-medium"> · Fechou</span>}
      </div>
    );
  }
  if (stage === 'toDeliver') {
    const clock = deliveryClock(item.callEndedAt, now);
    if (!clock) return <span className="text-xs text-amber-400 font-medium">Para entregar</span>;
    return (
      <div className={`text-xs flex items-center gap-1 ${clock.late ? 'text-red-400' : 'text-amber-400'}`}>
        <Timer className="h-3.5 w-3.5" />
        <span className="font-medium">
          {clock.late
            ? `Atrasado ${formatMinutes(clock.minutesLeft)}`
            : `Entregar até ${TIME_SP.format(new Date(clock.deadlineMs))} · faltam ${formatMinutes(clock.minutesLeft)}`}
        </span>
      </div>
    );
  }
  if (stage === 'inCall') return <span className="text-xs text-sky-400 font-medium">Call em andamento</span>;
  if (item.sessionStatus === 'no_show') return <span className="text-xs text-red-400">Não compareceu</span>;
  if (item.sessionStatus === 'cancelled') return <span className="text-xs text-muted-foreground">Cancelada</span>;
  return <span className="text-xs text-muted-foreground">A preparar</span>;
}

interface Props {
  item: DiagnosticSessionItem;
  now: number;
  todayYmd: string;
  showConsultant: boolean;
}

export function SessionRow({ item, now, todayYmd, showConsultant }: Props) {
  const stage = sessionStage(item);
  const subtitle = [item.jobTitle, item.area].filter(Boolean).join(' · ');
  return (
    <div className="glass-card p-4 flex flex-col md:flex-row md:items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-foreground truncate">{item.leadName || 'Sem nome'}</span>
          {item.origin === 'exemplo' && (
            <span className="text-[10px] uppercase tracking-wider rounded border border-border px-1.5 py-0.5 text-muted-foreground">
              Exemplo
            </span>
          )}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5 truncate">
          {subtitle || 'Dados do lead a completar na preparação'}
        </div>
        <div className="mt-1.5 flex items-center gap-3 flex-wrap">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <CalendarClock className="h-3.5 w-3.5" /> {scheduleLabel(item, todayYmd)}
          </span>
          <StageInfo item={item} now={now} />
          {showConsultant && item.consultantName && (
            <span className="text-xs text-muted-foreground">Consultor: {item.consultantName}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {stage === 'prep' && (
          <>
            <Button asChild size="sm" variant="ghost" className="gap-1.5 text-muted-foreground">
              <Link to={diagnosticPaths.cockpit(item.sessionId)}>
                <MonitorPlay className="h-4 w-4" /> Call
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link to={diagnosticPaths.prep(item.sessionId)}>Preparar</Link>
            </Button>
          </>
        )}
        {stage === 'inCall' && (
          <Button asChild size="sm" className="gap-1.5">
            <Link to={diagnosticPaths.cockpit(item.sessionId)}>
              <MonitorPlay className="h-4 w-4" /> Voltar à call
            </Link>
          </Button>
        )}
        {stage === 'toDeliver' && (
          <>
            <Button asChild size="sm" variant="ghost" className="gap-1.5 text-muted-foreground">
              <Link to={diagnosticPaths.cockpit(item.sessionId)}>
                <MonitorPlay className="h-4 w-4" /> Call
              </Link>
            </Button>
            <Button asChild size="sm" className="gap-1.5">
              <Link to={diagnosticPaths.send(item.sessionId)}>
                <Send className="h-4 w-4" /> Entregar
              </Link>
            </Button>
          </>
        )}
        {stage === 'sent' && (
          <Button asChild size="sm" variant="outline" className="gap-1.5">
            <Link to={diagnosticPaths.send(item.sessionId)}>
              <FileCheck2 className="h-4 w-4" /> Ver entrega
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
