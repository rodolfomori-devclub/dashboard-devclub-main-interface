// src/components/DateRangePicker.jsx
import React, { useState, useEffect, useRef } from 'react';
import { FaCalendarAlt } from 'react-icons/fa';

const DateRangePicker = ({ startDate, endDate, onDateChange, label }) => {
  const [showCalendar, setShowCalendar] = useState(false);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(startDate),
    endDate: new Date(endDate)
  });
  const calendarRef = useRef(null);

  // Formatar data para exibição (DD/MM/YYYY)
  const formatDateBR = (dateString) => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // Formatar data para input (YYYY-MM-DD)
  const formatDateISO = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Fechar o calendário ao clicar fora dele
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target)) {
        setShowCalendar(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Atualizar as datas quando o usuário seleciona um novo intervalo
  const handleDatesChange = (type, date) => {
    const newDateRange = { ...dateRange };
    
    if (type === 'start') {
      newDateRange.startDate = date;
      // Se a data inicial for posterior à data final, ajusta a data final
      if (date > newDateRange.endDate) {
        newDateRange.endDate = date;
      }
    } else {
      newDateRange.endDate = date;
      // Se a data final for anterior à data inicial, ajusta a data inicial
      if (date < newDateRange.startDate) {
        newDateRange.startDate = date;
      }
    }
    
    setDateRange(newDateRange);
    onDateChange(
      formatDateISO(newDateRange.startDate), 
      formatDateISO(newDateRange.endDate)
    );
  };

  return (
    <div className="relative">
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {label}
        </label>
      )}
      <button
        type="button"
        className="w-full p-3 border rounded-lg bg-white dark:bg-gray-700 text-text-light dark:text-text-dark text-left flex justify-between items-center"
        onClick={() => setShowCalendar(!showCalendar)}
      >
        <span>
          {formatDateBR(dateRange.startDate)} - {formatDateBR(dateRange.endDate)}
        </span>
        <FaCalendarAlt className="text-gray-400 dark:text-gray-300" />
      </button>
      
      {showCalendar && (
        <div 
          ref={calendarRef}
          className="absolute z-10 mt-1 bg-white dark:bg-gray-800 shadow-lg rounded-lg p-2 border dark:border-gray-700"
        >
          <div className="p-2 grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-400">
                Data Inicial
              </label>
              <input
                type="date"
                value={formatDateISO(dateRange.startDate)}
                onChange={(e) => handleDatesChange('start', new Date(e.target.value))}
                className="w-full px-2 py-1 border rounded text-sm bg-white dark:bg-gray-700 text-text-light dark:text-text-dark"
                max={formatDateISO(dateRange.endDate)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-400">
                Data Final
              </label>
              <input
                type="date"
                value={formatDateISO(dateRange.endDate)}
                onChange={(e) => handleDatesChange('end', new Date(e.target.value))}
                className="w-full px-2 py-1 border rounded text-sm bg-white dark:bg-gray-700 text-text-light dark:text-text-dark"
                min={formatDateISO(dateRange.startDate)}
              />
            </div>
          </div>
          
          <div className="flex justify-between mt-2 p-2">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Duração: {Math.ceil((dateRange.endDate - dateRange.startDate) / (1000 * 60 * 60 * 24)) + 1} dias
            </div>
            <button
              className="px-3 py-1 bg-primary hover:bg-primary-dark text-white dark:bg-secondary dark:hover:bg-secondary-light dark:text-primary-dark rounded text-sm"
              onClick={() => setShowCalendar(false)}
            >
              Confirmar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DateRangePicker;