/**
 * Cenas de resultado e de fechamento: devolutiva, plano, caminho, proximo
 * passo, bolsa e encerramento. Mesmo calculo do PDF (DiagnosisModel). A bolsa
 * so usa o que a oferta ja filtrou pelas regras de verdade (OfferView).
 */
import type { Level, PathPair, PillarResult } from '@diag/types.ts';
import { pathPairs as sharedPathPairs } from '@diag/archetype.ts';
import type {
  BolsaVM,
  CaminhoView,
  CaminhoVM,
  DevolutivaView,
  DevolutivaVM,
  EncerramentoVM,
  PathPairVM,
  PlanoView,
  PlanoVM,
  ProximoVM,
} from '@/lib/diagnostic/presentation';
import {
  commitmentOf,
  credentialOf,
  formatPhoneBR,
  giftOf,
  latestQuote,
  locked,
  missingScoresReason,
  programLine,
  ready,
  revealedKeys,
  seatsLineOf,
  wrapWords,
  type LeadViewContext,
  type SceneDef,
} from '@/lib/diagnostic/leadViewShared';

const MAP_HINT_CHARS = 27;
const MAX_PAIRS = 3;
// Sem graduacao confirmada nao se sabe a credencial nem se ele pode ver a pos e a bolsa.
const GRADUATION_FIRST = 'Confirme a graduação antes: ela define o que pode ser mostrado.';
const ROOT_CAUSE_MISSING = 'Falta a causa raiz: confirme o perfil na preparação ou escreva a causa na devolutiva.';

type ScoredPillar = PillarResult & { score: number; level: Level };

const graduationUnknown = ({ ws }: LeadViewContext) => !ws.lead.graduation_status;

export const devolutiva: SceneDef<DevolutivaVM> = {
  plan({ model, content }) {
    if (!model.complete) return locked(missingScoresReason(model, content));
    if (!model.rootCause.trim()) return locked(ROOT_CAUSE_MISSING);
    const steps: DevolutivaView[] = [];
    if (model.pdfQuotes.length) steps.push('frases');
    if (model.strongest || model.weakest) steps.push('forte');
    steps.push('travando', 'indice', 'mapa', 'retrato');
    return ready(steps);
  },
  build({ model }, plan, step) {
    const r = revealedKeys(plan, step);
    const scored = model.pillars.filter((p): p is ScoredPillar => p.score != null && p.level != null);
    return {
      id: 'devolutiva',
      step,
      steps: plan.steps.length,
      view: plan.steps[step] as DevolutivaView,
      quotes: r.has('frases') ? [...model.pdfQuotes] : null,
      strong: r.has('forte') ? model.strongest?.nome ?? null : null,
      weighs: r.has('forte') ? model.weakest?.nome ?? null : null,
      rootCause: r.has('travando') ? model.rootCause : null,
      blockers: r.has('travando') ? model.blockers.map((p) => ({ name: p.nome, text: p.texto_trava })) : null,
      total: r.has('indice') ? model.total : null,
      bars: r.has('indice')
        ? scored.map((p) => ({ name: p.pillar.nome, short: p.pillar.nome_curto, score: p.score, level: p.level }))
        : null,
      map: r.has('mapa')
        ? {
            goal: model.goal,
            nodes: scored.map((p) => ({
              short: p.pillar.nome_curto,
              score: p.score,
              level: p.level,
              hint:
                p.level === 'ponto_forte'
                  ? 'Manter e mostrar'
                  : `${wrapWords(p.pillar.movimento_90_dias, MAP_HINT_CHARS)[0] ?? ''}…`,
            })),
          }
        : null,
    };
  },
};

export const plano: SceneDef<PlanoVM> = {
  plan({ ws, model, content }) {
    if (!model.complete || !model.plan.length) return locked(missingScoresReason(model, content));
    const c = commitmentOf(ws);
    const steps = model.plan.map((_, i) => `m${i}`);
    steps.push('seu');
    if (c.text && c.due) steps.push('compromisso');
    steps.push('material');
    return ready(steps);
  },
  build({ ws, model }, plan, step) {
    const r = revealedKeys(plan, step);
    const key = plan.steps[step];
    const view: PlanoView = key === 'compromisso' ? 'compromisso' : key === 'material' ? 'material' : 'movimentos';
    const c = commitmentOf(ws);
    const consultant = ws.diagnosis.consultant_name.trim();
    const gift = giftOf(model.material);
    return {
      id: 'plano',
      step,
      steps: plan.steps.length,
      view,
      movements: model.plan.filter((_, i) => r.has(`m${i}`)).map((p) => p.movimento_90_dias),
      ownLine: r.has('seu')
        ? model.eligible
          ? 'Esse plano é seu e funciona com ou sem a pós.'
          : 'Esse plano é seu.'
        : null,
      commitment: r.has('compromisso')
        ? {
            text: c.text,
            due: c.due,
            contactLine: `Até ${c.due}. ${consultant || 'Seu consultor'} vai falar com você nesse dia.`,
          }
        : null,
      gift: r.has('material') ? { title: gift.title, detail: gift.detail, items: gift.items } : null,
    };
  },
};

const PAIR_CAPTION: Record<PathPair['kind'], string> = {
  trava: 'Sua trava',
  prioridade: 'O que pesa mais para você',
  plano: 'Para fortalecer',
};

/**
 * Ate 3 pares trava -> como a pos resolve (a prioridade escolhida vem primeiro).
 * A regra e a mesma do cockpit: @diag/archetype.ts pathPairs.
 */
export function pathPairs(ctx: LeadViewContext): PathPairVM[] {
  const { ws, model, content } = ctx;
  return sharedPathPairs(content, model, ws.diagnosis.call_data.needPriority, ws.lead.graduation_status)
    .slice(0, MAX_PAIRS)
    .map((p) => ({ caption: PAIR_CAPTION[p.kind], label: p.label, resolves: p.resolves }));
}

export const caminho: SceneDef<CaminhoVM> = {
  plan(ctx) {
    if (!ctx.model.eligible) return locked('Não apresente a pós para quem está cursando graduação.');
    if (graduationUnknown(ctx)) return locked(GRADUATION_FIRST);
    if (!ctx.ws.diagnosis.call_data.pathPermitted) return locked('Peça permissão antes: "Posso te mostrar como funciona?"');
    return ready(['trilha', ...pathPairs(ctx).map((_, i) => `p${i}`), 'programa']);
  },
  build(ctx, plan, step) {
    const r = revealedKeys(plan, step);
    const key = plan.steps[step];
    const view: CaminhoView = key === 'trilha' ? 'trilha' : key === 'programa' ? 'programa' : 'pares';
    const pairs = pathPairs(ctx).filter((_, i) => r.has(`p${i}`));
    return {
      id: 'caminho',
      step,
      steps: plan.steps.length,
      view,
      goal: ctx.ws.lead.goal_12m.trim() || null,
      quarters: ctx.content.caminho_12_meses.map((q) => ({ period: q.periodo, title: q.titulo, description: q.descricao })),
      pairs: pairs.length ? pairs : null,
      program: r.has('programa') ? programLine(credentialOf(ctx)) : null,
    };
  },
};

export const proximo: SceneDef<ProximoVM> = {
  plan: () => ready(['proximo']),
  build(ctx, plan, step) {
    const { ws, model, offer } = ctx;
    const due = commitmentOf(ws).due;
    const day = due || 'combinado';
    const base = { id: 'proximo' as const, step, steps: plan.steps.length };
    // Cursando graduacao (sem pos), graduacao ainda nao confirmada ou turma sem bolsas: caminho unico.
    if (!model.eligible || graduationUnknown(ctx) || offer.view.soldOut) {
      return { ...base, options: [], single: `Você recebe o diagnóstico hoje, e a gente conversa no dia ${day}.`, seatsLine: null };
    }
    const choice = ws.diagnosis.call_data.nextStepChoice;
    return {
      ...base,
      options: [
        { label: 'Ver agora como funciona a bolsa', chosen: choice === 'bolsa' },
        { label: `Receber o diagnóstico e conversar no dia ${day}`, chosen: choice === 'esperar' },
      ],
      single: null,
      seatsLine: seatsLineOf(offer.view),
    };
  },
};

function bolsaSteps({ offer }: LeadViewContext): string[] {
  const v = offer.view;
  const steps: string[] = [];
  if (v.anchor != null) steps.push('ancora');
  if (v.finalPrice != null) steps.push('valor');
  if (v.paths.length) steps.push('caminhos');
  if (seatsLineOf(v) || v.validUntilBR) steps.push('condicoes');
  return steps;
}

export const bolsa: SceneDef<BolsaVM> = {
  plan(ctx) {
    const { ws, model, offer } = ctx;
    if (!model.eligible) return locked('Quem está cursando graduação não entra na bolsa.');
    if (graduationUnknown(ctx)) return locked(GRADUATION_FIRST);
    if (!ws.diagnosis.offer_requested_at) return locked('Bolsa só se ele pedir: registre o pedido antes.');
    if (!ws.diagnosis.call_data.costStated && !latestQuote(ws.diagnosis.quotes, 'implicacao')) {
      return locked('Antes do preço, ele precisa dizer o custo de ficar como está (Implicação).');
    }
    if (offer.view.soldOut) return locked('Sem bolsas restantes nesta turma.');
    if (offer.view.finalPrice == null && !offer.view.paths.length) {
      return locked('Monte a oferta na preparação: valor com bolsa ou caminhos de pagamento.');
    }
    return ready(bolsaSteps(ctx));
  },
  build({ offer }, plan, step) {
    const r = revealedKeys(plan, step);
    const v = offer.view;
    return {
      id: 'bolsa',
      step,
      steps: plan.steps.length,
      anchor: r.has('ancora') ? v.anchor : null,
      finalPrice: r.has('valor') ? v.finalPrice : null,
      discount: r.has('valor') ? v.discount : null,
      paths: r.has('caminhos')
        ? v.paths.map((p) => ({ label: p.label, installments: p.installments, installmentValue: p.installmentValue, total: p.total }))
        : null,
      seatsLine: r.has('condicoes') ? seatsLineOf(v) : null,
      validityLine: r.has('condicoes') && v.validUntilBR ? `Condição válida até ${v.validUntilBR}.` : null,
    };
  },
};

/** A bolsa ja mostrou valor ou caminhos (nao so o preco de tabela) neste passo. */
export function offerRevealedAt(ctx: LeadViewContext, step: number): boolean {
  const plan = bolsa.plan(ctx);
  if (plan.reason) return false;
  const r = revealedKeys(plan, step);
  return r.has('valor') || r.has('caminhos');
}

export const encerramento: SceneDef<EncerramentoVM> = {
  plan: () => ready(['combinado']),
  build({ ws, model }, plan, step) {
    const c = commitmentOf(ws);
    const name = ws.diagnosis.consultant_name.trim();
    const phone = formatPhoneBR(ws.diagnosis.consultant_whatsapp);
    return {
      id: 'encerramento',
      step,
      steps: plan.steps.length,
      commitment: c.text ? { text: c.text, due: c.due || null } : null,
      delivery: `Você recebe hoje no WhatsApp: diagnóstico por escrito e ${giftOf(model.material).phrase}.`,
      consultant: name ? { name, whatsapp: phone || null } : null,
    };
  },
};
