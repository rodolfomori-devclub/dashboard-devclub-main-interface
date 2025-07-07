// src/components/RefundDetailsButton.jsx
import React from 'react';
import { FaSearchPlus } from 'react-icons/fa';

/**
 * Botão para visualizar detalhes dos reembolsos
 * @param {Object} props
 * @param {function} props.onClick - Função a ser executada quando o botão for clicado
 */
const RefundDetailsButton = ({ onClick }) => {
  return (
    <button
      onClick={onClick}
      className="mt-2 w-full flex items-center justify-center px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
    >
      <FaSearchPlus className="mr-2" />
      Ver Detalhes
    </button>
  );
};

export default RefundDetailsButton;