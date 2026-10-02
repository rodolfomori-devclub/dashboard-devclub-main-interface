import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, ArrowDownLeft, Calculator, CircleDollarSign, Clock3, Link2, LoaderCircle, RefreshCw, UserRoundPen, Wallet } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { CommissionRuleEditor } from './CommissionRuleEditor';
import { CommissionTrend } from './CommissionTrend';
import { CommissionLegacyLedger } from './CommissionLegacyLedger';
import { currentCommissionMonth, fetchCommissions, formatCommissionMoney as money, type CommissionSale } from './commissionApi';
import { formatCommissionDate as saleDate } from './commissionDate';
import './commissionWorkspace.css';

const STATUS_LABELS: Record<CommissionSale['commissionStatus'], string> = {
  pending_attribution: 'Vendedor a identificar', pending_rule: 'Regra pendente', pending_cash: 'Recebimento a confirmar', pending_refund: 'Reembolso em conferência', refunded: 'Reembolsada', calculated: 'Calculada',
};
function Metric({ title, value, detail, loading, accent, icon: Icon, partial }: {
  title: string; value: string; detail: string; loading: boolean; accent?: string; icon: typeof Wallet; partial: boolean;
}) {
  return <section className={`commission-stat ${accent || ''}`} aria-busy={loading}>
    <div className="commission-stat-label"><Icon size={17} /><span>{title}</span>{partial && !loading && <span className="commission-badge is-pending">Parcial</span>}</div>
    {loading ? <div className="commission-loading-label" role="status"><LoaderCircle size={19} /><span>Carregando valor...</span></div> : <strong className={value === 'Aguardando regra' || value === 'A confirmar' ? 'commission-pending' : ''}>{value}</strong>}
    <small>{loading ? 'Buscando as vendas e os recebimentos do período.' : detail}</small>
  </section>;
}

export function CommissionWorkspace({ mode }: { mode: 'seller' | 'financial' }) {
  const { user, isManager, isFinancial } = useAuth();
  const canManage = Boolean(isManager || isFinancial);
  const financialView = mode === 'financial' && canManage;
  const [month, setMonth] = useState(currentCommissionMonth);
  const [sellerFilter, setSellerFilter] = useState('all');
  const [attributionFilter, setAttributionFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const sellerId = financialView ? (sellerFilter === 'all' ? null : sellerFilter) : null;
  const query = useQuery({
    queryKey: ['automatic-commissions', user.id, mode, month, sellerId],
    queryFn: ({ signal }) => fetchCommissions(month, sellerId, signal, financialView ? 'financial' : 'self'),
    staleTime: 30000,
    refetchInterval: (entry) => entry.state.data?.status.loading ? 5000 : 60000,
    retry: 1,
  });
  const data = query.data;
  const loading = query.isPending || Boolean(data?.status.loading && !data.sales.length);
  const partial = Boolean(data?.status.partial || query.isError);
  const rows = useMemo(() => data?.sales || [], [data?.sales]);
  const summary = data?.summary;
  const calculatedRows = useMemo(() => rows.map((row) => ({ date: row.date, commissionValue: row.commissionStatus === 'calculated' ? row.commission : null })), [rows]);
  const shownRows = useMemo(() => rows.filter((row) => (attributionFilter === 'all' || row.attributionMethod === attributionFilter) && (statusFilter === 'all' || row.commissionStatus === statusFilter)), [rows, attributionFilter, statusFilter]);
  const automaticCount = rows.filter((row) => row.attributionMethod === 'utm').length;
  const manualCount = rows.filter((row) => row.attributionMethod === 'manual').length;
  const unassignedCount = rows.filter((row) => row.attributionMethod === 'unassigned').length;
  const missingRules = Boolean(summary?.pendingCommissionCount && data?.rules?.status === 'not_configured');
  const commissionValue = summary?.commission === null ? (missingRules ? 'Aguardando regra' : 'A confirmar') : money(summary?.commission);
  const commissionDetail = (summary?.pendingCommissionCount
    ? `${summary.pendingCommissionCount} venda(s) aguardam atribuição, recebimento, regra ou conferência de reembolso.`
    : 'Calculadas sobre as vendas atribuídas. O pagamento depende da conferência financeira.')
    + (summary?.commission === null && summary.calculatedCommission !== undefined && rows.some((row) => row.commissionStatus === 'calculated') ? ` Já calculado: ${money(summary.calculatedCommission)}.` : '');
  const monthName = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(`${month}-15T12:00:00`));
  const changedMonth = (value: string) => { if (/^\d{4}-\d{2}$/.test(value)) { setMonth(value); setAttributionFilter('all'); setStatusFilter('all'); } };

  return <div className="page-container commission-workspace">
    <header className="commission-header">
      <div><h2>{financialView ? 'Comissões do time' : 'Minhas comissões'}</h2><p>As vendas atribuídas por UTM ou pela gestão aparecem aqui automaticamente. Acompanhe cada venda, o recebimento e o cálculo da comissão.</p></div>
      <div className="commission-header-actions">{financialView && isManager && <CommissionRuleEditor month={month} preferredSeller={sellerFilter === 'all' ? null : sellerFilter} onSaved={() => query.refetch()} />}<button type="button" className="button" onClick={() => query.refetch()} disabled={query.isFetching}><RefreshCw size={15} className={query.isFetching ? 'commission-refresh-icon' : ''} />{query.isFetching ? 'Atualizando...' : 'Atualizar'}</button></div>
    </header>

    <div className="surface-panel commission-toolbar">
      <label>Competência<input aria-label="Competência das comissões" type="month" min="2020-01" max="2100-12" value={month} onChange={(event) => changedMonth(event.target.value)} /></label>
      {financialView && <label>Vendedor<select className="commission-seller-select" aria-label="Vendedor das comissões" value={sellerFilter} onChange={(event) => { setSellerFilter(event.target.value); setAttributionFilter('all'); setStatusFilter('all'); }}><option value="all">Todos os vendedores</option>{data?.sellers.map((seller) => <option key={seller.id} value={seller.id}>{seller.name}</option>)}</select></label>}
      <span className="commission-updated"><Clock3 size={14} />{query.isFetching ? 'Conferindo informações...' : data?.status.generatedAt ? `Atualizado às ${new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }).format(new Date(data.status.generatedAt))}` : 'Aguardando dados'}</span>
    </div>

    {query.isError && <div className="surface-panel commission-error" role="alert"><AlertCircle size={22} /><p>{query.error instanceof Error ? query.error.message : 'Não foi possível carregar as comissões.'}{data && ' Os valores exibidos são da última atualização recebida.'}</p><button type="button" className="button" onClick={() => query.refetch()}>Tentar novamente</button></div>}

    {(!query.isError || data) && <>
      <div className="commission-summary">
        <Metric title="Comissões estimadas" value={commissionValue} detail={commissionDetail} loading={loading} accent="is-primary" icon={CircleDollarSign} partial={partial || Boolean(summary?.pendingCommissionCount)} />
        <Metric title={financialView && sellerFilter === 'all' ? 'Cash collected das vendas' : 'Cash collected atribuído'} value={summary?.missingCashCount && summary.missingCashCount >= summary.salesCount ? 'A confirmar' : money(summary?.cashCollected)} detail={financialView && sellerFilter === 'all' ? 'Recebimentos das novas vendas no período, incluindo aquelas que aguardam identificação do vendedor.' : 'Recebimentos das novas vendas vinculadas ao vendedor no período.'} loading={loading} accent="is-cash" icon={Wallet} partial={partial || Boolean(summary?.missingCashCount)} />
        <Metric title={financialView && sellerFilter === 'all' ? 'Valor das vendas' : 'Valor das vendas atribuídas'} value={summary?.missingGrossCount && summary.missingGrossCount >= summary.salesCount ? 'A confirmar' : money(summary?.gross)} detail={`${summary?.salesCount || 0} venda(s) na competência${summary?.refundedSalesCount ? ` · ${summary.refundedSalesCount} reembolsada(s)` : ''}.`} loading={loading} icon={ArrowDownLeft} partial={partial || Boolean(summary?.missingGrossCount)} />
      </div>

      {!loading && data && <div className="commission-note"><AlertCircle size={18} /><span>Comissão estimada, sujeita à conferência de reembolsos. Não representa aprovação ou pagamento.</span></div>}
      {missingRules && !loading && <div className="commission-note"><AlertCircle size={18} /><div><strong>A regra de comissão ainda precisa ser definida.</strong> {data?.rules.message || 'As vendas e os recebimentos já estão disponíveis. O valor da comissão fica pendente até a gestão configurar os percentuais.'}</div></div>}
      {data?.rules.status === 'unavailable' && <div className="commission-note" role="status"><AlertCircle size={18} /><span>As regras de comissão estão temporariamente indisponíveis. As comissões ficam pendentes até a próxima conferência.</span></div>}
      {data && (!data.status.attributionAvailable || data.status.partial) && <div className="commission-note" role="status"><AlertCircle size={18} /><span>{!data.status.attributionAvailable ? 'A atribuição está temporariamente indisponível. Aguarde a próxima atualização para conferir todas as vendas.' : 'Algumas fontes ainda estão atualizando. Os valores disponíveis são parciais e podem mudar na próxima conferência.'}</span></div>}

      {!loading && data && <>
        <section className="surface-panel commission-attribution" aria-label="Origem da atribuição das vendas">
          <div><h3>Vínculo das vendas</h3><p>A identificação por UTM e os vínculos feitos pela gestão alimentam o mesmo extrato.</p><div className="commission-attribution-bar" aria-hidden="true"><span style={{ flex: automaticCount, background: 'var(--chart-1)' }} /><span style={{ flex: manualCount, background: 'var(--chart-3)' }} /><span style={{ flex: unassignedCount, background: 'var(--chart-4)' }} /></div></div>
          <div className="commission-attribution-counts"><span><strong style={{ color: 'var(--chart-1)' }}>{automaticCount}</strong>UTM automática</span><span><strong style={{ color: 'var(--chart-3)' }}>{manualCount}</strong>Atribuição manual</span>{financialView && <span><strong style={{ color: 'var(--chart-4)' }}>{unassignedCount}</strong>Sem vendedor</span>}</div>
        </section>

        <CommissionTrend month={month} rows={calculatedRows} partial={partial || Boolean(summary?.pendingCommissionCount)} />

        <section className="surface-panel" aria-label="Extrato de vendas e comissões">
          <div className="commission-panel-head"><div><h3>Extrato de vendas</h3><p>{shownRows.length} de {rows.length} venda(s) em {monthName}. Os cards mostram o total da competência. Valor das vendas: Guru e Hotmart líquido após taxas; demais plataformas valor contratado.</p></div><div className="commission-tabs" aria-label="Filtrar origem da atribuição">{[['all', 'Todas'], ['utm', 'UTM'], ['manual', 'Manual'], ...(financialView ? [['unassigned', 'Sem vendedor']] : [])].map(([value, label]) => <button key={value} type="button" aria-pressed={attributionFilter === value} onClick={() => setAttributionFilter(value)}>{label}</button>)}</div></div>
          <div className="commission-toolbar" style={{ borderBottom: '1px solid var(--border)', padding: '12px 18px' }}><label>Status<select aria-label="Status da comissão" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">Todos os status</option>{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
          {shownRows.length ? <div className="commission-sales-table"><p className="commission-table-hint">Deslize a tabela para conferir todos os valores.</p><table><thead><tr><th>Venda</th>{financialView && <th>Vendedor</th>}<th>Atribuição</th><th className="money">Valor da venda</th><th className="money">Cash collected</th><th className="money">Comissão</th><th>Status</th></tr></thead><tbody>{shownRows.map((row) => <tr key={row.id} data-sale-id={row.id}>
            <td className="commission-product"><strong>{row.product || row.family || 'Produto não informado'}</strong><small>{saleDate(row.date)} · {row.platform || row.sourceId}</small><small>{row.externalId || row.id}</small></td>
            {financialView && <td>{row.sellerName || 'Sem vendedor'}</td>}
            <td><span className={`commission-badge ${row.attributionMethod === 'utm' ? 'is-utm' : row.attributionMethod === 'manual' ? 'is-manual' : 'is-pending'}`}>{row.attributionMethod === 'utm' ? <Link2 size={12} /> : <UserRoundPen size={12} />}{row.attributionMethod === 'utm' ? 'UTM automática' : row.attributionMethod === 'manual' ? 'Manual' : 'Sem vendedor'}</span>{row.attributionMethod === 'utm' && <small>{[row.utm?.source, row.utm?.campaign].filter(Boolean).join(' · ') || 'Identificada pelo link de venda'}</small>}</td>
            <td className="money">{money(row.gross)}</td><td className="money">{money(row.cashCollected)}</td>
            <td className="money"><strong>{row.commission === null ? 'Pendente' : money(row.commission)}</strong>{row.commissionRate !== null && <small>{new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 4 }).format(row.commissionRate)} da base{row.commissionRateSource ? ` · ${row.commissionRateSource}` : ''}</small>}</td>
            <td><span className={`commission-badge ${row.commissionStatus === 'calculated' ? 'is-ready' : 'is-pending'}`}>{row.commissionStatus === 'calculated' && <Calculator size={12} />}{STATUS_LABELS[row.commissionStatus] || 'A conferir'}</span></td>
          </tr>)}</tbody></table></div> : <div className="commission-empty"><strong>{rows.length ? 'Nenhuma venda corresponde aos filtros' : 'Nenhuma venda atribuída nesta competência'}</strong><p>{rows.length ? 'Altere os filtros para conferir os outros lançamentos.' : 'As vendas aparecem aqui quando a UTM identifica o vendedor ou quando a gestão faz a atribuição.'}</p></div>}
        </section>
      </>}
    </>}
    <CommissionLegacyLedger month={month} sellerId={financialView ? (sellerFilter === 'all' ? null : sellerFilter) : user.id} financialView={financialView} canEditAdjustments={financialView && Boolean(isManager)} sellers={data?.sellers || []} />
  </div>;
}
