import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreateDiagnostic } from '@/hooks/useDiagnosticData';
import { diagnosticPaths } from '@/lib/diagnostic/routes';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate: string;
}

/** So o essencial para abrir a sessao; o resto do lead se preenche na preparacao. */
export function NewDiagnosisDialog({ open, onOpenChange, defaultDate }: Props) {
  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState('');
  const [wasOpen, setWasOpen] = useState(open);
  const create = useCreateDiagnostic();
  const navigate = useNavigate();

  // O dialogo fica montado na lista: a cada abertura a data volta para o dia de
  // hoje (a pagina pode ter ficado aberta de um dia para o outro).
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setDate(defaultDate);
  }

  const reset = () => {
    setName('');
    setWhatsapp('');
    setDate(defaultDate);
    setTime('');
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || create.isPending) return;
    create.mutate(
      {
        lead: { name: name.trim(), whatsapp: whatsapp.trim() },
        session: { scheduled_date: date || null, scheduled_time: time || null },
      },
      {
        onSuccess: (sessionId) => {
          onOpenChange(false);
          reset();
          navigate(diagnosticPaths.prep(sessionId));
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo diagnóstico</DialogTitle>
          <DialogDescription>
            Os outros dados do lead (cargo, área, objetivo, respostas da aplicação) você completa na preparação.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="diag-new-name">Nome do lead *</Label>
            <Input id="diag-new-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="diag-new-wa">WhatsApp</Label>
            <Input
              id="diag-new-wa"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              inputMode="tel"
              placeholder="(11) 91234-5678"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="diag-new-date">Data da sessão</Label>
              <Input id="diag-new-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="diag-new-time">Horário</Label>
              <Input id="diag-new-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!name.trim() || create.isPending} className="gap-2">
              {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Criar e preparar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
