import React from 'react';
import { FaTrophy, FaMedal, FaAward, FaStar, FaChartLine } from 'react-icons/fa';
import { formatCurrency } from '../utils/currencyUtils';

const PodiumTopSellers = ({ sellers, onSellerClick }) => {
  // Garantir que temos 3 vendedores (ou menos)
  const topSellers = sellers.slice(0, 3);
  
  // Se tivermos menos de 3 vendedores, preenchemos o array
  while (topSellers.length < 3) {
    topSellers.push(null);
  }
  
  // Reorganizar para o formato de pódio: [segundo, primeiro, terceiro]
  const podiumOrder = [topSellers[1], topSellers[0], topSellers[2]];

  return (
    <div className="mb-16 relative overflow-visible">
      {/* Confetti animation */}
      <div className="confetti confetti-1"></div>
      <div className="confetti confetti-2"></div>
      <div className="confetti confetti-3"></div>
      <div className="confetti confetti-4"></div>
      <div className="confetti confetti-5"></div>
      <div className="confetti confetti-6"></div>
      <div className="confetti confetti-7"></div>
      <div className="confetti confetti-8"></div>
      <div className="confetti confetti-9"></div>
      
      <h2 className="text-2xl font-bold text-primary dark:text-secondary mb-6">
        Top Vendedores
      </h2>
      
      <div className="relative flex justify-center items-end h-96 w-full overflow-visible">
        {/* Segundo Lugar */}
        {podiumOrder[0] && (
          <div 
            onClick={() => onSellerClick(podiumOrder[0])}
            className="relative z-10 flex-1 mx-2 mb-8 max-w-xs cursor-pointer group transform transition-all hover:scale-105 podium-second"
          >
            <div className="absolute inset-x-0 -bottom-6 h-24 bg-gradient-to-t from-gray-200 to-transparent dark:from-gray-600 rounded-b-lg"></div>
            <div className="relative h-60 bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden border-4 border-gray-300 dark:border-gray-500 z-20">
              <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-br from-gray-300 to-gray-400 dark:from-gray-500 dark:to-gray-600"></div>
              
              <div className="absolute top-4 right-4 bg-gray-400 text-white rounded-full w-10 h-10 flex items-center justify-center shadow-lg">
                <span className="text-lg font-bold">2</span>
              </div>
              
              <div className="absolute top-6 left-1/2 transform -translate-x-1/2 text-center z-10">
                <FaMedal className="inline-block text-4xl text-white medal-icon" />
                <h3 className="mt-1 text-xl font-bold text-white">
                  Prata
                </h3>
              </div>
              
              <div className="absolute top-24 inset-x-0 bottom-0 bg-white dark:bg-gray-800 p-4 flex flex-col justify-between">
                <div>
                  <div className="rounded-full h-16 w-16 bg-gray-100 dark:bg-gray-700 flex items-center justify-center mx-auto mb-2">
                    <span className="text-3xl font-bold text-gray-400">{podiumOrder[0].name.charAt(0)}</span>
                  </div>
                  <h3 className="text-xl font-bold text-center text-text-light dark:text-text-dark line-clamp-1">
                    {podiumOrder[0].name}
                  </h3>
                </div>
                
                <div className="text-center">
                  <p className="flex items-center justify-center text-gray-500 dark:text-gray-400">
                    <FaStar className="mr-1 text-gray-400" /> {podiumOrder[0].totalSales} vendas
                  </p>
                  <p className="text-xl font-bold text-gray-600 dark:text-gray-300">
                    {formatCurrency(podiumOrder[0].totalValue)}
                  </p>
                  <div className="mt-2 flex items-center justify-center space-x-1 text-xs">
                    <FaChartLine className="text-blue-500" />
                    <span className="text-gray-500 dark:text-gray-400">
                      Ticket: {formatCurrency(podiumOrder[0].totalValue / podiumOrder[0].totalSales)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Primeiro Lugar */}
        {podiumOrder[1] && (
          <div 
            onClick={() => onSellerClick(podiumOrder[1])}
            className="relative z-20 flex-1 mx-2 mb-0 max-w-xs scale-110 cursor-pointer group transform transition-all hover:scale-115 podium-first"
          >
            <div className="absolute inset-x-0 -bottom-6 h-24 bg-gradient-to-t from-amber-200 to-transparent dark:from-amber-800 rounded-b-lg"></div>
            <div className="relative h-72 bg-white dark:bg-gray-800 rounded-lg shadow-xl overflow-hidden border-4 border-yellow-400 dark:border-yellow-600 z-20">
              <div className="absolute top-0 left-0 w-full h-28 bg-gradient-to-br from-yellow-300 to-yellow-500 dark:from-yellow-500 dark:to-yellow-700"></div>
              
              <div className="absolute top-6 right-6 bg-yellow-500 text-white rounded-full w-12 h-12 flex items-center justify-center shadow-lg">
                <span className="text-xl font-bold">1</span>
              </div>
              
              <div className="absolute top-8 left-1/2 transform -translate-x-1/2 text-center z-10">
                <FaTrophy className="inline-block text-5xl text-white medal-icon" />
                <h3 className="mt-1 text-xl font-bold text-white">
                  Ouro
                </h3>
              </div>
              
              <div className="absolute top-28 inset-x-0 bottom-0 bg-white dark:bg-gray-800 p-4 flex flex-col justify-between">
                <div>
                  <div className="rounded-full h-20 w-20 bg-yellow-100 dark:bg-yellow-900 flex items-center justify-center mx-auto mb-2 border-2 border-yellow-300">
                    <span className="text-4xl font-bold text-yellow-500">{podiumOrder[1].name.charAt(0)}</span>
                  </div>
                  <h3 className="text-2xl font-bold text-center text-text-light dark:text-text-dark line-clamp-1">
                    {podiumOrder[1].name}
                  </h3>
                </div>
                
                <div className="text-center">
                  <p className="flex items-center justify-center text-yellow-600 dark:text-yellow-400">
                    <FaStar className="mr-1 text-yellow-500" /> {podiumOrder[1].totalSales} vendas
                  </p>
                  <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                    {formatCurrency(podiumOrder[1].totalValue)}
                  </p>
                  <div className="mt-2 flex items-center justify-center space-x-1">
                    <FaChartLine className="text-green-500" />
                    <span className="text-yellow-600 dark:text-yellow-500">
                      Ticket: {formatCurrency(podiumOrder[1].totalValue / podiumOrder[1].totalSales)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute inset-0 bg-yellow-400 opacity-0 group-hover:opacity-10 transition-opacity duration-300 rounded-lg"></div>
          </div>
        )}
        
        {/* Terceiro Lugar */}
        {podiumOrder[2] && (
          <div 
            onClick={() => onSellerClick(podiumOrder[2])}
            className="relative z-10 flex-1 mx-2 mb-16 max-w-xs cursor-pointer group transform transition-all hover:scale-105 podium-third"
          >
            <div className="absolute inset-x-0 -bottom-6 h-24 bg-gradient-to-t from-amber-100 to-transparent dark:from-amber-900 rounded-b-lg"></div>
            <div className="relative h-52 bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden border-4 border-amber-600 dark:border-amber-800 z-20">
              <div className="absolute top-0 left-0 w-full h-20 bg-gradient-to-br from-amber-500 to-amber-700 dark:from-amber-600 dark:to-amber-800"></div>
              
              <div className="absolute top-4 right-4 bg-amber-600 text-white rounded-full w-8 h-8 flex items-center justify-center shadow-lg">
                <span className="text-lg font-bold">3</span>
              </div>
              
              <div className="absolute top-4 left-1/2 transform -translate-x-1/2 text-center z-10">
                <FaAward className="inline-block text-3xl text-white medal-icon" />
                <h3 className="mt-1 text-lg font-bold text-white">
                  Bronze
                </h3>
              </div>
              
              <div className="absolute top-20 inset-x-0 bottom-0 bg-white dark:bg-gray-800 p-4 flex flex-col justify-between">
                <div>
                  <div className="rounded-full h-14 w-14 bg-amber-100 dark:bg-amber-900 flex items-center justify-center mx-auto mb-2">
                    <span className="text-2xl font-bold text-amber-600">{podiumOrder[2].name.charAt(0)}</span>
                  </div>
                  <h3 className="text-lg font-bold text-center text-text-light dark:text-text-dark line-clamp-1">
                    {podiumOrder[2].name}
                  </h3>
                </div>
                
                <div className="text-center">
                  <p className="flex items-center justify-center text-amber-700 dark:text-amber-400">
                    <FaStar className="mr-1 text-amber-600" /> {podiumOrder[2].totalSales} vendas
                  </p>
                  <p className="text-xl font-bold text-amber-700 dark:text-amber-400">
                    {formatCurrency(podiumOrder[2].totalValue)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Base do Pódio */}
      <div className="relative flex justify-center mt-6">
        <div className="w-full h-12 bg-gradient-to-r from-gray-300 via-gray-100 to-gray-300 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 rounded-lg shadow-lg podium-base"></div>
        <div className="absolute top-0 left-0 w-full h-full flex items-center justify-between px-8">
          <div className="text-center">
            <span className="text-gray-800 dark:text-gray-200 font-bold">2º</span>
          </div>
          <div className="text-center">
            <span className="text-gray-800 dark:text-gray-200 font-bold">1º</span>
          </div>
          <div className="text-center">
            <span className="text-gray-800 dark:text-gray-200 font-bold">3º</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PodiumTopSellers;