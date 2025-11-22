import React, { useState, useEffect } from 'react';
import { FaCalendar, FaSearch, FaFilter, FaChartLine, FaDollarSign, FaBullseye, FaChartBar, FaChevronDown } from 'react-icons/fa';
import DateRangePicker from '../components/DateRangePicker';

const TrafficDashboard = () => {
  const [loading, setLoading] = useState(false);
  
  // Inicializar com semana atual
  const getWeekRange = () => {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay()); // Domingo da semana atual
    
    const endOfWeek = new Date(today);
    endOfWeek.setDate(today.getDate() + (6 - today.getDay())); // Sábado da semana atual
    
    return { startDate: startOfWeek, endDate: endOfWeek };
  };

  const [dateRange, setDateRange] = useState(getWeekRange());
  const [selectedAccount, setSelectedAccount] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [trafficData, setTrafficData] = useState(null);
  const [dailyData, setDailyData] = useState([]);
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  const [period, setPeriod] = useState('7'); // Iniciar com 7 dias (semana atual)

  useEffect(() => {
    fetchAccounts();
    fetchTrafficData();
  }, []);

  useEffect(() => {
    fetchTrafficData();
  }, [selectedAccount, period, dateRange]);

  const fetchAccounts = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/meta/accounts`);
      const data = await response.json();
      const activeAccounts = data.data.filter(acc => acc.account_status === 1);
      setAccounts(activeAccounts);
    } catch (error) {
      console.error('Erro ao buscar contas:', error);
    }
  };

  const fetchTrafficData = async () => {
    setLoading(true);
    try {
      let url;
      if (selectedAccount === 'all') {
        url = `${import.meta.env.VITE_API_URL}/meta/all-accounts-spend/${period}`;
      } else {
        url = `${import.meta.env.VITE_API_URL}/meta/daily-spend/${period}?accountId=${selectedAccount}`;
      }

      const response = await fetch(url);
      const data = await response.json();
      setTrafficData(data);
      setDailyData(data.dailyData || []);
    } catch (error) {
      console.error('Erro ao buscar dados de tráfego:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDateRangeChange = (startDateStr, endDateStr) => {
    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    
    setDateRange({ startDate, endDate });
    
    if (startDate && endDate) {
      const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
      setPeriod(days.toString());
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getFilteredAccounts = () => {
    if (!searchTerm) return accounts;
    return accounts.filter(acc => 
      acc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      acc.business_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const quickPeriods = [
    { label: 'Hoje', value: '1' },
    { label: '7 dias', value: '7' },
    { label: '30 dias', value: '30' },
    { label: '90 dias', value: '90' }
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Dashboard de Tráfego
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Monitore seus gastos com anúncios e performance das campanhas
          </p>
        </div>

        {/* Filtros */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Busca */}
            <div className="relative">
              <FaSearch className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar conta..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Seletor de Conta */}
            <div className="relative">
              <button
                onClick={() => setShowAccountDropdown(!showAccountDropdown)}
                className="w-full flex items-center justify-between px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                <span className="flex items-center">
                  <FaFilter className="h-5 w-5 mr-2" />
                  {selectedAccount === 'all' 
                    ? 'Todas as Contas' 
                    : accounts.find(a => a.id === selectedAccount)?.name || 'Selecione'}
                </span>
                <FaChevronDown className="h-5 w-5" />
              </button>
              
              {showAccountDropdown && (
                <div className="absolute z-10 mt-2 w-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  <button
                    onClick={() => {
                      setSelectedAccount('all');
                      setShowAccountDropdown(false);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-900 dark:text-white"
                  >
                    Todas as Contas
                  </button>
                  {getFilteredAccounts().map(account => (
                    <button
                      key={account.id}
                      onClick={() => {
                        setSelectedAccount(account.id);
                        setShowAccountDropdown(false);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-900 dark:text-white"
                    >
                      <div>
                        <div className="font-medium">{account.name}</div>
                        {account.business_name && (
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {account.business_name}
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Período Rápido */}
            <div className="flex gap-2">
              {quickPeriods.map(p => (
                <button
                  key={p.value}
                  onClick={() => setPeriod(p.value)}
                  disabled={loading}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    period === p.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {loading && period === p.value ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {p.label}
                    </span>
                  ) : p.label}
                </button>
              ))}
            </div>

            {/* Date Range Picker */}
            <DateRangePicker
              startDate={dateRange.startDate}
              endDate={dateRange.endDate}
              onDateChange={handleDateRangeChange}
            />
          </div>
        </div>

        {/* Cards de Métricas */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : trafficData && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* Gasto Total */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
                    <FaDollarSign className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                </div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                  Gasto Total
                </h3>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatCurrency(trafficData.totalSpend || 0)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  {trafficData.period}
                </p>
              </div>

              {/* Contas Ativas */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
                    <FaChartBar className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                  Contas com Gastos
                </h3>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {trafficData.accountsWithSpend?.length || 0} / {trafficData.totalAccounts || 0}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Contas ativas no período
                </p>
              </div>
            </div>

            {/* Detalhamento por Conta */}
            {trafficData.accountsWithSpend && trafficData.accountsWithSpend.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
                  Gastos por Conta
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b dark:border-gray-700">
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                          Conta
                        </th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                          Empresa
                        </th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                          Gasto
                        </th>
                        <th className="text-center py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                          Moeda
                        </th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                          % do Total
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {trafficData.accountsWithSpend.map((account, index) => {
                        const percentage = ((account.spend / parseFloat(trafficData.totalSpend)) * 100).toFixed(1);
                        return (
                          <tr key={index} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                            <td className="py-3 px-4 text-gray-900 dark:text-white font-medium">
                              {account.accountName}
                            </td>
                            <td className="py-3 px-4 text-gray-600 dark:text-gray-400 text-sm">
                              {account.businessName || '-'}
                            </td>
                            <td className="py-3 px-4 text-right text-gray-900 dark:text-white font-semibold">
                              {formatCurrency(account.spend)}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className="px-2 py-1 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                                {account.currency}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end">
                                <span className="text-gray-900 dark:text-white font-medium mr-2">
                                  {percentage}%
                                </span>
                                <div className="w-20 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                  <div 
                                    className="bg-blue-600 h-2 rounded-full"
                                    style={{ width: `${percentage}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Gráfico de Gastos Diários */}
            {dailyData && dailyData.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
                  Gastos Diários
                </h2>
                <div className="h-64 flex items-end justify-between gap-2">
                  {dailyData.slice(-30).map((day, index) => {
                    const maxSpend = Math.max(...dailyData.map(d => d.spend));
                    const height = (day.spend / maxSpend) * 100;
                    return (
                      <div
                        key={index}
                        className="flex-1 bg-blue-500 hover:bg-blue-600 rounded-t transition-all cursor-pointer group relative"
                        style={{ height: `${height}%` }}
                      >
                        <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                          {new Date(day.date).toLocaleDateString('pt-BR')}
                          <br />
                          {formatCurrency(day.spend)}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 flex justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>{dailyData[0]?.date && new Date(dailyData[0].date).toLocaleDateString('pt-BR')}</span>
                  <span>{dailyData[dailyData.length - 1]?.date && new Date(dailyData[dailyData.length - 1].date).toLocaleDateString('pt-BR')}</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default TrafficDashboard;