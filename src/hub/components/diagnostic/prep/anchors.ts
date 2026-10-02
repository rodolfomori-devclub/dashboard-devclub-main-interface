/** Ancoras dos cartoes da preparacao (o checklist leva ate o cartao do item). */
export const PREP_SECTION = {
  lead: 'prep-lead',
  sdr: 'prep-sdr',
  precall: 'prep-precall',
  script: 'prep-script',
  scenes: 'prep-scenes',
  offer: 'prep-offer',
  seller: 'prep-seller',
} as const;

/** Item do checklist -> cartao onde se resolve. Itens manuais nao tem cartao. */
export const CHECKLIST_SECTION: Record<string, string> = {
  lead_name: PREP_SECTION.lead,
  lead_whatsapp: PREP_SECTION.lead,
  role_area: PREP_SECTION.lead,
  goal: PREP_SECTION.lead,
  graduation: PREP_SECTION.lead,
  profile: PREP_SECTION.script,
  news_screen: PREP_SECTION.script,
  offer: PREP_SECTION.offer,
  consultant: PREP_SECTION.seller,
};
