import React from 'react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  ScatterChart,
  Scatter,
  ZAxis,
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import { formatCurrency } from '../utils/currencyUtils';

/**
 * Modal para exibir detalhes dos reembolsos
 * @param {Object} props
 * @param {boolean} props.isOpen - Se o modal está aberto
 * @param {function} props.onClose - Função para fechar o modal
 * @param {Array} props.refundsData - Dados dos reembolsos
 */
const RefundDetailsModal = ({ isOpen, onClose, refundsData = [] }) => {
  if (!isOpen) return null;

  // Agrupar reembolsos por produto
  const refundsByProduct = {};
  const refundsByDay = {};
  
  // Preparar os dados agrupados
  refundsData.forEach(refund => {
    const productName = refund.product?.name || 'Não especificado';
    const refundValue = refund.calculation_details?.net_amount || 0;
    
    // Agrupar por produto
    if (!refundsByProduct[productName]) {
      refundsByProduct[productName] = {
        name: productName,
        count: 0,
        value: 0
      };
    }
    
    refundsByProduct[productName].count++;
    refundsByProduct[productName].value += refundValue;
    
    // Agrupar por dia
    if (refund.dates?.created_at) {
      const date = new Date(refund.dates.created_at * 1000);
      const dateStr = date.toLocaleDateString('en-CA'); // YYYY-MM-DD
      
      if (!refundsByDay[dateStr]) {
        refundsByDay[dateStr] = {
          date: dateStr,
          count: 0,
          value: 0
        };
      }
      
      refundsByDay[dateStr].count++;
      refundsByDay[dateStr].value += refundValue;
    }
  });
  
  // Converter para arrays para gráficos
  const productChartData = Object.values(refundsByProduct)
    .sort((a, b) => b.value - a.value);
  
  const dailyChartData = Object.values(refundsByDay)
    .sort((a, b) => a.date.localeCompare(b.date));
  
  // Calcular totais para percentuais
  const totalRefunds = refundsData.length;
  const totalValue = refundsData.reduce((sum, refund) => 
    sum + (refund.calculation_details?.net_amount || 0), 0);
  
  // Adicionar percentuais aos dados de produtos
  const pieChartData = productChartData.map(product => ({
    ...product,
    percentage: (product.count / totalRefunds) * 100
  }));
  
  // Cores para os gráficos
  const COLORS = ['#FF4500', '#1E90FF', '#FFD700', '#FF1493', '#4B0082', '#00CED1', '#32CD32', '#FF8C00'];
  
  // Função para formatar datas
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-text-light dark:text-text-dark">
            Detalhes dos Reembolsos
          </h2>
          <button
            onClick={onClose}
            className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>

        {/* Cards de resumo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
            <h4 className="text-lg font-medium text-red-800 dark:text-red-200 mb-2">
              Total de Reembolsos
            </h4>
            <p className="text-3xl font-bold text-red-600 dark:text-red-300">
              {totalRefunds}
            </p>
          </div>
          
          <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
            <h4 className="text-lg font-medium text-red-800 dark:text-red-200 mb-2">
              Valor Total Reembolsado
            </h4>
            <p className="text-3xl font-bold text-red-600 dark:text-red-300">
              {formatCurrency(totalValue)}
            </p>
          </div>
          
          <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
            <h4 className="text-lg font-medium text-red-800 dark:text-red-200 mb-2">
              Valor Médio por Reembolso
            </h4>
            <p className="text-3xl font-bold text-red-600 dark:text-red-300">
              {formatCurrency(totalRefunds > 0 ? totalValue / totalRefunds : 0)}
            </p>
          </div>
        </div>

        {/* Gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Gráfico de barras por produto */}
          <div>
            <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-4">
              Quantidade de Reembolsos por Produto
            </h3>
            <div className="bg-white dark:bg-gray-700 p-4 rounded-lg h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={productChartData}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 90, bottom: 5 }}
                >
                  <XAxis type="number" />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    tick={{ fontSize: 12 }}
                    width={80}
                  />
                  <Tooltip formatter={(value) => `${value} reembolsos`} />
                  <Legend />
                  <Bar 
                    dataKey="count" 
                    name="Quantidade" 
                    fill="#FF4500" 
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          {/* Gráfico de pizza para percentuais */}
          <div>
            <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-4">
              Percentual de Reembolsos por Produto
            </h3>
            <div className="bg-white dark:bg-gray-700 p-4 rounded-lg h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieChartData}
                    dataKey="percentage"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                    labelLine={false}
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `${value.toFixed(1)}%`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          {/* Gráfico de reembolsos por dia */}
          <div className="lg:col-span-2">
            <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-4">
              Reembolsos por Dia
            </h3>
            <div className="bg-white dark:bg-gray-700 p-4 rounded-lg h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart
                  margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                >
                  <CartesianGrid />
                  <XAxis 
                    type="category" 
                    dataKey="date" 
                    name="Data" 
                    tickFormatter={formatDate}
                  />
                  <YAxis 
                    type="number" 
                    dataKey="value" 
                    name="Valor" 
                    tickFormatter={(value) => formatCurrency(value).replace('R$', '').trim()}
                  />
                  <ZAxis
                    type="number"
                    dataKey="count"
                    range={[50, 500]}
                    name="Quantidade"
                  />
                  <Tooltip 
                    formatter={(value, name) => {
                      if (name === 'Valor') return formatCurrency(value);
                      return value;
                    }}
                    labelFormatter={formatDate}
                  />
                  <Legend />
                  <Scatter 
                    name="Reembolsos" 
                    data={dailyChartData} 
                    fill="#FF4500" 
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Tabela detalhada */}
        <div>
          <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-4">
            Detalhes dos Reembolsos
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Data
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Produto
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Cliente
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Valor
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {refundsData.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                      Nenhum reembolso encontrado.
                    </td>
                  </tr>
                ) : (
                  refundsData.map((refund, index) => {
                    const date = refund.dates?.created_at 
                      ? new Date(refund.dates.created_at * 1000)
                      : null;
                    
                    return (
                      <tr key={refund.id || index} className={index % 2 === 0 ? 'bg-gray-50 dark:bg-gray-700' : ''}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {date ? date.toLocaleDateString('pt-BR') : 'N/D'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {refund.product?.name || 'Não especificado'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {refund.customer?.name || 'Não especificado'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-red-600 dark:text-red-400 font-medium">
                          {formatCurrency(refund.calculation_details?.net_amount || 0)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RefundDetailsModal;