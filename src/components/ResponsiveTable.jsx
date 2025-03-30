// src/components/ResponsiveTable.jsx
import React from 'react';

/**
 * ResponsiveTable - Um componente para renderizar tabelas responsivas
 * 
 * @param {Object} props
 * @param {Array} props.columns - Array de objetos de coluna {key, header, render, className, hide}
 * @param {Array} props.data - Array de dados a serem renderizados
 * @param {Function} props.keyExtractor - Função para extrair a chave de um item (opcional)
 * @param {string} props.emptyMessage - Mensagem para exibir quando não há dados (opcional)
 * @param {string} props.className - Classes CSS adicionais para a tabela (opcional)
 * @param {string} props.headerClassName - Classes CSS adicionais para o cabeçalho (opcional)
 * @param {string} props.rowClassName - Classes CSS adicionais para as linhas (opcional)
 */
const ResponsiveTable = ({
  columns,
  data,
  keyExtractor = (item, index) => index,
  emptyMessage = 'Nenhum dado disponível',
  className = '',
  headerClassName = '',
  rowClassName = '',
}) => {
  if (!columns || !data) {
    return <p className="text-center text-gray-500 dark:text-gray-400 py-4">{emptyMessage}</p>;
  }

  // Para dispositivos móveis, mostramos apenas colunas que não têm hide definido como 'sm'
  const responsiveColumns = columns.filter(col => !col.hide);

  return (
    <div className="overflow-x-auto w-full">
      <table className={`min-w-full divide-y divide-gray-200 dark:divide-gray-700 ${className}`}>
        <thead className={`bg-gray-50 dark:bg-gray-700 ${headerClassName}`}>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={`px-4 sm:px-6 py-3 text-left text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider ${
                  column.hide === 'sm' ? 'hidden sm:table-cell' : 
                  column.hide === 'md' ? 'hidden md:table-cell' : 
                  column.hide === 'lg' ? 'hidden lg:table-cell' : ''
                } ${column.className || ''}`}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 sm:px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((item, index) => (
              <tr 
                key={keyExtractor(item, index)} 
                className={`hover:bg-gray-50 dark:hover:bg-gray-750 ${rowClassName}`}
              >
                {columns.map((column) => (
                  <td
                    key={`${keyExtractor(item, index)}-${column.key}`}
                    className={`px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white ${
                      column.hide === 'sm' ? 'hidden sm:table-cell' : 
                      column.hide === 'md' ? 'hidden md:table-cell' : 
                      column.hide === 'lg' ? 'hidden lg:table-cell' : ''
                    } ${column.cellClassName || ''}`}
                  >
                    {column.render ? column.render(item) : item[column.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default ResponsiveTable;