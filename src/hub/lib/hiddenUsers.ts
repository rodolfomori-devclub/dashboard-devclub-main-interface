// Users that must be excluded from dashboards, TV mode and any rankings.
// They remain in the system (still appear in admin / user management screens),
// but are filtered out of every aggregated/visualization surface.
export const HIDDEN_DASHBOARD_USER_IDS: ReadonlySet<string> = new Set([
  // Suelen
  '23465326-f6b5-4baf-8778-c10df7375028',
]);

export const isHiddenDashboardUser = (id?: string | null): boolean =>
  !!id && HIDDEN_DASHBOARD_USER_IDS.has(id);

export const filterVisibleProfiles = <T extends { id?: string | null }>(rows: T[]): T[] =>
  rows.filter((r) => !isHiddenDashboardUser(r?.id ?? null));

export const filterVisibleSales = <T extends { seller_id?: string | null }>(rows: T[]): T[] =>
  rows.filter((r) => !isHiddenDashboardUser(r?.seller_id ?? null));

export const filterVisibleMeetings = <T extends { scheduled_by?: string | null; assigned_closer_id?: string | null }>(rows: T[]): T[] =>
  rows.filter((r) => !isHiddenDashboardUser(r?.scheduled_by ?? null) && !isHiddenDashboardUser(r?.assigned_closer_id ?? null));
