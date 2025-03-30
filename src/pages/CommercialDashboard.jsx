import React, { useState, useEffect } from 'react'
import { db, productValues } from '../firebase'
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  onSnapshot,
  setDoc,
  serverTimestamp,
  orderBy,
  limit,
  collectionGroup,
} from 'firebase/firestore'

// Importar componentes personalizados
// Ajuste estes caminhos conforme a estrutura do seu projeto
import YearMonthSelector from '../components/YearMonthSelector'
import MonthDetailsModal from '../components/MonthDetailsModal'
import SellerDetailsModal from '../components/SellerDetailsModal'
import DashboardCharts from '../components/DashboardCharts'

function CommercialDashboard() {
  // State para vendedores
  const [sellers, setSellers] = useState([])
  const [selectedChannel, setSelectedChannel] = useState(null)
  const [channelError, setChannelError] = useState(false)

  // State para metas
  const [goals, setGoals] = useState({
    meta: '10',
    superMeta: '15',
    ultraMeta: '20',
  })

  // UI state
  const [editingGoal, setEditingGoal] = useState(null)
  const [showAddSellerModal, setShowAddSellerModal] = useState(false)
  const [newSellerName, setNewSellerName] = useState('')
  const [currentSeller, setCurrentSeller] = useState(null)
  const [showAddSaleModal, setShowAddSaleModal] = useState(false)
  const [showCancelSaleModal, setShowCancelSaleModal] = useState(false)
  const [showDeleteSellerModal, setShowDeleteSellerModal] = useState(false)
  const [sellerToDelete, setSellerToDelete] = useState(null)

  // Novos states para os modais de detalhes
  const [showSellerDetailsModal, setShowSellerDetailsModal] = useState(false)
  const [selectedSeller, setSelectedSeller] = useState(null)
  const [showMonthDetailsModal, setShowMonthDetailsModal] = useState(false)
  const [selectedYear, setSelectedYear] = useState(null)
  const [selectedMonth, setSelectedMonth] = useState(null)

  // State para todas as vendas (para visualizações gerais)
  const [allSales, setAllSales] = useState([])

  // Loading states
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Lista de produtos
  const products = [
    'DevClub Boleto',
    'DevClub Cartão',
    'Vitalicio Cartão',
    'Vitalicio Boleto',
    'Front End Cartão',
    'Front End Boleto',
  ]

  // Adicione estas funções no início do CommercialDashboard.jsx, logo após as importações

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

  // Carregar dados do Firestore na montagem do componente
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)

        // Buscar metas
        const goalsRef = doc(db, 'commercial', 'goals')
        const unsubscribeGoals = onSnapshot(
          goalsRef,
          (docSnapshot) => {
            if (docSnapshot.exists()) {
              setGoals(docSnapshot.data())
            } else {
              // Se o documento de metas não existir, cria com valores padrão
              setDoc(goalsRef, {
                meta: '10',
                superMeta: '15',
                ultraMeta: '20',
              })
            }
          },
          (error) => {
            console.error('Erro ao buscar metas:', error)
            setError('Falha ao carregar metas')
          },
        )

        // Buscar vendedores
        const sellersRef = collection(db, 'sellers')
        const unsubscribeSellers = onSnapshot(
          sellersRef,
          (snapshot) => {
            const sellersData = snapshot.docs.map((doc) => ({
              id: doc.id,
              ...doc.data(),
              // Inicializa o contador de vendas por produto, se não existir
              salesCount:
                doc.data().salesCount ||
                products.reduce(
                  (acc, product) => ({ ...acc, [product]: 0 }),
                  {},
                ),
            }))

            setSellers(sellersData)

            // Só definimos loading como false após buscar os vendedores e suas vendas
            if (sellersData.length === 0) {
              setLoading(false)
            }
          },
          (error) => {
            console.error('Erro ao buscar vendedores:', error)
            setError('Falha ao carregar dados dos vendedores')
            setLoading(false)
          },
        )

        // Buscar todas as vendas usando collectionGroup
        const salesQuery = query(
          collectionGroup(db, 'sales'),
          orderBy('timestamp', 'desc'),
        )

        const unsubscribeAllSales = onSnapshot(
          salesQuery,
          (snapshot) => {
            const salesData = snapshot.docs.map((doc) => ({
              id: doc.id,
              sellerId: doc.ref.parent.parent.id,
              ...doc.data(),
              timestamp: doc.data().timestamp?.toDate() || new Date(),
            }))

            setAllSales(salesData)
            setLoading(false)
          },
          (error) => {
            console.error('Erro ao buscar todas as vendas:', error)
            setError('Falha ao carregar histórico de vendas')
            setLoading(false)
          },
        )

        return () => {
          unsubscribeGoals()
          unsubscribeSellers()
          unsubscribeAllSales()
        }
      } catch (error) {
        console.error('Erro na inicialização do Firebase:', error)
        setError('Falha ao conectar com o banco de dados')
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  // Manipuladores para vendedores
  const handleAddSeller = async () => {
    if (newSellerName.trim()) {
      try {
        const newSeller = {
          name: newSellerName.trim(),
          // Inicializamos o contador de vendas por produto
          salesCount: products.reduce(
            (acc, product) => ({ ...acc, [product]: 0 }),
            {},
          ),
        }

        await addDoc(collection(db, 'sellers'), newSeller)
        setNewSellerName('')
        setShowAddSellerModal(false)
      } catch (error) {
        console.error('Erro ao adicionar vendedor:', error)
        setError('Falha ao adicionar vendedor')
      }
    }
  }

  // Manipuladores para vendas
  const handleAddSale = async (product, channel) => {
    if (currentSeller && channel) {
      try {
        // 1. Atualizar o contador de vendas do vendedor
        const sellerRef = doc(db, 'sellers', currentSeller.id);
        const updatedSalesCount = { 
          ...currentSeller.salesCount,
          [product]: (currentSeller.salesCount?.[product] || 0) + 1
        };
        
        await updateDoc(sellerRef, { salesCount: updatedSalesCount });
        
        // 2. Adicionar a venda à subcoleção de vendas do vendedor
        const salesCollectionRef = collection(db, 'sellers', currentSeller.id, 'sales');
        
        const saleData = {
          product: product,
          timestamp: serverTimestamp(),
          value: productValues[product] || 0,
          channel: channel // Adicionar o canal de venda
        };
        
        await addDoc(salesCollectionRef, saleData);
        
        setSelectedChannel(null); // Limpar canal selecionado
        setShowAddSaleModal(false);
      } catch (error) {
        console.error('Erro ao adicionar venda:', error);
        setError('Falha ao registrar venda');
      }
    } else if (!channel) {
      setChannelError(true);
      setTimeout(() => setChannelError(false), 3000);
    }
  };
  
  // Função para obter o canal de venda com segurança (para compatibilidade com registros antigos)
  const getSaleChannel = (sale) => {
    if (!sale || !sale.channel) return "Desconhecido";
    return sale.channel;
  };
  
  const handleCancelSale = async (product) => {
    if (
      currentSeller &&
      currentSeller.salesCount &&
      currentSeller.salesCount[product] > 0
    ) {
      try {
        // 1. Atualizar contador do vendedor
        const sellerRef = doc(db, 'sellers', currentSeller.id)
        const updatedSalesCount = {
          ...currentSeller.salesCount,
          [product]: Math.max(0, (currentSeller.salesCount[product] || 0) - 1),
        }

        await updateDoc(sellerRef, { salesCount: updatedSalesCount })

        // 2. Remover a venda mais recente deste produto
        const salesCollectionRef = collection(
          db,
          'sellers',
          currentSeller.id,
          'sales',
        )
        const q = query(
          salesCollectionRef,
          where('product', '==', product),
          orderBy('timestamp', 'desc'),
          limit(1),
        )

        const querySnapshot = await getDocs(q)

        if (!querySnapshot.empty) {
          // Excluir a venda mais recente
          await deleteDoc(doc(salesCollectionRef, querySnapshot.docs[0].id))
        }

        setShowCancelSaleModal(false)
      } catch (error) {
        console.error('Erro ao cancelar venda:', error)
        setError('Falha ao cancelar venda')
      }
    }
  }

  // Função para remover um vendedor
  const handleDeleteSeller = async () => {
    if (sellerToDelete) {
      try {
        // 1. Primeiro, excluir todas as vendas do vendedor (subcoleção)
        const salesCollectionRef = collection(
          db,
          'sellers',
          sellerToDelete.id,
          'sales',
        )
        const salesSnapshot = await getDocs(salesCollectionRef)

        const deletePromises = salesSnapshot.docs.map((saleDoc) =>
          deleteDoc(doc(salesCollectionRef, saleDoc.id)),
        )

        await Promise.all(deletePromises)

        // 2. Excluir o próprio vendedor
        await deleteDoc(doc(db, 'sellers', sellerToDelete.id))

        setShowDeleteSellerModal(false)
        setSellerToDelete(null)
      } catch (error) {
        console.error('Erro ao remover vendedor:', error)
        setError('Falha ao remover vendedor')
      }
    }
  }

  // Manipuladores para metas
  const handleGoalChange = (type, value) => {
    // Permitir apenas números
    const numericValue = value.replace(/\D/g, '')
    setGoals((prev) => ({
      ...prev,
      [type]: numericValue,
    }))
  }

  const saveGoal = async (type) => {
    try {
      const goalsRef = doc(db, 'commercial', 'goals')
      await updateDoc(goalsRef, {
        [type]: goals[type],
      })
      setEditingGoal(null)
    } catch (error) {
      console.error('Erro ao salvar meta:', error)
      setError('Falha ao salvar meta')
    }
  }

  // Calcular total de vendas para um vendedor
  const calculateSellerTotal = (salesCount) => {
    if (!salesCount) return 0
    return Object.values(salesCount).reduce((total, count) => total + count, 0)
  }

  // Calcular total de vendas para a equipe
  const calculateTeamTotals = () => {
    const teamTotals = {
      total: 0,
      byProduct: products.reduce(
        (acc, product) => ({ ...acc, [product]: 0 }),
        {},
      ),
    }

    sellers.forEach((seller) => {
      if (seller.salesCount) {
        Object.entries(seller.salesCount).forEach(([product, count]) => {
          teamTotals.byProduct[product] =
            (teamTotals.byProduct[product] || 0) + count
          teamTotals.total += count
        })
      }
    })

    return teamTotals
  }

  // Determinar cor da barra com base no alcance da meta
  const getBarColor = (salesCount) => {
    const meta = parseInt(goals.meta) || 1 // Evitar divisão por zero
    const superMeta = parseInt(goals.superMeta) || meta * 1.2
    const ultraMeta = parseInt(goals.ultraMeta) || meta * 1.5

    const percentage = (salesCount / meta) * 100

    if (percentage < 83) return 'bg-orange-500' // Laranja até 83%
    if (percentage < 100) return 'bg-amber-500' // Verde alaranjado entre 83% e 100%
    if (salesCount < superMeta) return 'bg-green-500' // Verde acima de 100% até super meta
    if (salesCount < ultraMeta) return 'bg-purple-500' // Roxo acima da super meta
    return 'bg-lime-500' // Verde limão quando atinge a ultra meta
  }

  // Calcular largura da barra de progresso
  const calculateProgressWidth = (salesCount) => {
    const meta = parseInt(goals.meta) || 1
    const superMeta = parseInt(goals.superMeta) || meta * 1.2
    const ultraMeta = parseInt(goals.ultraMeta) || meta * 1.5

    if (salesCount <= meta) {
      // Entre 0 e meta: vai de 0% a 75% da largura
      return (salesCount / meta) * 75
    } else if (salesCount <= superMeta) {
      // Entre meta e supermeta: vai de 75% a 85% da largura
      const progress = (salesCount - meta) / (superMeta - meta)
      return 75 + progress * 10
    } else if (salesCount <= ultraMeta) {
      // Entre supermeta e ultrameta: vai de 85% a 100% da largura
      const progress = (salesCount - superMeta) / (ultraMeta - superMeta)
      return 85 + progress * 15
    } else {
      // Acima de ultrameta: 100%
      return 100
    }
  }

  // Calcular a porcentagem da meta atingida
  const calculateMetaPercentage = (salesCount) => {
    const meta = parseInt(goals.meta) || 1
    return ((salesCount / meta) * 100).toFixed(1)
  }

  // Ordenar vendedores por número de vendas (ranking)
  const sortedSellers = [...sellers].sort(
    (a, b) =>
      calculateSellerTotal(b.salesCount) - calculateSellerTotal(a.salesCount),
  )

  // Manipulador para abrir modal de detalhes do vendedor
  const handleOpenSellerDetails = (seller) => {
    setSelectedSeller(seller)
    setShowSellerDetailsModal(true)
  }

  // Manipulador para seleção de mês
  const handleMonthSelect = (year, month) => {
    setSelectedYear(year)
    setSelectedMonth(month)
    setShowMonthDetailsModal(true)
  }

  // Filtrar vendas do vendedor selecionado
  const getSellerSales = (sellerId) => {
    if (!sellerId || !allSales) return []
    return allSales.filter((sale) => sale && sale.sellerId === sellerId)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary dark:border-secondary"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background-light dark:bg-background-dark p-6">
        <div className="max-w-7xl mx-auto bg-red-100 dark:bg-red-900 p-4 rounded-lg">
          <h1 className="text-2xl font-bold text-red-700 dark:text-red-300">
            Erro
          </h1>
          <p className="mt-2 text-red-600 dark:text-red-400">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-primary text-white rounded-lg"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-primary-dark dark:text-primary">
        Dashboard Comercial
          </h1>
          <button
            onClick={() => setShowAddSellerModal(true)}
            className="bg-secondary text-primary px-4 py-2 rounded hover:bg-primary hover:text-secondary transition-colors"
          >
            + Adicionar Vendedor
          </button>
        </div>

        {/* Seção de Metas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {['meta', 'superMeta', 'ultraMeta'].map((metaType) => (
            <div
              key={metaType}
              className="bg-white dark:bg-gray-800 rounded-lg shadow p-6"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-text-light dark:text-text-dark">
                  {metaType === 'meta'
                    ? 'Meta'
                    : metaType === 'superMeta'
                    ? 'Super Meta'
                    : 'Ultra Meta'}
                </h3>
                {editingGoal !== metaType ? (
                  <button
                    onClick={() => setEditingGoal(metaType)}
                    className="text-primary dark:text-secondary hover:text-secondary dark:hover:text-primary"
                  >
                    Editar
                  </button>
                ) : (
                  <button
                    onClick={() => saveGoal(metaType)}
                    className="text-green-500 hover:text-green-600 dark:text-green-400 dark:hover:text-green-300"
                  >
                    Salvar
                  </button>
                )}
              </div>
              {editingGoal === metaType ? (
                <input
                  type="text"
                  value={goals[metaType]}
                  onChange={(e) => handleGoalChange(metaType, e.target.value)}
                  className="w-full border rounded px-2 py-1 bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark"
                />
              ) : (
                <p className="text-2xl font-bold text-accent1 dark:text-accent2">
                  {goals[metaType]} vendas
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Resumo de Totais por Produto */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {products.map((product) => {
            const teamTotals = calculateTeamTotals()
            return (
              <div
                key={product}
                className="bg-white dark:bg-gray-800 rounded-lg shadow p-6"
              >
                <h3 className="text-lg font-medium text-text-light dark:text-text-dark">
                  {product}
                </h3>
                <p className="mt-2 text-3xl font-bold text-accent1 dark:text-accent2">
                  {teamTotals.byProduct[product] || 0}
                </p>
              </div>
            )
          })}
        </div>

        {/* Gráficos do Dashboard */}
        {allSales.length > 0 && (
          <DashboardCharts
            salesData={allSales}
            products={products}
            sellers={sellers}
          />
        )}

        {/* Barra Total da Equipe */}
        <div className="mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-4">
              Desempenho da Equipe
            </h3>
            <div className="relative h-16 flex items-center">
              <div className="w-full bg-gray-200 dark:bg-gray-700 h-12 rounded-full overflow-hidden">
                <div
                  className={`${getBarColor(
                    calculateTeamTotals().total,
                  )} h-12 rounded-full transition-all duration-500 ease-in-out`}
                  style={{
                    width: `${calculateProgressWidth(
                      calculateTeamTotals().total,
                    )}%`,
                  }}
                ></div>
              </div>
              <span className="absolute right-4 text-text-light dark:text-text-dark font-bold">
                {calculateTeamTotals().total} / {goals.meta}
              </span>
            </div>

            {/* Porcentagem da meta atingida */}
            <div className="mt-2 text-center">
              <span className="text-sm font-medium text-text-light dark:text-text-dark">
                {calculateMetaPercentage(calculateTeamTotals().total)}% da Meta
              </span>
            </div>

            {/* Marcadores de metas */}
            <div className="relative h-6 mt-2">
              <span className="absolute left-0 text-xs text-gray-600 dark:text-gray-300">
                0
              </span>

              <span
                className="absolute text-xs text-gray-600 dark:text-gray-300"
                style={{ left: '75%' }}
              >
                <span className="absolute top-0 left-0 -mt-2 w-1 h-8 border-l border-accent1"></span>
                <span className="absolute top-0 left-0 mt-8">
                  Meta: {goals.meta}
                </span>
              </span>

              <span
                className="absolute text-xs text-gray-600 dark:text-gray-300"
                style={{ left: '85%' }}
              >
                <span className="absolute top-0 left-0 -mt-2 w-1 h-8 border-l border-green-500"></span>
                <span className="absolute top-0 left-0 mt-8">
                  Super: {goals.superMeta}
                </span>
              </span>

              <span
                className="absolute text-xs text-gray-600 dark:text-gray-300"
                style={{ right: '0%' }}
              >
                <span className="absolute top-0 left-0 -mt-2 w-1 h-8 border-l border-purple-500"></span>
                <span className="absolute top-0 left-0 mt-8">
                  Ultra: {goals.ultraMeta}
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Barras de Vendedores Individuais (Ranking) */}
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-primary dark:text-secondary mt-8 mb-4">
            Ranking de Vendedores
          </h3>

          {sellers.length === 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center text-gray-500 dark:text-gray-400">
              <p>
                Nenhum vendedor adicionado. Clique em "+ Adicionar Vendedor"
                para começar.
              </p>
            </div>
          )}

          {sortedSellers.map((seller, index) => (
            <div
              key={seller.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow p-6"
            >
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center">
                  {/* Troféus para os três primeiros lugares */}
                  {index === 0 && (
                    <span className="text-2xl mr-2" title="1º Lugar - Ouro">
                      🏆
                    </span>
                  )}
                  {index === 1 && (
                    <span className="text-2xl mr-2" title="2º Lugar - Prata">
                      🥈
                    </span>
                  )}
                  {index === 2 && (
                    <span className="text-2xl mr-2" title="3º Lugar - Bronze">
                      🥉
                    </span>
                  )}
                  <h3 className="text-lg font-medium text-text-light dark:text-text-dark">
                    {seller.name}
                  </h3>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleOpenSellerDetails(seller)}
                    className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm hover:bg-blue-600"
                  >
                    Detalhes
                  </button>
                  <button
                    onClick={() => {
                      setCurrentSeller(seller)
                      setShowAddSaleModal(true)
                    }}
                    className="bg-green-500 text-white px-3 py-1 rounded-full text-sm hover:bg-green-600"
                  >
                    + Venda
                  </button>
                  <button
                    onClick={() => {
                      setCurrentSeller(seller)
                      setShowCancelSaleModal(true)
                    }}
                    className="bg-red-500 text-white px-3 py-1 rounded-full text-sm hover:bg-red-600"
                  >
                    - Venda
                  </button>
                  <button
                    onClick={() => {
                      setSellerToDelete(seller)
                      setShowDeleteSellerModal(true)
                    }}
                    className="bg-gray-500 text-white px-3 py-1 rounded-full text-sm hover:bg-gray-600"
                    title="Remover vendedor"
                  >
                    🗑️
                  </button>
                </div>
              </div>
              <div className="relative h-14 flex items-center">
                <div className="w-full bg-gray-200 dark:bg-gray-700 h-10 rounded-full overflow-hidden">
                  <div
                    className={`${getBarColor(
                      calculateSellerTotal(seller.salesCount),
                    )} h-10 rounded-full transition-all duration-500 ease-in-out`}
                    style={{
                      width: `${calculateProgressWidth(
                        calculateSellerTotal(seller.salesCount),
                      )}%`,
                    }}
                  ></div>
                </div>
                <span className="absolute right-4 text-text-light dark:text-text-dark font-bold">
                  {calculateSellerTotal(seller.salesCount)} / {goals.meta}
                </span>
              </div>

              {/* Porcentagem da meta atingida */}
              <div className="mt-1 mb-2">
                <span className="text-sm font-medium text-text-light dark:text-text-dark">
                  {calculateMetaPercentage(
                    calculateSellerTotal(seller.salesCount),
                  )}
                  % da Meta
                </span>
              </div>

              {/* Exibição de vendas por produto */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
                {products.map((product) => (
                  <div
                    key={product}
                    className="bg-gray-100 dark:bg-gray-700 p-2 rounded-lg text-center"
                  >
                    <span className="text-sm text-gray-600 dark:text-gray-300">
                      {product}
                    </span>
                    <p className="font-semibold text-text-light dark:text-text-dark">
                      {seller.salesCount?.[product] || 0}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Filtro de Ano/Mês */}
        <YearMonthSelector
          salesData={allSales}
          onMonthSelect={handleMonthSelect}
        />

        {/* Modais */}
        {/* Modal Adicionar Vendedor */}
        {showAddSellerModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-md w-full">
              <h2 className="text-xl font-bold text-text-light dark:text-text-dark mb-4">
                Adicionar Novo Vendedor
              </h2>
              <input
                type="text"
                placeholder="Nome do vendedor"
                value={newSellerName}
                onChange={(e) => setNewSellerName(e.target.value)}
                className="w-full border rounded px-3 py-2 mb-4 bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark"
              />
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => setShowAddSellerModal(false)}
                  className="px-4 py-2 border rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAddSeller}
                  className="px-4 py-2 bg-primary text-white dark:bg-secondary dark:text-gray-800 rounded hover:bg-opacity-90"
                >
                  Adicionar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Adicionar Venda */}
     {/* Modal Adicionar Venda */}
{showAddSaleModal && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-md w-full">
      <h2 className="text-xl font-bold text-text-light dark:text-text-dark mb-4">
        Adicionar Venda para {currentSeller?.name}
      </h2>
      
      {/* Seleção de Canal de Venda */}
      <div className="mb-6">
        <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-2">
          Canal de Venda:
        </h3>
        <div className="grid grid-cols-2 gap-2 mb-2">
          {["Ligação", "WhatsApp", "Sessão Estratégica", "Outro"].map(canal => (
            <button
              key={canal}
              onClick={() => setSelectedChannel(canal)}
              className={`px-3 py-2 rounded-md border-2 ${
                selectedChannel === canal
                  ? 'bg-primary text-white border-primary dark:bg-secondary dark:text-gray-900 dark:border-secondary'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600'
              }`}
            >
              {canal}
            </button>
          ))}
        </div>
        
        {channelError && (
          <div className="mb-4 p-2 rounded bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 text-sm">
            Por favor, selecione um canal de venda primeiro.
          </div>
        )}
      </div>
      
      {/* Seleção de Produto */}
      <div>
        <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-2">
          Produto:
        </h3>
        <div className="space-y-2">
          {products.map(product => (
            <button
              key={product}
              onClick={() => {
                if (selectedChannel) {
                  handleAddSale(product, selectedChannel);
                } else {
                  // Mostrar mensagem de erro ou destacar a seleção de canal
                  setChannelError(true);
                  setTimeout(() => setChannelError(false), 3000);
                }
              }}
              className="w-full py-2 px-4 bg-green-500 text-white rounded mb-2 hover:bg-green-600"
            >
              {product} - {formatCurrency(productValues[product] || 0)}
            </button>
          ))}
        </div>
      </div>
      
      <button
        onClick={() => {
          setShowAddSaleModal(false);
          setSelectedChannel(null);
        }}
        className="w-full mt-4 px-4 py-2 border rounded hover:bg-gray-100 dark:hover:bg-gray-700"
      >
        Cancelar
      </button>
    </div>
  </div>
)}

        {/* Modal Cancelar Venda */}
        {showCancelSaleModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-md w-full">
              <h2 className="text-xl font-bold text-text-light dark:text-text-dark mb-4">
                Cancelar Venda para {currentSeller?.name}
              </h2>
              <div className="space-y-2">
                {products.map((product) => (
                  <button
                    key={product}
                    onClick={() => handleCancelSale(product)}
                    disabled={
                      !currentSeller ||
                      !(currentSeller.salesCount?.[product] > 0)
                    }
                    className={`w-full py-2 px-4 rounded mb-2 ${
                      currentSeller && currentSeller.salesCount?.[product] > 0
                        ? 'bg-red-500 text-white hover:bg-red-600'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {product} ({currentSeller?.salesCount?.[product] || 0})
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowCancelSaleModal(false)}
                className="w-full mt-4 px-4 py-2 border rounded hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Modal de Confirmação para Remover Vendedor */}
        {showDeleteSellerModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-md w-full">
              <h2 className="text-xl font-bold text-text-light dark:text-text-dark mb-4">
                Remover Vendedor
              </h2>
              <p className="text-text-light dark:text-text-dark mb-6">
                Tem certeza que deseja remover{' '}
                <strong>{sellerToDelete?.name}</strong>? Esta ação não pode ser
                desfeita.
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowDeleteSellerModal(false)
                    setSellerToDelete(null)
                  }}
                  className="px-4 py-2 border rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteSeller}
                  className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                >
                  Confirmar Remoção
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Detalhes do Vendedor */}
        {showSellerDetailsModal && selectedSeller && (
          <SellerDetailsModal
            seller={selectedSeller}
            salesData={getSellerSales(selectedSeller.id)} // Certifique-se de que o nome da prop é 'salesData'
            products={products}
            onClose={() => setShowSellerDetailsModal(false)}
          />
        )}

        {/* Modal de Detalhes do Mês */}
        {showMonthDetailsModal && selectedYear && selectedMonth !== null && (
          <MonthDetailsModal
            year={selectedYear}
            month={selectedMonth}
            salesData={allSales}
            products={products}
            onClose={() => setShowMonthDetailsModal(false)}
          />
        )}
      </div>
    </div>
  )
}

export default CommercialDashboard
