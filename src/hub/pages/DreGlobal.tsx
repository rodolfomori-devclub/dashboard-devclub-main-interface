import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSales, useProfiles } from '@/hooks/useSupabaseData';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Plus, Trash2, Lock, Unlock, Save, Download } from 'lucide-react';
import { generateDrePdf } from '@/lib/drePdfGenerator';
import { CashCollectedBreakdown } from '@/components/dre/CashCollectedBreakdown';

// ── Types ──
interface CostLine { label: string; value: number | string; }

interface CostSectionProps {
  title: string;
  lines: CostLine[];
  setter: React.Dispatch<React.SetStateAction<CostLine[]>>;
  total: number;
  locked: boolean;
  updateLine: (
    setter: React.Dispatch<React.SetStateAction<CostLine[]>>,
    idx: number,
    field: 'label' | 'value',
    val: string,
  ) => void;
  blurLine: (
    setter: React.Dispatch<React.SetStateAction<CostLine[]>>,
    idx: number,
  ) => void;
  addLine: (setter: React.Dispatch<React.SetStateAction<CostLine[]>>) => void;
  removeLine: (
    setter: React.Dispatch<React.SetStateAction<CostLine[]>>,
    idx: number,
  ) => void;
}

// ── Helpers ──
const GLOBAL_KEYWORDS = ['global'];
const isGlobalProduct = (product: string) =>
  GLOBAL_KEYWORDS.some(k => product.toLowerCase().includes(k));

const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const parseLocalDate = (d: string) => {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day);
};

function CostSection({
  title,
  lines,
  setter,
  total,
  locked,
  updateLine,
  blurLine,
  addLine,
  removeLine,
}: CostSectionProps) {
  return (
    <div className="mb-1">
      <div className="grid grid-cols-[1fr_180px_40px] gap-1 items-center bg-muted/50 px-3 py-1.5 border-y border-border">
        <span className="text-xs font-bold text-foreground uppercase tracking-wide">{title}</span>
        <span className="text-xs font-bold text-right text-foreground">{fmt(total)}</span>
        <span />
      </div>
      {lines.map((line, idx) => (
        <div key={idx} className="grid grid-cols-[1fr_180px_40px] gap-1 items-center px-3 py-1 hover:bg-muted/30 transition-colors">
          <Input
            value={line.label}
            onChange={e => updateLine(setter, idx, 'label', e.target.value)}
            disabled={locked}
            className="h-7 text-xs border-0 bg-transparent shadow-none focus-visible:ring-1 px-1"
            placeholder="Nome"
          />
          <Input
            value={line.value}
            onChange={e => updateLine(setter, idx, 'value', e.target.value)}
            onBlur={() => blurLine(setter, idx)}
            disabled={locked}
            className="h-7 text-xs text-right border-0 bg-transparent shadow-none focus-visible:ring-1 px-1 font-mono"
            placeholder="0,00"
          />
          {!locked && (
            <Button variant="ghost" size="icon" className="h-6 w-6 text-error/60 hover:text-error" onClick={() => removeLine(setter, idx)}>
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      ))}
      {!locked && (
        <div className="px-3 py-1">
          <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground gap-1" onClick={() => addLine(setter)}>
            <Plus className="h-3 w-3" /> Adicionar
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Hook: DRE data ──
function useDreGlobal(month: number, year: number) {
  return useQuery({
    queryKey: ['dre_global', month, year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dre_global' as any)
        .select('*')
        .eq('month', month)
        .eq('year', year)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });
}

function useSaveDre() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dre: any) => {
      const { error } = await supabase
        .from('dre_global' as any)
        .upsert(dre as any, { onConflict: 'month,year' });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dre_global'] });
      toast.success('DRE salvo com sucesso');
    },
    onError: (err: any) => toast.error('Erro ao salvar DRE: ' + err.message),
  });
}

// ── Availability check ──
function isDreAvailable(month: number, year: number): boolean {
  const now = new Date();
  const availDate = new Date(year, month, 2);
  return now >= availDate;
}

// ── Component ──
export default function DreGlobal() {
  const { user } = useAuth();
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const m = now.getMonth();
    return m === 0 ? 12 : m;
  });
  const [selectedYear, setSelectedYear] = useState(() => {
    const m = now.getMonth();
    return m === 0 ? now.getFullYear() - 1 : now.getFullYear();
  });

  const available = isDreAvailable(selectedMonth, selectedYear);

  const { data: dreData, isLoading: dreLoading } = useDreGlobal(selectedMonth, selectedYear);
  const { data: allSales = [] } = useSales();
  const { data: profiles = [] } = useProfiles();
  const saveDre = useSaveDre();

  const globalSales = useMemo(() => {
    return allSales.filter(s => {
      if (!isGlobalProduct(s.product)) return false;
      const d = parseLocalDate(s.date);
      return d.getMonth() + 1 === selectedMonth && d.getFullYear() === selectedYear;
    });
  }, [allSales, selectedMonth, selectedYear]);

  const autoRevenue = useMemo(() => {
    let hubla = 0, tmb = 0;
    globalSales.forEach(s => {
      const platform = (s.platform || '').toLowerCase();
      const amount = Number(s.amount) || 0;
      if (platform.includes('tmb')) tmb += amount;
      else hubla += amount;
    });
    return { hubla, tmb, total: hubla + tmb };
  }, [globalSales]);

  const autoCc = useMemo(() => {
    let hubla = 0, tmb = 0;
    globalSales.forEach(s => {
      const platform = (s.platform || '').toLowerCase();
      const totalSaleValue = Number(s.total_sale_value) || Number(s.amount) || 0;
      const amount = Number(s.amount) || 0;
      if (platform.includes('tmb')) {
        tmb += totalSaleValue * 0.1;
      } else {
        hubla += amount;
      }
    });
    return { hubla, tmb, total: hubla + tmb };
  }, [globalSales]);

  const autoComissoes = useMemo(() => {
    const map: Record<string, number> = {};
    globalSales.forEach(s => {
      const sellerName = profiles.find(p => p.id === s.seller_id)?.name || 'Desconhecido';
      const cv = Number(s.commission_value) || 0;
      map[sellerName] = (map[sellerName] || 0) + cv;
    });
    return Object.entries(map).map(([label, value]) => ({ label: `${label} (Comissões)`, value }));
  }, [globalSales, profiles]);

  const [costsTime, setCostsTime] = useState<CostLine[]>([]);
  const [costsMarketing, setCostsMarketing] = useState<CostLine[]>([]);
  const [costsFerramentas, setCostsFerramentas] = useState<CostLine[]>([]);
  const [costsComissoes, setCostsComissoes] = useState<CostLine[]>([]);
  const [impostosManual, setImpostosManual] = useState<number | string | null>(null);
  const [overheadFixo, setOverheadFixo] = useState<number | string>(0);
  const [locked, setLocked] = useState(false);
  const [loaded, setLoaded] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // Editable revenue & cash collected (overrides auto values from sales)
  const [revHubla, setRevHubla] = useState<number | string>(0);
  const [revTmb, setRevTmb] = useState<number | string>(0);
  const [ccHubla, setCcHubla] = useState<number | string>(0);
  const [ccTmb, setCcTmb] = useState<number | string>(0);

  const revHublaNum = Number(revHubla) || 0;
  const revTmbNum = Number(revTmb) || 0;
  const ccHublaNum = Number(ccHubla) || 0;
  const ccTmbNum = Number(ccTmb) || 0;
  const revTotal = revHublaNum + revTmbNum;
  const ccTotal = ccHublaNum + ccTmbNum;

  const impostosAuto = ccTotal * 0.05;
  const impostos = impostosManual !== null ? impostosManual : impostosAuto;
  const setImpostos = (v: number | string) => setImpostosManual(v);

  const dreKey = `${selectedMonth}-${selectedYear}`;
  if (dreData && loaded !== dreKey) {
    setCostsTime(Array.isArray(dreData.costs_time) ? dreData.costs_time : []);
    setCostsMarketing(Array.isArray(dreData.costs_marketing) ? dreData.costs_marketing : []);
    setCostsFerramentas(Array.isArray(dreData.costs_ferramentas) ? dreData.costs_ferramentas : []);
    setCostsComissoes(Array.isArray(dreData.costs_comissoes) ? dreData.costs_comissoes : []);
    setImpostosManual(Number(dreData.impostos) || 0);
    setOverheadFixo(Number(dreData.overhead_fixo) || 0);
    setRevHubla(Number(dreData.revenue_hubla) || autoRevenue.hubla);
    setRevTmb(Number(dreData.revenue_tmb) || autoRevenue.tmb);
    setCcHubla(Number(dreData.cc_hubla) || autoCc.hubla);
    setCcTmb(Number(dreData.cc_tmb) || autoCc.tmb);
    setLocked(dreData.locked || false);
    setLoaded(dreKey);
    setIsDirty(false);
  } else if (!dreData && !dreLoading && loaded !== dreKey) {
    setCostsTime([
      { label: 'Dani CS', value: 0 },
      { label: 'Teacher Layla', value: 0 },
      { label: 'George', value: 0 },
    ]);
    setCostsMarketing([
      { label: 'Tráfego LinkedIn', value: 0 },
      { label: 'Tráfego Meta', value: 0 },
    ]);
    setCostsFerramentas([
      { label: 'Google Workspace', value: 0 },
      { label: 'Contrato de alunos', value: 0 },
    ]);
    setCostsComissoes(autoComissoes.length > 0 ? autoComissoes : []);
    setImpostosManual(null);
    setOverheadFixo(0);
    setRevHubla(autoRevenue.hubla);
    setRevTmb(autoRevenue.tmb);
    setCcHubla(autoCc.hubla);
    setCcTmb(autoCc.tmb);
    setLocked(false);
    setLoaded(dreKey);
    setIsDirty(false);
  }

  const totalTime = costsTime.reduce((s, c) => s + (Number(c.value) || 0), 0);
  const totalMarketing = costsMarketing.reduce((s, c) => s + (Number(c.value) || 0), 0);
  const totalFerramentas = costsFerramentas.reduce((s, c) => s + (Number(c.value) || 0), 0);
  const totalComissoes = costsComissoes.reduce((s, c) => s + (Number(c.value) || 0), 0);
  const totalSaidas = totalTime + totalMarketing + totalFerramentas + totalComissoes;
  const entrada = ccTotal;
  const lucroLiquido = entrada - totalSaidas - impostosAuto - (Number(overheadFixo) || 0);

  const goBack = () => {
    if (selectedMonth === 1) { setSelectedMonth(12); setSelectedYear(y => y - 1); }
    else setSelectedMonth(m => m - 1);
    setLoaded(null);
  };
  const goForward = () => {
    if (selectedMonth === 12) { setSelectedMonth(1); setSelectedYear(y => y + 1); }
    else setSelectedMonth(m => m + 1);
    setLoaded(null);
  };

  const handleSave = () => {
    saveDre.mutate({
      month: selectedMonth,
      year: selectedYear,
      revenue_hubla: revHublaNum,
      revenue_tmb: revTmbNum,
      cc_hubla: ccHublaNum,
      cc_tmb: ccTmbNum,
      costs_time: costsTime,
      costs_marketing: costsMarketing,
      costs_ferramentas: costsFerramentas,
      costs_comissoes: costsComissoes,
      impostos: impostosAuto,
      overhead_fixo: Number(overheadFixo) || 0,
      locked,
      created_by: user?.id,
    }, {
      onSuccess: () => setIsDirty(false),
    });
  };

  const updateLine = (setter: React.Dispatch<React.SetStateAction<CostLine[]>>, idx: number, field: 'label' | 'value', val: string) => {
    setter(prev => prev.map((c, i) => i === idx ? { ...c, [field]: val } : c));
    setIsDirty(true);
  };
  const blurLine = (setter: React.Dispatch<React.SetStateAction<CostLine[]>>, idx: number) => {
    setter(prev => prev.map((c, i) => i === idx ? { ...c, value: Number(c.value) || 0 } : c));
  };
  const addLine = (setter: React.Dispatch<React.SetStateAction<CostLine[]>>) => {
    setter(prev => [...prev, { label: '', value: 0 }]);
    setIsDirty(true);
  };
  const removeLine = (setter: React.Dispatch<React.SetStateAction<CostLine[]>>, idx: number) => {
    setter(prev => prev.filter((_, i) => i !== idx));
    setIsDirty(true);
  };

  if (!available) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-4">
        <h1 className="text-xl font-bold text-foreground">DRE Global</h1>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={goBack}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm font-semibold text-foreground min-w-[140px] text-center">{months[selectedMonth - 1]} {selectedYear}</span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={goForward}><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <div className="p-8 text-center border border-border rounded-lg bg-card">
          <p className="text-muted-foreground text-sm">O DRE de {months[selectedMonth - 1]}/{selectedYear} estará disponível a partir do dia 2 de {months[selectedMonth % 12]}/{selectedMonth === 12 ? selectedYear + 1 : selectedYear}.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-foreground">DRE Global</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={goBack}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm font-semibold text-foreground min-w-[140px] text-center">{months[selectedMonth - 1]} {selectedYear}</span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={goForward}><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => {
            generateDrePdf({
              month: selectedMonth,
              year: selectedYear,
              revenueHubla: revHublaNum,
              revenueTmb: revTmbNum,
              revenueTotal: revTotal,
              ccHubla: ccHublaNum,
              ccTmb: ccTmbNum,
              ccTotal: ccTotal,
              costsTime, costsMarketing, costsFerramentas, costsComissoes,
              totalTime, totalMarketing, totalFerramentas, totalComissoes, totalSaidas,
              impostos: impostosAuto,
              overheadFixo: Number(overheadFixo) || 0,
              lucroLiquido,
              margemLiquida: entrada > 0 ? (lucroLiquido / entrada) * 100 : null,
              sales: globalSales.sort((a, b) => a.date.localeCompare(b.date)).map(s => ({
                date: s.date,
                seller: profiles.find(p => p.id === s.seller_id)?.name || 'Desconhecido',
                client: s.client_name || '',
                product: s.product,
                platform: s.platform || '',
                origin: s.origin || '',
                commissionValue: Number(s.commission_value) || 0,
                totalValue: Number(s.total_sale_value) || Number(s.amount) || 0,
                note: s.note || '',
              })),
            }).catch(() => toast.error('Não foi possível gerar o PDF. Tente novamente.'));
          }}>
            <Download className="h-3 w-3" /> PDF
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => { setLocked(!locked); }}>
            {locked ? <><Unlock className="h-3 w-3" /> Desbloquear</> : <><Lock className="h-3 w-3" /> Bloquear</>}
          </Button>
          <Button size="sm" className="h-8 text-xs gap-1" onClick={handleSave} disabled={saveDre.isPending}>
            <Save className="h-3 w-3" /> Salvar
          </Button>
        </div>
      </div>

      {/* Cash Collected Breakdown */}
      <CashCollectedBreakdown month={selectedMonth} year={selectedYear} ccHubla={ccHublaNum} ccTmb={ccTmbNum} />

      {/* Spreadsheet */}
      <div className="border border-border rounded-lg bg-card overflow-hidden text-sm">
        {/* RECEITA */}
        <div className="bg-primary/10 px-3 py-2 border-b border-border">
          <span className="text-xs font-black text-primary uppercase tracking-widest">RECEITA</span>
        </div>

        {/* Vendas */}
        <div className="grid grid-cols-[1fr_180px_40px] gap-1 items-center bg-muted/30 px-3 py-1.5 border-b border-border/50">
          <span className="text-xs font-bold text-foreground">VENDAS</span>
          <span className="text-xs font-bold text-right text-foreground">{fmt(revTotal)}</span>
          <span />
        </div>
        <div className="grid grid-cols-[1fr_180px_40px] gap-1 items-center px-3 py-1">
          <span className="text-xs text-muted-foreground pl-3" title={`Sugerido: ${fmt(autoRevenue.hubla)}`}>Hubla</span>
          <Input
            value={revHubla}
            onChange={e => { setRevHubla(e.target.value); setIsDirty(true); }}
            onBlur={() => setRevHubla(Number(revHubla) || 0)}
            disabled={locked}
            className="h-7 text-xs text-right border-0 bg-transparent shadow-none focus-visible:ring-1 px-1 font-mono"
            placeholder="0,00"
          />
          <span />
        </div>
        <div className="grid grid-cols-[1fr_180px_40px] gap-1 items-center px-3 py-1 border-b border-border/30">
          <span className="text-xs text-muted-foreground pl-3" title={`Sugerido: ${fmt(autoRevenue.tmb)}`}>TMB</span>
          <Input
            value={revTmb}
            onChange={e => { setRevTmb(e.target.value); setIsDirty(true); }}
            onBlur={() => setRevTmb(Number(revTmb) || 0)}
            disabled={locked}
            className="h-7 text-xs text-right border-0 bg-transparent shadow-none focus-visible:ring-1 px-1 font-mono"
            placeholder="0,00"
          />
          <span />
        </div>

        {/* Cash Collected */}
        <div className="grid grid-cols-[1fr_180px_40px] gap-1 items-center bg-muted/30 px-3 py-1.5 border-b border-border/50">
          <span className="text-xs font-bold text-foreground">CASH COLLECTED</span>
          <span className="text-xs font-bold text-right text-foreground">{fmt(ccTotal)}</span>
          <span />
        </div>
        <div className="grid grid-cols-[1fr_180px_40px] gap-1 items-center px-3 py-1">
          <span className="text-xs text-muted-foreground pl-3" title={`Sugerido: ${fmt(autoCc.hubla)}`}>Hubla CC</span>
          <Input
            value={ccHubla}
            onChange={e => { setCcHubla(e.target.value); setIsDirty(true); }}
            onBlur={() => setCcHubla(Number(ccHubla) || 0)}
            disabled={locked}
            className="h-7 text-xs text-right border-0 bg-transparent shadow-none focus-visible:ring-1 px-1 font-mono"
            placeholder="0,00"
          />
          <span />
        </div>
        <div className="grid grid-cols-[1fr_180px_40px] gap-1 items-center px-3 py-1 border-b border-border">
          <span className="text-xs text-muted-foreground pl-3" title={`Sugerido: ${fmt(autoCc.tmb)}`}>TMB CC</span>
          <Input
            value={ccTmb}
            onChange={e => { setCcTmb(e.target.value); setIsDirty(true); }}
            onBlur={() => setCcTmb(Number(ccTmb) || 0)}
            disabled={locked}
            className="h-7 text-xs text-right border-0 bg-transparent shadow-none focus-visible:ring-1 px-1 font-mono"
            placeholder="0,00"
          />
          <span />
        </div>

        {/* SAÍDAS */}
        <div className="bg-destructive/10 px-3 py-2 border-b border-border">
          <span className="text-xs font-black text-error uppercase tracking-widest">SAÍDAS</span>
        </div>

        <CostSection title="Time" lines={costsTime} setter={setCostsTime} total={totalTime} locked={locked} updateLine={updateLine} blurLine={blurLine} addLine={addLine} removeLine={removeLine} />
        <CostSection title="Marketing" lines={costsMarketing} setter={setCostsMarketing} total={totalMarketing} locked={locked} updateLine={updateLine} blurLine={blurLine} addLine={addLine} removeLine={removeLine} />
        <CostSection title="Ferramentas" lines={costsFerramentas} setter={setCostsFerramentas} total={totalFerramentas} locked={locked} updateLine={updateLine} blurLine={blurLine} addLine={addLine} removeLine={removeLine} />
        <CostSection title="Comissões" lines={costsComissoes} setter={setCostsComissoes} total={totalComissoes} locked={locked} updateLine={updateLine} blurLine={blurLine} addLine={addLine} removeLine={removeLine} />

        {/* Total Saídas */}
        <div className="grid grid-cols-[1fr_180px_40px] gap-1 items-center bg-destructive/5 px-3 py-2 border-y border-border">
          <span className="text-xs font-black text-error uppercase">TOTAL SAÍDAS</span>
          <span className="text-xs font-black text-right text-error">{fmt(totalSaidas)}</span>
          <span />
        </div>

        {/* RESULTADO */}
        <div className="bg-primary/10 px-3 py-2 border-b border-border">
          <span className="text-xs font-black text-primary uppercase tracking-widest">RESULTADO</span>
        </div>

        <div className="grid grid-cols-[1fr_180px_40px] gap-1 items-center px-3 py-1.5">
          <span className="text-xs font-semibold text-foreground">Entrada (Cash Collected)</span>
          <span className="text-xs font-semibold text-right font-mono text-emerald-600">{fmt(entrada)}</span>
          <span />
        </div>
        <div className="grid grid-cols-[1fr_180px_40px] gap-1 items-center px-3 py-1.5">
          <span className="text-xs font-semibold text-foreground">Saídas</span>
          <span className="text-xs font-semibold text-right font-mono text-error">{fmt(totalSaidas)}</span>
          <span />
        </div>

        {/* Impostos */}
        <div className="grid grid-cols-[1fr_180px_40px] gap-1 items-center px-3 py-1.5">
          <span className="text-xs text-foreground">Impostos (5%)</span>
          <span className="text-xs text-right font-mono text-foreground">{fmt(impostosAuto)}</span>
          <span />
        </div>

        {/* Overhead */}
        <div className="grid grid-cols-[1fr_180px_40px] gap-1 items-center px-3 py-1.5 border-b border-border">
          <span className="text-xs text-foreground">Overhead Fixo</span>
          <Input
            value={overheadFixo}
            onChange={e => { setOverheadFixo(e.target.value); setIsDirty(true); }}
            onBlur={() => setOverheadFixo(Number(overheadFixo) || 0)}
            disabled={locked}
            className="h-7 text-xs text-right border-0 bg-transparent shadow-none focus-visible:ring-1 px-1 font-mono"
            placeholder="0,00"
          />
          <span />
        </div>

        {/* Lucro Líquido */}
        <div className={`grid grid-cols-[1fr_180px_40px] gap-1 items-center px-3 py-3 ${lucroLiquido >= 0 ? 'bg-emerald-500/10' : 'bg-destructive/10'}`}>
          <span className="text-sm font-black text-foreground uppercase">LUCRO LÍQUIDO</span>
          <span className={`text-sm font-black text-right font-mono ${lucroLiquido >= 0 ? 'text-emerald-600' : 'text-error'}`}>
            {fmt(lucroLiquido)}
          </span>
          <span />
        </div>

        {/* Margin */}
        {entrada > 0 && (
          <div className="grid grid-cols-[1fr_180px_40px] gap-1 items-center px-3 py-2 border-t border-border/30 bg-muted/20">
            <span className="text-xs text-muted-foreground">Margem Líquida</span>
            <span className={`text-xs font-semibold text-right ${lucroLiquido >= 0 ? 'text-emerald-600' : 'text-error'}`}>
              {((lucroLiquido / entrada) * 100).toFixed(1)}%
            </span>
            <span />
          </div>
        )}
      </div>

      {/* Detalhamento de Vendas */}
      {globalSales.length > 0 && (
        <div className="border border-border rounded-lg bg-card overflow-hidden text-sm">
          <div className="bg-muted/50 px-3 py-2 border-b border-border">
            <span className="text-xs font-black text-foreground uppercase tracking-widest">
              DETALHAMENTO DE VENDAS ({globalSales.length} vendas)
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Data</th>
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Vendedor</th>
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Cliente</th>
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Produto</th>
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Plataforma</th>
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Origem</th>
                  <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Valor Comissão</th>
                  <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Valor Total</th>
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Obs</th>
                </tr>
              </thead>
              <tbody>
                {globalSales
                  .sort((a, b) => a.date.localeCompare(b.date))
                  .map((s) => {
                    const sellerName = profiles.find(p => p.id === s.seller_id)?.name || 'Desconhecido';
                    const totalVal = Number(s.total_sale_value) || Number(s.amount) || 0;
                    return (
                      <tr key={s.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                        <td className="px-3 py-1.5 font-mono text-muted-foreground whitespace-nowrap">
                          {s.date.split('-').reverse().join('/')}
                        </td>
                        <td className="px-3 py-1.5 text-foreground">{sellerName}</td>
                        <td className="px-3 py-1.5 text-foreground">{s.client_name || '—'}</td>
                        <td className="px-3 py-1.5 text-foreground">{s.product}</td>
                        <td className="px-3 py-1.5 text-muted-foreground">{s.platform || '—'}</td>
                        <td className="px-3 py-1.5 text-muted-foreground">{s.origin || '—'}</td>
                        <td className="px-3 py-1.5 text-right font-mono text-foreground">{fmt(Number(s.commission_value) || 0)}</td>
                        <td className="px-3 py-1.5 text-right font-mono font-semibold text-foreground">{fmt(totalVal)}</td>
                        <td className="px-3 py-1.5 text-muted-foreground max-w-[200px] truncate">{s.note || '—'}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Floating save button */}
      {isDirty && !locked && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <Button
            size="lg"
            className="shadow-lg gap-2 px-6"
            onClick={handleSave}
            disabled={saveDre.isPending}
          >
            <Save className="h-4 w-4" />
            {saveDre.isPending ? 'Salvando...' : 'Salvar alterações'}
          </Button>
        </div>
      )}
    </div>
  );
}
