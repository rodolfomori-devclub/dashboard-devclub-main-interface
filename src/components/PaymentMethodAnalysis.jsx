import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { formatCurrency } from '../utils/currencyUtils';

// Cores para o gráfico
const COLORS = ['#37E359', '#051626', '#FF4500', '#1E90FF', '#FFD700', '#FF1493'];

const PaymentMethodAnalysis = ({ salesData }) => {
  const [paymentMethodSummary, setPaymentMethodSummary] = useState([]);
  
  useEffect(() => {
    if (!salesData || !salesData.length) return;
    
    // Agrupar vendas por método de pagamento
    const paymentMethods = {};
    
    salesData.forEach(sale => {
      const method = sale.paymentMethod || 'Desconhecido';
      
      if (!paymentMethods[method]) {
        paymentMethods[method] = {
          name: method,
          count: 0,
          value: 0,
        };
      }
      
      paymentMethods[method].count += 1;
      paymentMethods[method].value += (sale.value || 0);
    });
    
    // Converter para array e ordenar por valor
    const summaryData = Object.values(paymentMethods)
      .sort((a, b) => b.value - a.value);
    
    setPaymentMethodSummary(summaryData);
  }, [salesData]);
  
  const totalSales = paymentMethodSummary.reduce((sum, item) => sum + item.count, 0);
  const totalValue = paymentMethodSummary.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
      <h3 className="text-xl font-bold text-primary dark:text-secondary mb-6">
        Análise por Método de Pagamento
      </h3>
      
      {/* Cards de resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
          <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            Total de Vendas
          </h4>
          <p className="text-3xl font-bold text-primary-dark dark:text-primary">
            {totalSales}
          </p>
        </div>
        
        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
          <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            Valor Total
          </h4>
          <p className="text-3xl font-bold text-primary-dark dark:text-primary">
            {formatCurrency(totalValue)}
          </p>
        </div>
        
        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
          <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            Ticket Médio
          </h4>
          <p className="text-3xl font-bold text-primary-dark dark:text-primary">
            {formatCurrency(totalSales ? totalValue / totalSales : 0)}
          </p>
        </div>
      </div>
      
      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Gráfico de pizza para quantidade de vendas */}
        <div>
          <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
            Quantidade de Vendas por Método de Pagamento
          </h4>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={paymentMethodSummary}
                  dataKey="count"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  label={({name, percent}) => `${name}: ${(percent * 100).toFixed(1)}%`}
                >
                  {paymentMethodSummary.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => value} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        {/* Gráfico de pizza para valor de vendas */}
        <div>
          <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
            Valor de Vendas por Método de Pagamento
          </h4>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={paymentMethodSummary}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  label={({name, percent}) => `${name}: ${(percent * 100).toFixed(1)}%`}
                >
                  {paymentMethodSummary.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      
      {/* Tabela de detalhes */}
      <div className="mt-8">
        <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
          Detalhamento por Método de Pagamento
        </h4>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Método de Pagamento
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Quantidade
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  % do Total
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Valor Total
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  % da Receita
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Ticket Médio
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {paymentMethodSummary.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-500 dark:text-gray-400">
                    Nenhum dado disponível
                  </td>
                </tr>
              ) : (
                paymentMethodSummary.map((method, index) => (
                  <tr key={index} className={index % 2 === 0 ? 'bg-gray-50 dark:bg-gray-700' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {method.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {method.count}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {totalSales ? ((method.count / totalSales) * 100).toFixed(1) : 0}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {formatCurrency(method.value)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {totalValue ? ((method.value / totalValue) * 100).toFixed(1) : 0}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {formatCurrency(method.count ? method.value / method.count : 0)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PaymentMethodAnalysis;