import { useState, useEffect, useCallback, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, FileText, Save, CheckCircle2, Download, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { RichTextEditor } from '@/components/notes/RichTextEditor';
import { exportNoteToPdf, shareNoteOnWhatsApp } from '@/lib/notesExport';

export default function ManagerNotes() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [notesMap, setNotesMap] = useState<Record<string, string>>({});
  const [loadingNotes, setLoadingNotes] = useState(false);

  const days = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const firstDayOffset = getDay(days[0]);

  // Load all notes for current month
  useEffect(() => {
    if (!user) return;
    const loadNotes = async () => {
      setLoadingNotes(true);
      const startDate = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
      const { data } = await supabase
        .from('manager_notes')
        .select('date, content')
        .eq('user_id', user.id)
        .gte('date', startDate)
        .lte('date', endDate);

      const map: Record<string, string> = {};
      data?.forEach(n => { map[n.date] = n.content; });
      setNotesMap(map);
      setLoadingNotes(false);
    };
    loadNotes();
  }, [currentMonth, user]);

  // Load content when selecting a day
  useEffect(() => {
    if (!selectedDate) return;
    const key = format(selectedDate, 'yyyy-MM-dd');
    setContent(notesMap[key] || '');
    setSaved(false);
  }, [selectedDate, notesMap]);

  // Auto-save with debounce
  useEffect(() => {
    if (!selectedDate || !user) return;
    setSaved(false);
    const timeout = setTimeout(() => {
      saveNote();
    }, 1500);
    return () => clearTimeout(timeout);
  }, [content]);

  const saveNote = useCallback(async () => {
    if (!selectedDate || !user) return;
    setSaving(true);
    const dateStr = format(selectedDate, 'yyyy-MM-dd');

    const { error } = await supabase
      .from('manager_notes')
      .upsert(
        { user_id: user.id, date: dateStr, content },
        { onConflict: 'user_id,date' }
      );

    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    } else {
      setNotesMap(prev => ({ ...prev, [dateStr]: content }));
      setSaved(true);
    }
    setSaving(false);
  }, [selectedDate, user, content, toast]);

  const prevMonth = () => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  const nextMonth = () => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <FileText className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Anotações de Daily</h1>
          <p className="text-sm text-muted-foreground">Registre os resumos das dailys com seu time comercial</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Calendar */}
        <div className="glass-surface border border-border rounded-xl p-4 md:p-6">
          <div className="flex items-center justify-between mb-6">
            <Button variant="ghost" size="icon" onClick={prevMonth}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <h2 className="text-lg font-semibold capitalize text-foreground">
              {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
            </h2>
            <Button variant="ghost" size="icon" onClick={nextMonth}>
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>

          {/* Week headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {weekDays.map(d => (
              <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDayOffset }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {days.map(day => {
              const key = format(day, 'yyyy-MM-dd');
              const hasNote = !!(notesMap[key] && notesMap[key].trim().length > 0);
              const isSelected = selectedDate && isSameDay(day, selectedDate);
              const today = isToday(day);

              return (
                <button
                  key={key}
                  onClick={() => setSelectedDate(day)}
                  className={cn(
                    'relative aspect-square rounded-lg flex flex-col items-center justify-center text-sm transition-all duration-200 hover:bg-accent/50 border',
                    isSelected
                      ? 'bg-primary text-primary-foreground border-primary shadow-lg scale-105'
                      : today
                      ? 'border-primary/40 bg-primary/10 text-primary font-semibold'
                      : 'border-transparent text-foreground',
                    hasNote && !isSelected && 'bg-accent/30'
                  )}
                >
                  <span className="text-sm">{format(day, 'd')}</span>
                  {hasNote && (
                    <div className={cn(
                      'w-1.5 h-1.5 rounded-full mt-0.5',
                      isSelected ? 'bg-primary-foreground' : 'bg-primary'
                    )} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-primary" />
              <span>Com anotação</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full border border-primary/40" />
              <span>Hoje</span>
            </div>
          </div>
        </div>

        {/* Note editor */}
        <div className="glass-surface border border-border rounded-xl p-4 md:p-6 flex flex-col">
          {selectedDate ? (
            <>
              <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">
                    {format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {format(selectedDate, 'EEEE', { locale: ptBR })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {saving && (
                    <span className="text-xs text-muted-foreground animate-pulse flex items-center gap-1">
                      <Save className="h-3 w-3" /> Salvando...
                    </span>
                  )}
                  {saved && !saving && (
                    <span className="text-xs text-green-500 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Salvo
                    </span>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => exportNoteToPdf(selectedDate, content).catch(() => toast({ title: 'Não foi possível gerar o PDF', description: 'Tente novamente.', variant: 'destructive' }))}
                    disabled={!content.trim()}
                  >
                    <Download className="h-4 w-4 mr-1" /> PDF
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => shareNoteOnWhatsApp(selectedDate, content)}
                    disabled={!content.trim()}
                    className="text-green-500 hover:text-green-400 border-green-500/30 hover:border-green-500/60"
                  >
                    <Share2 className="h-4 w-4 mr-1" /> WhatsApp
                  </Button>
                </div>
              </div>
              <RichTextEditor
                content={content}
                onChange={setContent}
                placeholder="Escreva aqui o resumo da daily do dia..."
              />
              <p className="text-[11px] text-muted-foreground mt-2">
                As anotações são salvas automaticamente após parar de digitar. Use a barra de ferramentas para formatar texto, inserir imagens e mais.
              </p>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
              <FileText className="h-12 w-12 mb-3 opacity-30" />
              <p className="text-sm font-medium">Selecione um dia no calendário</p>
              <p className="text-xs mt-1">para visualizar ou criar uma anotação</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
