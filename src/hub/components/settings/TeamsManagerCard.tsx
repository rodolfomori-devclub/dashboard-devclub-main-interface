import { useState } from 'react';
import { Users, Plus, Pencil, Archive, ArchiveRestore, Save, X, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTeams, useUpsertTeam, useArchiveTeam, useDeleteTeam, Team } from '@/hooks/useTeams';
import { useProfiles, useUpdateProfile } from '@/hooks/useSupabaseData';
import { TeamAvatar } from '@/components/TeamAvatar';
import { requestApi } from '../../../lib/api';
import { toast } from 'sonner';

export function TeamsManagerCard() {
  const { data: teams = [] } = useTeams(true);
  const { data: profiles = [] } = useProfiles();
  const upsert = useUpsertTeam();
  const archive = useArchiveTeam();
  const del = useDeleteTeam();
  const updateProfile = useUpdateProfile();

  const [editing, setEditing] = useState<Partial<Team> | null>(null);
  const [uploading, setUploading] = useState(false);

  const openNew = () => setEditing({ name: '', description: '', image_url: '', archived: false });
  const openEdit = (t: Team) => setEditing({ ...t });

  const save = async () => {
    if (!editing?.name?.trim()) {
      toast.error('Informe o nome do time');
      return;
    }
    await upsert.mutateAsync(editing as any);
    setEditing(null);
  };

  const uploadImage = async (file: File) => {
    if (!editing) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      toast.error('Envie uma imagem PNG, JPEG ou WebP de até 5 MB.');
      return;
    }
    const editingId = editing.id;
    setUploading(true);
    try {
      const data = await requestApi(`/hub/avatars/upload?name=${encodeURIComponent(file.name)}`, {
        method: 'POST', headers: { 'Content-Type': file.type }, body: file,
      });
      setEditing(current => current && current.id === editingId ? { ...current, image_url: data.url } : current);
    } catch (err: any) {
      toast.error('Erro no upload: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const assignToTeam = async (profileId: string, teamId: string | null) => {
    await updateProfile.mutateAsync({ id: profileId, team_id: teamId });
  };

  const sellers = profiles.filter((p: any) => p.active && (p.role === 'vendedor' || p.role === 'pre-vendedor' || p.role === 'gestor'));

  return (
    <div className="glass-card p-6 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/15 flex items-center justify-center text-primary">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">Times</h3>
            <p className="text-xs text-muted-foreground">Crie times, atribua membros e defina avatares. Cada usuário pertence a um único time.</p>
          </div>
        </div>
        <Button size="sm" onClick={openNew} className="btn-gradient text-primary-foreground gap-1.5"><Plus className="h-4 w-4" /> Novo Time</Button>
      </div>

      <div className="space-y-3">
        {teams.map((t) => {
          const members = profiles.filter((p: any) => p.team_id === t.id);
          return (
            <div key={t.id} className={`rounded-xl border p-4 space-y-3 ${t.archived ? 'border-border/30 bg-muted/10 opacity-70' : 'border-border/40 bg-accent/10'}`}>
              <div className="flex items-center gap-3">
                <TeamAvatar name={t.name} imageUrl={t.image_url} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-foreground truncate">{t.name}{t.archived && <span className="ml-2 text-xs text-muted-foreground">(arquivado)</span>}</p>
                  {t.description && <p className="text-xs text-muted-foreground truncate">{t.description}</p>}
                  <p className="text-[11px] text-muted-foreground mt-0.5">{members.length} membro(s)</p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => archive.mutate({ id: t.id, archived: !t.archived })}>
                    {t.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => {
                    if (confirm(`Excluir o time "${t.name}"? Os membros ficarão sem time.`)) del.mutate(t.id);
                  }}><Trash2 className="h-4 w-4 text-error" /></Button>
                </div>
              </div>
              {!t.archived && (
                <div className="flex flex-wrap gap-1.5">
                  {members.map((m: any) => (
                    <span key={m.id} className="inline-flex items-center gap-1 bg-primary/10 border border-primary/20 rounded-full px-2.5 py-0.5 text-xs">
                      {m.name}
                      <button onClick={() => assignToTeam(m.id, null)} className="text-muted-foreground hover:text-error"><X className="h-3 w-3" /></button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Member assignment */}
      <div className="border-t border-border/30 pt-4 space-y-2">
        <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Atribuir usuários</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {sellers.map((p: any) => (
            <div key={p.id} className="flex items-center gap-2 bg-accent/20 rounded-md px-3 py-2 border border-border/30">
              <span className="flex-1 text-sm truncate">{p.name} <span className="text-xs text-muted-foreground">({p.role})</span></span>
              <Select value={p.team_id || 'none'} onValueChange={(v) => assignToTeam(p.id, v === 'none' ? null : v)}>
                <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem time</SelectItem>
                  {teams.filter(t => !t.archived).map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing?.id ? 'Editar Time' : 'Novo Time'}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <TeamAvatar name={editing.name || '?'} imageUrl={editing.image_url} size="xl" />
                <div className="space-y-1.5 flex-1">
                  <Label className="text-xs">Logo / Avatar</Label>
                  <Input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading} onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])} />
                  <Input type="url" placeholder="ou cole uma URL" value={editing.image_url || ''} onChange={(e) => setEditing({ ...editing, image_url: e.target.value })} className="text-xs" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Nome do Time</Label>
                <Input value={editing.name || ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Ex.: Global Propica" />
              </div>
              <div>
                <Label className="text-xs">Descrição (opcional)</Label>
                <Textarea rows={2} value={editing.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={save} disabled={upsert.isPending || uploading} className="btn-gradient text-primary-foreground gap-1.5"><Save className="h-4 w-4" /> Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
