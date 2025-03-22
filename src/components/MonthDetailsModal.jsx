import React from 'react';
import { Bar, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

// Registra os componentes necessários do Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

const MonthDetailsModal = ({ year, month, salesData, products, onClose }) => {
  // Filtra as vendas para o mês e ano específicos
  const filteredSales = salesData.filter(sale => {
    const date = new Date(sale.timestamp);
    return date.getFullYear() === parseInt(year) && date.getMonth() === parseInt(month);
  });

  // Calcula o total de vendas por produto
  const salesByProduct = products.reduce((acc, product) => {
    acc[product] = filteredSales.filter(sale => sale.product === product).length;
    return acc;
  }, {});

  // Calcula o faturamento total (considerando que cada produto tem um valor)
  const totalRevenue = filteredSales.reduce((total, sale) => total + (sale.value || 0), 0);

  // Dados para o gráfico de vendas por produto
  const productChartData = {
    labels: products,
    datasets: [
      {
        label: 'Vendas por Produto',
        data: products.map(product => salesByProduct[product] || 0),
        backgroundColor: [
          'rgba(255, 99, 132, 0.6)',
          'rgba(54, 162, 235, 0.6)',
          'rgba(255, 206, 86, 0.6)',
          'rgba(75, 192, 192, 0.6)',
        ],
        borderColor: [
          'rgba(255, 99, 132, 1)',
          'rgba(54, 162, 235, 1)',
          'rgba(255, 206, 86, 1)',
          'rgba(75, 192, 192, 1)',
        ],
        borderWidth: 1,
      },
    ],
  };

  // Dados para o gráfico de vendas por dia
  const salesByDay = {};
  
  // Inicializa todos os dias do mês
  const daysInMonth = new Date(year, parseInt(month) + 1, 0).getDate();
  for (let i = 1; i <= daysInMonth; i++) {
    salesByDay[i] = 0;
  }
  
  // Preenche os dados de vendas por dia
  filteredSales.forEach(sale => {
    const day = new Date(sale.timestamp).getDate();
    salesByDay[day]++;
  });

  const dailySalesChartData = {
    labels: Object.keys(salesByDay),
    datasets: [
      {
        label: 'Vendas por Dia',
        data: Object.values(salesByDay),
        fill: false,
        borderColor: 'rgb(75, 192, 192)',
        tension: 0.1,
      },
    ],
  };

  // Dados para gráfico de vendas por vendedor
  const salesBySeller = {};
  filteredSales.forEach(sale => {
    const sellerName = sale.sellerName || 'Desconhecido';
    salesBySeller[sellerName] = (salesBySeller[sellerName] || 0) + 1;
  });

  const sellerChartData = {
    labels: Object.keys(salesBySeller),
    datasets: [
      {
        label: 'Vendas por Vendedor',
        data: Object.values(salesBySeller),
        backgroundColor: 'rgba(54, 162, 235, 0.6)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1,
      },
    ],
  };

  const getMonthName = (monthIndex) => {
    const months = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return months[monthIndex];
  };

  // Função para formatar data e hora
  const formatDateTime = (timestamp) => {
    if (!timestamp) return { date: 'N/A', time: 'N/A' };
    
    const date = new Date(timestamp);
    return {
      date: date.toLocaleDateString('pt-BR'),
      time: date.toLocaleTimeString('pt-BR')
    };
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-text-light dark:text-text-dark">
            Detalhes de {getMonthName(parseInt(month))} de {year}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg">
            <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-2">
              Total de Vendas
            </h3>
            <p className="text-3xl font-bold text-accent1 dark:text-accent2">
              {filteredSales.length}
            </p>
          </div>
          
          <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg">
            <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-2">
              Faturamento Total
            </h3>
            <p className="text-3xl font-bold text-accent1 dark:text-accent2">
              R$ {totalRevenue.toFixed(2).replace('.', ',')}
            </p>
          </div>
          
          <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg">
            <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-2">
              Média Diária
            </h3>
            <p className="text-3xl font-bold text-accent1 dark:text-accent2">
              {(filteredSales.length / daysInMonth).toFixed(1).replace('.', ',')}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          <div>
            <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-4">
              Vendas por Produto
            </h3>
            <div className="bg-white dark:bg-gray-700 p-4 rounded-lg h-64">
              <Bar data={productChartData} />
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-4">
              Vendas por Dia
            </h3>
            <div className="bg-white dark:bg-gray-700 p-4 rounded-lg h-64">
              <Line data={dailySalesChartData} />
            </div>
          </div>
        </div>

        <div className="mb-8">
          <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-4">
            Desempenho por Vendedor
          </h3>
          <div className="bg-white dark:bg-gray-700 p-4 rounded-lg h-64">
            <Bar 
              data={sellerChartData}
              options={{
                indexAxis: 'y',
                plugins: {
                  legend: {
                    display: false,
                  },
                },
              }} 
            />
          </div>
        </div>

        <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-4">
          Detalhes das Vendas
        </h3>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-100 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Data
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Hora
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Produto
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Vendedor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Valor
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                    Nenhuma venda registrada neste período.
                  </td>
                </tr>
              ) : (
                filteredSales.map((sale, index) => {
                  const { date, time } = formatDateTime(sale.timestamp);
                  return (
                    <tr key={sale.id || index}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-text-light dark:text-text-dark">
                        {date}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-text-light dark:text-text-dark">
                        {time}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-text-light dark:text-text-dark">
                        {sale.product}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-text-light dark:text-text-dark">
                        {sale.sellerName || 'Desconhecido'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-text-light dark:text-text-dark">
                        R$ {(sale.value || 0).toFixed(2).replace('.', ',')}
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
  );
};

export default MonthDetailsModal;