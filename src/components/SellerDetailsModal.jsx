import React, { useState } from 'react';
import { Bar, Line, Pie } from 'react-chartjs-2';
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

// Função para formatar valores monetários em formato brasileiro (R$ 1.234,56)
const formatCurrency = (value) => {
  if (value === undefined || value === null) return 'R$ 0,00';
  
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2
  }).format(value);
};

// Função para classificar produtos em categorias
const categorizeProduct = (productName) => {
  if (!productName) return 'Outros';
  
  const lowerName = productName.toLowerCase();
  
  if (lowerName.includes('cartão') || lowerName.includes('cartao') || lowerName.includes('guru')) {
    return 'Cartão';
  } else if (lowerName.includes('boleto') || lowerName.includes('tmb')) {
    return 'Boleto';
  }
  
  return 'Outros';
};

// Função para obter o canal de venda com segurança
const getSaleChannel = (sale) => {
  if (!sale || !sale.channel) return "Desconhecido";
  return sale.channel;
};

const SellerDetailsModal = ({ seller, salesData = [], products, onClose }) => {
  const [activeTab, setActiveTab] = useState('history');

  // Garantir que salesData seja sempre um array (corrigindo o problema de iteração)
  const salesHistory = Array.isArray(salesData) ? salesData : [];

  // Ordenar vendas da mais recente para a mais antiga
  const sortedSales = [...salesHistory].sort((a, b) => 
    new Date(b.timestamp) - new Date(a.timestamp)
  );

  // Categorizar vendas
  const salesByCategory = {
    'Cartão': 0,
    'Boleto': 0,
    'Outros': 0
  };
  
  const revenueByCatetory = {
    'Cartão': 0,
    'Boleto': 0,
    'Outros': 0
  };

  // Processar vendas por categoria
  salesHistory.forEach(sale => {
    const category = categorizeProduct(sale.product);
    salesByCategory[category]++;
    revenueByCatetory[category] += (sale.value || 0);
  });

  // Contagem de vendas por canal
  const salesByChannel = {
    'Ligação': 0,
    'WhatsApp': 0,
    'Sessão Estratégica': 0,
    'Outro': 0,
    'Desconhecido': 0
  };

  // Processar vendas por canal
  salesHistory.forEach(sale => {
    const channel = getSaleChannel(sale);
    // Usar o canal ou "Desconhecido" como fallback para registros antigos
    salesByChannel[channel] = (salesByChannel[channel] || 0) + 1;
  });

  // Calcula total de vendas por produto
  const salesByProduct = products.reduce((acc, product) => {
    acc[product] = salesHistory.filter(sale => sale.product === product).length;
    return acc;
  }, {});

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
  
  // Dados para o gráfico de vendas por categoria
  const categoryChartData = {
    labels: ['Cartão', 'Boleto', 'Outros'],
    datasets: [
      {
        label: 'Vendas por Método',
        data: [salesByCategory['Cartão'], salesByCategory['Boleto'], salesByCategory['Outros']],
        backgroundColor: [
          'rgba(54, 162, 235, 0.6)',
          'rgba(255, 206, 86, 0.6)',
          'rgba(75, 192, 192, 0.6)',
        ],
        borderColor: [
          'rgba(54, 162, 235, 1)',
          'rgba(255, 206, 86, 1)',
          'rgba(75, 192, 192, 1)',
        ],
        borderWidth: 1,
      },
    ],
  };
  
  // Dados para o gráfico de vendas por canal
  const channelChartData = {
    labels: Object.keys(salesByChannel),
    datasets: [
      {
        label: 'Vendas por Canal',
        data: Object.values(salesByChannel),
        backgroundColor: [
          'rgba(255, 99, 132, 0.6)',
          'rgba(54, 162, 235, 0.6)',
          'rgba(255, 206, 86, 0.6)',
          'rgba(75, 192, 192, 0.6)',
          'rgba(153, 102, 255, 0.6)',
        ],
        borderColor: [
          'rgba(255, 99, 132, 1)',
          'rgba(54, 162, 235, 1)',
          'rgba(255, 206, 86, 1)',
          'rgba(75, 192, 192, 1)',
          'rgba(153, 102, 255, 1)',
        ],
        borderWidth: 1,
      },
    ],
  };

  // Agrupar vendas por dia para o gráfico de linha
  const last30Days = {};
  const today = new Date();
  
  // Inicializar os últimos 30 dias
  for (let i = 0; i < 30; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    last30Days[dateStr] = 0;
  }
  
  // Contar vendas por dia
  salesHistory.forEach(sale => {
    if (!sale.timestamp) return;
    
    const saleDate = new Date(sale.timestamp);
    const dateStr = saleDate.toISOString().split('T')[0];
    
    // Apenas vendas dos últimos 30 dias
    if (last30Days.hasOwnProperty(dateStr)) {
      last30Days[dateStr]++;
    }
  });
  
  // Preparar dados para o gráfico de linha
  const dailySalesLabels = Object.keys(last30Days).sort();
  const dailySalesData = dailySalesLabels.map(date => last30Days[date]);
  
  const dailySalesChartData = {
    labels: dailySalesLabels.map(date => {
      const [year, month, day] = date.split('-');
      return `${day}/${month}`;
    }),
    datasets: [
      {
        label: 'Vendas por Dia',
        data: dailySalesData,
        fill: false,
        borderColor: 'rgb(75, 192, 192)',
        tension: 0.1,
      },
    ],
  };

  // Calcular estatísticas gerais
  const totalSales = sortedSales.length;
  const totalRevenue = sortedSales.reduce((total, sale) => total + (sale.value || 0), 0);
  
  // Calcular média diária nos últimos 30 dias
  const salesLast30Days = sortedSales.filter(sale => {
    if (!sale.timestamp) return false;
    const saleDate = new Date(sale.timestamp);
    const timeDiff = today.getTime() - saleDate.getTime();
    const daysDiff = timeDiff / (1000 * 3600 * 24);
    return daysDiff <= 30;
  }).length;
  
  const avgDailySales = salesLast30Days / 30;

  // Função para formatar data e hora
  const formatDateTime = (timestamp) => {
    if (!timestamp) return { date: 'N/A', time: 'N/A' };
    
    const date = new Date(timestamp);
    return {
      date: date.toLocaleDateString('pt-BR'),
      time: date.toLocaleTimeString('pt-BR')
    };
  };

  // Função para obter cor do canal
  const getChannelColor = (channel) => {
    const colors = {
      'Ligação': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
      'WhatsApp': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      'Sessão Estratégica': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
      'Outro': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
      'Desconhecido': 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    };
    return colors[channel] || colors['Desconhecido'];
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-text-light dark:text-text-dark">
            Detalhes de {seller.name}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg">
            <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-2">
              Total de Vendas
            </h3>
            <p className="text-3xl font-bold text-accent1 dark:text-accent2">
              {totalSales}
            </p>
          </div>
          
          <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg">
            <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-2">
              Vendas Cartão
            </h3>
            <p className="text-3xl font-bold text-blue-500">
              {salesByCategory['Cartão']}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {formatCurrency(revenueByCatetory['Cartão'])}
            </p>
          </div>
          
          <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg">
            <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-2">
              Vendas Boleto
            </h3>
            <p className="text-3xl font-bold text-yellow-500">
              {salesByCategory['Boleto']}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {formatCurrency(revenueByCatetory['Boleto'])}
            </p>
          </div>
          
          <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg">
            <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-2">
              Faturamento Total
            </h3>
            <p className="text-3xl font-bold text-accent1 dark:text-accent2">
              {formatCurrency(totalRevenue)}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('history')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'history'
                  ? 'border-primary text-primary dark:border-secondary dark:text-secondary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Histórico de Vendas
            </button>
            <button
              onClick={() => setActiveTab('charts')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'charts'
                  ? 'border-primary text-primary dark:border-secondary dark:text-secondary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Gráficos
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'history' && (
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
                    Categoria
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Canal
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Valor
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {sortedSales.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                      Nenhuma venda registrada.
                    </td>
                  </tr>
                ) : (
                  sortedSales.map((sale, index) => {
                    const { date, time } = formatDateTime(sale.timestamp);
                    const category = categorizeProduct(sale.product);
                    const channel = getSaleChannel(sale);
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
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            category === 'Cartão' 
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
                              : category === 'Boleto'
                                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
                                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                          }`}>
                            {category}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getChannelColor(channel)}`}>
                            {channel}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-text-light dark:text-text-dark">
                          {formatCurrency(sale.value || 0)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'charts' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-4">
                Vendas por Produto
              </h3>
              <div className="bg-white dark:bg-gray-700 p-4 rounded-lg h-64">
                <Pie data={productChartData} />
              </div>
            </div>
            
            <div>
              <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-4">
                Vendas por Método de Pagamento
              </h3>
              <div className="bg-white dark:bg-gray-700 p-4 rounded-lg h-64">
                <Pie data={categoryChartData} />
              </div>
            </div>
            
            <div>
              <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-4">
                Vendas por Canal
              </h3>
              <div className="bg-white dark:bg-gray-700 p-4 rounded-lg h-64">
                <Pie data={channelChartData} />
              </div>
            </div>
            
            <div>
              <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-4">
                Vendas dos Últimos 30 Dias
              </h3>
              <div className="bg-white dark:bg-gray-700 p-4 rounded-lg h-64">
                <Line data={dailySalesChartData} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SellerDetailsModal;