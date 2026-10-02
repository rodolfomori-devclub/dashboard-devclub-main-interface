/**
 * Palco da tela do lead: 1280x720 logicos, escalado para caber no container
 * (sobra em papel). Puro: so desenha o LeadViewModel. Usado pela janela
 * compartilhada (sessao.html) e como miniatura no cockpit.
 */
import { Component, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { LeadViewModel, SceneVM } from '@/lib/diagnostic/presentation';
import { LeadSlate } from './LeadSlate';
import { AberturaScene } from './scenes/AberturaScene';
import { BolsaScene } from './scenes/BolsaScene';
import { CaminhoScene } from './scenes/CaminhoScene';
import { DevolutivaScene } from './scenes/DevolutivaScene';
import { EncerramentoScene } from './scenes/EncerramentoScene';
import { MercadoScene } from './scenes/MercadoScene';
import { MomentoScene } from './scenes/MomentoScene';
import { MontandoScene } from './scenes/MontandoScene';
import { ObjetivoScene } from './scenes/ObjetivoScene';
import { PalavrasScene } from './scenes/PalavrasScene';
import { PlanoScene } from './scenes/PlanoScene';
import { ProximoScene } from './scenes/ProximoScene';
import { TempoScene } from './scenes/TempoScene';
// Ordem importa: as cenas ajustam as pecas comuns.
import './lead.css';
import './lead-scenes.css';

export const STAGE_WIDTH = 1280;
export const STAGE_HEIGHT = 720;

function useStageScale() {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w > 0 && h > 0) setScale(Math.min(w / STAGE_WIDTH, h / STAGE_HEIGHT));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, scale };
}

function SceneView({ scene }: { scene: SceneVM }) {
  switch (scene.id) {
    case 'abertura':
      return <AberturaScene scene={scene} />;
    case 'momento':
      return <MomentoScene scene={scene} />;
    case 'tempo':
      return <TempoScene scene={scene} />;
    case 'mercado':
      return <MercadoScene scene={scene} />;
    case 'montando':
      return <MontandoScene scene={scene} />;
    case 'palavras':
      return <PalavrasScene scene={scene} />;
    case 'objetivo':
      return <ObjetivoScene scene={scene} />;
    case 'devolutiva':
      return <DevolutivaScene scene={scene} />;
    case 'plano':
      return <PlanoScene scene={scene} />;
    case 'caminho':
      return <CaminhoScene scene={scene} />;
    case 'proximo':
      return <ProximoScene scene={scene} />;
    case 'bolsa':
      return <BolsaScene scene={scene} />;
    case 'encerramento':
      return <EncerramentoScene scene={scene} />;
    default:
      return null;
  }
}

/** Cena que quebrar vira a tela de pausa; o proximo passo tenta de novo. */
class SceneBoundary extends Component<{ resetKey: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidUpdate(prev: { resetKey: string }) {
    if (this.state.failed && prev.resetKey !== this.props.resetKey) this.setState({ failed: false });
  }

  render() {
    return this.state.failed ? <LeadSlate kind="curtain" /> : this.props.children;
  }
}

function StageContent({ vm }: { vm: LeadViewModel | null }) {
  if (!vm || (!vm.curtain && !vm.scene)) return <LeadSlate kind="standby" />;
  if (vm.curtain || !vm.scene) return <LeadSlate kind="curtain" />;
  const scene = vm.scene;
  return (
    <>
      <div className="lead-head">
        <span className="lead-head-mark" aria-hidden="true" />
        <span className="lead-head-label">
          Diagnóstico de Carreira com IA{vm.firstName ? ` · ${vm.firstName}` : ''}
        </span>
      </div>
      <div className="lead-body">
        <SceneBoundary key={scene.id} resetKey={`${scene.id}:${scene.step}`}>
          <div className="lead-scene">
            <SceneView scene={scene} />
          </div>
        </SceneBoundary>
      </div>
      {vm.disclaimer && <div className="lead-foot">{vm.disclaimer}</div>}
    </>
  );
}

export function LeadStage({ vm, className }: { vm: LeadViewModel | null; className?: string }) {
  const { ref, scale } = useStageScale();
  return (
    <div ref={ref} className={className ? `lead-surface ${className}` : 'lead-surface'}>
      <div className="lead-stage" style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>
        <StageContent vm={vm} />
      </div>
    </div>
  );
}
