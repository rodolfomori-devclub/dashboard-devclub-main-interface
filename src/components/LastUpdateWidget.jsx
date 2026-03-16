import React, { useState, useEffect } from 'react';

/**
 * Componente LastUpdateWidget
 * Mostra quando foi a última atualização e a idade do cache
 */
const LastUpdateWidget = ({ lastFetchTime = null, cacheAge = 0, isError = false }) => {
  const [displayTime, setDisplayTime] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Atualizar segundos decorridos a cada segundo
  useEffect(() => {
    if (!lastFetchTime) return;

    const updateElapsedTime = () => {
      const now = new Date();
      const diff = Math.floor((now - new Date(lastFetchTime)) / 1000);
      setElapsedSeconds(diff);

      // Formatar texto
      if (diff < 60) {
        setDisplayTime(`Atualizado há ${diff}s`);
      } else if (diff < 3600) {
        const minutes = Math.floor(diff / 60);
        setDisplayTime(`Atualizado há ${minutes}m`);
      } else {
        const hours = Math.floor(diff / 3600);
        setDisplayTime(`Atualizado há ${hours}h`);
      }
    };

    updateElapsedTime();
    const interval = setInterval(updateElapsedTime, 1000);

    return () => clearInterval(interval);
  }, [lastFetchTime]);

  // Determinar cor baseado na age
  let statusColor = 'text-green-600 dark:text-green-400'; // < 1 min
  let bgColor = 'bg-green-100 dark:bg-green-900/30';

  if (elapsedSeconds >= 60 && elapsedSeconds < 300) {
    statusColor = 'text-yellow-600 dark:text-yellow-400'; // 1-5 min
    bgColor = 'bg-yellow-100 dark:bg-yellow-900/30';
  } else if (elapsedSeconds >= 300) {
    statusColor = 'text-orange-600 dark:text-orange-400'; // > 5 min
    bgColor = 'bg-orange-100 dark:bg-orange-900/30';
  }

  if (isError) {
    statusColor = 'text-red-600 dark:text-red-400';
    bgColor = 'bg-red-100 dark:bg-red-900/30';
  }

  return (
    <div className="w-full max-w-6xl mx-auto flex justify-center mt-8">
      <div className={`inline-flex items-center gap-2 px-4 py-3 ${bgColor} rounded-full border border-white/20 dark:border-gray-700/50`}>
        {/* Indicador de status */}
        <div
          className={`w-2.5 h-2.5 rounded-full ${isError ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}
        ></div>

        {/* Texto */}
        <span className={`text-sm font-medium ${statusColor}`}>
          {isError ? '🔴 Dados fora de sincronização' : displayTime}
        </span>
      </div>
    </div>
  );
};

export default LastUpdateWidget;
