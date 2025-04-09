import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { formatCurrency } from '../utils/currencyUtils';

const PaymentMethodComparison = ({ salesData }) => {
  const [comparisonData, setComparisonData] = useState([]);
  
  useEffect(() => {
    if (!salesData || !salesData.length) return;
    
    // Agrupar vendas por método de pagamento
    const methodsMap = {};
    
    salesData.forEach(sale => {
      const method = sale.paymentMethod || 'Desconhecido';
      
      if (!methodsMap[method]) {
        methodsMap[method] = {
          name: method,
          count: 0,
          value: 0,
        };
      }
      
      methodsMap[method].count += 1;
      methodsMap[method].value += (sale.value || 0);
    });
    
    // Converter para array e ordenar por valor
    const data = Object.values(methodsMap)
      .sort((a, b) => b.value - a.value);
      
    setComparisonData(data);
  }, [salesData]);
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
      <h3 className="text-xl font-bold text-primary dark:text-secondary mb-6">
        Comparativo de Métodos de Pagamento
      </h3>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Gráfico de barras para quantidade */}
        <div>
          <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
            Quantidade de Vendas
          </h4>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={comparisonData}
                layout="vertical"
                margin={{ top: 20, right: 30, left: 100, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis 
                  dataKey="name" 
                  type="category"
                  tick={{ fontSize: 12 }}
                  width={90}
                />
                <Tooltip />
                <Legend />
                <Bar 
                  dataKey="count" 
                  name="Quantidade" 
                  fill="#37E359"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        {/* Gráfico de barras para valor */}
        <div>
          <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
            Valor Total
          </h4>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={comparisonData}
                layout="vertical"
                margin={{ top: 20, right: 30, left: 100, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  type="number"
                  tickFormatter={(value) => formatCurrency(value).replace('R$', '')}
                />
                <YAxis 
                  dataKey="name" 
                  type="category"
                  tick={{ fontSize: 12 }}
                  width={90}
                />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Legend />
                <Bar 
                  dataKey="value" 
                  name="Valor" 
                  fill="#051626"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      
      <div className="mt-8">
        <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
          Indicadores por Método de Pagamento
        </h4>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Método de Pagamento
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Quantidade
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Valor Total
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Ticket Médio
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {comparisonData.map((method, index) => (
                <tr key={index} className={index % 2 === 0 ? 'bg-gray-50 dark:bg-gray-700' : ''}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    {method.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-white">
                    {method.count}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-white">
                    {formatCurrency(method.value)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-white">
                    {formatCurrency(method.count ? method.value / method.count : 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PaymentMethodComparison;