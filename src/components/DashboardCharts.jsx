import React from 'react';
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

  console.log(sale)
  return sale.channel;
};

const DashboardCharts = ({ salesData, products, sellers }) => {
  // Garantir que salesData seja sempre um array
  const safeData = Array.isArray(salesData) ? salesData : [];
  
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
  safeData.forEach(sale => {
    if (!sale || !sale.product) return;
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
  safeData.forEach(sale => {
    const channel = getSaleChannel(sale);
    // Usar o canal ou "Desconhecido" como fallback para registros antigos
    salesByChannel[channel] = (salesByChannel[channel] || 0) + 1;
  });

  // Preparar dados para o gráfico de vendas por produto
  const salesByProduct = products.reduce((acc, product) => {
    acc[product] = safeData.filter(sale => sale && sale.product === product).length;
    return acc;
  }, {});

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

  // Preparar dados para o gráfico de vendas por dia (últimos 15 dias)
  const last15Days = {};
  const today = new Date();
  
  // Inicializar os últimos 15 dias
  for (let i = 0; i < 15; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    last15Days[dateStr] = 0;
  }
  
  // Contar vendas por dia
  safeData.forEach(sale => {
    if (!sale || !sale.timestamp) return;
    
    const saleDate = new Date(sale.timestamp);
    const dateStr = saleDate.toISOString().split('T')[0];
    
    // Apenas vendas dos últimos 15 dias
    if (last15Days.hasOwnProperty(dateStr)) {
      last15Days[dateStr]++;
    }
  });
  
  // Preparar dados para o gráfico de linha
  const dailySalesLabels = Object.keys(last15Days).sort();
  const dailySalesData = dailySalesLabels.map(date => last15Days[date]);
  
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

  // Preparar dados para o gráfico de vendas por vendedor
  const salesBySeller = {};
  
  sellers.forEach(seller => {
    if (!seller || !seller.id) return;
    const sellerSales = safeData.filter(sale => sale && sale.sellerId === seller.id).length;
    salesBySeller[seller.name || 'Desconhecido'] = sellerSales;
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

  // Dados para o gráfico de faturamento por mês nos últimos 6 meses
  const last6Months = {};
  for (let i = 0; i < 6; i++) {
    const date = new Date(today);
    date.setMonth(today.getMonth() - i);
    const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
    last6Months[monthKey] = 0;
  }

  safeData.forEach(sale => {
    if (!sale || !sale.timestamp || !sale.value) return;
    
    const saleDate = new Date(sale.timestamp);
    const monthKey = `${saleDate.getFullYear()}-${saleDate.getMonth() + 1}`;
    
    if (last6Months.hasOwnProperty(monthKey)) {
      last6Months[monthKey] += sale.value;
    }
  });

  const monthlyRevenueLabels = Object.keys(last6Months).sort();
  const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  
  const monthlyRevenueChartData = {
    labels: monthlyRevenueLabels.map(key => {
      const [year, month] = key.split('-');
      return `${monthNames[parseInt(month) - 1]}/${year.slice(2)}`;
    }).reverse(),
    datasets: [
      {
        label: 'Faturamento Mensal',
        data: monthlyRevenueLabels.map(key => last6Months[key]).reverse(),
        backgroundColor: 'rgba(153, 102, 255, 0.6)',
        borderColor: 'rgba(153, 102, 255, 1)',
        borderWidth: 1,
      },
    ],
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
      <h3 className="text-xl font-bold text-primary dark:text-secondary mb-6">
        Análise de Vendas
      </h3>
      
      {/* Cards de Resumo - Vendas por Categoria */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-blue-50 dark:bg-blue-900 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
          <h4 className="text-lg font-medium text-blue-800 dark:text-blue-200 mb-2">
            Vendas por Cartão
          </h4>
          <p className="text-3xl font-bold text-blue-600 dark:text-blue-300">
            {salesByCategory['Cartão']}
          </p>
          <p className="text-sm text-blue-500 dark:text-blue-400 mt-1">
            {formatCurrency(revenueByCatetory['Cartão'])}
          </p>
        </div>
        
        <div className="bg-yellow-50 dark:bg-yellow-900 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
          <h4 className="text-lg font-medium text-yellow-800 dark:text-yellow-200 mb-2">
            Vendas por Boleto
          </h4>
          <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-300">
            {salesByCategory['Boleto']}
          </p>
          <p className="text-sm text-yellow-500 dark:text-yellow-400 mt-1">
            {formatCurrency(revenueByCatetory['Boleto'])}
          </p>
        </div>
        
        <div className="bg-purple-50 dark:bg-purple-900 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
          <h4 className="text-lg font-medium text-purple-800 dark:text-purple-200 mb-2">
            Faturamento Total
          </h4>
          <p className="text-3xl font-bold text-purple-600 dark:text-purple-300">
            {formatCurrency(revenueByCatetory['Cartão'] + revenueByCatetory['Boleto'] + revenueByCatetory['Outros'])}
          </p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        {/* Resumo de Canais de Venda */}
        {Object.entries(salesByChannel).map(([channel, count]) => (
          count > 0 && (
            <div key={channel} className="bg-white dark:bg-gray-700 p-4 rounded-lg shadow">
              <h4 className="text-lg font-medium text-text-light dark:text-text-dark mb-1">
                Canal: {channel}
              </h4>
              <p className="text-3xl font-bold text-accent1 dark:text-accent2">
                {count} vendas
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {((count / safeData.length) * 100).toFixed(1)}% do total
              </p>
            </div>
          )
        ))}
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <h4 className="text-lg font-medium text-text-light dark:text-text-dark mb-4">
            Vendas por Produto
          </h4>
          <div className="bg-white dark:bg-gray-700 p-4 rounded-lg h-64">
            <Bar data={productChartData} />
          </div>
        </div>
        
        <div>
          <h4 className="text-lg font-medium text-text-light dark:text-text-dark mb-4">
            Vendas por Canal
          </h4>
          <div className="bg-white dark:bg-gray-700 p-4 rounded-lg h-64">
            <Pie data={channelChartData} />
          </div>
        </div>
        
        <div>
          <h4 className="text-lg font-medium text-text-light dark:text-text-dark mb-4">
            Vendas por Método de Pagamento
          </h4>
          <div className="bg-white dark:bg-gray-700 p-4 rounded-lg h-64">
            <Pie data={categoryChartData} />
          </div>
        </div>
        
        <div>
          <h4 className="text-lg font-medium text-text-light dark:text-text-dark mb-4">
            Vendas dos Últimos 15 Dias
          </h4>
          <div className="bg-white dark:bg-gray-700 p-4 rounded-lg h-64">
            <Line data={dailySalesChartData} />
          </div>
        </div>
        
        <div>
          <h4 className="text-lg font-medium text-text-light dark:text-text-dark mb-4">
            Faturamento dos Últimos 6 Meses
          </h4>
          <div className="bg-white dark:bg-gray-700 p-4 rounded-lg h-64">
            <Bar data={monthlyRevenueChartData} />
          </div>
        </div>
        
        <div>
          <h4 className="text-lg font-medium text-text-light dark:text-text-dark mb-4">
            Desempenho por Vendedor
          </h4>
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
      </div>
    </div>
  );
};

export default DashboardCharts;