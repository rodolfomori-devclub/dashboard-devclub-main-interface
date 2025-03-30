import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
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
} from 'recharts'
import commercialService from '../services/commercialService'
import goalsService from '../services/goalsService'
import { formatCurrency } from '../utils/currencyUtils'
import {
  FaEdit,
  FaSave,
  FaTrophy,
  FaMedal,
  FaAward,
  FaChevronLeft,
  FaTimes,
  FaUser,
  FaStar,
  FaChartLine,
} from 'react-icons/fa'
import PodiumTopSellers from '../components/PodiumTopSellers'
import ConfettiEffect from '../components/ConfettiEffect'

const COLORS = [
  '#37E359',
  '#051626',
  '#FF4500',
  '#1E90FF',
  '#FFD700',
  '#FF1493',
]
const MEDALS = [
  {
    icon: <FaTrophy className="text-yellow-500 text-2xl" />,
    label: 'Ouro',
    color: 'from-yellow-300 to-yellow-500',
  },
  {
    icon: <FaMedal className="text-gray-400 text-2xl" />,
    label: 'Prata',
    color: 'from-gray-300 to-gray-500',
  },
  {
    icon: <FaAward className="text-amber-600 text-2xl" />,
    label: 'Bronze',
    color: 'from-amber-500 to-amber-700',
  },
]

function CommercialSellersPage() {
  // Estado para vendas e filtros
  const [salesData, setSalesData] = useState([])
  const [filterType, setFilterType] = useState('month') // 'month', 'year', 'custom'
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [customStartDate, setCustomStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .split('T')[0],
  )
  const [customEndDate, setCustomEndDate] = useState(
    new Date().toISOString().split('T')[0],
  )

  // Estado para vendedores
  const [sellers, setSellers] = useState([])
  const [selectedSeller, setSelectedSeller] = useState(null)
  const [sellerGoals, setSellerGoals] = useState({})
  const [editingSellerGoal, setEditingSellerGoal] = useState(null)
  const [tempSellerGoalValue, setTempSellerGoalValue] = useState('')

  // Estado para carregamento e erro
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Modal details
  const [showModal, setShowModal] = useState(false)
  const [modalData, setModalData] = useState(null)

  const navigate = useNavigate()
  const location = useLocation()

  // Extrair parâmetros da URL se fornecidos
  useEffect(() => {
    if (location.state) {
      if (location.state.year) {
        setSelectedYear(location.state.year)
      }
      if (location.state.month) {
        setSelectedMonth(location.state.month)
      }
    }
  }, [location])

  // Função para obter o nome do mês
  const getMonthName = (monthIndex) => {
    const months = [
      'Janeiro',
      'Fevereiro',
      'Março',
      'Abril',
      'Maio',
      'Junho',
      'Julho',
      'Agosto',
      'Setembro',
      'Outubro',
      'Novembro',
      'Dezembro',
    ]
    return months[monthIndex - 1]
  }

  // Buscar dados com base nos filtros
  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      let sales = []

      // Obter dados de acordo com o tipo de filtro
      if (filterType === 'month') {
        sales = await commercialService.getSalesByMonth(
          selectedYear,
          selectedMonth,
        )
      } else if (filterType === 'year') {
        sales = await commercialService.getSalesByYear(selectedYear)
      } else if (filterType === 'custom') {
        sales = await commercialService.getSalesByDateRange(
          new Date(customStartDate),
          new Date(customEndDate),
        )
      }

      // Processar dados de vendedores
      const sellerMap = new Map()
      sales.forEach((sale) => {
        const sellerName = sale.seller
        if (!sellerMap.has(sellerName)) {
          sellerMap.set(sellerName, {
            id: sellerName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
            name: sellerName,
            sales: [],
            totalSales: 0,
            totalValue: 0,
            salesByProduct: {},
            salesByChannel: {},
            salesByPaymentMethod: {},
          })
        }

        const sellerData = sellerMap.get(sellerName)

        // Adicionar venda ao vendedor
        sellerData.sales.push(sale)
        sellerData.totalSales += 1
        sellerData.totalValue += sale.value || 0

        // Adicionar à contagem por produto
        if (!sellerData.salesByProduct[sale.product]) {
          sellerData.salesByProduct[sale.product] = { count: 0, value: 0 }
        }
        sellerData.salesByProduct[sale.product].count += 1
        sellerData.salesByProduct[sale.product].value += sale.value || 0

        // Adicionar à contagem por canal
        if (!sellerData.salesByChannel[sale.channel]) {
          sellerData.salesByChannel[sale.channel] = { count: 0, value: 0 }
        }
        sellerData.salesByChannel[sale.channel].count += 1
        sellerData.salesByChannel[sale.channel].value += sale.value || 0

        // Adicionar à contagem por método de pagamento
        if (!sellerData.salesByPaymentMethod[sale.paymentMethod]) {
          sellerData.salesByPaymentMethod[sale.paymentMethod] = {
            count: 0,
            value: 0,
          }
        }
        sellerData.salesByPaymentMethod[sale.paymentMethod].count += 1
        sellerData.salesByPaymentMethod[sale.paymentMethod].value +=
          sale.value || 0
      })

      // Converter para array e ordenar por total de vendas (decrescente)
      const processedSellers = Array.from(sellerMap.values()).sort(
        (a, b) => b.totalSales - a.totalSales,
      )

      setSellers(processedSellers)
      setSalesData(sales)

      // Buscar metas dos vendedores
      if (filterType === 'month') {
        const goals = {}

        // Buscar metas para cada vendedor de forma assíncrona
        const goalPromises = processedSellers.map(async (seller) => {
          const goal = await goalsService.getSellerGoal(
            seller.id,
            selectedYear,
            selectedMonth,
          )
          return { sellerId: seller.id, goal }
        })

        // Aguardar todas as promessas de busca de metas
        const sellerGoalsResults = await Promise.all(goalPromises)

        // Construir objeto de metas
        sellerGoalsResults.forEach(({ sellerId, goal }) => {
          goals[sellerId] = goal
        })

        setSellerGoals(goals)
      }

      setLoading(false)
    } catch (err) {
      console.error('Erro ao carregar dados:', err)
      setError('Falha ao carregar os dados. Tente novamente mais tarde.')
      setLoading(false)
    }
  }, [filterType, selectedMonth, selectedYear, customStartDate, customEndDate])

  // Carregar dados iniciais
  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Manipuladores para mudança de filtros
  const handleFilterTypeChange = (e) => {
    setFilterType(e.target.value)
  }

  const handleMonthChange = (e) => {
    setSelectedMonth(Number(e.target.value))
  }

  const handleYearChange = (e) => {
    setSelectedYear(Number(e.target.value))
  }

  const handleStartDateChange = (e) => {
    setCustomStartDate(e.target.value)
  }

  const handleEndDateChange = (e) => {
    setCustomEndDate(e.target.value)
  }

  // Aplicar filtros
  const applyFilters = () => {
    fetchData()
  }

  // Abrir modal de detalhes do vendedor
  const openSellerDetails = (seller) => {
    setModalData(seller)
    setShowModal(true)
  }

  // Fechar modal
  const closeModal = () => {
    setShowModal(false)
    setModalData(null)
  }

  // Editar meta do vendedor
  const handleEditSellerGoal = (sellerId) => {
    setEditingSellerGoal(sellerId)
    setTempSellerGoalValue(sellerGoals[sellerId]?.toString() || '0')
  }

  // Salvar meta do vendedor
  const handleSaveSellerGoal = async (seller) => {
    try {
      const goalValue = parseInt(tempSellerGoalValue) || 0

      await goalsService.saveSellerGoal(
        seller.id,
        seller.name,
        selectedYear,
        selectedMonth,
        goalValue,
      )

      setSellerGoals((prev) => ({
        ...prev,
        [seller.id]: goalValue,
      }))

      setEditingSellerGoal(null)
    } catch (err) {
      console.error('Erro ao salvar meta:', err)
      alert('Erro ao salvar meta. Tente novamente.')
    }
  }

  // Calcular progresso em relação à meta
  const calculateProgress = (sellerId, totalSales) => {
    const goal = sellerGoals[sellerId]
    if (!goal) return 0
    return Math.min(100, Math.round((totalSales / goal) * 100))
  }

  // Navegar de volta para o dashboard
  const navigateToDashboard = () => {
    navigate('/commercial')
  }

  // Preparar dados para gráficos do modal
  const prepareModalChartData = (seller) => {
    if (!seller) return {}

    // Dados para gráfico de produtos
    const productChartData = Object.entries(seller.salesByProduct).map(
      ([name, data]) => ({
        name,
        count: data.count,
        value: data.value,
      }),
    )

    // Dados para gráfico de canais
    const channelChartData = Object.entries(seller.salesByChannel).map(
      ([name, data]) => ({
        name,
        count: data.count,
        value: data.value,
      }),
    )

    // Dados para gráfico de métodos de pagamento
    const paymentChartData = Object.entries(seller.salesByPaymentMethod).map(
      ([name, data]) => ({
        name,
        count: data.count,
        value: data.value,
      }),
    )

    return {
      productChartData,
      channelChartData,
      paymentChartData,
    }
  }

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark p-6">
      {!loading && !error && sellers.length > 0 && <ConfettiEffect />}
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center mb-6">
          <button
            onClick={navigateToDashboard}
            className="mr-4 text-primary dark:text-secondary hover:text-secondary dark:hover:text-primary"
          >
            <FaChevronLeft className="text-xl" />
          </button>
          <h1 className="text-3xl font-bold text-primary-dark dark:text-primary">
            Ranking de Vendedores
          </h1>
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
            {/* Top 3 Vendedores */}
            <PodiumTopSellers
              sellers={sellers.slice(0, 3).map((seller) => ({
                ...seller,
                totalValue: seller.totalValue,
                totalSales: seller.totalSales,
              }))}
              onSellerClick={openSellerDetails}
            />
            {/* Outros Vendedores */}
            {sellers.length > 3 && (
              <>
                <h2 className="text-2xl font-bold text-primary dark:text-secondary mb-6">
                  Outros Vendedores
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                  {sellers.slice(3).map((seller, index) => (
                    <div
                      key={seller.id}
                      className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                      onClick={() => openSellerDetails(seller)}
                    >
                      <div className="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center text-gray-500 dark:text-gray-300 font-bold">
                        {index + 4}
                      </div>
                      <div className="ml-4 flex-grow">
                        <h3 className="font-medium text-text-light dark:text-text-dark">
                          {seller.name}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {seller.totalSales} vendas
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-primary dark:text-secondary">
                          {formatCurrency(seller.totalValue)}
                        </p>

                        {filterType === 'month' && sellerGoals[seller.id] > 0 && (
                          <div className="flex items-center justify-end mt-1">
                            <div className="w-20 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full">
                              <div
                                className="bg-primary dark:bg-secondary h-1.5 rounded-full"
                                style={{
                                  width: `${calculateProgress(
                                    seller.id,
                                    seller.totalSales,
                                  )}%`,
                                }}
                              ></div>
                            </div>
                            <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                              {calculateProgress(seller.id, seller.totalSales)}%
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            {/* Modal Detalhes do Vendedor */}
            // Substitua a parte do modal de detalhes de vendedor na
            CommercialSellersPage.jsx
            {/* Modal Detalhes do Vendedor - Versão Melhorada */}
            {showModal && modalData && (
              <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm transition-all duration-300">
                <div
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden animate-fadeIn"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Header do Modal com Gradiente */}
                  <div className="relative p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-primary to-accent1 dark:from-primary-dark dark:to-accent2">
                    <div className="flex justify-between items-center">
                      <h2 className="text-2xl font-bold text-white">
                        {modalData.name}
                      </h2>
                      <button
                        onClick={closeModal}
                        className="text-white hover:text-gray-200 transition-colors"
                      >
                        <FaTimes className="text-xl" />
                      </button>
                    </div>

                    {/* Stats no header */}
                    <div className="mt-4 grid grid-cols-3 gap-4 animate-slideUp">
                      <div className="bg-white bg-opacity-20 dark:bg-gray-800 dark:bg-opacity-30 backdrop-blur-sm p-3 rounded-lg">
                        <p className="text-white text-opacity-80 text-sm">
                          Total de Vendas
                        </p>
                        <p className="text-white text-3xl font-bold">
                          {modalData.totalSales}
                        </p>
                      </div>

                      <div className="bg-white bg-opacity-20 dark:bg-gray-800 dark:bg-opacity-30 backdrop-blur-sm p-3 rounded-lg">
                        <p className="text-white text-opacity-80 text-sm">
                          Faturamento
                        </p>
                        <p className="text-white text-3xl font-bold">
                          {formatCurrency(modalData.totalValue)}
                        </p>
                      </div>

                      <div className="bg-white bg-opacity-20 dark:bg-gray-800 dark:bg-opacity-30 backdrop-blur-sm p-3 rounded-lg">
                        <p className="text-white text-opacity-80 text-sm">
                          Ticket Médio
                        </p>
                        <p className="text-white text-3xl font-bold">
                          {formatCurrency(
                            modalData.totalSales
                              ? modalData.totalValue / modalData.totalSales
                              : 0,
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
                    {/* Tabs de Navegação */}
                    <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
                      <button
                        className={`py-2 px-4 font-medium border-b-2 transition-colors ${
                          true
                            ? 'border-primary text-primary dark:border-secondary dark:text-secondary'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                        }`}
                      >
                        Desempenho
                      </button>
                    </div>

                    {/* Selos e Achievement Badges */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      <div className="bg-yellow-50 dark:bg-yellow-900/30 p-3 rounded-lg border border-yellow-200 dark:border-yellow-800 flex items-center">
                        <div className="h-12 w-12 bg-yellow-100 dark:bg-yellow-800 rounded-full flex items-center justify-center mr-3">
                          <FaTrophy className="text-yellow-500 text-xl" />
                        </div>
                        <div>
                          <p className="text-sm text-yellow-700 dark:text-yellow-300">
                            Produto Mais Vendido
                          </p>
                          <p className="font-medium text-yellow-900 dark:text-yellow-100">
                            {Object.entries(modalData.salesByProduct).sort(
                              (a, b) => b[1].count - a[1].count,
                            )[0]?.[0] || 'N/A'}
                          </p>
                        </div>
                      </div>

                      <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg border border-blue-200 dark:border-blue-800 flex items-center">
                        <div className="h-12 w-12 bg-blue-100 dark:bg-blue-800 rounded-full flex items-center justify-center mr-3">
                          <FaChartLine className="text-blue-500 text-xl" />
                        </div>
                        <div>
                          <p className="text-sm text-blue-700 dark:text-blue-300">
                            Canal Preferido
                          </p>
                          <p className="font-medium text-blue-900 dark:text-blue-100">
                            {Object.entries(modalData.salesByChannel).sort(
                              (a, b) => b[1].count - a[1].count,
                            )[0]?.[0] || 'N/A'}
                          </p>
                        </div>
                      </div>

                      <div className="bg-green-50 dark:bg-green-900/30 p-3 rounded-lg border border-green-200 dark:border-green-800 flex items-center">
                        <div className="h-12 w-12 bg-green-100 dark:bg-green-800 rounded-full flex items-center justify-center mr-3">
                          <FaStar className="text-green-500 text-xl" />
                        </div>
                        <div>
                          <p className="text-sm text-green-700 dark:text-green-300">
                            Conversão
                          </p>
                          <p className="font-medium text-green-900 dark:text-green-100">
                            {modalData.totalSales > 0 ? '100%' : '0%'}
                          </p>
                        </div>
                      </div>

                      <div className="bg-purple-50 dark:bg-purple-900/30 p-3 rounded-lg border border-purple-200 dark:border-purple-800 flex items-center">
                        <div className="h-12 w-12 bg-purple-100 dark:bg-purple-800 rounded-full flex items-center justify-center mr-3">
                          <FaMedal className="text-purple-500 text-xl" />
                        </div>
                        <div>
                          <p className="text-sm text-purple-700 dark:text-purple-300">
                            Posição no Ranking
                          </p>
                          <p className="font-medium text-purple-900 dark:text-purple-100">
                            {sellers.findIndex((s) => s.id === modalData.id) +
                              1}
                            º lugar
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Gráficos em grid com títulos estilizados */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                      {/* Vendas por Produto */}
                      <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg p-4 shadow-sm">
                        <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-2 pb-2 border-b border-gray-100 dark:border-gray-700">
                          <span className="border-l-4 border-primary dark:border-secondary pl-2">
                            Vendas por Produto
                          </span>
                        </h3>
                        <div className="h-72">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={Object.entries(
                                modalData.salesByProduct,
                              ).map(([name, data]) => ({
                                name,
                                count: data.count,
                              }))}
                              margin={{
                                top: 20,
                                right: 30,
                                left: 20,
                                bottom: 5,
                              }}
                            >
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="name" />
                              <YAxis />
                              <Tooltip />
                              <Bar dataKey="count" name="Vendas" fill="#37E359">
                                {Object.entries(modalData.salesByProduct).map(
                                  (entry, index) => (
                                    <Cell
                                      key={`cell-${index}`}
                                      fill={COLORS[index % COLORS.length]}
                                    />
                                  ),
                                )}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* Faturamento por Produto */}
                      <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg p-4 shadow-sm">
                        <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-2 pb-2 border-b border-gray-100 dark:border-gray-700">
                          <span className="border-l-4 border-accent1 dark:border-accent2 pl-2">
                            Faturamento por Produto
                          </span>
                        </h3>
                        <div className="h-72">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={Object.entries(
                                modalData.salesByProduct,
                              ).map(([name, data]) => ({
                                name,
                                value: data.value,
                              }))}
                              margin={{
                                top: 20,
                                right: 30,
                                left: 20,
                                bottom: 5,
                              }}
                            >
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="name" />
                              <YAxis
                                tickFormatter={(value) =>
                                  formatCurrency(value).slice(0, -3)
                                }
                              />
                              <Tooltip
                                formatter={(value) => formatCurrency(value)}
                              />
                              <Bar
                                dataKey="value"
                                name="Faturamento"
                                fill="#1E90FF"
                              >
                                {Object.entries(modalData.salesByProduct).map(
                                  (entry, index) => (
                                    <Cell
                                      key={`cell-${index}`}
                                      fill={COLORS[(index + 3) % COLORS.length]}
                                    />
                                  ),
                                )}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* Vendas por Canal com novo design de Pie Chart */}
                      <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg p-4 shadow-sm">
                        <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-2 pb-2 border-b border-gray-100 dark:border-gray-700">
                          <span className="border-l-4 border-secondary dark:border-primary pl-2">
                            Vendas por Canal
                          </span>
                        </h3>
                        <div className="h-72">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={Object.entries(
                                  modalData.salesByChannel,
                                ).map(([name, data], index) => ({
                                  name,
                                  value: data.count,
                                  fill: COLORS[index % COLORS.length],
                                }))}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                                labelLine={false}
                                label={({
                                  cx,
                                  cy,
                                  midAngle,
                                  innerRadius,
                                  outerRadius,
                                  value,
                                  index,
                                  name,
                                  fill,
                                }) => {
                                  const RADIAN = Math.PI / 180
                                  const radius =
                                    25 +
                                    innerRadius +
                                    (outerRadius - innerRadius)
                                  const x =
                                    cx + radius * Math.cos(-midAngle * RADIAN)
                                  const y =
                                    cy + radius * Math.sin(-midAngle * RADIAN)

                                  return (
                                    <text
                                      x={x}
                                      y={y}
                                      fill={fill}
                                      textAnchor={x > cx ? 'start' : 'end'}
                                      dominantBaseline="central"
                                    >
                                      {name} ({value})
                                    </text>
                                  )
                                }}
                              >
                                {Object.entries(modalData.salesByChannel).map(
                                  (entry, index) => (
                                    <Cell
                                      key={`cell-${index}`}
                                      fill={COLORS[index % COLORS.length]}
                                    />
                                  ),
                                )}
                              </Pie>
                              <Tooltip formatter={(value) => value} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* Vendas por Método de Pagamento com novo design */}
                      <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg p-4 shadow-sm">
                        <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-2 pb-2 border-b border-gray-100 dark:border-gray-700">
                          <span className="border-l-4 border-accent3 dark:border-accent4 pl-2">
                            Método de Pagamento
                          </span>
                        </h3>
                        <div className="h-72">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={Object.entries(
                                  modalData.salesByPaymentMethod,
                                ).map(([name, data], index) => ({
                                  name,
                                  value: data.count,
                                }))}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="value"
                              >
                                {Object.entries(
                                  modalData.salesByPaymentMethod,
                                ).map((entry, index) => (
                                  <Cell
                                    key={`cell-${index}`}
                                    fill={COLORS[(index + 2) % COLORS.length]}
                                  />
                                ))}
                              </Pie>
                              <Tooltip formatter={(value) => value} />
                              <Legend
                                layout="vertical"
                                verticalAlign="middle"
                                align="right"
                                iconType="circle"
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>

                    {/* Tabela de vendas - Headers estilizados */}
                    <div className="mb-4">
                      <h3 className="text-xl font-bold text-primary dark:text-secondary mb-4 flex items-center">
                        <span className="h-8 w-1 bg-primary dark:bg-secondary rounded-full mr-2"></span>
                        Histórico de Vendas
                        <span className="ml-2 px-2 py-1 bg-primary/10 dark:bg-secondary/10 text-primary dark:text-secondary text-xs rounded-full">
                          {modalData.sales.length} vendas
                        </span>
                      </h3>
                      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                          <thead className="bg-gray-50 dark:bg-gray-800">
                            <tr>
                              <th
                                scope="col"
                                className="group px-6 py-3 text-left"
                              >
                                <div className="flex items-center gap-x-2">
                                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-800 dark:text-gray-200">
                                    Data
                                  </span>
                                </div>
                              </th>
                              <th
                                scope="col"
                                className="group px-6 py-3 text-left"
                              >
                                <div className="flex items-center gap-x-2">
                                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-800 dark:text-gray-200">
                                    Produto
                                  </span>
                                </div>
                              </th>
                              <th
                                scope="col"
                                className="group px-6 py-3 text-left"
                              >
                                <div className="flex items-center gap-x-2">
                                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-800 dark:text-gray-200">
                                    Canal
                                  </span>
                                </div>
                              </th>
                              <th
                                scope="col"
                                className="group px-6 py-3 text-left"
                              >
                                <div className="flex items-center gap-x-2">
                                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-800 dark:text-gray-200">
                                    Pagamento
                                  </span>
                                </div>
                              </th>
                              <th
                                scope="col"
                                className="group px-6 py-3 text-right"
                              >
                                <div className="flex items-center justify-end gap-x-2">
                                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-800 dark:text-gray-200">
                                    Valor
                                  </span>
                                </div>
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800">
                            {modalData.sales
                              .sort(
                                (a, b) =>
                                  new Date(b.timestamp) - new Date(a.timestamp),
                              )
                              .map((sale, index) => (
                                <tr
                                  key={index}
                                  className="hover:bg-gray-50 dark:hover:bg-gray-700 transform transition-colors"
                                >
                                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                                    {sale.date.formatted}
                                  </td>
                                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                                    {sale.product}
                                  </td>
                                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                                      {sale.channel}
                                    </span>
                                  </td>
                                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                                    <span
                                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                        sale.paymentMethod
                                          .toLowerCase()
                                          .includes('cartão') ||
                                        sale.paymentMethod
                                          .toLowerCase()
                                          .includes('guru')
                                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                                          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
                                      }`}
                                    >
                                      {sale.paymentMethod}
                                    </span>
                                  </td>
                                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-right text-green-600 dark:text-green-400">
                                    {formatCurrency(sale.value)}
                                  </td>
                                </tr>
                              ))}

                            {modalData.sales.length === 0 && (
                              <tr>
                                <td
                                  className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400"
                                  colSpan={5}
                                >
                                  Nenhuma venda registrada para este período.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Footer com Call to Action */}
                  <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800 text-right">
                    <button
                      onClick={closeModal}
                      className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors mr-3"
                    >
                      Fechar
                    </button>

                    {filterType === 'month' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleEditSellerGoal(modalData.id)
                          if (editingSellerGoal === modalData.id) {
                            handleSaveSellerGoal(modalData)
                          }
                        }}
                        className="px-4 py-2 bg-primary text-white dark:bg-secondary dark:text-primary-dark rounded-lg hover:bg-primary-dark dark:hover:bg-secondary-light transition-colors"
                      >
                        {editingSellerGoal === modalData.id ? (
                          <>
                            <FaSave className="inline-block mr-2" />
                            Salvar Meta
                          </>
                        ) : (
                          <>
                            <FaEdit className="inline-block mr-2" />
                            Definir Meta
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {editingSellerGoal === modalData.id && (
                    <div className="absolute inset-x-0 bottom-16 p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 animate-slideUp shadow-lg">
                      <div className="flex items-center">
                        <div className="flex-grow">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Meta de vendas para {getMonthName(selectedMonth)} de{' '}
                            {selectedYear}
                          </label>
                          <input
                            type="number"
                            value={tempSellerGoalValue}
                            onChange={(e) =>
                              setTempSellerGoalValue(e.target.value)
                            }
                            className="w-full border rounded px-3 py-2 bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark"
                            placeholder="Número de vendas"
                          />
                        </div>

                        <div className="ml-4 flex-shrink-0">
                          <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg shadow-sm">
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              Atual
                            </p>
                            <p className="text-lg font-bold text-gray-700 dark:text-gray-300">
                              {modalData.totalSales} de{' '}
                              {sellerGoals[modalData.id] || 0}
                            </p>
                            <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2.5 mt-1">
                              <div
                                className="bg-primary dark:bg-secondary h-2.5 rounded-full"
                                style={{
                                  width: `${calculateProgress(
                                    modalData.id,
                                    modalData.totalSales,
                                  )}%`,
                                }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default CommercialSellersPage
