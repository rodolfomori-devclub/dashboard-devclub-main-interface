import React from 'react';

/**
 * Componente PlatformBreakdown
 * Mostra contagem e percentual de cada plataforma em cards
 */
const PlatformBreakdown = ({ platforms = {} }) => {
  const { asaas = {}, hotmart = {}, guru = {}, tmb = {}, outros = {} } = platforms;

  // Plataformas com configuração visual
  const platformsConfig = [
    {
      key: 'asaas',
      name: 'Asaas',
      data: asaas,
      color: 'from-primary to-primary-dark',
      bgColor: 'bg-primary/5 dark:bg-primary/10',
      accentColor: 'text-primary'
    },
    {
      key: 'hotmart',
      name: 'Hotmart',
      data: hotmart,
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-500/5 dark:bg-blue-500/10',
      accentColor: 'text-blue-500'
    },
    {
      key: 'guru',
      name: 'Guru',
      data: guru,
      color: 'from-purple-500 to-purple-600',
      bgColor: 'bg-purple-500/5 dark:bg-purple-500/10',
      accentColor: 'text-purple-500'
    },
    {
      key: 'tmb',
      name: 'TMB',
      data: tmb,
      color: 'from-orange-500 to-amber-500',
      bgColor: 'bg-orange-500/5 dark:bg-orange-500/10',
      accentColor: 'text-orange-500'
    },
    {
      key: 'outros',
      name: 'Outros',
      data: outros,
      color: 'from-gray-500 to-gray-600',
      bgColor: 'bg-gray-500/5 dark:bg-gray-500/10',
      accentColor: 'text-gray-500'
    }
  ];

  return (
    <div className="w-full max-w-6xl mx-auto">
      <h3 className="text-lg md:text-xl font-bold text-gray-800 dark:text-gray-100 mb-6 text-center">
        Distribuição por Plataforma
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6">
        {platformsConfig.map(({ key, name, data, color, bgColor, accentColor }) => {
          const count = data.count || 0;
          const percentage = data.percentage || 0;
          const hasError = data.error;

          return (
            <div
              key={key}
              className="bg-white dark:bg-[#141419] rounded-xl border border-gray-200 dark:border-[#27272a] p-6 shadow-lg hover:shadow-xl transition-shadow duration-300"
            >
              {/* Cabeçalho com nome da plataforma */}
              <div className="flex items-center justify-between mb-4">
                <h4 className={`text-lg font-bold ${accentColor}`}>{name}</h4>
                {hasError && (
                  <span className="text-xs px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-full">
                    ⚠️ Offline
                  </span>
                )}
              </div>

              {/* Contagem principal */}
              {hasError ? (
                <div className="mb-6">
                  <p className="text-gray-600 dark:text-gray-400 text-sm">{hasError}</p>
                </div>
              ) : (
                <>
                  <div className="mb-4">
                    <p className={`text-4xl md:text-5xl font-black bg-gradient-to-r ${color} bg-clip-text text-transparent`}>
                      {count.toLocaleString('pt-BR')}
                    </p>
                    <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
                      estudantes
                    </p>
                  </div>

                  {/* Percentual */}
                  <div className="mb-6">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Participação
                      </span>
                      <span className={`text-lg font-bold ${accentColor}`}>
                        {percentage.toFixed(1)}%
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className={`w-full h-3 ${bgColor} rounded-full overflow-hidden border border-white/20 dark:border-gray-700/50`}>
                      <div
                        className={`h-full bg-gradient-to-r ${color} transition-all duration-500 ease-out`}
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                </>
              )}

              {/* Timestamp */}
              {data.lastUpdate && !hasError && (
                <div className="pt-4 border-t border-white/20 dark:border-gray-700/50">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Atualizado: {new Date(data.lastUpdate).toLocaleTimeString('pt-BR')}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PlatformBreakdown;
