// src/components/DateRangePicker.jsx
import React, { useState, useEffect, useRef } from 'react';
import { FaCalendarAlt, FaSearch } from 'react-icons/fa';

const DateRangePicker = ({ startDate, endDate, onDateChange, label }) => {
  const [showCalendar, setShowCalendar] = useState(false);
  const calendarRef = useRef(null);

  // Converte prop para string ISO se necessário (a prop pode vir como string ou Date)
  const toISOString = (date) => {
    if (!date) return '';
    // Se já é string no formato ISO, retorna direto
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return date;
    }
    // Se é Date ou string de outro formato, converte
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Formatar string ISO para exibição brasileira (DD/MM/YYYY)
  const formatDateBR = (isoString) => {
    if (!isoString || !/^\d{4}-\d{2}-\d{2}$/.test(isoString)) return '--/--/----';
    const [year, month, day] = isoString.split('-');
    return `${day}/${month}/${year}`;
  };

  // Estado local das datas (strings ISO YYYY-MM-DD)
  // Estas são as datas que o usuário está editando, antes de confirmar
  const [tempStartDate, setTempStartDate] = useState(toISOString(startDate));
  const [tempEndDate, setTempEndDate] = useState(toISOString(endDate));

  // Sincronizar estado temporário quando props mudam (ex: clique nos botões de período)
  useEffect(() => {
    const newStart = toISOString(startDate);
    const newEnd = toISOString(endDate);

    if (newStart) setTempStartDate(newStart);
    if (newEnd) setTempEndDate(newEnd);
  }, [startDate, endDate]);

  // Fechar o calendário ao clicar fora dele
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target)) {
        // Ao fechar sem confirmar, restaura os valores originais
        setTempStartDate(toISOString(startDate));
        setTempEndDate(toISOString(endDate));
        setShowCalendar(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [startDate, endDate]);

  // Handler para mudança de data inicial (só atualiza estado local)
  const handleStartDateChange = (e) => {
    const newStartDate = e.target.value;
    setTempStartDate(newStartDate);

    // Se a data inicial for posterior à data final, ajusta a data final
    if (newStartDate > tempEndDate) {
      setTempEndDate(newStartDate);
    }
  };

  // Handler para mudança de data final (só atualiza estado local)
  const handleEndDateChange = (e) => {
    const newEndDate = e.target.value;
    setTempEndDate(newEndDate);

    // Se a data final for anterior à data inicial, ajusta a data inicial
    if (newEndDate < tempStartDate) {
      setTempStartDate(newEndDate);
    }
  };

  // Calcular duração em dias
  const calculateDuration = () => {
    if (!tempStartDate || !tempEndDate) return 0;
    const [startYear, startMonth, startDay] = tempStartDate.split('-').map(Number);
    const [endYear, endMonth, endDay] = tempEndDate.split('-').map(Number);
    const start = new Date(startYear, startMonth - 1, startDay);
    const end = new Date(endYear, endMonth - 1, endDay);
    return Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
  };

  // Handler do botão Buscar - só aqui dispara a busca
  const handleSearch = () => {
    onDateChange(tempStartDate, tempEndDate);
    setShowCalendar(false);
  };

  // Handler para cancelar
  const handleCancel = () => {
    setTempStartDate(toISOString(startDate));
    setTempEndDate(toISOString(endDate));
    setShowCalendar(false);
  };

  // Display das datas (mostra as datas confirmadas, não as temporárias)
  const displayStart = formatDateBR(toISOString(startDate));
  const displayEnd = formatDateBR(toISOString(endDate));

  return (
    <div className="relative" ref={calendarRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {label}
        </label>
      )}
      <button
        type="button"
        className="w-full p-3 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-left flex justify-between items-center border-gray-300 dark:border-gray-600 hover:border-blue-500 transition-colors"
        onClick={() => setShowCalendar(!showCalendar)}
      >
        <span className="text-sm">
          {displayStart} - {displayEnd}
        </span>
        <FaCalendarAlt className="text-gray-400 dark:text-gray-300" />
      </button>

      {showCalendar && (
        <div
          className="absolute z-50 mt-1 bg-white dark:bg-gray-800 shadow-xl rounded-lg p-4 border dark:border-gray-700 min-w-[320px] right-0"
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-2 text-gray-600 dark:text-gray-400">
                Data Inicial
              </label>
              <input
                type="date"
                value={tempStartDate}
                onChange={handleStartDateChange}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-2 text-gray-600 dark:text-gray-400">
                Data Final
              </label>
              <input
                type="date"
                value={tempEndDate}
                onChange={handleEndDateChange}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div className="flex justify-between items-center mt-4 pt-3 border-t dark:border-gray-700">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              <span className="font-medium">{calculateDuration()}</span> dias selecionados
            </div>
            <div className="flex gap-2">
              <button
                className="px-3 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium transition-colors"
                onClick={handleCancel}
              >
                Cancelar
              </button>
              <button
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                onClick={handleSearch}
              >
                <FaSearch className="h-3 w-3" />
                Buscar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DateRangePicker;
