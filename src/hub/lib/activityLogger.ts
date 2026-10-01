import { supabase } from '@/integrations/supabase/client';

export type ActivityAction =
  | 'LOGIN'
  | 'LOGOUT'
  | 'SALE_CREATED'
  | 'SALE_UPDATED'
  | 'SALE_DELETED'
  | 'KPI_SUBMITTED'
  | 'KPI_UPDATED'
  | 'USER_CREATED'
  | 'USER_UPDATED'
  | 'USER_PASSWORD_RESET'
  | 'USER_DELETED'
  | 'GOAL_UPDATED'
  | 'PROFILE_UPDATED';

interface LogActivityParams {
  userId: string;
  userName: string;
  userRole: string;
  action: ActivityAction;
  details?: string;
  entityType?: string;
  entityId?: string;
}

export async function logActivity({
  userId,
  userName,
  userRole,
  action,
  details = '',
  entityType = '',
  entityId = '',
}: LogActivityParams) {
  try {
    await supabase.from('activity_logs').insert({
      user_id: userId,
      user_name: userName,
      user_role: userRole,
      action,
      details,
      entity_type: entityType,
      entity_id: entityId,
    });
  } catch (err) {
    console.warn('[ActivityLogger] Failed to log activity:', err);
  }
}

export const ACTION_LABELS: Record<ActivityAction, string> = {
  LOGIN: 'Login realizado',
  LOGOUT: 'Logout realizado',
  SALE_CREATED: 'Venda registrada',
  SALE_UPDATED: 'Venda atualizada',
  SALE_DELETED: 'Venda excluída',
  KPI_SUBMITTED: 'KPI preenchido',
  KPI_UPDATED: 'KPI atualizado',
  USER_CREATED: 'Usuário criado',
  USER_UPDATED: 'Usuário atualizado',
  USER_PASSWORD_RESET: 'Senha resetada',
  USER_DELETED: 'Usuário excluído',
  GOAL_UPDATED: 'Meta atualizada',
  PROFILE_UPDATED: 'Perfil atualizado',
};
