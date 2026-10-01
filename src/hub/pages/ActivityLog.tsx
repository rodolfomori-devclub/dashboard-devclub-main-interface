import { useState, useMemo, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ACTION_LABELS, type ActivityAction } from '@/lib/activityLogger';
import { format } from 'date-fns';
import { Search, LogIn, LogOut, DollarSign, ClipboardList, Users, Target, UserCog, KeyRound, Trash2, RefreshCw } from 'lucide-react';

const ACTION_ICONS: Record<string, React.ElementType> = {
  LOGIN: LogIn,
  LOGOUT: LogOut,
  SALE_CREATED: DollarSign,
  SALE_UPDATED: DollarSign,
  SALE_DELETED: Trash2,
  KPI_SUBMITTED: ClipboardList,
  KPI_UPDATED: ClipboardList,
  USER_CREATED: Users,
  USER_UPDATED: UserCog,
  USER_PASSWORD_RESET: KeyRound,
  USER_DELETED: Trash2,
  GOAL_UPDATED: Target,
  PROFILE_UPDATED: UserCog,
};

const ACTION_COLORS: Record<string, string> = {
  LOGIN: 'text-emerald-400',
  LOGOUT: 'text-muted-foreground',
  SALE_CREATED: 'text-primary',
  SALE_UPDATED: 'text-amber-400',
  SALE_DELETED: 'text-error',
  KPI_SUBMITTED: 'text-sky-400',
  KPI_UPDATED: 'text-sky-400',
  USER_CREATED: 'text-emerald-400',
  USER_UPDATED: 'text-amber-400',
  USER_PASSWORD_RESET: 'text-amber-400',
  USER_DELETED: 'text-error',
  GOAL_UPDATED: 'text-primary',
  PROFILE_UPDATED: 'text-muted-foreground',
};

export default function ActivityLog() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState('all');
  const [filterUser, setFilterUser] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (filterAction !== 'all') {
        query = query.eq('action', filterAction);
      }
      if (filterUser !== 'all') {
        query = query.eq('user_id', filterUser);
      }
      if (dateFrom) {
        query = query.gte('created_at', new Date(dateFrom).toISOString());
      }
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        query = query.lte('created_at', end.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      setLogs(data ?? []);
    } catch (err) {
      console.error('Error fetching activity logs:', err);
    } finally {
      setLoading(false);
    }
  }, [filterAction, filterUser, dateFrom, dateTo]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Refresh through the authenticated Vault gateway; no anonymous websocket.
  useEffect(() => {
    const timer = setInterval(() => { if (document.visibilityState === 'visible') fetchLogs(); }, 60000);
    return () => clearInterval(timer);
  }, [fetchLogs]);

  const uniqueUsers = useMemo(() => {
    const map = new Map<string, string>();
    logs.forEach(l => map.set(l.user_id, l.user_name));
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [logs]);

  const filteredLogs = useMemo(() => {
    if (!search.trim()) return logs;
    const q = search.toLowerCase();
    return logs.filter(l =>
      l.user_name.toLowerCase().includes(q) ||
      (ACTION_LABELS[l.action as ActivityAction] || l.action).toLowerCase().includes(q) ||
      l.details.toLowerCase().includes(q)
    );
  }, [logs, search]);

  return (
    <div className="page-container space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="page-title">Histórico de Atividades</h2>
          <p className="page-subtitle">Acompanhe as ações realizadas pelos usuários</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} /> Atualizar
        </Button>
      </div>

      {/* Filters */}
      <div className="glass-card p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="relative md:col-span-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="pl-9"
            />
          </div>
          <Select value={filterUser} onValueChange={setFilterUser}>
            <SelectTrigger><SelectValue placeholder="Todos os usuários" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os usuários</SelectItem>
              {uniqueUsers.map(([id, name]) => (
                <SelectItem key={id} value={id}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterAction} onValueChange={setFilterAction}>
            <SelectTrigger><SelectValue placeholder="Todas as ações" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as ações</SelectItem>
              {Object.entries(ACTION_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} placeholder="Data início" />
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} placeholder="Data fim" />
        </div>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Carregando atividades...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma atividade encontrada.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left p-3 font-medium text-muted-foreground">Usuário</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Ação</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Detalhes</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Data</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Hora</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log: any) => {
                  const Icon = ACTION_ICONS[log.action] || ClipboardList;
                  const colorClass = ACTION_COLORS[log.action] || 'text-muted-foreground';
                  const actionLabel = ACTION_LABELS[log.action as ActivityAction] || log.action;
                  const createdAt = new Date(log.created_at);

                  return (
                    <tr key={log.id} className="border-b border-border/30 last:border-0 hover:bg-accent/20 transition-colors">
                      <td className="p-3">
                        <div>
                          <p className="font-medium text-foreground">{log.user_name}</p>
                          <p className="text-xs text-muted-foreground capitalize">{log.user_role === 'gestor' ? 'Gestor' : log.user_role === 'pre-vendedor' ? 'Pré-Vendedor' : 'Vendedor'}</p>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <Icon className={`h-4 w-4 flex-shrink-0 ${colorClass}`} />
                          <Badge variant="outline" className="text-xs font-normal">{actionLabel}</Badge>
                        </div>
                      </td>
                      <td className="p-3 text-muted-foreground max-w-[300px] truncate">{log.details || '—'}</td>
                      <td className="p-3 text-muted-foreground whitespace-nowrap">{format(createdAt, 'dd/MM/yyyy')}</td>
                      <td className="p-3 text-muted-foreground whitespace-nowrap">{format(createdAt, 'HH:mm')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
