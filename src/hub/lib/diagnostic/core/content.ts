/**
 * Leitura do conteudo do diagnostico (pilares, perfis, areas, aulas, kits,
 * reportagens) e a validacao de forma antes de publicar uma versao.
 */
import type { Archetype, CallBlockId, DiagnosticContent, Lesson, NewsItem, Pillar } from './types.ts';
import { PILLAR_ORDER } from './types.ts';
import { normalizeText } from './guardrails.ts';

const GENERIC_GROUP = 'generico';

const squash = (s: string): string => normalizeText(s).replace(/\s+/g, ' ').trim();

function own<T>(record: Record<string, T> | null | undefined, key: string): T | undefined {
  return record && Object.prototype.hasOwnProperty.call(record, key) ? record[key] : undefined;
}

export function findPillar(content: DiagnosticContent, id: string): Pillar | null {
  return (content.pilares ?? []).find((p) => p.id === id) ?? null;
}

/** Perfil pelo id exato; null quando o id e vazio ou desconhecido. */
export function archetypeById(content: DiagnosticContent, id: string): Archetype | null {
  return (content.arquetipos ?? []).find((a) => a.id === id) ?? null;
}

/**
 * Perfil pelo id; sem id conhecido, o primeiro do conteudo (para selects).
 * O diagnostico nao usa este fallback: ver resolveArchetype em derive.ts.
 */
export function findArchetype(content: DiagnosticContent, id: string): Archetype {
  return archetypeById(content, id) ?? (content.arquetipos ?? [])[0];
}

export function findNews(content: DiagnosticContent, id: string): NewsItem | null {
  return (content.reportagens ?? []).find((n) => n.id === id) ?? null;
}

/**
 * Grupo de material da area (kit e aula). Aplica os apelidos da aplicacao
 * ('Tenho meu próprio negócio' -> 'Negócio próprio'). Desconhecida ou vazia -> 'generico'.
 */
export function areaGroup(content: DiagnosticContent, area: string): string {
  const key = squash(area ?? '');
  if (!key) return GENERIC_GROUP;
  let name = key;
  for (const [alias, target] of Object.entries(content.areas_aliases ?? {})) {
    if (squash(alias) === key) {
      name = squash(target);
      break;
    }
  }
  const entry = (content.areas ?? []).find((a) => squash(a.nome) === name);
  return entry?.grupo_material || GENERIC_GROUP;
}

export function lessonForGroup(content: DiagnosticContent, group: string): Lesson | null {
  return own(content.aulas_por_grupo, group) ?? null;
}

/** Opcoes da aplicacao que nao sao nome de area. */
const NOT_AN_AREA = new Set(['outra', 'outro', 'outras']);
const OWN_BUSINESS = squash('Negócio próprio');

/**
 * Nome da area para exibir: aplica os apelidos da aplicacao
 * ('Tenho meu próprio negócio' -> 'Negócio próprio'); 'Outra' ou vazio -> ''.
 */
export function areaDisplayName(content: DiagnosticContent, area: string): string {
  const raw = (area ?? '').trim();
  const key = squash(raw);
  if (!key || NOT_AN_AREA.has(key)) return '';
  for (const [alias, target] of Object.entries(content.areas_aliases ?? {})) {
    if (squash(alias) === key) return target.trim();
  }
  return raw;
}

/** Minusculas mantendo siglas: 'Domínio prático de IA' -> 'domínio prático de IA', 'RH' -> 'RH'. */
export function lowerKeepAcronyms(s: string): string {
  return s
    .split(' ')
    .map((word) => {
      const letters = word.replace(/[^\p{L}]/gu, '');
      const acronym = letters.length >= 2 && letters === letters.toUpperCase() && letters !== letters.toLowerCase();
      return acronym ? word : word.toLowerCase();
    })
    .join(' ');
}

/** A area no meio da frase ("kit de 3 prompts para ..."): 'financeiro', 'TI', 'o seu negócio', 'a sua área'. */
export function areaPhrase(displayName: string): string {
  const name = (displayName ?? '').trim();
  if (!name) return 'a sua área';
  if (squash(name) === OWN_BUSINESS) return 'o seu negócio';
  return lowerKeepAcronyms(name);
}

// ---------------------------------------------------------------------------
// Validacao de forma (antes de publicar)
// ---------------------------------------------------------------------------

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isText = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';
const isTextList = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');
const objects = (v: unknown): Obj[] => (Array.isArray(v) ? v.map((x) => (isObj(x) ? x : {})) : []);

const PILLAR_TEXT_FIELDS = [
  'nome',
  'nome_curto',
  'pergunta_que_revela',
  'guia_consultor',
  'texto_trava',
  'texto_em_construcao',
  'texto_ponto_forte',
  'causa_provavel',
  'movimento_90_dias',
  'onde_o_mba_resolve',
];

const CALL_BLOCK_ORDER: CallBlockId[] = [
  'abertura',
  'situacao',
  'reportagem',
  'problema',
  'implicacao',
  'necessidade',
  'devolutiva',
  'pitch',
  'proximo',
];

function checkPillars(value: unknown, problems: string[]): void {
  if (!Array.isArray(value) || value.length !== PILLAR_ORDER.length) {
    const count = Array.isArray(value) ? value.length : 0;
    problems.push(`Os pilares precisam ser exatamente 5 (hoje: ${count}).`);
    return;
  }
  objects(value).forEach((p, i) => {
    const expected = PILLAR_ORDER[i];
    if (p.id !== expected) {
      problems.push(`O ${i + 1}º pilar precisa ter o id "${expected}" (ordem fixa: ${PILLAR_ORDER.join(', ')}).`);
    }
    const label = isText(p.id) ? p.id : String(i + 1);
    for (const field of PILLAR_TEXT_FIELDS) {
      if (!isText(p[field])) problems.push(`Pilar "${label}": falta o texto "${field}".`);
    }
  });
}

function checkArchetypes(value: unknown, problems: string[]): Set<string> {
  const ids = new Set<string>();
  if (!Array.isArray(value) || value.length === 0) {
    problems.push('Cadastre pelo menos um perfil (arquetipos).');
    return ids;
  }
  objects(value).forEach((a, i) => {
    if (!isText(a.id)) {
      problems.push(`Perfil ${i + 1}: falta o id.`);
      return;
    }
    if (ids.has(a.id)) problems.push(`O perfil "${a.id}" está repetido.`);
    ids.add(a.id);
    if (!isText(a.nome)) problems.push(`Perfil "${a.id}": falta o nome.`);
    if (!isText(a.causa_raiz)) problems.push(`Perfil "${a.id}": falta a causa raiz (causa_raiz).`);
  });
  return ids;
}

function checkKits(content: Obj, problems: string[]): void {
  const groups = new Set<string>([GENERIC_GROUP]);
  if (Array.isArray(content.areas)) {
    for (const area of objects(content.areas)) {
      if (isText(area.grupo_material)) groups.add(area.grupo_material);
      else problems.push(`Área "${isText(area.nome) ? area.nome : '?'}": falta o grupo de material.`);
    }
  } else {
    problems.push('Falta a lista de áreas (areas).');
  }
  const kits = isObj(content.kits_de_prompts) ? content.kits_de_prompts : {};
  for (const group of groups) {
    const kit = own(kits, group);
    if (!Array.isArray(kit)) {
      problems.push(
        group === GENERIC_GROUP
          ? 'Falta o kit de prompts "generico", usado quando a área não tem kit próprio.'
          : `Falta o kit de prompts do grupo "${group}".`,
      );
      continue;
    }
    if (kit.length !== 3) problems.push(`O kit "${group}" precisa ter exatamente 3 prompts (hoje: ${kit.length}).`);
    objects(kit).forEach((item, i) => {
      if (!isText(item.titulo) || !isText(item.prompt)) problems.push(`Kit "${group}", prompt ${i + 1}: falta título ou texto.`);
    });
  }
}

function checkCallBlocks(value: unknown, problems: string[]): void {
  const blocks = isObj(value) ? value.blocos : undefined;
  const ids = objects(blocks).map((b) => b.id);
  const ok = ids.length === CALL_BLOCK_ORDER.length && CALL_BLOCK_ORDER.every((id, i) => ids[i] === id);
  if (!ok) problems.push(`A call precisa ter os 9 blocos, nesta ordem: ${CALL_BLOCK_ORDER.join(', ')}.`);
}

function checkNews(value: unknown, problems: string[]): Set<string> {
  const ids = new Set<string>();
  if (!Array.isArray(value)) {
    problems.push('Falta a lista de reportagens (reportagens).');
    return ids;
  }
  objects(value).forEach((n, i) => {
    if (!isText(n.id)) {
      problems.push(`Reportagem ${i + 1}: falta o id.`);
      return;
    }
    if (ids.has(n.id)) problems.push(`A reportagem "${n.id}" está repetida.`);
    ids.add(n.id);
    if (n.na_tela === true && !isText(n.url)) problems.push(`A reportagem "${n.id}" está marcada para a tela, mas não tem link.`);
  });
  return ids;
}

function checkNewsRefs(content: Obj, archetypeIds: Set<string>, newsIds: Set<string>, problems: string[]): void {
  const byArchetype = content.reportagens_por_arquetipo;
  if (!isObj(byArchetype)) {
    problems.push('Falta o mapa de reportagens por perfil (reportagens_por_arquetipo).');
  } else {
    for (const [key, ids] of Object.entries(byArchetype)) {
      if (!archetypeIds.has(key)) problems.push(`reportagens_por_arquetipo: "${key}" não é um perfil cadastrado.`);
      if (!isTextList(ids)) {
        problems.push(`reportagens_por_arquetipo["${key}"] precisa ser uma lista de ids.`);
        continue;
      }
      for (const id of ids) {
        if (!newsIds.has(id)) problems.push(`reportagens_por_arquetipo["${key}"]: a reportagem "${id}" não existe.`);
      }
    }
  }
  const fearful = content.reportagens_lead_com_medo;
  if (fearful === undefined) return;
  if (!isTextList(fearful)) {
    problems.push('reportagens_lead_com_medo precisa ser uma lista de ids.');
    return;
  }
  for (const id of fearful) {
    if (!newsIds.has(id)) problems.push(`reportagens_lead_com_medo: a reportagem "${id}" não existe.`);
  }
}

function checkGuardrails(value: unknown, problems: string[]): void {
  const g = isObj(value) ? value : {};
  for (const key of ['palavras', 'frases', 'promessas']) {
    if (!isTextList(g[key])) problems.push(`guardrails.${key} precisa ser uma lista de textos.`);
  }
}

function checkCredential(value: unknown, problems: string[]): void {
  const t = isObj(value) ? value : {};
  for (const key of ['graduacao_concluida', 'sem_graduacao']) {
    if (!isText(t[key])) problems.push(`Falta o texto da credencial "${key}" (texto_credencial).`);
  }
  if (t.cursando_graduacao !== null && t.cursando_graduacao !== undefined && typeof t.cursando_graduacao !== 'string') {
    problems.push('texto_credencial.cursando_graduacao precisa ser texto ou vazio.');
  }
}

/** Problemas de forma do conteudo, em portugues. Vazio = pode publicar. */
export function validateContentShape(content: unknown): string[] {
  if (!isObj(content)) return ['O conteúdo precisa ser um objeto JSON.'];
  const problems: string[] = [];
  checkPillars(content.pilares, problems);
  const archetypeIds = checkArchetypes(content.arquetipos, problems);
  checkKits(content, problems);
  checkCallBlocks(content.call, problems);
  const newsIds = checkNews(content.reportagens, problems);
  checkNewsRefs(content, archetypeIds, newsIds, problems);
  checkGuardrails(content.guardrails, problems);
  checkCredential(content.texto_credencial, problems);
  if (!isText(content.aviso_legal)) problems.push('Falta o aviso legal (aviso_legal).');
  return problems;
}
