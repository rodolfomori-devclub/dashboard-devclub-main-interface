import React, { useState, useEffect, useRef } from 'react';
import { FaCalendarWeek, FaChevronLeft, FaChevronRight } from 'react-icons/fa';

const WeekSelector = ({ onWeekSelect, selectedWeek, label = "Filtrar por Lançamento", autoSelect = true }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [weeks, setWeeks] = useState([]);
  const selectorRef = useRef(null);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (selectorRef.current && !selectorRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Gerar semanas do ano
  useEffect(() => {
    generateWeeksForYear(currentYear);
  }, [currentYear]);

  // Selecionar semana atual automaticamente apenas na primeira carga se autoSelect for true
  const [hasInitialized, setHasInitialized] = useState(false);
  
  useEffect(() => {
    if (autoSelect && !hasInitialized && !selectedWeek && weeks.length > 0) {
      const currentWeek = getCurrentWeek();
      if (currentWeek) {
        onWeekSelect(currentWeek);
        setHasInitialized(true);
      }
    }
  }, [weeks, hasInitialized, selectedWeek, onWeekSelect, autoSelect]);

  const generateWeeksForYear = (year) => {
    const weeksArray = [];
    const startOfYear = new Date(year, 0, 1);
    
    // Encontrar a primeira segunda-feira do ano
    let firstMonday = new Date(startOfYear);
    const dayOfWeek = startOfYear.getDay();
    const daysToMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek);
    firstMonday.setDate(startOfYear.getDate() + daysToMonday);

    // Se a primeira segunda-feira é muito tarde no ano, começar da semana anterior
    if (firstMonday.getDate() > 7) {
      firstMonday.setDate(firstMonday.getDate() - 7);
    }

    let currentMonday = new Date(firstMonday);
    let weekNumber = 1;

    while (currentMonday.getFullYear() <= year && weekNumber <= 53) {
      const sunday = new Date(currentMonday);
      sunday.setDate(currentMonday.getDate() + 6);

      // Parar se a semana for totalmente do próximo ano
      if (currentMonday.getFullYear() > year) break;

      weeksArray.push({
        weekNumber,
        startDate: new Date(currentMonday),
        endDate: new Date(sunday),
        year: year,
        id: `${year}-W${weekNumber.toString().padStart(2, '0')}`
      });

      currentMonday.setDate(currentMonday.getDate() + 7);
      weekNumber++;
    }

    setWeeks(weeksArray);
  };

  const getCurrentWeek = () => {
    const today = new Date();
    const currentWeek = weeks.find(week => {
      return today >= week.startDate && today <= week.endDate;
    });
    return currentWeek || weeks[0];
  };

  const formatDateBR = (date) => {
    return date.toLocaleDateString('pt-BR', { 
      day: '2-digit', 
      month: '2-digit'
    });
  };

  const formatWeekDisplay = (week) => {
    if (!week) return "Selecione uma semana";
    
    const startMonth = week.startDate.getMonth();
    const endMonth = week.endDate.getMonth();
    
    if (startMonth === endMonth) {
      return `Sem ${week.weekNumber} - ${formatDateBR(week.startDate)} a ${formatDateBR(week.endDate)}`;
    } else {
      return `Sem ${week.weekNumber} - ${formatDateBR(week.startDate)} a ${formatDateBR(week.endDate)}`;
    }
  };

  const handleWeekSelect = (week) => {
    onWeekSelect(week);
    setIsOpen(false);
  };

  const changeYear = (direction) => {
    const newYear = currentYear + direction;
    if (newYear >= 2020 && newYear <= new Date().getFullYear() + 1) {
      setCurrentYear(newYear);
    }
  };

  const isCurrentWeek = (week) => {
    const today = new Date();
    return week && today >= week.startDate && today <= week.endDate;
  };

  const isSelectedWeek = (week) => {
    return selectedWeek && week.id === selectedWeek.id;
  };

  return (
    <div className="relative" ref={selectorRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-md"
      >
        <FaCalendarWeek className="h-4 w-4" />
        <span className="hidden sm:inline">{label}</span>
        <span className="text-xs bg-blue-500 px-2 py-1 rounded">
          {selectedWeek ? `S${selectedWeek.weekNumber}` : 'Sem'}
        </span>
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 left-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 w-80">
          {/* Header com navegação de ano */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => changeYear(-1)}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              disabled={currentYear <= 2020}
            >
              <FaChevronLeft className="h-4 w-4 text-gray-600 dark:text-gray-400" />
            </button>
            
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Semanas de {currentYear}
            </h3>
            
            <button
              onClick={() => changeYear(1)}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              disabled={currentYear >= new Date().getFullYear() + 1}
            >
              <FaChevronRight className="h-4 w-4 text-gray-600 dark:text-gray-400" />
            </button>
          </div>

          {/* Lista de semanas */}
          <div className="max-h-80 overflow-y-auto">
            {weeks.map((week) => (
              <button
                key={week.id}
                onClick={() => handleWeekSelect(week)}
                className={`w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-b-0 transition-colors ${
                  isSelectedWeek(week) 
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' 
                    : ''
                } ${
                  isCurrentWeek(week) 
                    ? 'font-semibold text-blue-600 dark:text-blue-400' 
                    : 'text-gray-700 dark:text-gray-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">
                      Semana {week.weekNumber}
                      {isCurrentWeek(week) && (
                        <span className="ml-2 text-xs bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400 px-2 py-1 rounded">
                          Atual
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {formatDateBR(week.startDate)} a {formatDateBR(week.endDate)}
                    </div>
                  </div>
                  {isSelectedWeek(week) && (
                    <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Footer com semana selecionada */}
          {selectedWeek && (
            <div className="p-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Selecionada: <span className="font-medium text-gray-900 dark:text-white">
                  {formatWeekDisplay(selectedWeek)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default WeekSelector;