import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSalesLinks, useAddSalesLink, useUpdateSalesLink, useDeleteSalesLink } from '@/hooks/useSupabaseData';
import { Copy, Link2, Plus, Pencil, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';

export default function SalesLinksPage() {
  const { user } = useAuth();
  const { data: links = [] } = useSalesLinks(user!.id);
  const addLink = useAddSalesLink();
  const updateLink = useUpdateSalesLink();
  const deleteLink = useDeleteSalesLink();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const copyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success('Link copiado!');
  };

  const handleDelete = (id: string) => {
    if (confirm('Excluir este link?')) deleteLink.mutate(id);
  };

  const openNew = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (link: any) => { setEditing(link); setFormOpen(true); };

  return (
    <div className="page-container space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="page-title">Meus Links de Venda</h2>
          <p className="page-subtitle">Gerencie seus links de checkout</p>
        </div>
        <Dialog open={formOpen} onOpenChange={setFormOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openNew} className="btn-gradient text-primary-foreground">
              <Plus className="h-3.5 w-3.5 mr-1" /> Cadastrar novo link
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? 'Editar Link' : 'Novo Link de Venda'}</DialogTitle>
            </DialogHeader>
            <LinkForm
              link={editing}
              userId={user!.id}
              onSave={() => setFormOpen(false)}
              onCancel={() => setFormOpen(false)}
              addLink={addLink}
              updateLink={updateLink}
            />
          </DialogContent>
        </Dialog>
      </div>

      {links.length === 0 ? (
        <div className="glass-card p-8 text-center text-muted-foreground text-sm">
          Nenhum link cadastrado. Clique em "Cadastrar novo link" para começar.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {links.map((link: any) => (
            <div key={link.id} className="glass-card-hover p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <Link2 className="h-4 w-4 text-primary shrink-0" />
                  <h3 className="font-medium text-foreground truncate">{link.product_name}</h3>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-accent/50" onClick={() => openEdit(link)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-error hover:bg-accent/50" onClick={() => handleDelete(link.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              {Number(link.price) > 0 && (
                <p className="text-lg font-bold text-primary">
                  R$ {Number(link.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              )}
              <p className="text-xs text-muted-foreground truncate">{link.link_url}</p>
              <Button variant="outline" size="sm" className="w-full border-border/50 hover:bg-accent/50" onClick={() => copyLink(link.link_url)}>
                <Copy className="h-3.5 w-3.5 mr-1" /> Copiar Link
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LinkForm({ link, userId, onSave, onCancel, addLink, updateLink }: {
  link: any | null;
  userId: string;
  onSave: () => void;
  onCancel: () => void;
  addLink: any;
  updateLink: any;
}) {
  const [productName, setProductName] = useState(link?.product_name || '');
  const [price, setPrice] = useState(link?.price?.toString() || '');
  const [linkUrl, setLinkUrl] = useState(link?.link_url || '');
  const [errors, setErrors] = useState<string[]>([]);

  const validate = () => {
    const errs: string[] = [];
    if (!productName.trim()) errs.push('Produto é obrigatório.');
    if (!linkUrl.trim()) errs.push('Link é obrigatório.');
    try { new URL(linkUrl.trim()); } catch { if (linkUrl.trim()) errs.push('Link deve ser uma URL válida.'); }
    return errs;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validate();
    if (validationErrors.length > 0) { setErrors(validationErrors); return; }
    setErrors([]);

    const data = {
      product_name: productName.trim(),
      link_url: linkUrl.trim(),
      price: parseFloat(price) || 0,
    };

    try {
      if (link) {
        await updateLink.mutateAsync({ id: link.id, ...data });
      } else {
        await addLink.mutateAsync({ seller_id: userId, ...data });
      }
      onSave();
    } catch {
      // Error handled by mutation
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {errors.length > 0 && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-sm text-error space-y-1">
          {errors.map((err, i) => <p key={i}>• {err}</p>)}
        </div>
      )}
      <div className="space-y-2">
        <Label>Produto *</Label>
        <Input value={productName} onChange={e => setProductName(e.target.value)} placeholder="Ex: DevClub" />
      </div>
      <div className="space-y-2">
        <Label>Preço (R$)</Label>
        <Input type="number" step="0.01" value={price} onChange={e => setPrice(e.target.value)} placeholder="0,00" />
      </div>
      <div className="space-y-2">
        <Label>Link *</Label>
        <Input value={linkUrl} onChange={e => setLinkUrl(e.target.value)} placeholder="https://..." />
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" className="btn-gradient text-primary-foreground">
          {link ? 'Atualizar' : 'Cadastrar'}
        </Button>
      </div>
    </form>
  );
}
