import React, { useState, useEffect } from 'react';

/**
 * Componente VidometroCounter
 * Exibe um contador animado de alunos com estilo impactante
 */
const VidometroCounter = ({ value = 0, loading = false, previousValue = null }) => {
  const [displayValue, setDisplayValue] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  // Animar números quando o valor muda
  useEffect(() => {
    if (value === displayValue) return;

    setIsAnimating(true);

    const startValue = displayValue;
    const difference = value - startValue;
    const steps = 60; // Duração da animação em frames
    const stepValue = difference / steps;
    let currentStep = 0;

    const animationInterval = setInterval(() => {
      currentStep++;
      const newValue = startValue + stepValue * currentStep;

      if (currentStep >= steps) {
        setDisplayValue(value);
        setIsAnimating(false);
        clearInterval(animationInterval);
      } else {
        setDisplayValue(Math.round(newValue));
      }
    }, 16); // ~60fps

    return () => clearInterval(animationInterval);
  }, [value, displayValue]);

  // Calcular delta (quanto aumentou desde o valor anterior)
  const delta = previousValue ? value - previousValue : null;

  // Formatar número com separador de milhares
  const formattedValue = displayValue.toLocaleString('pt-BR');

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="h-20 w-64 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded-lg animate-pulse"></div>
        <div className="mt-4 h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Cartão Principal */}
      <div className="relative bg-white/80 dark:bg-secondary/80 backdrop-blur-lg rounded-3xl border border-white/20 dark:border-gray-700/50 p-8 md:p-12 shadow-2xl">
        {/* Efeito de brilho animado */}
        <div className="absolute inset-0 rounded-3xl overflow-hidden">
          <div
            className={`absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent opacity-50 ${
              isAnimating ? 'animate-pulse' : ''
            }`}
          ></div>
        </div>

        {/* Conteúdo */}
        <div className="relative z-10">
          {/* Título */}
          <div className="text-center mb-8">
            <h2 className="text-xl md:text-2xl font-bold text-gray-700 dark:text-gray-300 tracking-wide">
              VIDAS IMPACTADAS
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Estudantes em nossos programas
            </p>
          </div>

          {/* Número Grande Animado */}
          <div className="text-center mb-6">
            <div className="relative inline-block">
              {/* Efeito de glow ao fundo */}
              <div className="absolute -inset-8 bg-gradient-to-r from-primary/20 to-primary-dark/20 rounded-full blur-2xl opacity-50 group-hover:opacity-75 transition-opacity duration-300"></div>

              {/* Número */}
              <div className="relative">
                <h1
                  className={`text-7xl md:text-8xl font-black bg-gradient-to-r from-primary to-primary-dark bg-clip-text text-transparent transition-all duration-300 ${
                    isAnimating ? 'scale-110' : 'scale-100'
                  }`}
                >
                  {formattedValue}
                </h1>
              </div>
            </div>
          </div>

          {/* Delta (Novo hoje) */}
          {delta !== null && delta !== 0 && (
            <div className="text-center mb-8">
              <div className="inline-block px-4 py-2 bg-primary/10 dark:bg-primary/20 rounded-full">
                <span className="text-primary font-bold">
                  ↑ {delta > 0 ? '+' : ''}{delta.toLocaleString('pt-BR')} hoje
                </span>
              </div>
            </div>
          )}

          {/* Descrição */}
          <div className="text-center pt-6 border-t border-white/20 dark:border-gray-700/50">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Cada aluno em cada programa é uma vida tocada pelo DevClub
            </p>
          </div>
        </div>
      </div>

      {/* Espaçador */}
      <div className="mt-12"></div>
    </div>
  );
};

export default VidometroCounter;
