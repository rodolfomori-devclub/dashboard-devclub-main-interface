import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import boletoService from '../services/boletoService';
import expensesService from '../services/expensesService';
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
import { formatCurrency } from '../utils/currencyUtils';

const COLORS = ['#37E359', '#051626', '#FF4500', '#1E90FF', '#FFD700', '#FF1493', '#9370DB', '#00CED1'];

function DREDashboard() {
  // State for date filtering
  const [filterType, setFilterType] = useState('month'); // 'month', 'year', 'custom'
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [customStartDate, setCustomStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  );
  const [customEndDate, setCustomEndDate] = useState(
    new Date().toISOString().split('T')[0]
  );

  // State for tag filtering
  const [availableTags, setAvailableTags] = useState([]);
  const [selectedTag, setSelectedTag] = useState('');

  // State for data
  const [incomeData, setIncomeData] = useState(null);
  const [expensesData, setExpensesData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Format date for display
  const formatDateForDisplay = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR');
  };

  // Format month name
  const getMonthName = (monthIndex) => {
    const months = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return months[monthIndex];
  };

  // Get date range based on filter type
  const getDateRange = useCallback(() => {
    let startDate, endDate;

    switch (filterType) {
      case 'month':
        startDate = new Date(selectedYear, selectedMonth, 1);
        endDate = new Date(selectedYear, selectedMonth + 1, 0); // Last day of month
        break;
      case 'year':
        startDate = new Date(selectedYear, 0, 1);
        endDate = new Date(selectedYear, 11, 31);
        break;
      case 'custom':
        startDate = new Date(customStartDate);
        endDate = new Date(customEndDate);
        break;
      default:
        startDate = new Date(selectedYear, selectedMonth, 1);
        endDate = new Date(selectedYear, selectedMonth + 1, 0);
    }

    // Format dates for API
    const formattedStartDate = startDate.toISOString().split('T')[0];
    const formattedEndDate = endDate.toISOString().split('T')[0];

    return { startDate: formattedStartDate, endDate: formattedEndDate };
  }, [filterType, selectedMonth, selectedYear, customStartDate, customEndDate]);

  // Fetch data (income and expenses)
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { startDate, endDate } = getDateRange();
      
      console.log(`Fetching data from ${startDate} to ${endDate}`);

      // 1. Fetch transactions from GURU (card)
      const transactionsResponse = await axios.post(
        `${import.meta.env.VITE_API_URL}/transactions`,
        {
          ordered_at_ini: startDate,
          ordered_at_end: endDate,
        }
      );

      // 2. Fetch boleto sales
      const startDateObj = new Date(startDate);
      const endDateObj = new Date(endDate);
      const boletoSales = await boletoService.getSalesByDateRange(startDateObj, endDateObj);

      // 3. Fetch expenses
      const expenses = await expensesService.getExpensesByDateRange(startDateObj, endDateObj, selectedTag);

      // Process income data
      let totalCardIncome = 0;
      let totalBoletoIncome = 0;
      let totalCardSales = 0;
      let totalBoletoSales = 0;

      // Process card transactions
      if (Array.isArray(transactionsResponse.data.data)) {
        transactionsResponse.data.data.forEach(transaction => {
          const netAmount = Number(transaction?.calculation_details?.net_amount || 0);
          totalCardIncome += netAmount;
          totalCardSales += 1;
        });
      }

      // Process boleto sales
      boletoSales.forEach(sale => {
        totalBoletoIncome += (sale.value || 0);
        totalBoletoSales += 1;
      });

      // Get all expense categories and calculate totals
      const expenseCategories = {};
      let totalExpenses = 0;

      expenses.forEach(expense => {
        const category = expense.category || 'Sem categoria';
        if (!expenseCategories[category]) {
          expenseCategories[category] = 0;
        }
        expenseCategories[category] += expense.value;
        totalExpenses += expense.value;
      });

      // Get all available tags for the filter dropdown
      const allTags = await expensesService.getAllTags();
      setAvailableTags(['', ...allTags]); // Add empty option for "All tags"

      // Format data for charts
      const incomeByType = [
        { name: 'Cartão (GURU)', value: totalCardIncome },
        { name: 'Boleto (TMB)', value: totalBoletoIncome }
      ];

      const expensesByCategory = Object.keys(expenseCategories).map(category => ({
        name: category,
        value: expenseCategories[category]
      })).sort((a, b) => b.value - a.value); // Sort by value descending

      // Calculate profits
      const totalIncome = totalCardIncome + totalBoletoIncome;
      const profit = totalIncome - totalExpenses;
      const profitMargin = totalIncome ? (profit / totalIncome) * 100 : 0;
      
      // Calculate card-only profit (sometimes requested by clients)
      const cardProfit = totalCardIncome - totalExpenses;
      const cardProfitMargin = totalCardIncome ? (cardProfit / totalCardIncome) * 100 : 0;

      // Daily data for timeline chart
      const dailyData = {};
      
      // Initialize all days in range
      const currentDate = new Date(startDateObj);
      while (currentDate <= endDateObj) {
        const dateStr = currentDate.toISOString().split('T')[0];
        dailyData[dateStr] = {
          date: dateStr,
          income: 0,
          expenses: 0
        };
        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Add income data
      if (Array.isArray(transactionsResponse.data.data)) {
        transactionsResponse.data.data.forEach(transaction => {
          const timestamp = transaction.dates.created_at * 1000;
          const date = new Date(timestamp);
          const dateStr = date.toISOString().split('T')[0];
          
          if (dailyData[dateStr]) {
            dailyData[dateStr].income += Number(transaction?.calculation_details?.net_amount || 0);
          }
        });
      }

      // Add boleto income data
      boletoSales.forEach(sale => {
        const date = new Date(sale.timestamp);
        const dateStr = date.toISOString().split('T')[0];
        
        if (dailyData[dateStr]) {
          dailyData[dateStr].income += (sale.value || 0);
        }
      });

      // Add expense data
      expenses.forEach(expense => {
        const dateStr = expense.date;
        
        if (dailyData[dateStr]) {
          dailyData[dateStr].expenses += expense.value;
        }
      });

      // Convert to array for chart
      const timelineData = Object.values(dailyData).sort((a, b) => 
        new Date(a.date) - new Date(b.date)
      );

      // Monthly breakdown for longer periods
      const monthlyData = {};
      
      if (filterType === 'year' || (filterType === 'custom' && endDateObj - startDateObj > 60 * 24 * 60 * 60 * 1000)) {
        // Initialize all months in range
        for (let year = startDateObj.getFullYear(); year <= endDateObj.getFullYear(); year++) {
          const startMonth = year === startDateObj.getFullYear() ? startDateObj.getMonth() : 0;
          const endMonth = year === endDateObj.getFullYear() ? endDateObj.getMonth() : 11;
          
          for (let month = startMonth; month <= endMonth; month++) {
            const monthKey = `${year}-${String(month+1).padStart(2, '0')}`;
            monthlyData[monthKey] = {
              month: monthKey,
              monthName: `${getMonthName(month)} ${year}`,
              income: 0,
              expenses: 0
            };
          }
        }
        
        // Add income data
        if (Array.isArray(transactionsResponse.data.data)) {
          transactionsResponse.data.data.forEach(transaction => {
            const timestamp = transaction.dates.created_at * 1000;
            const date = new Date(timestamp);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2, '0')}`;
            
            if (monthlyData[monthKey]) {
              monthlyData[monthKey].income += Number(transaction?.calculation_details?.net_amount || 0);
            }
          });
        }

        // Add boleto income data
        boletoSales.forEach(sale => {
          const date = new Date(sale.timestamp);
          const monthKey = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2, '0')}`;
          
          if (monthlyData[monthKey]) {
            monthlyData[monthKey].income += (sale.value || 0);
          }
        });

        // Add expense data
        expenses.forEach(expense => {
          const date = new Date(expense.date);
          const monthKey = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2, '0')}`;
          
          if (monthlyData[monthKey]) {
            monthlyData[monthKey].expenses += expense.value;
          }
        });
      }

      // Convert to array for chart
      const monthlyChartData = Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month));

      // Store all income and expense data
      setIncomeData({
        totalIncome,
        totalCardIncome,
        totalBoletoIncome,
        totalCardSales,
        totalBoletoSales,
        incomeByType,
        timelineData,
        monthlyData: monthlyChartData
      });

      setExpensesData({
        totalExpenses,
        expensesByCategory,
        expenses,
        timelineData,
        profit,
        profitMargin,
        cardProfit,
        cardProfitMargin
      });

      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Falha ao buscar dados');
      setLoading(false);
    }
  }, [getDateRange, selectedTag]);

  // Fetch data when filters change
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Helper for profit indicator
  const getProfitIndicatorClass = (value) => {
    if (value >= 30) return 'text-green-500';
    if (value >= 15) return 'text-yellow-500';
    if (value >= 0) return 'text-orange-500';
    return 'text-red-500';
  };

  // Handle filter changes
  const handleFilterChange = (e) => {
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

  const handleTagChange = (e) => {
    setSelectedTag(e.target.value);
  };

  // Component render
  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-primary-dark dark:text-primary">
            DRE - Demonstração do Resultado do Exercício
          </h1>
          <button
            onClick={fetchData}
            className="p-2 flex justify-center rounded-md bg-primary text-white dark:bg-primary-dark dark:text-white hover:bg-primary-dark hover:shadow-md dark:hover:bg-primary transition-all duration-200 ease-in-out transform hover:scale-105"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              className="w-5 h-5"
            >
              <path
                d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"
                fill="currentColor"
              />
            </svg>
          </button>
        </div>

        {/* Filter controls */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-bold text-primary dark:text-secondary mb-4">
            Filtros
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tipo de período
              </label>
              <select
                value={filterType}
                onChange={handleFilterChange}
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
                      <option key={i} value={i}>
                        {getMonthName(i)}
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

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Filtrar por tag (opcional)
              </label>
              <select
                value={selectedTag}
                onChange={handleTagChange}
                className="w-full border rounded-lg bg-white dark:bg-gray-700 text-text-light dark:text-text-dark px-3 py-2"
              >
                <option value="">Todas as tags</option>
                {availableTags.filter(tag => tag !== '').map(tag => (
                  <option key={tag} value={tag}>{tag}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary dark:border-secondary"></div>
          </div>
        ) : error ? (
          <div className="bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-300 px-4 py-3 rounded relative mb-6">
            <strong className="font-bold">Erro! </strong>
            <span className="block sm:inline">{error}</span>
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-text-light dark:text-text-dark">
                  Receita Total
                </h3>
                <p className="mt-2 text-3xl font-bold text-green-500 dark:text-green-400">
                  {formatCurrency(incomeData?.totalIncome || 0)}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {incomeData?.totalCardSales + incomeData?.totalBoletoSales || 0} venda(s)
                </p>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-text-light dark:text-text-dark">
                  Despesas Totais
                </h3>
                <p className="mt-2 text-3xl font-bold text-red-500 dark:text-red-400">
                  {formatCurrency(expensesData?.totalExpenses || 0)}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {expensesData?.expenses?.length || 0} despesa(s)
                </p>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-text-light dark:text-text-dark">
                  Lucro Líquido
                </h3>
                <p className={`mt-2 text-3xl font-bold ${expensesData?.profit >= 0 ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                  {formatCurrency(expensesData?.profit || 0)}
                </p>
                <p className={`text-sm ${getProfitIndicatorClass(expensesData?.profitMargin || 0)}`}>
                  Margem: {expensesData?.profitMargin.toFixed(2) || 0}%
                </p>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-text-light dark:text-text-dark">
                  Lucro (Apenas Cartão)
                </h3>
                <p className={`mt-2 text-3xl font-bold ${expensesData?.cardProfit >= 0 ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                  {formatCurrency(expensesData?.cardProfit || 0)}
                </p>
                <p className={`text-sm ${getProfitIndicatorClass(expensesData?.cardProfitMargin || 0)}`}>
                  Margem: {expensesData?.cardProfitMargin.toFixed(2) || 0}%
                </p>
              </div>
            </div>

            {/* Income breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-4">
                  Receitas por Tipo
                </h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={incomeData?.incomeByType || []}
                        cx="50%"
                        cy="50%"
                        labelLine={true}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {incomeData?.incomeByType.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatCurrency(value)} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                  <div className="bg-blue-50 dark:bg-blue-900 p-4 rounded-lg">
                    <h4 className="font-medium text-blue-800 dark:text-blue-200">Cartão (GURU)</h4>
                    <p className="text-xl font-bold text-blue-600 dark:text-blue-300">
                      {formatCurrency(incomeData?.totalCardIncome || 0)}
                    </p>
                    <p className="text-sm text-blue-500 dark:text-blue-400">
                      {incomeData?.totalCardSales || 0} venda(s)
                    </p>
                  </div>
                  <div className="bg-yellow-50 dark:bg-yellow-900 p-4 rounded-lg">
                    <h4 className="font-medium text-yellow-800 dark:text-yellow-200">Boleto (TMB)</h4>
                    <p className="text-xl font-bold text-yellow-600 dark:text-yellow-300">
                      {formatCurrency(incomeData?.totalBoletoIncome || 0)}
                    </p>
                    <p className="text-sm text-yellow-500 dark:text-yellow-400">
                      {incomeData?.totalBoletoSales || 0} venda(s)
                    </p>
                  </div>
                </div>
              </div>

              {/* Expenses by category */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-4">
                  Despesas por Categoria
                </h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={expensesData?.expensesByCategory || []}
                        cx="50%"
                        cy="50%"
                        labelLine={true}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {expensesData?.expensesByCategory.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatCurrency(value)} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 max-h-48 overflow-y-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Categoria
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Valor
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          %
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {expensesData?.expensesByCategory.map((category, index) => (
                        <tr key={index}>
                          <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {category.name}
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap text-sm text-right text-gray-900 dark:text-white">
                            {formatCurrency(category.value)}
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap text-sm text-right text-gray-900 dark:text-white">
                            {((category.value / expensesData.totalExpenses) * 100).toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Daily/Monthly trend */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
              <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-4">
                {filterType === 'month' || (filterType === 'custom' && incomeData?.timelineData?.length <= 31) ? 
                  'Análise Diária de Receitas e Despesas' : 
                  'Análise Mensal de Receitas e Despesas'}
              </h3>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  {filterType === 'month' || (filterType === 'custom' && incomeData?.timelineData?.length <= 31) ? (
                    <BarChart
                      data={incomeData?.timelineData || []}
                      margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="date" 
                        tickFormatter={(dateStr) => {
                          const date = new Date(dateStr);
                          return date.getDate().toString();
                        }}
                      />
                      <YAxis tickFormatter={(value) => formatCurrency(value)} />
                      <Tooltip 
                        formatter={(value) => formatCurrency(value)}
                        labelFormatter={(dateStr) => formatDateForDisplay(dateStr)}
                      />
                      <Legend />
                      <Bar dataKey="income" name="Receita" fill="#37E359" />
                      <Bar dataKey="expenses" name="Despesa" fill="#FF4500" />
                      <Bar 
                        dataKey={(data) => Math.max(0, data.income - data.expenses)} 
                        name="Lucro" 
                        fill="#1E90FF" 
                      />
                    </BarChart>
                  ) : (
                    <BarChart
                      data={incomeData?.monthlyData || []}
                      margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="monthName" 
                        tickFormatter={(monthName) => monthName.split(' ')[0]}
                      />
                      <YAxis tickFormatter={(value) => formatCurrency(value)} />
                      <Tooltip 
                        formatter={(value) => formatCurrency(value)}
                      />
                      <Legend />
                      <Bar dataKey="income" name="Receita" fill="#37E359" />
                      <Bar dataKey="expenses" name="Despesa" fill="#FF4500" />
                      <Bar 
                        dataKey={(data) => Math.max(0, data.income - data.expenses)} 
                        name="Lucro" 
                        fill="#1E90FF" 
                      />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>

            {/* Income vs Expenses Trend */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
              <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-4">
                Tendência de Receitas vs Despesas
              </h3>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  {filterType === 'month' || (filterType === 'custom' && incomeData?.timelineData?.length <= 31) ? (
                    <LineChart
                      data={incomeData?.timelineData || []}
                      margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="date" 
                        tickFormatter={(dateStr) => {
                          const date = new Date(dateStr);
                          return date.getDate().toString();
                        }}
                      />
                      <YAxis tickFormatter={(value) => formatCurrency(value)} />
                      <Tooltip 
                        formatter={(value) => formatCurrency(value)}
                        labelFormatter={(dateStr) => formatDateForDisplay(dateStr)}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="income" name="Receita" stroke="#37E359" activeDot={{ r: 8 }} />
                      <Line type="monotone" dataKey="expenses" name="Despesa" stroke="#FF4500" />
                      <Line 
                        type="monotone" 
                        dataKey={(data) => data.income - data.expenses} 
                        name="Resultado" 
                        stroke="#1E90FF"
                        strokeDasharray="5 5"
                      />
                    </LineChart>
                  ) : (
                    <LineChart
                      data={incomeData?.monthlyData || []}
                      margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="monthName" 
                        tickFormatter={(monthName) => monthName.split(' ')[0]}
                      />
                      <YAxis tickFormatter={(value) => formatCurrency(value)} />
                      <Tooltip 
                        formatter={(value) => formatCurrency(value)}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="income" name="Receita" stroke="#37E359" activeDot={{ r: 8 }} />
                      <Line type="monotone" dataKey="expenses" name="Despesa" stroke="#FF4500" />
                      <Line 
                        type="monotone" 
                        dataKey={(data) => data.income - data.expenses} 
                        name="Resultado" 
                        stroke="#1E90FF"
                        strokeDasharray="5 5"
                      />
                    </LineChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>

            {/* Detailed expense list */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
              <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-4">
                Detalhamento de Despesas {selectedTag && `(Tag: ${selectedTag})`}
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Data
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Nome
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Categoria
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Tag
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Valor
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {expensesData?.expenses?.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-500 dark:text-gray-400">
                          Nenhuma despesa encontrada no período
                        </td>
                      </tr>
                    ) : (
                      expensesData?.expenses?.map((expense, index) => (
                        <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {formatDateForDisplay(expense.date)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {expense.name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {expense.category || 'Sem categoria'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {expense.tag || 'Sem tag'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-white">
                            {formatCurrency(expense.value)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Analysis and insights */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
              <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-4">
                Análise e Insights
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Profit margin */}
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <h4 className="font-medium text-text-light dark:text-text-dark mb-2">
                    Margem de Lucro
                  </h4>
                  <div className="relative pt-1">
                    <div className="flex mb-2 items-center justify-between">
                      <div>
                        <span className={`text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full ${getProfitIndicatorClass(expensesData?.profitMargin || 0)}`}>
                          {expensesData?.profitMargin.toFixed(2) || 0}%
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-semibold inline-block text-primary dark:text-primary">
                          Meta: 30%
                        </span>
                      </div>
                    </div>
                    <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-gray-200 dark:bg-gray-600">
                      <div 
                        style={{ width: `${Math.min(Math.max(expensesData?.profitMargin || 0, 0), 100)}%` }} 
                        className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center ${getProfitIndicatorClass(expensesData?.profitMargin || 0)}`}
                      ></div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {expensesData?.profitMargin >= 30 ? (
                      'Margem de lucro excelente. Continue mantendo as despesas sob controle.'
                    ) : expensesData?.profitMargin >= 15 ? (
                      'Margem de lucro boa, mas há espaço para melhorias.'
                    ) : expensesData?.profitMargin >= 0 ? (
                      'Margem de lucro baixa. Considere estratégias para aumentar receitas ou reduzir despesas.'
                    ) : (
                      'Operação em prejuízo. É urgente revisar a estrutura de custos e estratégias de vendas.'
                    )}
                  </p>
                </div>

                {/* Revenue composition */}
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <h4 className="font-medium text-text-light dark:text-text-dark mb-2">
                    Composição da Receita
                  </h4>
                  <div className="flex items-center mb-2">
                    <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2.5">
                      <div 
                        className="bg-blue-600 h-2.5 rounded-full" 
                        style={{ width: `${incomeData?.totalCardIncome ? (incomeData?.totalCardIncome / incomeData?.totalIncome * 100) : 0}%` }}
                      ></div>
                    </div>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-blue-600 dark:text-blue-400">
                      Cartão: {incomeData?.totalCardIncome ? ((incomeData?.totalCardIncome / incomeData?.totalIncome) * 100).toFixed(1) : 0}%
                    </span>
                    <span className="text-yellow-600 dark:text-yellow-400">
                      Boleto: {incomeData?.totalBoletoIncome ? ((incomeData?.totalBoletoIncome / incomeData?.totalIncome) * 100).toFixed(1) : 0}%
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
                    {incomeData?.totalCardIncome > incomeData?.totalBoletoIncome * 2 ? (
                      'Forte dependência de pagamentos por cartão. Considere diversificar métodos de pagamento.'
                    ) : incomeData?.totalBoletoIncome > incomeData?.totalCardIncome * 2 ? (
                      'Forte dependência de pagamentos por boleto. Considere incentivar pagamentos por cartão que geralmente têm menor taxa de inadimplência.'
                    ) : (
                      'Boa diversificação entre métodos de pagamento.'
                    )}
                  </p>
                </div>

                {/* Expense growth */}
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <h4 className="font-medium text-text-light dark:text-text-dark mb-2">
                    Maiores Despesas
                  </h4>
                  <ul className="space-y-2">
                    {expensesData?.expensesByCategory.slice(0, 3).map((category, index) => (
                      <li key={index} className="flex justify-between">
                        <span className="text-gray-700 dark:text-gray-300">{category.name}</span>
                        <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(category.value)}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
                    {expensesData?.expensesByCategory.length > 0 && (
                      `As maiores despesas representam ${((expensesData.expensesByCategory.slice(0, 3).reduce((sum, cat) => sum + cat.value, 0) / expensesData.totalExpenses) * 100).toFixed(1)}% do total de gastos.`
                    )}
                  </p>
                </div>

                {/* Recommendation */}
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <h4 className="font-medium text-text-light dark:text-text-dark mb-2">
                    Recomendações
                  </h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 dark:text-gray-300">
                    {expensesData?.profitMargin < 15 && (
                      <li>Revisar a estrutura de custos para melhorar a margem de lucro.</li>
                    )}
                    {incomeData?.totalCardIncome > incomeData?.totalBoletoIncome * 3 && (
                      <li>Reduzir dependência de pagamentos por cartão diversificando os métodos.</li>
                    )}
                    {incomeData?.totalBoletoIncome > incomeData?.totalCardIncome * 3 && (
                      <li>Incentivar pagamentos por cartão para reduzir inadimplência.</li>
                    )}
                    {expensesData?.expenses?.length > 10 && expensesData?.totalExpenses > 10000 && (
                      <li>Analisar contratos recorrentes para identificar oportunidades de redução de custos.</li>
                    )}
                    <li>
                      {expensesData?.profitMargin >= 30 ? 
                        'Considerar investimentos em crescimento e expansão.' :
                        'Focar em aumentar receitas mantendo o mesmo nível de custos.'
                      }
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default DREDashboard;