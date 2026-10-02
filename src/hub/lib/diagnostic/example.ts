/**
 * "Criar exemplo": a Marina do pacote do Time MBA (exemplo() do gerador atual),
 * para ensaiar a call e conferir o PDF contra 05_exemplo_pdf_lead.pdf.
 * Fica marcada com origem 'exemplo' para nao entrar nas metricas.
 */
import { addDaysYmd } from '@diag/dates.ts';
import { defaultPrepConfig } from '@/lib/diagnostic/workspace';

const addDays = addDaysYmd;

export function examplePayload(todayYmd: string) {
  const at = new Date().toISOString();
  return {
    origin: 'exemplo' as const,
    lead: {
      name: 'Marina (exemplo)',
      whatsapp: '',
      job_title: 'Analista Financeira Sênior',
      time_in_role_text: '4 anos',
      area: 'Financeiro',
      career_moment: 'Faço tudo certo, mas não saio do lugar',
      time_in_role: '3 a 5 anos',
      last_promotion: 'Mais de 3 anos',
      trigger_event: 'Vi uma promoção ou vaga ir para outra pessoa',
      ai_frequency: 'Algumas vezes por mês',
      ai_uses: ['Escrever e revisar e-mails e textos'],
      goal_12m: 'Ser promovido(a) onde estou',
      graduation_status: 'concluida',
      investment_answer: 'organizar',
    },
    session: {
      scheduled_date: todayYmd,
      precall_answers: {
        tasks: [
          { id: 't1', label: 'Relatório mensal de despesas', hoursPerWeek: 4 },
          { id: 't2', label: 'Conciliação de lançamentos', hoursPerWeek: 3 },
        ],
        tools: ['ChatGPT'],
        source: 'consultor',
      },
    },
    qualification: {
      sdr_name: 'SDR do time',
      pain_text: 'A vaga de coordenação foi pra alguém de fora.',
      accepts_status_quo: false,
      decision_score: 8,
      commits_to_apply: true,
    },
    diagnosis: {
      score_uso: 2,
      score_aplic: 2,
      score_prova: 1,
      score_cred: 2,
      score_metodo: 3,
      archetype_id: 'invisivel',
      quotes: [
        { id: 'q1', text: 'Eu entrego tudo no prazo e ninguém percebe.', tag: 'problema', inPdf: true, at },
        { id: 'q2', text: 'Uso o ChatGPT só pra escrever e-mail.', tag: 'situacao', inPdf: true, at },
        { id: 'q3', text: 'A vaga de coordenação foi pra alguém de fora.', tag: 'problema', inPdf: true, at },
      ],
      news_shown_ids: ['nubank', 'g1'],
      commitment_text: 'Refazer com IA o relatório mensal de despesas',
      commitment_due_date: addDays(todayYmd, 4),
      commitment_movement: 'aplic',
      consultant_name: 'Consultor do time',
      // Chega preparado: perfil confirmado e as duas reportagens com link na tela.
      prep_config: { ...defaultPrepConfig(), archetypeConfirmed: true, newsScreen: ['nubank', 'g1'] },
    },
  };
}
