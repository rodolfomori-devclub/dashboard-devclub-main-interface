import React, { useState, useEffect, useRef } from 'react';
import vidometroService from '../services/vidometroService';
import VidometroCounter from '../components/VidometroCounter';
import PlatformBreakdown from '../components/PlatformBreakdown';
import LastUpdateWidget from '../components/LastUpdateWidget';

const GOAL = 100000;
const GOAL_DEADLINE = new Date('2029-12-31T23:59:59');

const GoalTracker = ({ current }) => {
  const now = new Date();
  const pct = Math.min((current / GOAL) * 100, 100);
  const remaining = GOAL - current;

  // Tempo restante
  const diffMs = GOAL_DEADLINE - now;
  const totalDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  const years = Math.floor(totalDays / 365);
  const months = Math.floor((totalDays % 365) / 30);
  const days = totalDays % 30;

  // Ritmo necessário
  const neededPerDay = totalDays > 0 ? Math.ceil(remaining / totalDays) : 0;
  const neededPerMonth = totalDays > 0 ? Math.ceil(remaining / (totalDays / 30)) : 0;

  // Marcos
  const milestones = [
    { label: '25K', value: 25000 },
    { label: '50K', value: 50000 },
    { label: '75K', value: 75000 },
    { label: '100K', value: 100000 },
  ];

  return (
    <div className="mb-12">
      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg rounded-3xl p-8 border border-white/20 dark:border-gray-700/50 shadow-xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-white mb-1">
            Meta: 100.000 vidas
          </h2>
          <p className="text-gray-500 dark:text-gray-400">
            Até 31 de dezembro de 2029
          </p>
        </div>

        {/* Barra de progresso */}
        <div className="relative mb-3">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-emerald-400 rounded-full transition-all duration-1000 ease-out relative"
              style={{ width: `${Math.max(pct, 1)}%` }}
            >
              <div className="absolute inset-0 bg-white/20 rounded-full animate-pulse" style={{ animationDuration: '3s' }} />
            </div>
          </div>
          {/* Marcos na barra */}
          <div className="absolute inset-0 flex items-center">
            {milestones.map((m) => (
              <div
                key={m.label}
                className="absolute h-8 flex items-center"
                style={{ left: `${(m.value / GOAL) * 100}%` }}
              >
                <div className={`w-0.5 h-full ${current >= m.value ? 'bg-white/40' : 'bg-gray-400/30 dark:bg-gray-500/30'}`} />
              </div>
            ))}
          </div>
        </div>

        {/* Labels marcos */}
        <div className="relative h-5 mb-8">
          {milestones.map((m) => (
            <span
              key={m.label}
              className={`absolute text-[10px] font-semibold -translate-x-1/2 ${
                current >= m.value
                  ? 'text-primary'
                  : 'text-gray-400 dark:text-gray-500'
              }`}
              style={{ left: `${(m.value / GOAL) * 100}%` }}
            >
              {m.label}
            </span>
          ))}
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Progresso */}
          <div className="bg-gradient-to-br from-primary/10 to-emerald-500/10 dark:from-primary/20 dark:to-emerald-500/20 rounded-2xl p-5 text-center">
            <p className="text-3xl md:text-4xl font-black text-primary">{pct.toFixed(1)}%</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">da meta</p>
          </div>

          {/* Faltam */}
          <div className="bg-gradient-to-br from-blue-500/10 to-indigo-500/10 dark:from-blue-500/20 dark:to-indigo-500/20 rounded-2xl p-5 text-center">
            <p className="text-3xl md:text-4xl font-black text-blue-600 dark:text-blue-400">
              {remaining > 1000 ? `${(remaining / 1000).toFixed(1)}K` : remaining.toLocaleString('pt-BR')}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">vidas restantes</p>
          </div>

          {/* Tempo restante */}
          <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 dark:from-amber-500/20 dark:to-orange-500/20 rounded-2xl p-5 text-center">
            <p className="text-2xl md:text-3xl font-black text-amber-600 dark:text-amber-400">
              {years > 0 && <span>{years}a </span>}
              {months > 0 && <span>{months}m </span>}
              <span>{days}d</span>
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">tempo restante</p>
          </div>

          {/* Ritmo necessário */}
          <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 dark:from-purple-500/20 dark:to-pink-500/20 rounded-2xl p-5 text-center">
            <p className="text-3xl md:text-4xl font-black text-purple-600 dark:text-purple-400">
              {neededPerDay}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">vidas/dia necessárias</p>
          </div>
        </div>

        {/* Ritmo mensal */}
        <div className="mt-4 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Ritmo necessário: <span className="font-bold text-gray-700 dark:text-gray-300">{neededPerMonth.toLocaleString('pt-BR')}</span> vidas/mês
            {' · '}<span className="font-bold text-gray-700 dark:text-gray-300">{(neededPerDay * 7).toLocaleString('pt-BR')}</span> vidas/semana
          </p>
        </div>
      </div>
    </div>
  );
};

/**
 * VidometroPage
 * Página principal do Vidômetro com contador animado e breakdown por plataforma
 */
const VidometroPage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastFetchTime, setLastFetchTime] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const pollingIntervalRef = useRef(null);
  const visibilityListenerRef = useRef(null);

  // Fetch inicial
  const fetchData = async () => {
    try {
      setError(null);
      const result = await vidometroService.fetchVidometroData();

      if (result.success !== false) {
        setData(result);
        setLastFetchTime(new Date());
      } else if (result.data) {
        // Sucesso parcial (com erro, mas tem dados em cache)
        setData(result);
        setLastFetchTime(new Date(result.lastRefreshed || new Date()));
      } else {
        throw new Error(result.error || 'Erro desconhecido');
      }
    } catch (err) {
      console.error('Erro ao buscar vidômetro:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  // Fetch inicial ao montar
  useEffect(() => {
    fetchData();
  }, []);

  // Setup polling com 10 segundos (conforme plano aprovado)
  useEffect(() => {
    pollingIntervalRef.current = setInterval(() => {
      fetchData();
    }, 10000);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  // Pausar polling quando a aba não está visível
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
        }
      } else {
        // Retomar polling quando aba volta ao foco
        fetchData();
        pollingIntervalRef.current = setInterval(() => {
          fetchData();
        }, 10000);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    visibilityListenerRef.current = handleVisibilityChange;

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Handler para refresh manual
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    vidometroService.clearCache();
    await fetchData();
  };

  // Extrair valores compatíveis com os componentes
  const total = data?.total || 0;
  const dailyDelta = data?.dailyDelta || 0;
  const platforms = data?.platforms || {};

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900 py-12 px-4">
      {/* Container Principal */}
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-6xl font-black mb-4 bg-gradient-to-r from-primary to-primary-dark bg-clip-text text-transparent">
            Vidômetro
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400">
            Contagem em tempo real de vidas impactadas pelo DevClub
          </p>
        </div>

        {/* Alerta de Erro */}
        {error && !data && (
          <div className="mb-8 p-4 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700/50 rounded-lg text-red-700 dark:text-red-400">
            <p className="font-semibold">⚠️ Erro ao carregar dados</p>
            <p className="text-sm mt-1">{error}</p>
            <button
              onClick={handleManualRefresh}
              className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm font-medium"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {/* Contador Principal */}
        <div className="flex justify-center mb-16">
          <VidometroCounter value={total} loading={loading} previousValue={total - dailyDelta} />
        </div>

        {/* Breakdown por Plataforma */}
        {!loading && (
          <>
            <div className="mb-12">
              <PlatformBreakdown platforms={platforms} />
            </div>

            {/* Meta 100K */}
            <GoalTracker current={total} />

            {/* Update Widget + Refresh Button */}
            <div className="flex flex-col items-center gap-4">
              <LastUpdateWidget
                lastFetchTime={lastFetchTime}
                cacheAge={data?.cacheAge || 0}
                isError={data?.error || error}
              />

              {/* Botão de Refresh Manual */}
              <button
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className="px-6 py-2 bg-primary/10 hover:bg-primary/20 dark:bg-primary/20 dark:hover:bg-primary/30 border border-primary/50 rounded-full text-primary font-medium text-sm transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRefreshing ? '⟳ Atualizando...' : '⟳ Atualizar agora'}
              </button>
            </div>
          </>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="inline-block">
              <div className="w-12 h-12 border-4 border-primary/30 dark:border-primary/20 border-t-primary dark:border-t-primary rounded-full animate-spin"></div>
            </div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Carregando contagem de alunos...</p>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="text-center mt-20 text-sm text-gray-500 dark:text-gray-400">
        <p>Atualização automática a cada 10 segundos</p>
      </div>
    </div>
  );
};

export default VidometroPage;
