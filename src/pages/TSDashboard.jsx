import React, { useState, useEffect, useCallback } from 'react'
import { radarService } from '../services/radarService'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from 'recharts'
import { formatCurrency } from '../utils/currencyUtils'
import { FaPhone, FaUsers, FaCalendarCheck, FaMoneyBillWave, FaCreditCard, FaFileInvoiceDollar, FaChartLine, FaPercentage } from 'react-icons/fa'

const COLORS = ['#10B981', '#F59E0B', '#3B82F6', '#8B5CF6', '#EF4444', '#EC4899', '#06B6D4', '#84CC16']

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

function TSDashboard() {
  const [data, setData] = useState([])
  const [totals, setTotals] = useState({})
  const [averageRates, setAverageRates] = useState({})
  const [loading, setLoading] = useState(true)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [availableMonths, setAvailableMonths] = useState([])
  const [initialLoadDone, setInitialLoadDone] = useState(false)

  // Carrega os meses disponíveis na inicialização
  useEffect(() => {
    const loadAvailableMonths = async () => {
      try {
        const months = await radarService.getAvailableMonths()
        console.log('Meses disponíveis:', months)
        setAvailableMonths(months)

        // Auto-selecionar o mês mais recente disponível
        if (months.length > 0 && !initialLoadDone) {
          const mostRecent = months[0]
          console.log('Selecionando mês mais recente:', mostRecent)
          setSelectedYear(mostRecent.year)
          setSelectedMonth(mostRecent.month)
          setInitialLoadDone(true)
        }
      } catch (error) {
        console.error('Erro ao carregar meses disponíveis:', error)
      }
    }

    loadAvailableMonths()
  }, [initialLoadDone])

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      console.log(`Buscando dados para ${selectedMonth}/${selectedYear}`)

      const monthData = await radarService.getDataByMonth(selectedYear, selectedMonth)
      console.log('Dados recebidos:', monthData)

      setData(monthData)

      // Calcular totais e médias
      const calculatedTotals = radarService.calculateTotals(monthData)
      const calculatedRates = radarService.calculateAverageRates(monthData)

      setTotals(calculatedTotals)
      setAverageRates(calculatedRates)

    } catch (error) {
      console.error('Erro ao buscar dados:', error)
    } finally {
      setLoading(false)
    }
  }, [selectedYear, selectedMonth])

  useEffect(() => {
    if (initialLoadDone) {
      fetchData()
    }
  }, [fetchData, initialLoadDone])

  const formatDate = (dateStr) => {
    const date = new Date(dateStr + 'T12:00:00')
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  }

  const handleRefresh = () => {
    radarService.clearCache()
    fetchData()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary border-t-transparent"></div>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">Carregando dados do Radar...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-primary-dark dark:text-primary">
              T$ - Toca o Sino
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Dashboard de vendas e métricas comerciais
            </p>
          </div>

          <div className="flex items-center gap-4">
            {/* Seletor de Mês */}
            <div className="flex items-center gap-2">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
              >
                {MONTHS.map((month, index) => (
                  <option key={index + 1} value={index + 1}>{month}</option>
                ))}
              </select>

              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
              >
                {Array.from({ length: 3 }, (_, i) => new Date().getFullYear() - i).map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>

            <button
              onClick={handleRefresh}
              className="px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg transition-colors"
            >
              Atualizar
            </button>
          </div>
        </div>

        {data.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-xl text-gray-500 dark:text-gray-400">
              Nenhum dado encontrado para {MONTHS[selectedMonth - 1]} de {selectedYear}
            </p>
            {availableMonths.length > 0 && (
              <div className="mt-4">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                  Meses disponíveis:
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {availableMonths.slice(0, 6).map(({ year, month, key }) => (
                    <button
                      key={key}
                      onClick={() => {
                        setSelectedYear(year)
                        setSelectedMonth(month)
                      }}
                      className="px-3 py-1 bg-primary/10 hover:bg-primary/20 text-primary rounded-full text-sm transition-colors"
                    >
                      {MONTHS[month - 1]} {year}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* KPIs Principais - Vendas */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Total Vendas</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{totals.vendasRealizadas || 0}</p>
                  </div>
                  <FaMoneyBillWave className="text-3xl text-green-500" />
                </div>
                <p className="text-lg font-semibold text-green-600 dark:text-green-400 mt-2">
                  {formatCurrency(totals.valorVendasRealizadas || 0)}
                </p>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Vendas GURU (Cartão)</p>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{totals.vendaGURU || 0}</p>
                  </div>
                  <FaCreditCard className="text-3xl text-blue-500" />
                </div>
                <p className="text-lg font-semibold text-blue-600 dark:text-blue-400 mt-2">
                  {formatCurrency(totals.valorGURU || 0)}
                </p>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Vendas TMB (Boleto)</p>
                    <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{totals.vendaTMB || 0}</p>
                  </div>
                  <FaFileInvoiceDollar className="text-3xl text-yellow-500" />
                </div>
                <p className="text-lg font-semibold text-yellow-600 dark:text-yellow-400 mt-2">
                  {formatCurrency(totals.valorTMB || 0)}
                </p>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Ticket Médio</p>
                    <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                      {formatCurrency(averageRates.ticketMedio || 0)}
                    </p>
                  </div>
                  <FaChartLine className="text-3xl text-purple-500" />
                </div>
              </div>
            </div>

            {/* KPIs Secundários - Funil */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Leads</p>
                <p className="text-xl font-bold text-blue-600">{totals.leadsRecebidosTotais || 0}</p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Ligações</p>
                <p className="text-xl font-bold text-green-600">{totals.ligacoesRealizadas || 0}</p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Atendidas</p>
                <p className="text-xl font-bold text-teal-600">{totals.ligacoesAtendidas || 0}</p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Qualificações</p>
                <p className="text-xl font-bold text-orange-600">{totals.qualificacoes || 0}</p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Reuniões Agend.</p>
                <p className="text-xl font-bold text-purple-600">{totals.reunioesAgendadas || 0}</p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Reuniões Realiz.</p>
                <p className="text-xl font-bold text-pink-600">{totals.reunioesRealizadas || 0}</p>
              </div>
            </div>

            {/* Gráfico de Vendas por Dia - GURU vs TMB */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                Vendas por Dia - GURU (Cartão) vs TMB (Boleto)
              </h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickFormatter={formatDate} />
                    <YAxis yAxisId="left" orientation="left" />
                    <YAxis yAxisId="right" orientation="right" tickFormatter={(value) => formatCurrency(value)} />
                    <Tooltip
                      formatter={(value, name) => {
                        if (name.includes('Valor')) return formatCurrency(value)
                        return value
                      }}
                      labelFormatter={formatDate}
                    />
                    <Legend />
                    <Bar yAxisId="left" dataKey="vendaGURU" name="Qtd GURU" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                    <Bar yAxisId="left" dataKey="vendaTMB" name="Qtd TMB" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                    <Bar yAxisId="right" dataKey="valorGURU" name="Valor GURU" fill="#60A5FA" radius={[4, 4, 0, 0]} />
                    <Bar yAxisId="right" dataKey="valorTMB" name="Valor TMB" fill="#FBBF24" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Gráficos lado a lado */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              {/* Distribuição de Vendas */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                  Distribuição de Vendas
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'GURU (Cartão)', value: totals.valorGURU || 0 },
                          { name: 'TMB (Boleto)', value: totals.valorTMB || 0 }
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        dataKey="value"
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      >
                        <Cell fill="#3B82F6" />
                        <Cell fill="#F59E0B" />
                      </Pie>
                      <Tooltip formatter={(value) => formatCurrency(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Faturamento Diário */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                  Faturamento Diário
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tickFormatter={formatDate} />
                      <YAxis tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(value) => formatCurrency(value)} labelFormatter={formatDate} />
                      <Area
                        type="monotone"
                        dataKey="valorVendasRealizadas"
                        stroke="#10B981"
                        fill="#10B981"
                        fillOpacity={0.3}
                        name="Faturamento"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Funil de Vendas */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                Funil de Vendas Diário
              </h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickFormatter={formatDate} />
                    <YAxis />
                    <Tooltip labelFormatter={formatDate} />
                    <Legend />
                    <Line type="monotone" dataKey="leadsRecebidosTotais" stroke="#3B82F6" name="Leads" strokeWidth={2} />
                    <Line type="monotone" dataKey="ligacoesRealizadas" stroke="#10B981" name="Ligações" strokeWidth={2} />
                    <Line type="monotone" dataKey="qualificacoes" stroke="#F59E0B" name="Qualificações" strokeWidth={2} />
                    <Line type="monotone" dataKey="reunioesAgendadas" stroke="#8B5CF6" name="Reuniões Agend." strokeWidth={2} />
                    <Line type="monotone" dataKey="vendasRealizadas" stroke="#EF4444" name="Vendas" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Taxas de Conversão */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center">
                <FaPercentage className="mr-2 text-primary" />
                Taxas de Conversão (Médias do Mês)
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Ligação → Atendida</p>
                  <p className="text-2xl font-bold text-blue-600">{(averageRates.taxaLigacaoAtendida || 0).toFixed(1)}%</p>
                </div>
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Leads → Qualificação</p>
                  <p className="text-2xl font-bold text-green-600">{(averageRates.taxaLeadsQualificacao || 0).toFixed(1)}%</p>
                </div>
                <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Leads → Agendamento</p>
                  <p className="text-2xl font-bold text-purple-600">{(averageRates.taxaLeadsAgendamento || 0).toFixed(1)}%</p>
                </div>
                <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Qualif. → Agendamento</p>
                  <p className="text-2xl font-bold text-orange-600">{(averageRates.taxaQualificacaoAgendamento || 0).toFixed(1)}%</p>
                </div>
                <div className="p-4 bg-pink-50 dark:bg-pink-900/20 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Oport. → Realizadas</p>
                  <p className="text-2xl font-bold text-pink-600">{(averageRates.taxaOportunidadesRealizadas || 0).toFixed(1)}%</p>
                </div>
                <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400">No Show</p>
                  <p className="text-2xl font-bold text-red-600">{(averageRates.taxaNoShow || 0).toFixed(1)}%</p>
                </div>
                <div className="p-4 bg-teal-50 dark:bg-teal-900/20 rounded-lg col-span-2">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Reuniões → Vendas</p>
                  <p className="text-2xl font-bold text-teal-600">{(averageRates.taxaReunioesVendas || 0).toFixed(1)}%</p>
                </div>
              </div>
            </div>

            {/* Gráfico de Taxas de Conversão por Dia */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                Evolução das Taxas de Conversão
              </h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickFormatter={formatDate} />
                    <YAxis tickFormatter={(value) => `${value}%`} />
                    <Tooltip formatter={(value) => `${value.toFixed(1)}%`} labelFormatter={formatDate} />
                    <Legend />
                    <Line type="monotone" dataKey="taxaLigacaoAtendida" stroke="#3B82F6" name="Lig→Atend" />
                    <Line type="monotone" dataKey="taxaLeadsQualificacao" stroke="#10B981" name="Lead→Qual" />
                    <Line type="monotone" dataKey="taxaReunioesVendas" stroke="#EF4444" name="Reun→Venda" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Tabela Detalhada */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                Dados Detalhados - {MONTHS[selectedMonth - 1]} {selectedYear}
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Data</th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Leads</th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Ligações</th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Atendidas</th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Qualif.</th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Reuniões</th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Vendas</th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-blue-500 uppercase">GURU</th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-yellow-500 uppercase">TMB</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-green-500 uppercase">Faturamento</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {data.map((record, index) => (
                      <tr key={record.id} className={index % 2 === 0 ? 'bg-gray-50 dark:bg-gray-700/50' : ''}>
                        <td className="px-3 py-3 text-sm font-medium text-gray-900 dark:text-white">
                          {formatDate(record.date)}
                        </td>
                        <td className="px-3 py-3 text-sm text-center text-blue-600 dark:text-blue-400">
                          {record.leadsRecebidosTotais}
                        </td>
                        <td className="px-3 py-3 text-sm text-center text-gray-600 dark:text-gray-400">
                          {record.ligacoesRealizadas}
                        </td>
                        <td className="px-3 py-3 text-sm text-center text-gray-600 dark:text-gray-400">
                          {record.ligacoesAtendidas}
                        </td>
                        <td className="px-3 py-3 text-sm text-center text-orange-600 dark:text-orange-400">
                          {record.qualificacoes}
                        </td>
                        <td className="px-3 py-3 text-sm text-center text-purple-600 dark:text-purple-400">
                          {record.reunioesRealizadas}
                        </td>
                        <td className="px-3 py-3 text-sm text-center font-bold text-gray-900 dark:text-white">
                          {record.vendasRealizadas}
                        </td>
                        <td className="px-3 py-3 text-sm text-center text-blue-600 dark:text-blue-400">
                          {record.vendaGURU} ({formatCurrency(record.valorGURU)})
                        </td>
                        <td className="px-3 py-3 text-sm text-center text-yellow-600 dark:text-yellow-400">
                          {record.vendaTMB} ({formatCurrency(record.valorTMB)})
                        </td>
                        <td className="px-3 py-3 text-sm text-right font-bold text-green-600 dark:text-green-400">
                          {formatCurrency(record.valorVendasRealizadas)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-100 dark:bg-gray-600">
                    <tr>
                      <td className="px-3 py-3 text-sm font-bold text-gray-900 dark:text-white">TOTAL</td>
                      <td className="px-3 py-3 text-sm text-center font-bold text-blue-600">{totals.leadsRecebidosTotais}</td>
                      <td className="px-3 py-3 text-sm text-center font-bold text-gray-900 dark:text-white">{totals.ligacoesRealizadas}</td>
                      <td className="px-3 py-3 text-sm text-center font-bold text-gray-900 dark:text-white">{totals.ligacoesAtendidas}</td>
                      <td className="px-3 py-3 text-sm text-center font-bold text-orange-600">{totals.qualificacoes}</td>
                      <td className="px-3 py-3 text-sm text-center font-bold text-purple-600">{totals.reunioesRealizadas}</td>
                      <td className="px-3 py-3 text-sm text-center font-bold text-gray-900 dark:text-white">{totals.vendasRealizadas}</td>
                      <td className="px-3 py-3 text-sm text-center font-bold text-blue-600">{totals.vendaGURU} ({formatCurrency(totals.valorGURU)})</td>
                      <td className="px-3 py-3 text-sm text-center font-bold text-yellow-600">{totals.vendaTMB} ({formatCurrency(totals.valorTMB)})</td>
                      <td className="px-3 py-3 text-sm text-right font-bold text-green-600">{formatCurrency(totals.valorVendasRealizadas)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default TSDashboard
