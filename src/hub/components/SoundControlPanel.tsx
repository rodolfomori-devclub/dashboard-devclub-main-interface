import { useState, useEffect, useCallback, useRef } from 'react';
import { Volume2, VolumeX, Volume1 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { audioManager } from '@/lib/audioManager';
import { toast } from 'sonner';

interface SoundControlPanelProps {
  variant?: 'default' | 'tv';
}

export function SoundControlPanel({ variant = 'default' }: SoundControlPanelProps) {
  const [settings, setSettings] = useState(audioManager.getSettings());
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    return audioManager.subscribe(setSettings);
  }, []);

  const toggleSound = useCallback(() => {
    const newEnabled = !settings.enabled;
    audioManager.setEnabled(newEnabled);
    if (newEnabled) {
      setTimeout(() => {
        audioManager.playTestSound();
        toast.success('Som ativado — teste de áudio executado');
      }, 100);
    } else {
      toast.info('Som desativado');
    }
  }, [settings.enabled]);

  const handleVolumeChange = useCallback((value: number[]) => {
    const vol = value[0] / 100;
    audioManager.setVolume(vol);
    if (vol > 0 && !settings.enabled) {
      audioManager.setEnabled(true);
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      audioManager.playTestSound();
    }, 400);
  }, [settings.enabled]);

  const VolumeIcon = settings.volume === 0 || !settings.enabled
    ? VolumeX
    : settings.volume < 0.5
      ? Volume1
      : Volume2;

  const isTv = variant === 'tv';

  return (
    <div className={`flex items-center gap-2 ${isTv ? 'gap-3' : ''}`}>
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleSound}
        className={`text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all ${
          settings.enabled ? 'text-primary' : ''
        } ${isTv ? 'h-10 w-10' : ''}`}
        title={settings.enabled ? 'Desativar som' : 'Ativar som'}
      >
        <VolumeIcon className={isTv ? 'h-5 w-5' : 'h-4 w-4'} />
      </Button>
      <div className={`flex items-center ${isTv ? 'w-40' : 'w-28'}`}>
        <Slider
          value={[Math.round(settings.volume * 100)]}
          min={0}
          max={100}
          step={5}
          onValueChange={handleVolumeChange}
          className="cursor-pointer"
        />
      </div>
      <span className={`text-muted-foreground min-w-[2.5rem] text-right ${isTv ? 'text-sm' : 'text-xs'}`}>
        {Math.round(settings.volume * 100)}%
      </span>
    </div>
  );
}
