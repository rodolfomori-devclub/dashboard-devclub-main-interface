// src/pages/GoalsPage.jsx
import { useState, useEffect } from 'react';
import { FaEdit, FaSave, FaTimes, FaChartLine, FaCreditCard, FaFileInvoiceDollar, FaBullhorn, FaArrowUp, FaArrowDown, FaCheckCircle, FaExclamationTriangle, FaTimesCircle } from 'react-icons/fa';
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
  RadialBarChart,
  RadialBar
} from 'recharts';
import goalsService from '../services/goalsService';
import { revenueService } from '../services/revenueService';
import { expensesService } from '../services/expensesService';
import { formatCurrency } from '../utils/currencyUtils';

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const COLORS = ['#10B981', '#8B5CF6', '#F59E0B', '#3B82F6', '#EF4444', '#EC4899'];

const GoalsPage = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Filtros
  const [viewType, setViewType] = useState('month');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);

  // Metas
  const [goals, setGoals] = useState({
    faturamentoCartao: { base: 0, super: 0, ultra: 0 },
    faturamentoBoleto: { base: 0, super: 0, ultra: 0 },
    investimentoTrafego: { base: 0, super: 0, ultra: 0 }
  });

  // Estado de edição
  const [isEditing, setIsEditing] = useState(false);
  const [editGoals, setEditGoals] = useState(goals);

  // Valores reais (simulados)
  const [actualValues, setActualValues] = useState({
    faturamentoCartao: 0,
    faturamentoBoleto: 0,
    investimentoTrafego: 0
  });

  // Carregar metas
  useEffect(() => {
    fetchGoals();
  }, [viewType, selectedYear, selectedMonth]);

  const fetchGoals = async () => {
    try {
      setLoading(true);
      setError('');

      const goalsData = await goalsService.getRevenueGoals(
        viewType,
        selectedYear,
        viewType === 'month' ? selectedMonth : null
      );

      setGoals(goalsData);
      setEditGoals(goalsData);

      // Buscar dados reais de faturamento e tráfego
      let startDate, endDate;

      if (viewType === 'month') {
        // Período mensal
        startDate = new Date(selectedYear, selectedMonth - 1, 1);
        endDate = new Date(selectedYear, selectedMonth, 0);
      } else {
        // Período anual
        startDate = new Date(selectedYear, 0, 1);
        endDate = new Date(selectedYear, 11, 31);
      }

      // Formatar datas para API (YYYY-MM-DD)
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      // Buscar faturamento real (cartão e boleto)
      let cardRevenue = 0;
      let boletoRevenue = 0;
      let trafficExpenses = 0;

      try {
        const revenueData = await revenueService.getRevenueByDateRange(startDateStr, endDateStr);
        cardRevenue = revenueData.totals?.cardRevenue || 0;
        boletoRevenue = revenueData.totals?.boletoRevenue || 0;
      } catch (err) {
        console.error('Erro ao buscar faturamento:', err);
      }

      // Buscar despesas de tráfego
      try {
        const expenses = await expensesService.getExpensesByDateRange(startDate, endDate, 'trafego');
        trafficExpenses = expenses.reduce((total, expense) => total + (expense.value || 0), 0);
      } catch (err) {
        console.error('Erro ao buscar despesas de tráfego:', err);
      }

      setActualValues({
        faturamentoCartao: cardRevenue,
        faturamentoBoleto: boletoRevenue,
        investimentoTrafego: trafficExpenses
      });

    } catch (err) {
      console.error('Erro ao carregar metas:', err);
      setError('Falha ao carregar metas');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');

      await goalsService.saveRevenueGoals(
        viewType,
        selectedYear,
        viewType === 'month' ? selectedMonth : null,
        editGoals
      );

      setGoals(editGoals);
      setIsEditing(false);
      setSuccessMessage('Metas salvas com sucesso!');
      setTimeout(() => setSuccessMessage(''), 3000);

    } catch (err) {
      console.error('Erro ao salvar metas:', err);
      setError('Falha ao salvar metas');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditGoals(goals);
    setIsEditing(false);
  };

  const updateGoalValue = (category, level, value) => {
    setEditGoals(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [level]: parseFloat(value) || 0
      }
    }));
  };

  // Calcular progresso
  const calculateProgress = (actual, goal) => {
    if (!goal || goal === 0) return 0;
    return ((actual / goal) * 100).toFixed(1);
  };

  // Calcular diferença percentual
  const calculateDifference = (actual, goal) => {
    if (!goal || goal === 0) return 0;
    return (((actual - goal) / goal) * 100).toFixed(1);
  };

  // Dados para gráficos
  const getComparisonChartData = () => {
    return [
      {
        name: 'Cartão',
        Meta: goals.faturamentoCartao.base,
        Realizado: actualValues.faturamentoCartao,
      },
      {
        name: 'Boleto',
        Meta: goals.faturamentoBoleto.base,
        Realizado: actualValues.faturamentoBoleto,
      },
      {
        name: 'Tráfego',
        Meta: goals.investimentoTrafego.base,
        Realizado: actualValues.investimentoTrafego,
      }
    ];
  };

  const getRadialData = () => {
    const totalMeta = goals.faturamentoCartao.base + goals.faturamentoBoleto.base;
    const totalRealizado = actualValues.faturamentoCartao + actualValues.faturamentoBoleto;
    const progress = totalMeta > 0 ? (totalRealizado / totalMeta) * 100 : 0;

    return [
      {
        name: 'Progresso',
        value: Math.min(progress, 100),
        fill: progress >= 100 ? '#10B981' : progress >= 75 ? '#F59E0B' : '#EF4444'
      }
    ];
  };

  const getPieChartData = () => {
    return [
      { name: 'Cartão', value: actualValues.faturamentoCartao },
      { name: 'Boleto', value: actualValues.faturamentoBoleto }
    ].filter(item => item.value > 0);
  };

  const getGoalLevelsData = (category) => {
    const actual = actualValues[category];
    return [
      { name: 'Base', meta: goals[category].base, realizado: actual },
      { name: 'Super', meta: goals[category].super, realizado: actual },
      { name: 'Ultra', meta: goals[category].ultra, realizado: actual }
    ];
  };

  // Calcular status geral
  const getOverallStatus = () => {
    const totalMeta = goals.faturamentoCartao.base + goals.faturamentoBoleto.base;
    const totalRealizado = actualValues.faturamentoCartao + actualValues.faturamentoBoleto;
    const progress = totalMeta > 0 ? (totalRealizado / totalMeta) * 100 : 0;

    if (progress >= 100) return { status: 'success', label: 'Meta Atingida', icon: FaCheckCircle, color: 'text-green-500' };
    if (progress >= 75) return { status: 'warning', label: 'Quase Lá', icon: FaExclamationTriangle, color: 'text-yellow-500' };
    return { status: 'danger', label: 'Atenção Necessária', icon: FaTimesCircle, color: 'text-red-500' };
  };

  // Renderizar card de meta compacto
  const renderGoalCard = (title, icon, category, color, bgColor) => {
    const actual = actualValues[category];
    const goalData = goals[category];
    const progressBase = calculateProgress(actual, goalData.base);
    const diff = calculateDifference(actual, goalData.base);
    const isPositive = parseFloat(diff) >= 0;

    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <div className={`p-3 rounded-full ${bgColor} text-white mr-3`}>
              {icon}
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Meta Base: {formatCurrency(goalData.base)}
              </p>
            </div>
          </div>
        </div>

        <div className="mb-4">
          <div className="flex justify-between items-end mb-2">
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(actual)}
            </span>
            {goalData.base > 0 && (
              <span className={`flex items-center text-sm font-medium ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {isPositive ? <FaArrowUp className="mr-1" /> : <FaArrowDown className="mr-1" />}
                {Math.abs(parseFloat(diff))}%
              </span>
            )}
          </div>

          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all duration-500 ${color}`}
              style={{ width: `${Math.min(parseFloat(progressBase), 100)}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {progressBase}% da meta base
          </p>
        </div>

        {/* Mini gráfico de barras para níveis */}
        <div className="h-24">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={getGoalLevelsData(category)} layout="vertical">
              <XAxis type="number" hide />
              <YAxis dataKey="name" type="category" width={40} tick={{ fontSize: 10 }} />
              <Tooltip
                formatter={(value) => formatCurrency(value)}
                contentStyle={{ fontSize: '12px' }}
              />
              <Bar dataKey="meta" fill="#E5E7EB" name="Meta" radius={[0, 4, 4, 0]} />
              <Bar dataKey="realizado" fill={color.includes('green') ? '#10B981' : color.includes('purple') ? '#8B5CF6' : '#F59E0B'} name="Realizado" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  // Renderizar formulário de edição
  const renderEditForm = () => {
    const categories = [
      { key: 'faturamentoCartao', label: 'Faturamento Cartão', icon: <FaCreditCard /> },
      { key: 'faturamentoBoleto', label: 'Faturamento Boleto', icon: <FaFileInvoiceDollar /> },
      { key: 'investimentoTrafego', label: 'Investimento em Tráfego', icon: <FaBullhorn /> }
    ];

    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
            <FaEdit className="mr-2 text-primary dark:text-secondary" />
            Editar Metas - {viewType === 'month' ? `${MONTHS[selectedMonth - 1]} ${selectedYear}` : selectedYear}
          </h2>
          <div className="flex space-x-2">
            <button
              onClick={handleCancel}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 flex items-center"
            >
              <FaTimes className="mr-2" />
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-primary hover:bg-primary-dark text-white dark:bg-blue-600 dark:hover:bg-blue-700 dark:text-white rounded-lg flex items-center disabled:opacity-50"
            >
              <FaSave className="mr-2" />
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b dark:border-gray-700">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Categoria</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-blue-600 dark:text-blue-400">Meta Base</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-purple-600 dark:text-purple-400">Meta Super</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-orange-600 dark:text-orange-400">Meta Ultra</th>
              </tr>
            </thead>
            <tbody>
              {categories.map(({ key, label, icon }) => (
                <tr key={key} className="border-b dark:border-gray-700">
                  <td className="py-4 px-4">
                    <div className="flex items-center">
                      <span className="mr-2 text-gray-500">{icon}</span>
                      <span className="font-medium text-gray-900 dark:text-white">{label}</span>
                    </div>
                  </td>
                  {['base', 'super', 'ultra'].map((level) => (
                    <td key={level} className="py-4 px-4">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">R$</span>
                        <input
                          type="number"
                          value={editGoals[key][level] || ''}
                          onChange={(e) => updateGoalValue(key, level, e.target.value)}
                          className="w-full pl-10 pr-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 focus:ring-primary dark:focus:ring-secondary focus:border-primary dark:focus:border-secondary"
                          placeholder="0"
                        />
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex justify-center items-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary"></div>
      </div>
    );
  }

  const overallStatus = getOverallStatus();
  const StatusIcon = overallStatus.icon;
  const totalMeta = goals.faturamentoCartao.base + goals.faturamentoBoleto.base;
  const totalRealizado = actualValues.faturamentoCartao + actualValues.faturamentoBoleto;
  const totalProgress = totalMeta > 0 ? ((totalRealizado / totalMeta) * 100).toFixed(1) : 0;

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-primary-dark dark:text-primary mb-2">
          Gestão de Metas
        </h1>
        <p className="text-gray-600 dark:text-gray-300">
          Acompanhe e gerencie suas metas de faturamento e investimento
        </p>
      </div>

      {/* Mensagens */}
      {error && (
        <div className="bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-300 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="bg-green-100 dark:bg-green-900 border border-green-400 dark:border-green-700 text-green-700 dark:text-green-300 px-4 py-3 rounded mb-6">
          {successMessage}
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Tipo de Período
            </label>
            <select
              value={viewType}
              onChange={(e) => setViewType(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
            >
              <option value="month">Mensal</option>
              <option value="year">Anual</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Ano
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
            >
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          {viewType === 'month' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Mês
              </label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
              >
                {MONTHS.map((month, index) => (
                  <option key={index + 1} value={index + 1}>{month}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="w-full px-4 py-2 bg-primary hover:bg-primary-dark text-white dark:bg-blue-600 dark:hover:bg-blue-700 dark:text-white rounded-lg flex items-center justify-center"
              >
                <FaEdit className="mr-2" />
                Editar Metas
              </button>
            ) : (
              <div className="h-10" />
            )}
          </div>
        </div>
      </div>

      {/* Formulário de edição */}
      {isEditing && renderEditForm()}

      {/* Status Geral */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Card de Status */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Status Geral</h3>
          <div className="flex items-center justify-center mb-4">
            <div className="relative">
              <div className="w-32 h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart
                    innerRadius="70%"
                    outerRadius="100%"
                    data={getRadialData()}
                    startAngle={90}
                    endAngle={-270}
                  >
                    <RadialBar
                      background
                      dataKey="value"
                      cornerRadius={10}
                    />
                  </RadialBarChart>
                </ResponsiveContainer>
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-bold text-gray-900 dark:text-white">{totalProgress}%</span>
              </div>
            </div>
          </div>
          <div className="text-center">
            <div className={`flex items-center justify-center ${overallStatus.color}`}>
              <StatusIcon className="mr-2" />
              <span className="font-medium">{overallStatus.label}</span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              {formatCurrency(totalRealizado)} de {formatCurrency(totalMeta)}
            </p>
          </div>
        </div>

        {/* Gráfico de Pizza - Distribuição */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Distribuição do Faturamento</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={getPieChartData()}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {getPieChartData().map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Resumo Rápido */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Resumo Rápido</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="flex items-center">
                <FaCreditCard className="text-green-500 mr-2" />
                <span className="text-sm text-gray-700 dark:text-gray-300">Cartão</span>
              </div>
              <span className="font-bold text-green-600 dark:text-green-400">
                {calculateProgress(actualValues.faturamentoCartao, goals.faturamentoCartao.base)}%
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <div className="flex items-center">
                <FaFileInvoiceDollar className="text-purple-500 mr-2" />
                <span className="text-sm text-gray-700 dark:text-gray-300">Boleto</span>
              </div>
              <span className="font-bold text-purple-600 dark:text-purple-400">
                {calculateProgress(actualValues.faturamentoBoleto, goals.faturamentoBoleto.base)}%
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
              <div className="flex items-center">
                <FaBullhorn className="text-orange-500 mr-2" />
                <span className="text-sm text-gray-700 dark:text-gray-300">Tráfego</span>
              </div>
              <span className="font-bold text-orange-600 dark:text-orange-400">
                {formatCurrency(actualValues.investimentoTrafego)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Gráfico de Comparação */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
          <FaChartLine className="inline mr-2 text-primary dark:text-secondary" />
          Meta vs Realizado - {viewType === 'month' ? `${MONTHS[selectedMonth - 1]} ${selectedYear}` : `Ano ${selectedYear}`}
        </h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={getComparisonChartData()}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(value) => formatCurrency(value)} />
              <Legend />
              <Bar dataKey="Meta" fill="#E5E7EB" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Realizado" fill="#10B981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Cards de Metas Detalhados */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          Detalhamento por Categoria
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {renderGoalCard(
          'Faturamento Cartão',
          <FaCreditCard className="w-5 h-5" />,
          'faturamentoCartao',
          'bg-green-500',
          'bg-green-500'
        )}
        {renderGoalCard(
          'Faturamento Boleto',
          <FaFileInvoiceDollar className="w-5 h-5" />,
          'faturamentoBoleto',
          'bg-purple-500',
          'bg-purple-500'
        )}
        {renderGoalCard(
          'Investimento em Tráfego',
          <FaBullhorn className="w-5 h-5" />,
          'investimentoTrafego',
          'bg-orange-500',
          'bg-orange-500'
        )}
      </div>

      {/* Tabela Resumo */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Resumo Detalhado</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b dark:border-gray-700">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Categoria</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Realizado</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-blue-600 dark:text-blue-400">Meta Base</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-purple-600 dark:text-purple-400">Meta Super</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-orange-600 dark:text-orange-400">Meta Ultra</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">% Base</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b dark:border-gray-700">
                <td className="py-4 px-4 font-medium text-gray-900 dark:text-white">Faturamento Cartão</td>
                <td className="py-4 px-4 text-right font-bold text-green-600 dark:text-green-400">{formatCurrency(actualValues.faturamentoCartao)}</td>
                <td className="py-4 px-4 text-right text-gray-900 dark:text-white">{formatCurrency(goals.faturamentoCartao.base)}</td>
                <td className="py-4 px-4 text-right text-gray-900 dark:text-white">{formatCurrency(goals.faturamentoCartao.super)}</td>
                <td className="py-4 px-4 text-right text-gray-900 dark:text-white">{formatCurrency(goals.faturamentoCartao.ultra)}</td>
                <td className="py-4 px-4 text-right font-bold text-gray-900 dark:text-white">{calculateProgress(actualValues.faturamentoCartao, goals.faturamentoCartao.base)}%</td>
              </tr>
              <tr className="border-b dark:border-gray-700">
                <td className="py-4 px-4 font-medium text-gray-900 dark:text-white">Faturamento Boleto</td>
                <td className="py-4 px-4 text-right font-bold text-purple-600 dark:text-purple-400">{formatCurrency(actualValues.faturamentoBoleto)}</td>
                <td className="py-4 px-4 text-right text-gray-900 dark:text-white">{formatCurrency(goals.faturamentoBoleto.base)}</td>
                <td className="py-4 px-4 text-right text-gray-900 dark:text-white">{formatCurrency(goals.faturamentoBoleto.super)}</td>
                <td className="py-4 px-4 text-right text-gray-900 dark:text-white">{formatCurrency(goals.faturamentoBoleto.ultra)}</td>
                <td className="py-4 px-4 text-right font-bold text-gray-900 dark:text-white">{calculateProgress(actualValues.faturamentoBoleto, goals.faturamentoBoleto.base)}%</td>
              </tr>
              <tr className="border-b dark:border-gray-700">
                <td className="py-4 px-4 font-medium text-gray-900 dark:text-white">Investimento Tráfego</td>
                <td className="py-4 px-4 text-right font-bold text-orange-600 dark:text-orange-400">{formatCurrency(actualValues.investimentoTrafego)}</td>
                <td className="py-4 px-4 text-right text-gray-900 dark:text-white">{formatCurrency(goals.investimentoTrafego.base)}</td>
                <td className="py-4 px-4 text-right text-gray-900 dark:text-white">{formatCurrency(goals.investimentoTrafego.super)}</td>
                <td className="py-4 px-4 text-right text-gray-900 dark:text-white">{formatCurrency(goals.investimentoTrafego.ultra)}</td>
                <td className="py-4 px-4 text-right font-bold text-gray-900 dark:text-white">{calculateProgress(actualValues.investimentoTrafego, goals.investimentoTrafego.base)}%</td>
              </tr>
              <tr className="bg-gray-50 dark:bg-gray-700">
                <td className="py-4 px-4 font-bold text-gray-900 dark:text-white">Total Faturamento</td>
                <td className="py-4 px-4 text-right font-bold text-gray-900 dark:text-white">{formatCurrency(totalRealizado)}</td>
                <td className="py-4 px-4 text-right font-bold text-gray-900 dark:text-white">{formatCurrency(totalMeta)}</td>
                <td className="py-4 px-4 text-right font-bold text-gray-900 dark:text-white">{formatCurrency(goals.faturamentoCartao.super + goals.faturamentoBoleto.super)}</td>
                <td className="py-4 px-4 text-right font-bold text-gray-900 dark:text-white">{formatCurrency(goals.faturamentoCartao.ultra + goals.faturamentoBoleto.ultra)}</td>
                <td className="py-4 px-4 text-right font-bold text-primary dark:text-secondary">{totalProgress}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default GoalsPage;
