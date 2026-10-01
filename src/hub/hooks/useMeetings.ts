import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows, HISTORY_STALE_TIME } from '@/lib/fetchAllRows';

export type MeetingStatus = 'Scheduled' | 'Completed' | 'No Show' | 'Rescheduled' | 'Closed Won' | 'Closed Lost';

export const MEETING_STATUSES: MeetingStatus[] = [
  'Scheduled', 'Completed', 'No Show', 'Rescheduled', 'Closed Won', 'Closed Lost',
];

export interface Meeting {
  id: string;
  lead_name: string;
  whatsapp: string;
  linkedin_profile: string;
  product: string;
  seniority: string;
  already_tried_global: string;
  can_invest: string;
  currently_employed: string;
  watched_materials: string;
  career_priority: string;
  main_pain_point: string;
  has_college_degree: string;
  watched_recorded_materials: string;
  priority: string;
  has_degree: string;
  would_invest_500_plus: string;
  is_priority: string;
  source: string;
  funnel_entry: string;
  assigned_closer_id: string | null;
  assigned_closer_name: string;
  scheduled_by: string | null;
  scheduled_by_name: string;
  scheduled_at: string;
  meeting_date: string | null;
  meeting_time: string | null;
  status: MeetingStatus;
  notes: string;
  created_at: string;
  updated_at: string;
}

export type MeetingInput = Omit<Meeting, 'id' | 'created_at' | 'updated_at'>;

export function useMeetings() {
  return useQuery({
    queryKey: ['meetings'],
    staleTime: HISTORY_STALE_TIME,
    queryFn: ({ signal }): Promise<Meeting[]> => fetchAllRows(() => supabase
      .from('meetings').select('*', { count: 'exact' })
      .order('meeting_date', { ascending: false, nullsFirst: false })
      .order('meeting_time', { ascending: false, nullsFirst: false }), { signal }) as Promise<Meeting[]>,
  });
}
