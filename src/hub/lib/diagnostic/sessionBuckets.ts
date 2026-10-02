import type { DiagnosticSessionItem } from '@/hooks/useDiagnosticData';

/** Prazo do playbook: diagnostico entregue ate 2 horas depois da call. */
export const DELIVERY_WINDOW_MS = 2 * 60 * 60 * 1000;

export type SessionBucket = 'today' | 'toDeliver' | 'drafts' | 'sent';

export interface SessionBuckets {
  today: DiagnosticSessionItem[];
  toDeliver: DiagnosticSessionItem[];
  drafts: DiagnosticSessionItem[];
  sent: DiagnosticSessionItem[];
}

export type SessionStage = 'prep' | 'inCall' | 'toDeliver' | 'sent';

export function sessionStage(item: DiagnosticSessionItem): SessionStage {
  if (item.diagnosisStatus === 'sent') return 'sent';
  if (item.callEndedAt) return 'toDeliver';
  if (item.callStartedAt) return 'inCall';
  return 'prep';
}

function byScheduleAsc(a: DiagnosticSessionItem, b: DiagnosticSessionItem): number {
  const da = a.scheduledDate ?? '9999-12-31';
  const db = b.scheduledDate ?? '9999-12-31';
  if (da !== db) return da < db ? -1 : 1;
  const ta = a.scheduledTime ?? '99:99';
  const tb = b.scheduledTime ?? '99:99';
  if (ta !== tb) return ta < tb ? -1 : 1;
  return a.createdAt < b.createdAt ? 1 : -1;
}

/**
 * Hoje: sessoes do dia em qualquer etapa. Para entregar: call encerrada e
 * diagnostico nao enviado (mais antiga primeiro). Rascunhos: sem call encerrada.
 */
export function bucketSessions(items: DiagnosticSessionItem[], todayYmd: string): SessionBuckets {
  const today = items.filter((i) => i.scheduledDate === todayYmd).sort(byScheduleAsc);
  const toDeliver = items
    .filter((i) => sessionStage(i) === 'toDeliver')
    .sort((a, b) => String(a.callEndedAt).localeCompare(String(b.callEndedAt)));
  const drafts = items
    .filter((i) => i.diagnosisStatus === 'draft' && !i.callEndedAt)
    .sort(byScheduleAsc);
  const sent = items
    .filter((i) => i.diagnosisStatus === 'sent')
    .sort((a, b) => String(b.sentAt).localeCompare(String(a.sentAt)));
  return { today, toDeliver, drafts, sent };
}

export interface DeliveryClock {
  deadlineMs: number;
  /** Minutos ate o prazo; negativo quando passou. */
  minutesLeft: number;
  late: boolean;
}

export function deliveryClock(callEndedAt: string | null, nowMs: number): DeliveryClock | null {
  if (!callEndedAt) return null;
  const ended = Date.parse(callEndedAt);
  if (Number.isNaN(ended)) return null;
  const deadlineMs = ended + DELIVERY_WINDOW_MS;
  const minutesLeft = Math.round((deadlineMs - nowMs) / 60000);
  return { deadlineMs, minutesLeft, late: minutesLeft < 0 };
}

/** "1h25" / "35 min". */
export function formatMinutes(total: number): string {
  const m = Math.abs(Math.round(total));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h}h${String(rest).padStart(2, '0')}` : `${h}h`;
}
