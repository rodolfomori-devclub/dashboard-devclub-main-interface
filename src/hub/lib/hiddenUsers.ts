// Ranking participation is an administrator setting, independent of account access.
// Keep financial ledgers intact; filter rows only when computing people rankings.
type RankingProfile = { id?: string | null; excludedFromRanking?: boolean; excluded_from_ranking?: boolean };
export const isRankingParticipant = (profile?: RankingProfile | null): boolean =>
  profile?.excludedFromRanking !== true && profile?.excluded_from_ranking !== true;

export const filterVisibleProfiles = <T extends RankingProfile>(rows: T[]): T[] =>
  rows.filter(isRankingParticipant);

export const filterVisibleSales = <T extends { seller_id?: string | null }>(rows: T[], profiles: RankingProfile[]): T[] => {
  const excluded = new Set(profiles.filter(profile => !isRankingParticipant(profile)).map(profile => profile.id));
  return rows.filter(row => !excluded.has(row.seller_id));
};
