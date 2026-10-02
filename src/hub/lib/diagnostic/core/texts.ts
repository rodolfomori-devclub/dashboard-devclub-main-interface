/**
 * Textos prontos: variaveis dos roteiros da call, mensagens de WhatsApp para o
 * lead (porte de textoWa()) e a nota do CRM (porte de textoCrm()).
 */
import type { DiagnosisInput, DiagnosisModel, FilledTemplate, MaterialInfo, ScriptVarName, TemplateVars } from './types.ts';
import { areaPhrase, lowerKeepAcronyms as lower } from './content.ts';

const VAR_RE = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;

/**
 * Troca {{ chave }} pelo valor. null/undefined vira "[chave]" e entra em
 * `missing` (uma vez por chave, na ordem em que aparece). '' fica ''.
 */
export function fillTemplate(tpl: string, vars: TemplateVars): FilledTemplate {
  const missing: string[] = [];
  const text = String(tpl ?? '').replace(VAR_RE, (_match, key: string) => {
    const value = vars && Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : undefined;
    if (typeof value === 'string') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    if (!missing.includes(key)) missing.push(key);
    return `[${key}]`;
  });
  return { text, missing };
}

const clean = (s: string | null | undefined): string => (typeof s === 'string' ? s.trim() : '');
const orNull = (s: string | null | undefined): string | null => clean(s) || null;

/** Snapshots antigos (enviados antes de areaPhrase existir) caem no rotulo da area. */
function phraseOf(m: MaterialInfo): string {
  return m.areaPhrase || areaPhrase(m.areaLabel === 'sua área' ? '' : m.areaLabel);
}

/** Como citar o material de presente (aula so com link; sem link, o kit). */
export function materialPhrases(model: DiagnosisModel): { material: string; materialShort: string; gift: string } {
  const m = model.material;
  const area = phraseOf(m);
  if (m.type === 'aula') {
    return {
      material: m.lessonTitle ? `a aula "${m.lessonTitle}"` : `a aula de IA para ${area}`,
      materialShort: 'a aula da sua área',
      gift: `Aula: ${m.lessonTitle || 'IA aplicada à sua área'}`,
    };
  }
  return {
    material: `o kit de 3 prompts para ${area}`,
    materialShort: 'o kit de prompts da sua área',
    gift: `Kit de 3 prompts para ${area}`,
  };
}

/** Variaveis dos roteiros e perguntas da call. Sem dado -> null (vira [variavel] na tela). */
export function scriptVars(
  input: DiagnosisInput,
  model: DiagnosisModel,
  extra: { featuredQuote: string | null; aiUseAnswer: string | null; seatsClause: string; trava?: string | null },
): TemplateVars {
  const phrases = materialPhrases(model);
  const trigger = clean(input.lead.trigger);
  const aiUses = (input.lead.aiUses ?? []).map(clean).filter(Boolean).join(', ');
  const decision = input.sdr?.decisionScore;
  const travaPillar = model.blockers[0] ?? model.weakest;
  const vars: Record<ScriptVarName, string | null> = {
    nome: model.name ? model.firstName : null,
    consultor: orNull(input.consultant?.name),
    sdr: orNull(input.sdr?.name),
    tempo_cargo: orNull(model.timeInRole),
    gatilho: trigger ? `"${trigger}"` : null,
    como_usa_ia: orNull(extra.aiUseAnswer) ?? (aiUses ? lower(aiUses) : null),
    nota_decisao: typeof decision === 'number' && Number.isFinite(decision) ? String(decision) : null,
    pilar_forte: model.strongest ? lower(model.strongest.nome) : null,
    pilar_fraco: model.weakest ? lower(model.weakest.nome) : null,
    frase: orNull(extra.featuredQuote) ?? model.pdfQuotes[0] ?? null,
    causa_raiz: orNull(model.rootCause),
    movimento_1: model.plan[0]?.movimento_90_dias ?? null,
    area: orNull(model.area),
    material: phrases.material,
    material_curto: phrases.materialShort,
    objetivo: orNull(model.goal),
    data_compromisso: model.commitmentDueBR || null,
    trava: extra.trava ?? (travaPillar ? lower(travaPillar.nome) : null),
    clausula_vagas: extra.seatsClause ?? '',
  };
  return vars;
}

/** Texto do WhatsApp que acompanha o PDF (o PDF vai anexado a mao). */
export function deliveryMessage(model: DiagnosisModel): string {
  const due = model.commitmentDueBR;
  const bullets: string[] = [];
  if (model.total !== null) bullets.push(`• Seu Índice hoje: ${model.total}/25`);
  if (model.strongest) bullets.push(`• Ponto forte: ${model.strongest.nome}`);
  if (model.weakest) bullets.push(`• O que mais pesa: ${model.weakest.nome}`);
  if (model.commitmentText) bullets.push(`• Seu compromisso: ${model.commitmentText}, até ${due || '[data]'}`);

  const material =
    model.material.type === 'aula' && model.material.lessonUrl
      ? `Sua aula de presente: ${model.material.lessonUrl}`
      : `Na última página tem o seu kit de 3 prompts para ${phraseOf(model.material)}. Começa por ele, que ajuda direto no seu compromisso.`;

  return [
    `${model.firstName}, aqui está seu Diagnóstico de Carreira com IA 👇`,
    bullets.length ? ['Resumo:', ...bullets].join('\n') : '',
    material,
    `No dia ${due || 'combinado'} te chamo pra saber como foi.`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

const THANKS_TEMPLATE =
  '{{nome}}, obrigado pela conversa de hoje. Deu pra ver que você {{reconhecimento}}.\n' +
  'Estou montando seu diagnóstico por escrito. Te mando até {{hora}}, junto com {{material}}.';

/** Mensagem de H+0 (ate 30 min depois da call). */
export function thanksMessage(
  model: DiagnosisModel,
  opts: { recognition: string | null; deliverBy: string | null },
): FilledTemplate {
  return fillTemplate(THANKS_TEMPLATE, {
    nome: model.name ? model.firstName : null,
    reconhecimento: orNull(opts.recognition),
    hora: orNull(opts.deliverBy),
    material: materialPhrases(model).material,
  });
}

const GRADUATION_NOTE: Record<string, string> = {
  concluida: 'concluída',
  nao: 'não tem (Extensão)',
  cursando: 'cursando (não elegível)',
};

const dash = (s: string | number | null | undefined): string => {
  const value = typeof s === 'number' ? (Number.isFinite(s) ? String(s) : '') : clean(s);
  return value || '-';
};

/** Perfil para o CRM: o sugerido pela aplicacao vem marcado; sem perfil, "-". */
function archetypeNote(model: DiagnosisModel): string {
  if (model.archetypeSource === 'none') return '-';
  const name = dash(model.archetype?.nome);
  return model.archetypeSource === 'suggested' && name !== '-' ? `${name} (sugerido)` : name;
}

/** Nota interna para colar no CRM (Nold). Pode ter termos internos. */
export function crmNote(
  input: DiagnosisInput,
  model: DiagnosisModel,
  extra: { scholarshipStatus: 'none' | 'presented' | 'closed'; offerSummary: string | null; newsNames: string[] },
): string {
  const scores = model.pillars.map((r) => `${r.pillar.nome_curto} ${r.score ?? '-'}`).join(', ');
  const quotes = model.pdfQuotes.map((q) => `"${q}"`).join(' | ');
  const material =
    model.material.type === 'aula' && model.material.lessonUrl
      ? `aula ${model.material.lessonUrl}`
      : `kit de prompts ${model.material.areaLabel}`;
  let scholarship = 'não apresentada, retomar no dia do compromisso';
  if (extra.scholarshipStatus === 'closed') scholarship = 'FECHOU';
  else if (extra.scholarshipStatus === 'presented') scholarship = 'apresentada na call';
  else if (!model.eligible) scholarship = 'não se aplica (cursando graduação)';
  const news = (extra.newsNames ?? []).map(clean).filter(Boolean).join(', ');

  return [
    `DIAGNÓSTICO MBA | ${model.displayName} | ${dash(model.jobTitle)} | ${dash(model.timeInRole)} | ${dash(model.area)}`,
    `Graduação: ${GRADUATION_NOTE[input.lead.graduation] ?? 'não informada'}`,
    `Gatilho da aplicação: ${dash(input.lead.trigger)}`,
    `Nota de decisão (SDR): ${dash(input.sdr?.decisionScore)}`,
    `Arquétipo: ${archetypeNote(model)}`,
    `Objetivo 12m: ${dash(model.goal)}`,
    `Índice: ${model.total ?? '-'}/25 (${scores})`,
    `Frases do lead: ${quotes || '-'}`,
    `Causa raiz: ${dash(model.rootCause)}`,
    `Reportagens mostradas: ${news || '-'}`,
    `Compromisso: ${dash(model.commitmentText)} até ${model.commitmentDueBR || '-'}`,
    `Material: ${material}`,
    `Bolsa: ${scholarship}`,
    `Condição: ${dash(extra.offerSummary)}`,
    `Consultor: ${model.consultantName}`,
    `Próximo contato: ${model.commitmentDueBR || '-'}`,
  ].join('\n');
}
