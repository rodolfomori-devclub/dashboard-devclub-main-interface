// src/pages/CommercialDashboardPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import commercialService from '../services/commercialService';
import goalsService from '../services/goalsService';
import { formatCurrency } from '../utils/currencyUtils';
import { FaEdit, FaSave, FaChartBar, FaCalendarAlt } from 'react-icons/fa';

const COLORS = ['#37E359', '#051626', '#FF4500', '#1E90FF', '#FFD700', '#FF1493'];

function CommercialDashboardPage() {
  // Estado para vendas e filtros
  const [salesData, setSalesData] = useState([]);
  const [filteredSales, setFilteredSales] = useState([]);
  const [filterType, setFilterType] = useState('month'); // 'month', 'year', 'custom'
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [customStartDate, setCustomStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  );
  const [customEndDate, setCustomEndDate] = useState(
    new Date().toISOString().split('T')[0]
  );

  // Estado para metas
  const [goals, setGoals] = useState({
    meta: 0,
    superMeta: 0,
    ultraMeta: 0,
  });
  const [editingGoal, setEditingGoal] = useState(null);
  const [tempGoalValue, setTempGoalValue] = useState('');

  // Estado para carregamento e erro
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Estado para dados agregados
  const [summary, setSummary] = useState({
    totalSales: 0,
    totalRevenue: 0,
    salesByProduct: [],
    salesBySeller: [],
    salesByChannel: [],
    salesByPaymentMethod: [],
    dailyTrend: [],
  });

  const navigate = useNavigate();

  // Função para formatar data para exibição
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR');
  };

  // Função para obter o nome do mês
  const getMonthName = (monthIndex) => {
    const months = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return months[monthIndex - 1];
  };

  // Buscar dados com base nos filtros
  const fetchSalesData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let sales = [];
      let goalValues = {
        meta: 0,
        superMeta: 0,
        ultraMeta: 0,
      };

      // Obter dados de acordo com o tipo de filtro
      if (filterType === 'month') {
        sales = await commercialService.getSalesByMonth(selectedYear, selectedMonth);
        goalValues = await goalsService.getAllGoals('month', selectedYear, selectedMonth);
      } else if (filterType === 'year') {
        sales = await commercialService.getSalesByYear(selectedYear);
        goalValues = await goalsService.getAllGoals('year', selectedYear);
      } else if (filterType === 'custom') {
        sales = await commercialService.getSalesByDateRange(
          new Date(customStartDate),
          new Date(customEndDate)
        );
        // Para datas personalizadas, não carregamos metas
      }

      // Definir dados e metas
      setSalesData(sales);
      setFilteredSales(sales);
      setGoals(goalValues);

      // Calcular resumo dos dados
      calculateSummary(sales);

      setLoading(false);
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
      setError('Falha ao carregar os dados. Tente novamente mais tarde.');
      setLoading(false);
    }
  }, [filterType, selectedMonth, selectedYear, customStartDate, customEndDate]);

  // Efeito para carregar dados iniciais
  useEffect(() => {
    fetchSalesData();
  }, [fetchSalesData]);

  // Calcular dados de resumo
  const calculateSummary = (sales) => {
    // Calcular total de vendas e receita
    const totalSales = sales.length;
    const totalRevenue = sales.reduce((sum, sale) => sum + (sale.value || 0), 0);

    // Agrupar vendas por produto
    const productMap = new Map();
    sales.forEach(sale => {
      const product = sale.product;
      if (!productMap.has(product)) {
        productMap.set(product, { name: product, count: 0, value: 0 });
      }
      const productData = productMap.get(product);
      productData.count += 1;
      productData.value += (sale.value || 0);
    });
    const salesByProduct = Array.from(productMap.values());

    // Agrupar vendas por vendedor
    const sellerMap = new Map();
    sales.forEach(sale => {
      const seller = sale.seller;
      if (!sellerMap.has(seller)) {
        sellerMap.set(seller, { name: seller, count: 0, value: 0 });
      }
      const sellerData = sellerMap.get(seller);
      sellerData.count += 1;
      sellerData.value += (sale.value || 0);
    });
    const salesBySeller = Array.from(sellerMap.values())
      .sort((a, b) => b.count - a.count);

    // Agrupar vendas por canal
    const channelMap = new Map();
    sales.forEach(sale => {
      const channel = sale.channel;
      if (!channelMap.has(channel)) {
        channelMap.set(channel, { name: channel, count: 0, value: 0 });
      }
      const channelData = channelMap.get(channel);
      channelData.count += 1;
      channelData.value += (sale.value || 0);
    });
    const salesByChannel = Array.from(channelMap.values());

    // Agrupar vendas por método de pagamento
    const paymentMap = new Map();
    sales.forEach(sale => {
      const payment = sale.paymentMethod;
      if (!paymentMap.has(payment)) {
        paymentMap.set(payment, { name: payment, count: 0, value: 0 });
      }
      const paymentData = paymentMap.get(payment);
      paymentData.count += 1;
      paymentData.value += (sale.value || 0);
    });
    const salesByPaymentMethod = Array.from(paymentMap.values());

    // Tendência diária (para gráfico de linha)
    const dateMap = new Map();
    sales.forEach(sale => {
      const dateStr = sale.date.formatted;
      if (!dateMap.has(dateStr)) {
        dateMap.set(dateStr, { date: dateStr, count: 0, value: 0 });
      }
      const dateData = dateMap.get(dateStr);
      dateData.count += 1;
      dateData.value += (sale.value || 0);
    });
    // Ordenar por data
    const dailyTrend = Array.from(dateMap.values())
      .sort((a, b) => {
        const dateA = a.date.split('/').reverse().join('-');
        const dateB = b.date.split('/').reverse().join('-');
        return dateA.localeCompare(dateB);
      });

    setSummary({
      totalSales,
      totalRevenue,
      salesByProduct,
      salesBySeller,
      salesByChannel,
      salesByPaymentMethod,
      dailyTrend
    });
  };

  // Manipuladores para mudança de filtros
  const handleFilterTypeChange = (e) => {
    setFilterType(e.target.value);
  };

  const handleMonthChange = (e) => {
    setSelectedMonth(Number(e.target.value));
  };

  const handleYearChange = (e) => {
    setSelectedYear(Number(e.target.value));
  };

  const handleStartDateChange = (e) => {
    setCustomStartDate(e.target.value);
  };

  const handleEndDateChange = (e) => {
    setCustomEndDate(e.target.value);
  };

  // Aplicar filtros
  const applyFilters = () => {
    fetchSalesData();
  };

  // Editar meta
  const handleEditGoal = (goalType) => {
    setEditingGoal(goalType);
    setTempGoalValue(goals[goalType].toString());
  };

  // Salvar meta
  const handleSaveGoal = async (goalType) => {
    try {
      const goalValue = parseInt(tempGoalValue) || 0;
      
      if (filterType === 'month') {
        await goalsService.saveGoal('month', selectedYear, selectedMonth, goalType, goalValue);
      } else if (filterType === 'year') {
        await goalsService.saveGoal('year', selectedYear, null, goalType, goalValue);
      }
      
      setGoals(prev => ({
        ...prev,
        [goalType]: goalValue
      }));
      setEditingGoal(null);
    } catch (err) {
      console.error('Erro ao salvar meta:', err);
      alert('Erro ao salvar meta. Tente novamente.');
    }
  };

  // Calcular progresso em relação à meta
  const calculateProgress = (metaValue) => {
    if (!metaValue) return 0;
    return Math.min(100, Math.round((summary.totalSales / metaValue) * 100));
  };

  // Navegar para a página de vendedores
  const navigateToSellers = () => {
    navigate('/commercial/sellers', { 
      state: { 
        year: selectedYear,
        month: selectedMonth 
      } 
    });
  };

  // Renderização do componente
  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
          <h1 className="text-3xl font-bold text-primary-dark dark:text-primary">
            Dashboard Comercial
          </h1>
          <div className="mt-4 sm:mt-0">
            <button 
              onClick={navigateToSellers}
              className="px-4 py-2 bg-secondary text-primary hover:bg-secondary-light rounded-lg transition-colors"
            >
              Ver Vendedores
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-bold text-primary dark:text-secondary mb-4">
            Filtros
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tipo de período
              </label>
              <select
                value={filterType}
                onChange={handleFilterTypeChange}
                className="w-full border rounded-lg bg-white dark:bg-gray-700 text-text-light dark:text-text-dark px-3 py-2"
              >
                <option value="month">Mensal</option>
                <option value="year">Anual</option>
                <option value="custom">Personalizado</option>
              </select>
            </div>

            {filterType === 'month' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Mês
                  </label>
                  <select
                    value={selectedMonth}
                    onChange={handleMonthChange}
                    className="w-full border rounded-lg bg-white dark:bg-gray-700 text-text-light dark:text-text-dark px-3 py-2"
                  >
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {getMonthName(i + 1)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Ano
                  </label>
                  <select
                    value={selectedYear}
                    onChange={handleYearChange}
                    className="w-full border rounded-lg bg-white dark:bg-gray-700 text-text-light dark:text-text-dark px-3 py-2"
                  >
                    {Array.from({ length: 5 }, (_, i) => (
                      <option key={i} value={new Date().getFullYear() - i}>
                        {new Date().getFullYear() - i}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {filterType === 'year' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Ano
                </label>
                <select
                  value={selectedYear}
                  onChange={handleYearChange}
                  className="w-full border rounded-lg bg-white dark:bg-gray-700 text-text-light dark:text-text-dark px-3 py-2"
                >
                  {Array.from({ length: 5 }, (_, i) => (
                    <option key={i} value={new Date().getFullYear() - i}>
                      {new Date().getFullYear() - i}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {filterType === 'custom' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Data inicial
                  </label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={handleStartDateChange}
                    className="w-full border rounded-lg bg-white dark:bg-gray-700 text-text-light dark:text-text-dark px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Data final
                  </label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={handleEndDateChange}
                    className="w-full border rounded-lg bg-white dark:bg-gray-700 text-text-light dark:text-text-dark px-3 py-2"
                  />
                </div>
              </>
            )}

            <div className="flex items-end">
              <button
                onClick={applyFilters}
                className="px-4 py-2 bg-primary text-white dark:bg-secondary dark:text-primary-dark rounded-lg hover:opacity-90 transition-opacity"
              >
                <FaCalendarAlt className="inline mr-2" />
                Aplicar Filtros
              </button>
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

        {!loading && !error && (
          <>
            {/* Cards de Metas */}
            {(filterType === 'month' || filterType === 'year') && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {['meta', 'superMeta', 'ultraMeta'].map((goalType) => (
                  <div
                    key={goalType}
                    className="bg-white dark:bg-gray-800 rounded-lg shadow p-6"
                  >
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-medium text-text-light dark:text-text-dark">
                        {goalType === 'meta'
                          ? 'Meta'
                          : goalType === 'superMeta'
                          ? 'Super Meta'
                          : 'Ultra Meta'}
                      </h3>
                      {editingGoal !== goalType ? (
                        <button
                          onClick={() => handleEditGoal(goalType)}
                          className="text-primary dark:text-secondary hover:text-secondary dark:hover:text-primary"
                        >
                          <FaEdit />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleSaveGoal(goalType)}
                          className="text-green-500 hover:text-green-600 dark:text-green-400 dark:hover:text-green-300"
                        >
                          <FaSave />
                        </button>
                      )}
                    </div>
                    {editingGoal === goalType ? (
                      <input
                        type="number"
                        value={tempGoalValue}
                        onChange={(e) => setTempGoalValue(e.target.value)}
                        className="w-full border rounded px-2 py-1 bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark"
                      />
                    ) : (
                      <p className="text-2xl font-bold text-accent1 dark:text-accent2">
                        {goals[goalType]} vendas
                      </p>
                    )}
                    <div className="mt-4">
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mb-1">
                        <div
                          className="bg-primary dark:bg-secondary h-2.5 rounded-full"
                          style={{
                            width: `${calculateProgress(goals[goalType])}%`,
                          }}
                        ></div>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {calculateProgress(goals[goalType])}% concluído ({summary.totalSales} de {goals[goalType]})
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Cards de resumo */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-text-light dark:text-text-dark">
                  Total de Vendas
                </h3>
                <p className="mt-2 text-3xl font-bold text-accent1 dark:text-accent2">
                  {summary.totalSales}
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-text-light dark:text-text-dark">
                  Receita Total
                </h3>
                <p className="mt-2 text-3xl font-bold text-green-500 dark:text-green-400">
                  {formatCurrency(summary.totalRevenue)}
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-text-light dark:text-text-dark">
                  Ticket Médio
                </h3>
                <p className="mt-2 text-3xl font-bold text-blue-500 dark:text-blue-400">
                  {formatCurrency(summary.totalSales ? summary.totalRevenue / summary.totalSales : 0)}
                </p>
              </div>
            </div>

            {/* Top Vendedores */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-primary dark:text-secondary">
                  Top Vendedores
                </h3>
                <button 
                  onClick={navigateToSellers}
                  className="text-sm text-primary dark:text-secondary hover:underline"
                >
                  Ver todos
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {summary.salesBySeller.slice(0, 3).map((seller, index) => (
                  <div key={seller.name} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 shadow-sm">
                    <div className="flex items-center mb-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                        index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : 'bg-amber-600'
                      }`}>
                        {index + 1}
                      </div>
                      <div className="ml-4">
                        <h4 className="font-bold text-text-light dark:text-text-dark">{seller.name}</h4>
                        <p className="text-gray-600 dark:text-gray-400">{seller.count} vendas</p>
                      </div>
                    </div>
                    <p className="text-xl font-bold text-primary dark:text-secondary">
                      {formatCurrency(seller.value)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Gráficos */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* Gráfico de Vendas por Produto */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-4">
                  Vendas por Produto
                </h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={summary.salesByProduct}
                      margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip formatter={(value, name, props) => [value, 'Vendas']} />
                      <Legend />
                      <Bar dataKey="count" name="Vendas" fill="#37E359" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Gráfico de Faturamento por Produto */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-4">
                  Faturamento por Produto
                </h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={summary.salesByProduct}
                      margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis tickFormatter={(value) => formatCurrency(value).slice(0, -3)} />
                      <Tooltip formatter={(value) => formatCurrency(value)} />
                      <Legend />
                      <Bar dataKey="value" name="Faturamento" fill="#1E90FF" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Vendas por Canal */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-4">
                  Vendas por Canal
                </h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={summary.salesByChannel}
                        dataKey="count"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        fill="#8884d8"
                        label={(entry) => entry.name}
                      >
                        {summary.salesByChannel.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value, name, props) => [value, 'Vendas']} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Vendas por Método de Pagamento */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-4">
                  Vendas por Método de Pagamento
                </h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={summary.salesByPaymentMethod}
                        dataKey="count"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        fill="#8884d8"
                        label={(entry) => entry.name}
                      >
                        {summary.salesByPaymentMethod.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value, name, props) => [value, 'Vendas']} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Tendência de Vendas Diárias */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 md:col-span-2">
                <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-4">
                  Tendência de Vendas Diárias
                </h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={summary.dailyTrend}
                      margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis yAxisId="left" orientation="left" />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        tickFormatter={(value) => formatCurrency(value).slice(0, -3)}
                      />
                      <Tooltip formatter={(value, name) => {
                        if (name === 'Faturamento') return formatCurrency(value);
                        return value;
                      }} />
                      <Legend />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="count"
                        name="Vendas"
                        stroke="#37E359"
                        activeDot={{ r: 8 }}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="value"
                        name="Faturamento"
                        stroke="#1E90FF"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Lista de vendas recentes */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-xl font-bold text-primary dark:text-secondary mb-6">
                Vendas Recentes
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Data
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Produto
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Vendedor
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Canal
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Pagamento
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Valor
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredSales.slice(0, 10).map((sale, index) => (
                      <tr key={sale.id || index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {sale.date.formatted}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-text-light dark:text-text-dark">
                          {sale.product}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {sale.seller}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {sale.channel}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {sale.paymentMethod}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600 dark:text-green-400">
                          {formatCurrency(sale.value)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default CommercialDashboardPage;