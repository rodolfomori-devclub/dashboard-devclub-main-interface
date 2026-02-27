// src/pages/CommercialSalesListPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FaChevronLeft, FaFilter, FaSearch, FaDownload } from 'react-icons/fa';
import commercialService from '../services/commercialService';
import { formatCurrency } from '../utils/currencyUtils';
import ResponsiveTable from '../components/ResponsiveTable';

function CommercialSalesListPage() {
  const [sales, setSales] = useState([]);
  const [filteredSales, setFilteredSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    seller: '',
    product: '',
    paymentMethod: '',
    channel: ''
  });
  
  // Filtros únicos disponíveis
  const [sellers, setSellers] = useState([]);
  const [products, setProducts] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [channels, setChannels] = useState([]);
  
  const navigate = useNavigate();
  const location = useLocation();

  // Carregar dados iniciais com base nos parâmetros da URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const startDate = params.get('startDate');
    const endDate = params.get('endDate');
    
    if (startDate && endDate) {
      fetchSalesData(new Date(startDate), new Date(endDate));
    } else {
      // Período padrão: últimos 30 dias
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      fetchSalesData(startDate, endDate);
    }
  }, [location.search]);

  const fetchSalesData = useCallback(async (startDate, endDate) => {
    try {
      setLoading(true);
      
      // Buscar vendas no intervalo de datas
      const salesData = await commercialService.getSalesByDateRange(startDate, endDate);
      
      // Ordenar por data (mais recentes primeiro)
      const sortedSales = [...salesData].sort((a, b) => 
        new Date(b.timestamp) - new Date(a.timestamp)
      );
      
      setSales(sortedSales);
      setFilteredSales(sortedSales);
      
      // Extrair opções únicas para filtros
      const uniqueSellers = [...new Set(sortedSales.map(sale => sale.seller))].sort();
      const uniqueProducts = [...new Set(sortedSales.map(sale => sale.product))].sort();
      const uniquePaymentMethods = [...new Set(sortedSales.map(sale => sale.paymentMethod))].sort();
      const uniqueChannels = [...new Set(sortedSales.map(sale => sale.channel))].sort();
      
      setSellers(uniqueSellers);
      setProducts(uniqueProducts);
      setPaymentMethods(uniquePaymentMethods);
      setChannels(uniqueChannels);
      
      setLoading(false);
    } catch (err) {
      console.error('Erro ao buscar dados:', err);
      setError('Falha ao carregar vendas. Por favor, tente novamente.');
      setLoading(false);
    }
  }, []);

  // Aplicar filtros aos dados
  useEffect(() => {
    let result = [...sales];
    
    // Aplicar pesquisa textual
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      result = result.filter(sale => 
        sale.seller.toLowerCase().includes(lowerSearch) ||
        sale.product.toLowerCase().includes(lowerSearch) ||
        sale.paymentMethod.toLowerCase().includes(lowerSearch) ||
        sale.channel.toLowerCase().includes(lowerSearch)
      );
    }
    
    // Aplicar filtros de dropdown
    if (filters.seller) {
      result = result.filter(sale => sale.seller === filters.seller);
    }
    
    if (filters.product) {
      result = result.filter(sale => sale.product === filters.product);
    }
    
    if (filters.paymentMethod) {
      result = result.filter(sale => sale.paymentMethod === filters.paymentMethod);
    }
    
    if (filters.channel) {
      result = result.filter(sale => sale.channel === filters.channel);
    }
    
    setFilteredSales(result);
  }, [sales, searchTerm, filters]);

  const handleFilterChange = (name, value) => {
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const clearFilters = () => {
    setFilters({
      seller: '',
      product: '',
      paymentMethod: '',
      channel: ''
    });
    setSearchTerm('');
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const navigateBack = () => {
    navigate('/commercial');
  };

  // Exportar para CSV
  const exportToCSV = () => {
    // Preparar os dados
    const headers = ['Data', 'Produto', 'Vendedor', 'Valor', 'Método de Pagamento', 'Canal'];
    
    const csvRows = [
      headers.join(','), // Cabeçalho
      ...filteredSales.map(sale => {
        const date = sale.date.formatted;
        const product = `"${sale.product.replace(/"/g, '""')}"`;
        const seller = `"${sale.seller.replace(/"/g, '""')}"`;
        const value = sale.value;
        const paymentMethod = `"${sale.paymentMethod.replace(/"/g, '""')}"`;
        const channel = `"${sale.channel.replace(/"/g, '""')}"`;
        
        return [date, product, seller, value, paymentMethod, channel].join(',');
      })
    ];
    
    const csvContent = csvRows.join('\n');
    
    // Criar blob e link de download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `vendas_comercial_${new Date().toLocaleDateString('en-CA')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Definir colunas para a tabela
  const columns = [
    {
      key: 'date',
      header: 'Data',
      render: (sale) => sale.date.formatted
    },
    {
      key: 'product',
      header: 'Produto',
      render: (sale) => sale.product
    },
    {
      key: 'seller',
      header: 'Vendedor',
      render: (sale) => sale.seller
    },
    {
      key: 'value',
      header: 'Valor',
      render: (sale) => formatCurrency(sale.value),
      className: 'text-right'
    },
    {
      key: 'paymentMethod',
      header: 'Pagamento',
      render: (sale) => sale.paymentMethod,
      hide: 'sm' // Ocultar em telas pequenas
    },
    {
      key: 'channel',
      header: 'Canal',
      render: (sale) => sale.channel,
      hide: 'sm' // Ocultar em telas pequenas
    }
  ];

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center mb-6">
          <button
            onClick={navigateBack}
            className="mr-4 text-primary dark:text-secondary hover:text-secondary dark:hover:text-primary"
          >
            <FaChevronLeft className="text-xl" />
          </button>
          <h1 className="text-3xl font-bold text-primary-dark dark:text-primary">
            Todas as Vendas
          </h1>
        </div>

        {/* Resumo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-text-light dark:text-text-dark">
              Total de Vendas
            </h3>
            <p className="mt-2 text-3xl font-bold text-accent1 dark:text-accent2">
              {filteredSales.length}
            </p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-text-light dark:text-text-dark">
              Valor Total
            </h3>
            <p className="mt-2 text-3xl font-bold text-green-500 dark:text-green-400">
              {formatCurrency(filteredSales.reduce((sum, sale) => sum + sale.value, 0))}
            </p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-text-light dark:text-text-dark">
              Ticket Médio
            </h3>
            <p className="mt-2 text-3xl font-bold text-blue-500 dark:text-blue-400">
              {formatCurrency(filteredSales.length 
                ? filteredSales.reduce((sum, sale) => sum + sale.value, 0) / filteredSales.length 
                : 0
              )}
            </p>
          </div>
        </div>

        {/* Filtros e pesquisa */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
            <h2 className="text-xl font-bold text-primary dark:text-secondary mb-4 md:mb-0 flex items-center">
              <FaFilter className="mr-2" />
              Filtros
            </h2>
            
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FaSearch className="text-gray-400" />
                </div>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={handleSearchChange}
                  placeholder="Pesquisar..."
                  className="pl-10 pr-4 py-2 border rounded-lg bg-white dark:bg-gray-700 text-text-light dark:text-text-dark"
                />
              </div>
              
              <button
                onClick={clearFilters}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Limpar Filtros
              </button>
              
              <button
                onClick={exportToCSV}
                className="px-4 py-2 bg-primary text-white dark:bg-secondary dark:text-primary-dark rounded-lg hover:bg-primary-dark dark:hover:bg-secondary-light flex items-center"
              >
                <FaDownload className="mr-2" />
                Exportar CSV
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Vendedor
              </label>
              <select
                value={filters.seller}
                onChange={(e) => handleFilterChange('seller', e.target.value)}
                className="w-full border rounded-lg bg-white dark:bg-gray-700 text-text-light dark:text-text-dark px-3 py-2"
              >
                <option value="">Todos os vendedores</option>
                {sellers.map(seller => (
                  <option key={seller} value={seller}>
                    {seller}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Produto
              </label>
              <select
                value={filters.product}
                onChange={(e) => handleFilterChange('product', e.target.value)}
                className="w-full border rounded-lg bg-white dark:bg-gray-700 text-text-light dark:text-text-dark px-3 py-2"
              >
                <option value="">Todos os produtos</option>
                {products.map(product => (
                  <option key={product} value={product}>
                    {product}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Método de Pagamento
              </label>
              <select
                value={filters.paymentMethod}
                onChange={(e) => handleFilterChange('paymentMethod', e.target.value)}
                className="w-full border rounded-lg bg-white dark:bg-gray-700 text-text-light dark:text-text-dark px-3 py-2"
              >
                <option value="">Todos os métodos</option>
                {paymentMethods.map(method => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Canal
              </label>
              <select
                value={filters.channel}
                onChange={(e) => handleFilterChange('channel', e.target.value)}
                className="w-full border rounded-lg bg-white dark:bg-gray-700 text-text-light dark:text-text-dark px-3 py-2"
              >
                <option value="">Todos os canais</option>
                {channels.map(channel => (
                  <option key={channel} value={channel}>
                    {channel}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            <p className="font-bold">Erro</p>
            <p>{error}</p>
          </div>
        )}

        {/* Tabela de vendas */}
        {!loading && !error && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold text-primary dark:text-secondary mb-2">
                Lista de Vendas
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                {filteredSales.length} registro(s) encontrado(s)
              </p>
            </div>
            
            <ResponsiveTable
              columns={columns}
              data={filteredSales}
              keyExtractor={(item) => item.id}
              emptyMessage="Nenhuma venda encontrada com os filtros atuais"
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default CommercialSalesListPage;