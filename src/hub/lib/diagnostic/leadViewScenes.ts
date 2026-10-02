/**
 * Cenas do comeco e do meio da call: abertura, momento, tempo, mercado,
 * montando, palavras e objetivo. Cada cena diz quando abre (plan) e o que o
 * lead ve em cada passo (build). So respostas dele, nas faixas em que respondeu.
 */
import type { CallBlockId, NewsItem, PillarId } from '@diag/types.ts';
import { hasNewsSource } from '@diag/content.ts';
import type {
  AberturaVM,
  MercadoVM,
  MomentoFact,
  MomentoVM,
  MontandoVM,
  ObjetivoVM,
  PalavrasVM,
  TempoVM,
} from '@/lib/diagnostic/presentation';
import {
  WEEKS_PER_YEAR,
  firstNameOf,
  giftOf,
  latestQuote,
  locked,
  ready,
  revealedKeys,
  type LeadViewContext,
  type SceneDef,
} from '@/lib/diagnostic/leadViewShared';

const MAX_SCREEN_NEWS = 2;
/** Cabe no palco com a conta ao lado; o pre-diagnostico pede 2 ou 3. */
const MAX_TASKS = 6;

export const abertura: SceneDef<AberturaVM> = {
  plan: () => ready(['ola', 'agenda', 'leva']),
  build({ ws, model }, plan, step) {
    const r = revealedKeys(plan, step);
    const first = firstNameOf(ws.lead.name);
    const consultant = ws.diagnosis.consultant_name.trim();
    const agenda = ['Seu momento', 'O que o mercado está mostrando', 'Seu diagnóstico e o plano de 90 dias'];
    if (model.eligible) agenda.push('O caminho completo, sem compromisso');
    return {
      id: 'abertura',
      step,
      steps: plan.steps.length,
      greeting: first ? `Olá, ${first}.` : 'Olá.',
      consultantLine: consultant ? `Sessão de diagnóstico com ${consultant}` : null,
      agenda: r.has('agenda') ? agenda : null,
      takeaways: r.has('leva') ? ['Diagnóstico por escrito', 'Plano de 90 dias', giftOf(model.material).title] : null,
    };
  },
};

function momentoData({ ws }: LeadViewContext) {
  const { lead, qualification } = ws;
  const facts: MomentoFact[] = [];
  const push = (label: string, value: string) => {
    const v = (value || '').trim();
    if (v) facts.push({ label, value: v });
  };
  push('Cargo', lead.job_title);
  if (lead.area.trim() !== 'Outra') push('Área', lead.area);
  push('Tempo no cargo', lead.time_in_role_text.trim() || lead.time_in_role);
  push('Última promoção', lead.last_promotion);
  const trigger = lead.trigger_event.trim();
  const decision = qualification.decision_score;
  return {
    facts,
    trigger: trigger && trigger !== 'Outro' ? trigger : null,
    freePhrase: lead.free_phrase.trim() || null,
    goal: lead.goal_12m.trim() || null,
    decision: typeof decision === 'number' && decision >= 0 && decision <= 10 ? Math.round(decision) : null,
  };
}

export const momento: SceneDef<MomentoVM> = {
  plan(ctx) {
    const d = momentoData(ctx);
    const any = d.facts.length > 0 || d.trigger || d.freePhrase || d.goal || d.decision != null;
    return any ? ready(['momento']) : locked('Ainda não há respostas da aplicação para mostrar.');
  },
  build(ctx, plan, step) {
    return { id: 'momento', step, steps: plan.steps.length, ...momentoData(ctx) };
  },
};

function tasksWithHours({ ws }: LeadViewContext) {
  return (ws.session.precall_answers.tasks ?? [])
    .filter((t) => t.label.trim() && typeof t.hoursPerWeek === 'number' && t.hoursPerWeek > 0 && t.hoursPerWeek <= 168)
    .slice(0, MAX_TASKS)
    // Cada tarefa com 1 casa, como a tela mostra: a soma visivel sempre fecha.
    .map((t) => ({ label: t.label.trim(), hours: Math.round((t.hoursPerWeek as number) * 10) / 10 }));
}

export const tempo: SceneDef<TempoVM> = {
  plan: (ctx) =>
    tasksWithHours(ctx).length > 0
      ? ready(['tarefas', 'total'])
      : locked('Sem tarefas com horas por semana no pré-diagnóstico.'),
  build(ctx, plan, step) {
    const tasks = tasksWithHours(ctx);
    const showTotal = revealedKeys(plan, step).has('total');
    const weekly = Math.round(tasks.reduce((sum, t) => sum + t.hours, 0) * 10) / 10;
    return {
      id: 'tempo',
      step,
      steps: plan.steps.length,
      tasks,
      weeklyHours: showTotal ? weekly : null,
      yearlyHours: showTotal ? Math.round(weekly * WEEKS_PER_YEAR) : null,
      weeksPerYear: showTotal ? WEEKS_PER_YEAR : null,
    };
  },
};

/** Reportagens planejadas para a tela que podem aparecer: link, veiculo e data. */
export function screenArticles({ ws, content }: LeadViewContext): NewsItem[] {
  const out: NewsItem[] = [];
  for (const id of ws.diagnosis.prep_config.newsScreen) {
    const n = content.reportagens.find((x) => x.id === id);
    if (!n || out.includes(n)) continue;
    if (!n.na_tela || !hasNewsSource(n) || !n.veiculo.trim() || !n.data.trim() || !n.manchete.trim()) continue;
    out.push(n);
    if (out.length === MAX_SCREEN_NEWS) break;
  }
  return out;
}

export const mercado: SceneDef<MercadoVM> = {
  plan(ctx) {
    const articles = screenArticles(ctx);
    if (!articles.length) return locked('Nenhuma reportagem com link marcada para a tela na preparação.');
    const steps = articles.flatMap((_, i) => [`a${i}`, `a${i}d`]);
    if (ctx.content.reportagem_fecho.trim()) steps.push('fecho');
    return ready(steps);
  },
  build(ctx, plan, step) {
    const articles = screenArticles(ctx);
    const key = plan.steps[step];
    const base = { id: 'mercado' as const, step, steps: plan.steps.length, count: articles.length };
    if (key === 'fecho') {
      return { ...base, index: articles.length, article: null, closing: ctx.content.reportagem_fecho.trim() };
    }
    const index = Number(key.slice(1, 2));
    const n = articles[index];
    const withData = key.endsWith('d');
    return {
      ...base,
      index,
      closing: null,
      article: {
        outlet: n.veiculo.trim(),
        date: n.data.trim(),
        headline: n.manchete.trim(),
        seal: n.selo?.trim() || null,
        data: withData ? n.dado_principal.trim() || null : null,
        url: withData ? n.url : null,
      },
    };
  },
};

/** Id da reportagem que o passo `step` da cena do mercado mostra (ou null). */
export function mercadoArticleIdAt(ctx: LeadViewContext, step: number): string | null {
  const plan = mercado.plan(ctx);
  const key = plan.steps[step];
  if (!key || !/^a\d/.test(key)) return null;
  return screenArticles(ctx)[Number(key.slice(1, 2))]?.id ?? null;
}

const PILLAR_BLOCK_FALLBACK: Record<PillarId, CallBlockId> = {
  uso: 'situacao',
  aplic: 'situacao',
  prova: 'problema',
  cred: 'problema',
  metodo: 'problema',
};

export const montando: SceneDef<MontandoVM> = {
  plan: () => ready(['montando']),
  build({ ws, content }, plan, step) {
    const blocks = [...content.call.blocos].sort((a, b) => a.ordem - b.ordem);
    const orderOf = (id: CallBlockId) => blocks.findIndex((b) => b.id === id);
    const current = orderOf(ws.diagnosis.call_data.currentBlock);
    const pillars = content.pilares.map((p) => {
      const block = blocks.find((b) => b.pilares.includes(p.id))?.id ?? PILLAR_BLOCK_FALLBACK[p.id];
      const at = orderOf(block);
      return { name: p.nome_curto, done: current >= 0 && at >= 0 && current > at };
    });
    return { id: 'montando', step, steps: plan.steps.length, pillars };
  },
};

export const palavras: SceneDef<PalavrasVM> = {
  plan: ({ ws }) =>
    latestQuote(ws.diagnosis.quotes, 'implicacao')
      ? ready(['frase'])
      : locked('Capture a frase dele sobre daqui a um ano (marca Implicação).'),
  build({ ws }, plan, step) {
    const q = latestQuote(ws.diagnosis.quotes, 'implicacao');
    return { id: 'palavras', step, steps: plan.steps.length, quote: q ? q.text.trim() : '' };
  },
};

export const objetivo: SceneDef<ObjetivoVM> = {
  plan({ ws, content }) {
    if (!ws.lead.goal_12m.trim()) return locked('Sem objetivo de 12 meses na ficha.');
    return ready(content.necessidade_prioridades.length ? ['objetivo', 'prioridades'] : ['objetivo']);
  },
  build({ ws, content }, plan, step) {
    const r = revealedKeys(plan, step);
    const chosen = ws.diagnosis.call_data.needPriority;
    const q = latestQuote(ws.diagnosis.quotes, 'necessidade');
    return {
      id: 'objetivo',
      step,
      steps: plan.steps.length,
      goal: ws.lead.goal_12m.trim(),
      quote: q ? q.text.trim() : null,
      priorities: r.has('prioridades')
        ? content.necessidade_prioridades.map((p) => ({ label: p.rotulo, chosen: p.id === chosen }))
        : null,
    };
  },
};
