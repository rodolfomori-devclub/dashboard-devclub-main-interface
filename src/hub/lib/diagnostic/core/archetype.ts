/**
 * Sugestoes da preparacao: perfil a partir da aplicacao, reportagens, diferenciais
 * a mostrar primeiro e os pares "sua trava, como a pos resolve" do Caminho completo.
 */
import type {
  ApplicationAnswers,
  ArchetypeSignal,
  ArchetypeSignalField,
  ArchetypeSuggestion,
  DiagnosisModel,
  DiagnosticContent,
  Graduation,
  NeedPriorityId,
  PathPair,
  Pillar,
  PillarId,
} from './types.ts';
import { archetypeById, findNews, findPillar } from './content.ts';
import { findForbidden, normalizeText } from './guardrails.ts';

const MAX_NEWS = 2;
const MAX_DIFFERENTIALS = 3;
const MAX_PATH_PAIRS = 3;
// Mesmo texto do paragrafo do programa no PDF.
const CRED_SUFFIX = ', extensão pela Arizona State University e mais de 30 certificações internacionais.';

const squash = (s: string): string => normalizeText(s ?? '').replace(/\s+/g, ' ').trim();

/** Alguma das palavras aparece inteira no texto (mesma regra do verificador de palavras). */
const hasWholeWord = (text: string, words: string[]): boolean =>
  findForbidden(text, { palavras: words, frases: [], promessas: [] }).length > 0;

function canonicalArea(content: DiagnosticContent, value: string): string {
  const key = squash(value);
  for (const [alias, target] of Object.entries(content.areas_aliases ?? {})) {
    if (squash(alias) === key) return squash(target);
  }
  return key;
}

type SingleChoiceField = Exclude<ArchetypeSignalField, 'cargo' | 'usos_ia'>;

const REASON: Record<SingleChoiceField, (answer: string) => string> = {
  area: (a) => `Área: ${a}`,
  momento: (a) => `Marcou "${a}"`,
  tempo_cargo: (a) => `Tempo no cargo: ${a}`,
  ultima_promocao: (a) => `Última promoção: ${a}`,
  gatilho: (a) => `Marcou "${a}"`,
  objetivo: (a) => `Objetivo: ${a}`,
  frequencia_ia: (a) => `Frequência de IA: ${a}`,
};

/** Motivo curto quando o sinal bate com a aplicacao; null quando nao bate. */
function matchSignal(signal: ArchetypeSignal, answers: ApplicationAnswers, content: DiagnosticContent): string | null {
  const values = (signal.valores ?? []).filter((v) => typeof v === 'string' && squash(v) !== '');
  if (!values.length) return null;
  if (signal.campo === 'cargo') {
    const cargo = String(answers.cargo ?? '').trim();
    return cargo && hasWholeWord(cargo, values) ? `Cargo: ${cargo}` : null;
  }
  if (signal.campo === 'usos_ia') {
    const wanted = new Set(values.map(squash));
    const hits = (answers.usos_ia ?? []).filter((use) => typeof use === 'string' && wanted.has(squash(use)));
    return hits.length ? `Usa IA para: ${[...new Set(hits)].join(', ')}` : null;
  }
  const field = signal.campo;
  const answer = String(answers[field] ?? '').trim();
  if (!squash(answer)) return null;
  const hit =
    field === 'area'
      ? values.some((v) => canonicalArea(content, v) === canonicalArea(content, answer) || squash(v) === squash(answer))
      : values.some((v) => squash(v) === squash(answer));
  if (!hit) return null;
  const reason = REASON[field];
  return reason ? reason(answer) : `Marcou "${answer}"`;
}

/** Perfil sugerido pela aplicacao. Empate: content.arquetipos_desempate. Nada bateu: o primeiro perfil. */
export function suggestArchetype(answers: ApplicationAnswers, content: DiagnosticContent): ArchetypeSuggestion {
  const archetypes = content.arquetipos ?? [];
  const scores: Record<string, number> = {};
  const evaluated = archetypes.map((archetype, index) => {
    let score = 0;
    const reasons: string[] = [];
    for (const signal of archetype.sinais ?? []) {
      const reason = matchSignal(signal, answers, content);
      if (!reason) continue;
      score += Number(signal.pontos) || 0;
      reasons.push(reason);
    }
    scores[archetype.id] = score;
    return { id: archetype.id, score, reasons, index };
  });

  const best = Math.max(0, ...evaluated.map((e) => e.score));
  if (best <= 0) return { id: archetypes[0]?.id ?? '', score: 0, reasons: [], scores };

  const tieOrder = content.arquetipos_desempate ?? [];
  const rank = (id: string) => (tieOrder.includes(id) ? tieOrder.indexOf(id) : tieOrder.length);
  const winner = evaluated
    .filter((e) => e.score === best)
    .sort((a, b) => rank(a.id) - rank(b.id) || a.index - b.index)[0];
  return { id: winner.id, score: winner.score, reasons: winner.reasons, scores };
}

/** Ate 2 reportagens: na tela as que podem (na_tela e com link), as outras so faladas. */
export function suggestNews(
  content: DiagnosticContent,
  archetypeId: string,
  fearful: boolean,
): { screen: string[]; spoken: string[] } {
  const byArchetype = content.reportagens_por_arquetipo ?? {};
  const forArchetype = Object.prototype.hasOwnProperty.call(byArchetype, archetypeId) ? byArchetype[archetypeId] : [];
  const source = fearful ? content.reportagens_lead_com_medo : forArchetype;
  const screen: string[] = [];
  const spoken: string[] = [];
  for (const id of source ?? []) {
    if (screen.length + spoken.length >= MAX_NEWS) break;
    const item = findNews(content, id);
    if (!item || screen.includes(id) || spoken.includes(id)) continue;
    (item.na_tela && item.url ? screen : spoken).push(id);
  }
  return { screen, spoken };
}

/**
 * Ate 3 diferenciais a mostrar primeiro. A prioridade que o lead escolheu ("o que
 * pesa mais") define o primeiro (playbook, bloco N). Com as 5 notas, o resto vem
 * pela pontuacao (+3 resolve o que mais pesa, +2 resolve uma trava, +2 esta na
 * prioridade, +1 e do perfil). Sem as notas: os da prioridade e depois os do perfil.
 */
export function suggestDifferentials(
  content: DiagnosticContent,
  model: DiagnosisModel | null,
  archetypeId: string,
  needPriority: NeedPriorityId | null,
): string[] {
  const all = content.diferenciais ?? [];
  // Sem perfil gravado, o perfil do diagnostico (confirmado ou sugerido), nunca o primeiro da lista.
  const fromModel = model && model.archetypeSource !== 'none' ? model.archetype : null;
  const archetypeIds = (archetypeById(content, archetypeId) ?? fromModel)?.diferenciais_ids ?? [];
  const priority = needPriority ? (content.necessidade_prioridades ?? []).find((n) => n.id === needPriority) : undefined;
  const priorityIds = priority?.diferenciais ?? [];

  if (model && model.complete) {
    const blockerIds = new Set<string>(model.blockers.map((p) => p.id));
    const ranked = all
      .map((d, index) => {
        let score = 0;
        if (model.weakest && d.resolve === model.weakest.id) score += 3;
        if (blockerIds.has(d.resolve)) score += 2;
        if (priorityIds.includes(d.id)) score += 2;
        if (archetypeIds.includes(d.id)) score += 1;
        return { id: d.id, score, index };
      })
      .filter((d) => d.score > 0)
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .map((d) => d.id);
    const first = ranked.find((id) => priorityIds.includes(id));
    const ids = first ? [first, ...ranked.filter((id) => id !== first)] : ranked;
    return ids.slice(0, MAX_DIFFERENTIALS);
  }

  const known = new Set(all.map((d) => d.id));
  const out: string[] = [];
  for (const id of [...priorityIds, ...archetypeIds]) {
    if (known.has(id) && !out.includes(id)) out.push(id);
  }
  return out.slice(0, MAX_DIFFERENTIALS);
}

/** Credencial por graduacao, sem nunca citar as duas juntas. */
function resolvesFor(content: DiagnosticContent, pillar: Pillar, graduation: Graduation): string {
  if (pillar.id !== 'cred') return pillar.onde_o_mba_resolve;
  const texts = content.texto_credencial;
  const base = ((graduation === 'nao' ? texts?.sem_graduacao : texts?.graduacao_concluida) ?? '').trim();
  if (!base) return pillar.onde_o_mba_resolve;
  return base.charAt(0).toUpperCase() + base.slice(1) + CRED_SUFFIX;
}

/**
 * Pares da cena "Caminho completo": ate 3 travas, as da prioridade que o lead
 * escolheu primeiro; sem trava, os pilares dessa prioridade; sem prioridade, os
 * 3 pilares do plano.
 */
export function pathPairs(
  content: DiagnosticContent,
  model: DiagnosisModel,
  needPriority: NeedPriorityId | null,
  graduation: Graduation,
): PathPair[] {
  if (!model.complete) return [];
  const priority = needPriority ? (content.necessidade_prioridades ?? []).find((n) => n.id === needPriority) : undefined;
  const chosen: PillarId[] = priority?.pilares ?? [];
  let kind: PathPair['kind'] = 'trava';
  let pillars: Pillar[] = [
    ...model.blockers.filter((p) => chosen.includes(p.id)),
    ...model.blockers.filter((p) => !chosen.includes(p.id)),
  ];
  if (!pillars.length && chosen.length) {
    kind = 'prioridade';
    pillars = chosen.map((id) => findPillar(content, id)).filter((p): p is Pillar => p !== null);
  }
  if (!pillars.length) {
    kind = 'plano';
    pillars = model.plan;
  }
  return pillars.slice(0, MAX_PATH_PAIRS).map((p) => ({
    pillarId: p.id,
    label: p.nome,
    resolves: resolvesFor(content, p, graduation),
    kind,
  }));
}
