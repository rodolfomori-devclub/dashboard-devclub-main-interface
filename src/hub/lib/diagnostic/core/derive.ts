/**
 * Regras do diagnostico (porte de derive() e das partes de dados de render()
 * em 03_referencia_gerador.html). Com nota faltando nada e calculado: o modelo
 * sai "a avaliar" (complete = false) em vez de inventar Indice ou plano.
 */
import type {
  ApplicationAnswers,
  Archetype,
  DiagnosisInput,
  DiagnosisModel,
  DiagnosticContent,
  Level,
  MaterialInfo,
  NewsItem,
  PillarId,
  PillarResult,
  ValidationIssue,
} from './types.ts';
import { PILLAR_ORDER } from './types.ts';
import { isValidYmd, ymdToBR } from './dates.ts';
import { archetypeById, areaDisplayName, areaGroup, areaPhrase, findNews, findPillar, hasNewsSource, lessonForGroup } from './content.ts';
import { suggestArchetype } from './archetype.ts';

export const LEVEL_LABEL: Record<Level, string> = {
  trava: 'Trava',
  em_construcao: 'Em construção',
  ponto_forte: 'Ponto forte',
};

const isScore = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 5;

/** Nota 1 ou 2 = trava, 3 = em construcao, 4 ou 5 = ponto forte (regra 4). */
export function levelOf(score: number | null): Level | null {
  if (!isScore(score)) return null;
  if (score <= 2) return 'trava';
  return score === 3 ? 'em_construcao' : 'ponto_forte';
}

const text = (s: string | null | undefined): string => (typeof s === 'string' ? s.trim() : '');

function own<T>(record: Record<string, T> | null | undefined, key: string): T | undefined {
  return record && Object.prototype.hasOwnProperty.call(record, key) ? record[key] : undefined;
}

/** Desempate explicito pela ordem fixa (regras 6 e 7), sem depender de sort estavel. */
function byScoreThenOrder(a: PillarResult, b: PillarResult): number {
  return (a.score ?? 0) - (b.score ?? 0) || PILLAR_ORDER.indexOf(a.pillar.id) - PILLAR_ORDER.indexOf(b.pillar.id);
}

function deriveMaterial(input: DiagnosisInput, content: DiagnosticContent): MaterialInfo {
  const group = areaGroup(content, input.lead.area);
  const lesson = lessonForGroup(content, group);
  const lessonUrl = text(input.lessonUrlOverride) || text(lesson?.url) || null;
  const kits = content.kits_de_prompts ?? {};
  const areaName = areaDisplayName(content, input.lead.area);
  return {
    type: lessonUrl ? 'aula' : 'kit',
    group,
    areaLabel: areaName || 'sua área',
    areaPhrase: areaPhrase(areaName),
    lessonTitle: lesson?.titulo ?? null,
    lessonUrl,
    kit: own(kits, group) ?? own(kits, 'generico') ?? [],
    pages: lessonUrl ? 2 : 3,
  };
}

/** Regra 10. Graduacao ainda nao informada usa o texto do MBA, como o gerador atual. */
function deriveCredential(input: DiagnosisInput, content: DiagnosticContent): string | null {
  const graduation = input.lead.graduation;
  if (graduation === 'cursando') return null;
  const texts = content.texto_credencial;
  return (graduation === 'nao' ? texts?.sem_graduacao : texts?.graduacao_concluida) ?? null;
}

/** Reportagens mostradas, na ordem, que tem link e vao no PDF (regra 12). */
function deriveReadLater(input: DiagnosisInput, content: DiagnosticContent): NewsItem[] {
  const out: NewsItem[] = [];
  for (const id of input.newsShownIds ?? []) {
    const item = findNews(content, id);
    if (item && hasNewsSource(item) && item.vai_no_pdf && !out.includes(item)) out.push(item);
  }
  return out;
}

/** Respostas da aplicacao guardadas no lead, no formato da sugestao de perfil. */
function applicationAnswers(lead: DiagnosisInput['lead']): ApplicationAnswers {
  return {
    area: lead.area,
    momento: lead.careerMoment,
    tempo_cargo: lead.timeInRoleBucket,
    ultima_promocao: lead.lastPromotion,
    gatilho: lead.trigger,
    objetivo: lead.goal,
    frequencia_ia: lead.aiFrequency,
    usos_ia: lead.aiUses,
    cargo: lead.jobTitle,
  };
}

/**
 * Perfil confirmado; sem ele, o sugerido pela aplicacao (o mesmo que a
 * preparacao mostra). Sem nenhum dos dois, o primeiro do conteudo fica so para
 * o tipo: a causa raiz entao depende do texto do consultor.
 */
function resolveArchetype(
  input: DiagnosisInput,
  content: DiagnosticContent,
): { archetype: Archetype; source: DiagnosisModel['archetypeSource'] } {
  const confirmed = archetypeById(content, input.archetypeId);
  if (confirmed) return { archetype: confirmed, source: 'confirmed' };
  const suggestion = suggestArchetype(applicationAnswers(input.lead), content);
  const suggested = suggestion.score > 0 ? archetypeById(content, suggestion.id) : null;
  if (suggested) return { archetype: suggested, source: 'suggested' };
  return { archetype: (content.arquetipos ?? [])[0], source: 'none' };
}

export function deriveDiagnosis(input: DiagnosisInput, content: DiagnosticContent): DiagnosisModel {
  const pillars: PillarResult[] = [];
  const missingScores: PillarId[] = [];
  for (const id of PILLAR_ORDER) {
    const pillar = findPillar(content, id);
    const raw = input.scores ? input.scores[id] : null;
    const score = isScore(raw) ? raw : null;
    if (!pillar || score === null) missingScores.push(id);
    if (pillar) pillars.push({ pillar, score, level: levelOf(score) });
  }

  const complete = missingScores.length === 0;
  const ordered = complete ? [...pillars].sort(byScoreThenOrder) : [];
  const allEqual = complete && ordered[0].score === ordered[ordered.length - 1].score;
  const ranked = complete && !allEqual;

  const { archetype, source } = resolveArchetype(input, content);
  const eligible = input.lead.graduation !== 'cursando';
  const name = text(input.lead.name);
  const pdfQuotes = (input.quotes ?? [])
    .filter((q) => q && q.inPdf && text(q.text))
    .map((q) => text(q.text))
    .slice(0, 3);

  return {
    complete,
    missingScores,
    name,
    displayName: name || '[Nome]',
    firstName: name ? name.split(/\s+/)[0] : '[Nome]',
    consultantName: text(input.consultant?.name) || '[Consultor]',
    consultantWhatsapp: text(input.consultant?.whatsapp),
    jobTitle: text(input.lead.jobTitle),
    timeInRole: text(input.lead.timeInRoleText) || text(input.lead.timeInRoleBucket),
    area: areaDisplayName(content, input.lead.area),
    goal: text(input.lead.goal),
    dateBR: ymdToBR(input.dateYmd),
    pillars,
    ordered,
    total: complete ? pillars.reduce((sum, r) => sum + (r.score ?? 0), 0) : null,
    strongest: ranked ? ordered[ordered.length - 1].pillar : null,
    weakest: ranked ? ordered[0].pillar : null,
    plan: ordered.slice(0, 3).map((r) => r.pillar),
    blockers: ordered.filter((r) => (r.score ?? 0) <= 2).map((r) => r.pillar),
    archetype,
    archetypeSource: source,
    rootCause: text(input.rootCauseOverride) || (source === 'none' ? '' : (archetype?.causa_raiz ?? '')),
    pdfQuotes,
    material: deriveMaterial(input, content),
    eligible,
    credential: deriveCredential(input, content),
    readLater: deriveReadLater(input, content),
    path: content.caminho_12_meses,
    commitmentText: text(input.commitment?.text),
    commitmentDueBR: ymdToBR(input.commitment?.dueDate ?? ''),
    // Regra 10: quem esta cursando nunca recebe condicao de bolsa, nem por escrito.
    conditionLine: eligible ? input.conditionLine : null,
    disclaimer: content.aviso_legal,
  };
}

/** 'A', 'A e B', 'A, B e C'. */
function joinPt(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`;
}

/** O que falta para gerar o PDF e marcar como enviado. Vazio = pronto. */
export function validateForDelivery(input: DiagnosisInput, model: DiagnosisModel): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!model.name) issues.push({ field: 'name', message: 'Falta o nome do lead.' });
  if (!model.commitmentText) {
    issues.push({ field: 'commitmentText', message: 'Falta o compromisso de ação. Ele é o motivo do próximo contato.' });
  }
  const due = text(input.commitment?.dueDate);
  if (!due) issues.push({ field: 'commitmentDueDate', message: 'Falta a data do compromisso.' });
  else if (!isValidYmd(due)) issues.push({ field: 'commitmentDueDate', message: 'A data do compromisso não é válida.' });
  if (model.missingScores.length) {
    const names = model.missingScores.map((id) => model.pillars.find((r) => r.pillar.id === id)?.pillar.nome_curto ?? id);
    issues.push({
      field: 'scores',
      message: names.length === 1 ? `Falta a nota de ${names[0]}.` : `Faltam as notas de ${joinPt(names)}.`,
    });
  }
  if (!input.lead.graduation) {
    issues.push({ field: 'graduation', message: 'Falta confirmar a graduação. Ela define a credencial que vai no PDF.' });
  }
  if (!text(model.rootCause)) {
    issues.push({
      field: 'rootCause',
      message: 'Falta a causa raiz: confirme o perfil na preparação ou escreva a causa raiz.',
    });
  }
  if (!text(input.consultant?.name)) {
    issues.push({ field: 'consultant', message: 'Falta o nome do consultor: ele vai no PDF.' });
  }
  if (model.material.type === 'aula') {
    const value = text(model.material.lessonUrl);
    let valid = false;
    try {
      const url = new URL(value);
      valid = ['https:', 'http:'].includes(url.protocol) && url.hostname.includes('.') && !/\s/.test(value);
    } catch { /* An incomplete or unsupported URL cannot be delivered as a gift. */ }
    if (!valid) issues.push({ field: 'lessonUrl', message: 'O link da aula não é válido: corrija o endereço completo ou remova-o para entregar o kit de prompts.' });
  }
  return issues;
}
