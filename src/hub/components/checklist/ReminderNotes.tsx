import { useState } from 'react';
import { Plus, X, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export interface Reminder {
  id: string;
  text: string;
  done: boolean;
}

interface ReminderNotesProps {
  reminders: Reminder[];
  onAdd: (text: string) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

export function ReminderNotes({ reminders, onAdd, onToggle, onDelete }: ReminderNotesProps) {
  const [newText, setNewText] = useState('');

  const handleAdd = () => {
    const trimmed = newText.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setNewText('');
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-lg">📌</span>
        <h2 className="text-sm font-semibold text-foreground">Lembretes do Dia</h2>
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <Input
          placeholder="Ex: Fazer follow no lead João..."
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          className="bg-background/50 border-border/50 text-sm"
        />
        <Button size="sm" onClick={handleAdd} className="shrink-0 gap-1">
          <Plus className="h-3.5 w-3.5" />
          Adicionar
        </Button>
      </div>

      {/* Notes grid */}
      {reminders.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {reminders.map((r) => (
            <div
              key={r.id}
              className={`relative rounded-lg p-3 shadow-md border transition-all duration-200 ${
                r.done
                  ? 'bg-amber-100/50 dark:bg-amber-900/20 border-amber-200/50 dark:border-amber-700/30 opacity-60'
                  : 'bg-amber-100 dark:bg-amber-900/40 border-amber-200 dark:border-amber-700/50'
              }`}
              style={{
                transform: `rotate(${(Math.random() - 0.5) * 2}deg)`,
              }}
            >
              <p
                className={`text-sm pr-12 ${
                  r.done
                    ? 'line-through text-amber-800/60 dark:text-amber-200/50'
                    : 'text-amber-900 dark:text-amber-100'
                }`}
              >
                {r.text}
              </p>
              <div className="absolute top-2 right-2 flex gap-1">
                <button
                  onClick={() => onToggle(r.id)}
                  className={`p-1 rounded hover:bg-amber-200/60 dark:hover:bg-amber-800/40 transition-colors ${
                    r.done ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-300'
                  }`}
                  title={r.done ? 'Desfazer' : 'Concluir'}
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => onDelete(r.id)}
                  className="p-1 rounded hover:bg-red-200/60 dark:hover:bg-red-900/40 text-amber-700/60 dark:text-amber-300/60 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                  title="Remover"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {reminders.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-2">Nenhum lembrete ainda. Adicione acima!</p>
      )}
    </div>
  );
}
