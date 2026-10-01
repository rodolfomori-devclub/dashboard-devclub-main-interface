import { useEffect, useState, useCallback, useRef, memo } from 'react';
import { createPortal } from 'react-dom';
import { Trophy, Target, Star, Zap, Rocket, Flame } from 'lucide-react';
import { useTvPerformance } from '@/contexts/TvPerformanceContext';

export type CelebrationEvent = {
  type: 'new-leader' | 'goal-achieved' | 'team-goal' | 'overtake' | 'pace-achieved' | 'team-milestone-50' | 'team-milestone-70';
  sellerName?: string;
  sellerInitials?: string;
  overtakenName?: string;
  newPosition?: number;
  teamGoalValue?: number;
};

interface CelebrationOverlayProps {
  event: CelebrationEvent | null;
  onDone: () => void;
}

// Lightweight confetti — reduced particles in TV perf mode
const ConfettiCanvas = memo(function ConfettiCanvas({ intensity = 1, duration = 8000, lite = false }: { intensity?: number; duration?: number; lite?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Canvas fillStyle cannot parse var(), so resolve the design tokens at runtime.
    // Paleta de festa DevClub: verde da marca + roxo premium + branco/off-white.
    const cs = getComputedStyle(document.documentElement);
    const token = (name: string) => cs.getPropertyValue(name).trim();
    const colors = [
      token('--primary'),
      token('--brand-grad-end'),
      token('--brand-premium'),
      token('--foreground'),
      token('--warning'),
      token('--dc-info-solid'),
    ].filter(Boolean);
    if (colors.length === 0) colors.push('#39d353'); // fallback: verde DevClub

    // In lite mode, halve particles for GPU savings
    const particleCount = Math.floor((lite ? 50 : 120) * intensity);
    const particles = Array.from({ length: particleCount }, () => ({
      x: Math.random() * canvas.width,
      y: -20 - Math.random() * canvas.height * 0.5,
      vx: (Math.random() - 0.5) * 4,
      vy: Math.random() * 3 + 2,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 10,
      width: Math.random() * 10 + 5,
      height: Math.random() * 6 + 3,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));

    let animId: number;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      if (elapsed > duration) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const fadeOut = elapsed > duration - 2000 ? (duration - elapsed) / 2000 : 1;

      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05;
        p.vx *= 0.99;
        p.rotation += p.rotationSpeed;

        if (p.y > canvas.height + 20) {
          p.y = -20;
          p.x = Math.random() * canvas.width;
          p.vy = Math.random() * 3 + 2;
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = fadeOut;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height);
        ctx.restore();
      });

      animId = requestAnimationFrame(animate);
    };

    animate();
    return () => cancelAnimationFrame(animId);
  }, [intensity, duration, lite]);

  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-10" />;
});

const CELEBRATION_CONFIGS: Record<CelebrationEvent['type'], {
  getTitle: (e: CelebrationEvent) => string;
  getSubtitle: (e: CelebrationEvent) => string;
  icon: typeof Trophy;
  glowColor: string;
  confettiIntensity: number;
  duration: number;
}> = {
  'overtake': {
    getTitle: () => '🔥 ULTRAPASSAGEM!',
    getSubtitle: (e) => `${e.sellerName} ultrapassou ${e.overtakenName} e agora está em ${e.newPosition}º lugar!`,
    icon: Flame,
    glowColor: 'var(--warning)',
    confettiIntensity: 0.7,
    duration: 6000,
  },
  'new-leader': {
    getTitle: () => '👑 NOVO LÍDER DO RANKING',
    getSubtitle: (e) => `${e.sellerName} assumiu a liderança!`,
    icon: Trophy,
    glowColor: 'var(--warning)',
    confettiIntensity: 1.0,
    duration: 8000,
  },
  'goal-achieved': {
    getTitle: () => '🎯 META BATIDA!',
    getSubtitle: (e) => `${e.sellerName} bateu sua meta mensal!`,
    icon: Target,
    glowColor: 'var(--primary)',
    confettiIntensity: 1.2,
    duration: 8000,
  },
  'pace-achieved': {
    getTitle: () => '⚡ PACE DIÁRIO ATINGIDO!',
    getSubtitle: (e) => `${e.sellerName} atingiu o ritmo ideal de vendas do dia!`,
    icon: Zap,
    glowColor: 'var(--dc-info-solid)',
    confettiIntensity: 0.6,
    duration: 6000,
  },
  'team-milestone-50': {
    getTitle: () => '🚀 50% DA META!',
    getSubtitle: () => 'O time chegou a 50% da meta!',
    icon: Rocket,
    glowColor: 'var(--dc-info-solid)',
    confettiIntensity: 0.8,
    duration: 6000,
  },
  'team-milestone-70': {
    getTitle: () => '🔥 70% DA META!',
    getSubtitle: () => '70% da meta atingida! Vamos com tudo!',
    icon: Flame,
    glowColor: 'var(--warning)',
    confettiIntensity: 1.0,
    duration: 7000,
  },
  'team-goal': {
    getTitle: () => '🏆 O TIME ESPANCOU A META!!!',
    getSubtitle: () => 'Parabéns time, cumprimos a nossa missão do mês!',
    icon: Star,
    glowColor: 'var(--brand-premium)',
    confettiIntensity: 2,
    duration: 10000,
  },
};

export function CelebrationOverlay({ event, onDone }: CelebrationOverlayProps) {
  const [visible, setVisible] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const isTvPerf = useTvPerformance();

  useEffect(() => {
    if (!event) {
      setVisible(false);
      setFadeOut(false);
      return;
    }

    setVisible(true);
    setFadeOut(false);

    const config = CELEBRATION_CONFIGS[event.type];
    const duration = config?.duration ?? 8000;
    const fadeStart = duration - 2000;

    timerRef.current = setTimeout(() => setFadeOut(true), fadeStart);
    const endTimer = setTimeout(() => {
      setVisible(false);
      setFadeOut(false);
      onDone();
    }, duration);

    return () => {
      clearTimeout(timerRef.current);
      clearTimeout(endTimer);
    };
  }, [event, onDone]);

  if (!visible || !event) return null;

  const config = CELEBRATION_CONFIGS[event.type];
  if (!config) return null;

  const IconComponent = config.icon;
  const title = config.getTitle(event);
  const subtitle = config.getSubtitle(event);
  const glow = config.glowColor;
  // glowColor agora e um token var(); sufixo hex de alpha nao funciona mais.
  const glowAlpha = (pct: number) => `color-mix(in oklch, ${glow} ${pct}%, transparent)`;

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center"
      style={{
        opacity: fadeOut ? 0 : 1,
        transition: 'opacity 1s ease-in-out',
        willChange: 'opacity',
      }}
    >
      {/* Backdrop — lighter blur in TV perf mode */}
      <div className={`absolute inset-0 ${isTvPerf ? 'bg-background/85' : 'bg-background/80 backdrop-blur-sm'}`} />

      {/* Glow — simplified: no blur filter in TV perf mode */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full animate-pulse"
          style={{
            backgroundColor: config.glowColor,
            opacity: 0.2,
            filter: isTvPerf ? 'blur(60px)' : 'blur(100px)',
            willChange: 'opacity',
          }}
        />
      </div>

      {/* Confetti — lite mode in TV perf */}
      <ConfettiCanvas intensity={config.confettiIntensity} duration={config.duration} lite={isTvPerf} />

      {/* Content */}
      <div className="relative z-20 flex flex-col items-center gap-6 animate-scale-in">
        <div
          className="relative w-32 h-32 rounded-full flex items-center justify-center"
          style={{
            boxShadow: isTvPerf
              ? `0 0 30px 10px ${glowAlpha(38)}`
              : `0 0 40px 15px ${glow}, 0 0 80px 30px ${glowAlpha(25)}`,
            background: `radial-gradient(circle, ${glowAlpha(19)}, transparent)`,
          }}
        >
          {event.sellerInitials ? (
            <div
              className="w-28 h-28 rounded-full flex items-center justify-center text-4xl font-bold border-4"
              style={{
                borderColor: glow,
                backgroundColor: glowAlpha(13),
                color: glow,
              }}
            >
              {event.sellerInitials}
            </div>
          ) : (
            <IconComponent
              className="w-16 h-16"
              style={{ color: glow, filter: isTvPerf ? 'none' : `drop-shadow(0 0 12px ${glow})` }}
            />
          )}
        </div>

        <h1
          className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-center"
          style={{
            color: glow,
            textShadow: isTvPerf ? 'none' : `0 0 30px ${glowAlpha(50)}, 0 0 60px ${glowAlpha(25)}`,
          }}
        >
          {title}
        </h1>

        <p className="text-xl md:text-2xl lg:text-3xl font-semibold text-foreground text-center max-w-2xl">
          {subtitle}
        </p>

        {event.type === 'team-goal' && (
          <div className="flex gap-4 mt-4">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={`w-8 h-8 ${isTvPerf ? '' : 'animate-pulse'}`}
                style={{
                  color: 'var(--warning)',
                  filter: isTvPerf ? 'none' : 'drop-shadow(0 0 8px var(--warning))',
                  animationDelay: `${i * 0.2}s`,
                }}
                fill="currentColor"
              />
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
