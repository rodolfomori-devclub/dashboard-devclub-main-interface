import React, { useState, useEffect } from 'react';

const YearMonthSelector = ({ salesData, onMonthSelect }) => {
  const [expandedYear, setExpandedYear] = useState(null);
  const [yearsWithMonths, setYearsWithMonths] = useState({});

  useEffect(() => {
    // Extrair anos e meses únicos dos dados de vendas
    if (salesData && salesData.length > 0) {
      const yearsMonths = {};
      
      salesData.forEach(sale => {
        const date = new Date(sale.timestamp);
        const year = date.getFullYear();
        const month = date.getMonth();
        
        if (!yearsMonths[year]) {
          yearsMonths[year] = new Set();
        }
        yearsMonths[year].add(month);
      });
      
      // Converter Set para Array e ordenar
      const formattedData = {};
      Object.keys(yearsMonths).forEach(year => {
        formattedData[year] = Array.from(yearsMonths[year]).sort((a, b) => a - b);
      });
      
      setYearsWithMonths(formattedData);
      
      // Expandir o ano mais recente por padrão
      const years = Object.keys(formattedData).sort((a, b) => b - a);
      if (years.length > 0) {
        setExpandedYear(years[0]);
      }
    }
  }, [salesData]);

  const handleYearClick = (year) => {
    setExpandedYear(expandedYear === year ? null : year);
  };

  const getMonthName = (monthIndex) => {
    const months = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return months[monthIndex];
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mt-8">
      <h3 className="text-xl font-bold text-primary dark:text-secondary mb-4">
        Filtrar por Período
      </h3>
      
      <div className="space-y-4">
        {Object.keys(yearsWithMonths).sort((a, b) => b - a).map(year => (
          <div key={year} className="space-y-2">
            <button
              onClick={() => handleYearClick(year)}
              className="w-full text-left p-3 bg-gray-100 dark:bg-gray-700 rounded-lg flex justify-between items-center hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              <span className="font-semibold text-text-light dark:text-text-dark">
                {year}
              </span>
              <span className="text-lg">
                {expandedYear === year ? '▼' : '▶'}
              </span>
            </button>
            
            {expandedYear === year && (
              <div className="grid grid-cols-3 md:grid-cols-4 gap-2 pl-4">
                {yearsWithMonths[year].map(month => (
                  <button
                    key={month}
                    onClick={() => onMonthSelect(year, month)}
                    className="p-2 bg-secondary text-primary rounded hover:bg-primary hover:text-secondary transition-colors"
                  >
                    {getMonthName(month)}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        
        {Object.keys(yearsWithMonths).length === 0 && (
          <p className="text-center text-gray-500 dark:text-gray-400">
            Nenhum dado de vendas disponível.
          </p>
        )}
      </div>
    </div>
  );
};

export default YearMonthSelector;