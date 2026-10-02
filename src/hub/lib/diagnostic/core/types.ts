/**
 * Diagnostico de Carreira com IA: tipos compartilhados entre o navegador (Vite,
 * alias `@diag`) e as edge functions (Deno).
 *
 * REGRAS DESTE DIRETORIO
 * - TypeScript puro: nada de Deno.*, window, document, localStorage, fetch,
 *   imports de npm/esm.sh, alias `@/` ou import de JSON.
 * - Imports relativos com extensao `.ts` explicita (exigencia do Deno).
 * - Funcoes puras: "agora" e sempre parametro, nunca `new Date()` implicito.
 */

// ---------------------------------------------------------------------------
// Conteudo (supabase/diagnostic/content/*.json, versionado no banco)
// ---------------------------------------------------------------------------

export type PillarId = 'uso' | 'aplic' | 'prova' | 'cred' | 'metodo';

/** Ordem fixa dos pilares. Desempates sempre seguem esta ordem (regras 6 e 7). */
export const PILLAR_ORDER: readonly PillarId[] = ['uso', 'aplic', 'prova', 'cred', 'metodo'];

/** Nota 1 ou 2 = trava, 3 = em construcao, 4 ou 5 = ponto forte (regra 4). */
export type Level = 'trava' | 'em_construcao' | 'ponto_forte';

/** '' = ainda nao informado. */
export type Graduation = '' | 'concluida' | 'nao' | 'cursando';

export type InvestmentAnswer = '' | 'sim' | 'organizar' | 'nao';

export type QuoteTag = 'situacao' | 'reportagem' | 'problema' | 'implicacao' | 'necessidade' | 'outro';

export type NeedPriorityId = 'aprender' | 'provar' | 'formacao';

export interface Pillar {
  id: PillarId;
  nome: string;
  nome_curto: string;
  pergunta_que_revela: string;
  guia_consultor: string;
  texto_trava: string;
  texto_em_construcao: string;
  texto_ponto_forte: string;
  causa_provavel: string;
  movimento_90_dias: string;
  onde_o_mba_resolve: string;
}

export type ArchetypeSignalField =
  | 'area'
  | 'momento'
  | 'tempo_cargo'
  | 'ultima_promocao'
  | 'gatilho'
  | 'objetivo'
  | 'frequencia_ia'
  | 'usos_ia'
  | 'cargo';

/**
 * Sinal da aplicacao que soma pontos para um perfil.
 * `cargo` compara por "contem a palavra" (sem acento, sem caixa); os demais
 * comparam o valor exato da opcao (sem acento, sem caixa). `usos_ia` e lista.
 */
export interface ArchetypeSignal {
  campo: ArchetypeSignalField;
  valores: string[];
  pontos: number;
}

export interface Archetype {
  id: string;
  nome: string;
  como_reconhecer: string;
  causa_raiz: string;
  diferencial_para_mostrar_primeiro: string;
  diferenciais_ids: string[];
  sinais: ArchetypeSignal[];
}

export interface AreaEntry {
  nome: string;
  grupo_material: string;
}

export interface Lesson {
  titulo: string;
  status: string;
  url: string | null;
}

export interface PromptItem {
  titulo: string;
  prompt: string;
}

export interface NewsItem {
  id: string;
  /** Titulo completo usado no "Para ler depois" do PDF (igual ao gerador atual). */
  titulo: string;
  url: string | null;
  vai_no_pdf: boolean;
  /** Pode aparecer na tela do lead (precisa de URL). ABDI, PwC sem link e o video: nunca. */
  na_tela: boolean;
  veiculo: string;
  data: string;
  manchete: string;
  dado_principal: string;
  outros_dados: string | null;
  quando_usar: string;
  pergunta_depois: string | null;
  /** Ressalva de origem exibida junto (ex.: "Pesquisa dos EUA, 2024"). */
  selo: string | null;
  /** Link so para o consultor abrir (nunca vai ao PDF nem a tela). */
  link_interno: string | null;
}

export interface PathStep {
  periodo: string;
  titulo: string;
  descricao: string;
}

export interface Differential {
  id: string;
  titulo: string;
  como_falar: string;
  resolve: PillarId | 'confianca';
}

export interface NeedPriority {
  id: NeedPriorityId;
  rotulo: string;
  pilares: PillarId[];
  diferenciais: string[];
}

export interface Guardrails {
  palavras: string[];
  frases: string[];
  promessas: string[];
}

export type CallBlockId =
  | 'abertura'
  | 'situacao'
  | 'reportagem'
  | 'problema'
  | 'implicacao'
  | 'necessidade'
  | 'devolutiva'
  | 'pitch'
  | 'proximo';

export interface CallQuestion {
  id: string;
  /** Pode conter variaveis {{...}} (ver ScriptVarName). */
  texto: string;
  pilar?: PillarId;
  nota?: string;
}

export interface CallScript {
  id: string;
  titulo: string;
  /** Pode conter variaveis {{...}} (ver ScriptVarName). */
  texto: string;
  /** Sem `quando`: vale para todos. */
  quando?: 'cursando' | 'nao_cursando';
}

export interface CallChecklistItem {
  id: string;
  texto: string;
}

export interface CallBlock {
  id: CallBlockId;
  ordem: number;
  min_inicio: number;
  min_fim: number;
  titulo: string;
  sigla: string;
  /** Pilares cuja nota e dada neste bloco. */
  pilares: PillarId[];
  roteiros: CallScript[];
  perguntas: CallQuestion[];
  checklist: CallChecklistItem[];
  dicas: string[];
  alertas: string[];
}

export interface ApplicationQuestion {
  id: string;
  pergunta: string;
  tipo: 'escolha_unica' | 'multipla_escolha' | 'texto_curto';
  opcoes?: string[];
  opcional?: boolean;
}

export interface DiagnosticContent {
  versao: string;
  fonte?: string;
  escala_pilares: unknown;
  pilares: Pillar[];
  arquetipos: Archetype[];
  /** Ordem de desempate da sugestao de perfil. */
  arquetipos_desempate: string[];
  areas: AreaEntry[];
  /** Opcao da aplicacao -> nome da area no conteudo. */
  areas_aliases: Record<string, string>;
  aulas_por_grupo: Record<string, Lesson | null>;
  kits_de_prompts: Record<string, PromptItem[]>;
  objetivos_12_meses: string[];
  gatilhos_da_aplicacao: string[];
  caminho_12_meses: PathStep[];
  texto_credencial: {
    graduacao_concluida: string;
    sem_graduacao: string;
    cursando_graduacao: string | null;
  };
  aviso_legal: string;
  reportagens: NewsItem[];
  reportagens_por_arquetipo: Record<string, string[]>;
  reportagens_lead_com_medo: string[];
  reportagem_fecho: string;
  diferenciais: Differential[];
  necessidade_prioridades: NeedPriority[];
  guardrails: Guardrails;
  call: {
    duracao_min: number;
    minutos_modo_curto: number;
    preparacao: string[];
    blocos: CallBlock[];
  };
  aplicacao: {
    perguntas: ApplicationQuestion[];
    lead_score: Record<string, string>;
  };
  qualificacao_sdr: unknown;
  cadencia_pos_call: unknown[];
}

// ---------------------------------------------------------------------------
// Entrada das derivacoes (montada a partir do Workspace no navegador, ou do
// banco na edge function do PDF)
// ---------------------------------------------------------------------------

export interface Quote {
  id: string;
  text: string;
  tag: QuoteTag;
  /** Vai para "Seu ponto de partida" no PDF e na devolutiva (no maximo 3). */
  inPdf: boolean;
  /** ISO de quando foi capturada. */
  at: string;
}

export interface WeeklyTask {
  id: string;
  label: string;
  hoursPerWeek: number | null;
}

export interface DiagnosisInput {
  lead: {
    name: string;
    jobTitle: string;
    /** Texto livre ("4 anos"). Tem prioridade sobre a faixa da aplicacao. */
    timeInRoleText: string;
    /** Faixa da aplicacao ("3 a 5 anos"). */
    timeInRoleBucket: string;
    lastPromotion: string;
    area: string;
    goal: string;
    graduation: Graduation;
    trigger: string;
    careerMoment: string;
    aiFrequency: string;
    aiUses: string[];
    freePhrase: string;
    whatsapp: string;
  };
  sdr: {
    name: string;
    painText: string;
    decisionScore: number | null;
    acceptsStatusQuo: boolean | null;
    commitsToApply: boolean | null;
  };
  scores: Record<PillarId, number | null>;
  archetypeId: string;
  rootCauseOverride: string;
  quotes: Quote[];
  /** Reportagens mostradas ou citadas na call (no maximo 2). */
  newsShownIds: string[];
  commitment: {
    text: string;
    /** 'YYYY-MM-DD' ou ''. */
    dueDate: string;
    /** PillarId do movimento escolhido, 'custom' ou ''. */
    movement: string;
  };
  lessonUrlOverride: string;
  consultant: { name: string; whatsapp: string };
  /** Data impressa no diagnostico (dia da sessao), 'YYYY-MM-DD'. */
  dateYmd: string;
  /** Frase pronta da condicao real (ver offer.ts conditionLine) ou null. */
  conditionLine: string | null;
}

// ---------------------------------------------------------------------------
// Modelo derivado (o que o PDF, as mensagens, os roteiros e a tela usam)
// ---------------------------------------------------------------------------

export interface PillarResult {
  pillar: Pillar;
  score: number | null;
  level: Level | null;
}

export interface MaterialInfo {
  type: 'aula' | 'kit';
  /** Grupo de material da area (ex.: 'financeiro_administrativo'). */
  group: string;
  /** Nome da area para exibir (ex.: 'Financeiro'); 'sua área' quando nao ha area. */
  areaLabel: string;
  /** A area no meio da frase: 'financeiro', 'TI', 'o seu negócio', 'a sua área'. */
  areaPhrase: string;
  /** Titulo da aula do grupo, mesmo quando ainda nao tem link. */
  lessonTitle: string | null;
  lessonUrl: string | null;
  kit: PromptItem[];
  /** 2 quando vai a aula, 3 quando vai o kit (pagina 3). */
  pages: 2 | 3;
}

export interface DiagnosisModel {
  /** As 5 notas estao preenchidas. */
  complete: boolean;
  missingScores: PillarId[];
  /** Nome digitado (trim). Pode ser ''. */
  name: string;
  /** Nome para exibir: o nome ou '[Nome]'. */
  displayName: string;
  /** Primeira palavra do nome, ou '[Nome]'. */
  firstName: string;
  /** Nome do consultor ou '[Consultor]'. */
  consultantName: string;
  consultantWhatsapp: string;
  jobTitle: string;
  timeInRole: string;
  area: string;
  goal: string;
  /** 'dd/mm/aaaa' do dia do diagnostico. */
  dateBR: string;
  /** Na ordem fixa dos pilares. */
  pillars: PillarResult[];
  /** Ordem crescente de nota, desempate pela ordem fixa. [] se incompleto. */
  ordered: PillarResult[];
  total: number | null;
  /** Maior nota (desempate: o ultimo na ordem fixa). null se incompleto ou 5 notas iguais. */
  strongest: Pillar | null;
  /** Menor nota (desempate: o primeiro na ordem fixa). null se incompleto ou 5 notas iguais. */
  weakest: Pillar | null;
  /** Os 3 pilares de menor nota (regra 6). [] se incompleto. */
  plan: Pillar[];
  /** Pilares com nota 1 ou 2, na ordem de `ordered`. */
  blockers: Pillar[];
  /** Perfil efetivo: o confirmado, senao o sugerido pela aplicacao, senao o primeiro do conteudo (so para tipos). */
  archetype: Archetype;
  /** De onde veio o perfil. 'none': nao ha perfil e a causa raiz depende do texto do consultor. */
  archetypeSource: 'confirmed' | 'suggested' | 'none';
  /** Texto proprio do consultor ou o do perfil (regra 8). '' quando nao ha perfil nem texto proprio. */
  rootCause: string;
  /** Ate 3 frases marcadas para o PDF, na ordem de captura. */
  pdfQuotes: string[];
  material: MaterialInfo;
  /** false quando esta cursando graduacao (regra 10). */
  eligible: boolean;
  /** Texto da credencial por graduacao; null quando cursando. */
  credential: string | null;
  /** Reportagens mostradas que tem URL e vao no PDF (regra 12). */
  readLater: NewsItem[];
  path: PathStep[];
  commitmentText: string;
  /** 'dd/mm/aaaa' ou ''. */
  commitmentDueBR: string;
  conditionLine: string | null;
  disclaimer: string;
}

export type DeliveryField =
  | 'name'
  | 'commitmentText'
  | 'commitmentDueDate'
  | 'scores'
  | 'graduation'
  /** Sem perfil (confirmado ou sugerido) e sem causa raiz escrita pelo consultor. */
  | 'rootCause'
  /** Sem nome do consultor: o PDF sairia com "[Consultor]". */
  | 'consultant'
  | 'lessonUrl';

export interface ValidationIssue {
  field: DeliveryField;
  message: string;
}

// Oferta (cena da bolsa e "Proximo passo" do PDF): offerTypes.ts.
export * from './offerTypes.ts';

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

/** URLs (navegador) ou nomes de arquivo (Gotenberg) das fontes do PDF. */
export interface FontUrls {
  bricolage: string;
  plexSans400: string;
  plexSans400Italic: string;
  plexSans500: string;
  plexSans600: string;
  plexMono400: string;
  plexMono500: string;
  plexMono600: string;
}

// ---------------------------------------------------------------------------
// Mensagens e roteiros
// ---------------------------------------------------------------------------

export type TemplateVars = Record<string, string | number | null | undefined>;

export interface FilledTemplate {
  text: string;
  /** Variaveis sem valor (null/undefined), na ordem em que aparecem. */
  missing: string[];
}

/** Variaveis disponiveis nos roteiros e perguntas do conteudo. */
export type ScriptVarName =
  | 'nome'
  | 'consultor'
  | 'sdr'
  | 'tempo_cargo'
  | 'gatilho'
  | 'como_usa_ia'
  | 'nota_decisao'
  | 'pilar_forte'
  | 'pilar_fraco'
  | 'frase'
  | 'causa_raiz'
  | 'movimento_1'
  | 'area'
  | 'material'
  | 'material_curto'
  | 'objetivo'
  | 'data_compromisso'
  | 'trava'
  | 'clausula_vagas';

/** Entradas da sugestao de perfil (respostas da aplicacao). */
export interface ApplicationAnswers {
  area: string;
  momento: string;
  tempo_cargo: string;
  ultima_promocao: string;
  gatilho: string;
  objetivo: string;
  frequencia_ia: string;
  usos_ia: string[];
  cargo: string;
}

export interface ArchetypeSuggestion {
  id: string;
  score: number;
  /** Frases curtas para o vendedor ("marcou 'Faço tudo certo...'"). */
  reasons: string[];
  scores: Record<string, number>;
}

export interface PathPair {
  pillarId: PillarId | null;
  /** Ex.: "Prova de resultado" ou o rotulo da prioridade escolhida. */
  label: string;
  /** Como a pos resolve (texto para o lead). */
  resolves: string;
  /** De onde veio o par: uma trava, a prioridade que o lead escolheu ou o plano. */
  kind: 'trava' | 'prioridade' | 'plano';
}
