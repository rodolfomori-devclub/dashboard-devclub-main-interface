import { useState, useEffect } from 'react';
import { FaSync, FaChartLine, FaSpinner } from 'react-icons/fa';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import leadScoringService from '../services/leadScoringService';
import { revenueService } from '../services/revenueService';


  function LeadScoringPage() {
    const [loading, setLoading] = useState(true);
    const [loadingProgress, setLoadingProgress] = useState(null);
  const [error, setError] = useState(null);

  const [allLaunchesData, setAllLaunchesData] = useState(null);
  const [processedData, setProcessedData] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  const [selectedFilter, setSelectedFilter] = useState('10');
  const [processingAll, setProcessingAll] = useState(false);
  const [showGenderBars, setShowGenderBars] = useState(false);
  const [showAgeBars, setShowAgeBars] = useState(false);
  // Estados para os novos gráficos
  const [showCurrentJobBars, setShowCurrentJobBars] = useState(false);
  const [showSalaryBars, setShowSalaryBars] = useState(false);
  const [showCreditCardBars, setShowCreditCardBars] = useState(false);
  const [showProgrammingStudyBars, setShowProgrammingStudyBars] = useState(false);
  const [showCollegeBars, setShowCollegeBars] = useState(false);
  const [showOnlineCourseBars, setShowOnlineCourseBars] = useState(false);
  const [showProgrammingInterestBars, setShowProgrammingInterestBars] = useState(false);
  const [showEventInterestBars, setShowEventInterestBars] = useState(false);
  const [showComputerBars, setShowComputerBars] = useState(false);
  const [showFaixaBars, setShowFaixaBars] = useState(false);
  
  // Estados para o gráfico de faturamento
  const [revenueData, setRevenueData] = useState(null);
  const [loadingRevenue, setLoadingRevenue] = useState(false);
  const [showRevenueBars, setShowRevenueBars] = useState(true);
  const [revenueProgress, setRevenueProgress] = useState(null);
  
  // Estados para o gráfico de tráfego
  const [showTrafficBars, setShowTrafficBars] = useState(false);
  


  const fetchData = async (limit = null) => {
    try {
      setLoading(true);
      setError(null);
      setLoadingProgress(null);
      
      // Busca os dados das planilhas (limitado ou todos)
      const allData = await leadScoringService.fetchAllLaunchesData((progress) => {
        setLoadingProgress(progress);
      }, limit);
      
      setAllLaunchesData(allData);
      
      // Processa os dados para gráficos
      const processed = leadScoringService.processDataForCharts(allData);
      
      setProcessedData(processed);
      
      setLastUpdate(new Date().toLocaleString('pt-BR'));
    } catch (err) {
      setError(err.message || 'Erro ao carregar dados');
      console.error('Erro ao buscar dados:', err);
    } finally {
      setLoading(false);
      setLoadingProgress(null);
    }
  };

  useEffect(() => {
    let mounted = true;
    
    const loadData = async () => {
      if (mounted) {
        await fetchData(10); // Carregar apenas os últimos 10 inicialmente
      }
    };
    
    loadData();
    
    return () => {
      mounted = false;
    };
  }, []);

  const handleRefresh = () => {
    leadScoringService.clearCache();
    fetchData();
  };

  // Função para buscar dados de faturamento
  const fetchRevenueData = async () => {
    try {
      setLoadingRevenue(true);
      setRevenueProgress(null);
      
      const launches = allLaunchesData.launches;
      const totalLaunches = launches.length;
      
      const revenueByLaunch = [];
      
      for (let i = 0; i < launches.length; i++) {
        const launch = launches[i];
        const launchName = launch['Lançamento'];
        
        // Atualizar progresso
        setRevenueProgress({
          current: i + 1,
          total: totalLaunches,
          launchName: launchName,
          percentage: Math.round(((i + 1) / totalLaunches) * 100)
        });
        
        try {
          // Buscar faturamento para este lançamento
          const revenue = await revenueService.getRevenueByLaunch([launch]);
          if (revenue && revenue.length > 0) {
            revenueByLaunch.push(revenue[0]);
          }
        } catch {
          // Erro silencioso para produção
        }
        
        // Pequena pausa para não sobrecarregar as APIs
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Ordenar por número do LF (mais antigo primeiro)
      const sortedRevenueData = revenueByLaunch.sort((a, b) => {
        const getNum = (name) => {
          const match = name.match(/(\d+)/);
          return match ? parseInt(match[1]) : 0;
        };
        const numA = getNum(a.launch);
        const numB = getNum(b.launch);
        return numA - numB; // Ordem crescente: mais antigo primeiro
      });
      setRevenueData(sortedRevenueData);
      
    } catch (error) {
      console.error('Erro ao buscar dados de faturamento:', error);
    } finally {
      setLoadingRevenue(false);
      setRevenueProgress(null);
    }
  };

  // Função para aplicar filtro de quantidade
  const handleFilterChange = async (filter) => {
    setSelectedFilter(filter);
    
    // Se for "todos", buscar todos os dados primeiro
    if (filter === 'todos') {
      setProcessingAll(true);
      await fetchData(null); // null = sem limite, buscar todos
      setProcessingAll(false);
      return;
    }
    
    // Se for "10" e já temos dados carregados, apenas aplicar o filtro
    if (allLaunchesData) {
      // Primeiro: filtrar apenas lançamentos com dados válidos de gênero OU idade
      let validLaunches = allLaunchesData.launches.filter(launch => {
        const hasValidGenderData = leadScoringService.hasValidGenderData(launch);
        const hasValidAgeData = leadScoringService.hasValidAgeData(launch);
        const hasValidData = hasValidGenderData || hasValidAgeData;
        return hasValidData;
      });
      
      // Segundo: aplicar filtro de quantidade nos lançamentos válidos
      let filteredLaunches = [...validLaunches];
      
      const count = parseInt(filter);
      
      // Ordenar por número do LF (maior = mais recente)
      filteredLaunches.sort((a, b) => {
        const getNum = (name) => {
          const match = name.match(/(\d+)/);
          return match ? parseInt(match[1]) : 0;
        };
        const numA = getNum(a['Lançamento']);
        const numB = getNum(b['Lançamento']);
        return numB - numA;
      });
      
      filteredLaunches = filteredLaunches.slice(0, count);
      
      // Criar novo objeto com dados filtrados
      const filteredData = {
        ...allLaunchesData,
        launches: filteredLaunches,
        totalLaunches: filteredLaunches.length
      };
      
      // Processar dados filtrados para gráficos
      const processed = leadScoringService.processDataForCharts(filteredData);
      
      setProcessedData(processed);
    }
  };

  if ((loading && !allLaunchesData) || processingAll) {
    return (
      <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-text-light dark:text-text-dark mb-2">
            {processingAll ? 'Processando todos os lançamentos...' : 'Carregando dados...'}
          </p>
          {loadingProgress && (
            <div className="text-sm text-gray-500 dark:text-gray-400">
              <p>Processando: {loadingProgress.launchName}</p>
              <p>{loadingProgress.current} de {loadingProgress.total} lançamentos</p>
              <div className="w-64 bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-2 mx-auto">
                <div 
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(loadingProgress.current / loadingProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-text-light dark:text-text-dark flex items-center">
              <FaChartLine className="mr-3" />
              Lead Scoring
            </h1>
            <div className="flex gap-2">
              <button
                onClick={handleRefresh}
                className="flex items-center px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark transition-colors"
                disabled={loading}
              >
                {loading ? (
                  <FaSpinner className="mr-2 animate-spin" />
                ) : (
                  <FaSync className="mr-2" />
                )}
                Atualizar
              </button>
            </div>
          </div>
          {lastUpdate && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              Última atualização: {lastUpdate}
            </p>
          )}
        </div>

        {error && (
          <div className="bg-red-100 dark:bg-red-900/20 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-400 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}



        {/* Filtros de Quantidade */}
        {allLaunchesData && (
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6">
            <h2 className="text-xl font-semibold mb-4 text-text-light dark:text-text-dark">
              Filtros
            </h2>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Filtrar lançamentos:
                </span>
                <div className="flex gap-2">
                  {['3', '5', '7', '10', 'todos'].map((filter) => (
                    <button
                      key={filter}
                      onClick={() => handleFilterChange(filter)}
                      className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                        selectedFilter === filter
                          ? 'bg-primary text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {filter === 'todos' ? 'Todos' : `Últimos ${filter}`}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {(() => {
                  const validLaunches = allLaunchesData.launches.filter(launch => 
                    leadScoringService.hasValidGenderData(launch) || leadScoringService.hasValidAgeData(launch)
                  ).length;
                  
                  if (selectedFilter === 'todos') {
                    return `${validLaunches} lançamentos com dados válidos`;
                  } else {
                    const count = parseInt(selectedFilter);
                    const actualCount = Math.min(count, validLaunches);
                    return `${actualCount} de ${validLaunches} lançamentos válidos`;
                  }
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Resumo dos Dados */}
        {processedData && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total de Leads</h3>
              <p className="text-2xl font-bold text-text-light dark:text-text-dark">
                {processedData.totalLeads.toLocaleString('pt-BR')}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total de Lançamentos</h3>
              <p className="text-2xl font-bold text-text-light dark:text-text-dark">
                {allLaunchesData?.totalLaunches || 0}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Média por Lançamento</h3>
              <p className="text-2xl font-bold text-text-light dark:text-text-dark">
                {allLaunchesData?.totalLaunches 
                  ? Math.round(processedData.totalLeads / allLaunchesData.totalLaunches).toLocaleString('pt-BR')
                  : 0}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Planilhas com Erro</h3>
              <p className="text-2xl font-bold text-text-light dark:text-text-dark">
                {allLaunchesData?.errors?.length || 0}
              </p>
            </div>
          </div>
        )}

        {/* Gráfico de Faixa de Lead Scoring - PRIMEIRO GRÁFICO */}
        {processedData && processedData.faixaByLaunch && processedData.faixaByLaunch.length > 0 && (
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-text-light dark:text-text-dark">
                Distribuição por Faixa de Lead Scoring
              </h2>
              <button
                onClick={() => setShowFaixaBars(!showFaixaBars)}
                className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark transition-colors text-sm font-medium"
              >
                {showFaixaBars ? 'LINHAS' : 'BARRAS'}
              </button>
            </div>
            <ResponsiveContainer width="100%" height={400}>
              {showFaixaBars ? (
                <BarChart data={processedData.faixaByLaunch} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} angle={-45} textAnchor="end" height={100} />
                  <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                  <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }} formatter={(value) => `${value}%`} />
                  <Legend />
                  {Object.keys(processedData.faixaByLaunch[0]).filter(key => key !== 'name' && key !== 'totalLeads').map((key, idx) => {
                    // Definir cores específicas para cada faixa
                    let color = `hsl(${idx * 40}, 70%, 50%)`;
                    if (key.includes('A') || key.toUpperCase().includes('A')) {
                      color = '#37E359'; // Verde forte
                    } else if (key.includes('B') || key.toUpperCase().includes('B')) {
                      color = '#4CAF50'; // Verde médio
                    } else if (key.includes('C') || key.toUpperCase().includes('C')) {
                      color = '#FFC107'; // Amarelo
                    } else if (key.includes('D') || key.toUpperCase().includes('D')) {
                      color = '#FF5722'; // Laranja/vermelho
                    } else if (key.includes('E') || key.toUpperCase().includes('E')) {
                      color = '#F44336'; // Vermelho
                    }
                    
                    return (
                      <Bar key={key} dataKey={key} fill={color} name={key} stackId="a" />
                    );
                  })}
                </BarChart>
              ) : (
                <LineChart data={processedData.faixaByLaunch} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} angle={-45} textAnchor="end" height={100} />
                  <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                  <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }} formatter={(value) => `${value}%`} />
                  <Legend />
                  {Object.keys(processedData.faixaByLaunch[0]).filter(key => key !== 'name' && key !== 'totalLeads').map((key, idx) => {
                    // Definir cores específicas para cada faixa
                    let color = `hsl(${idx * 40}, 70%, 50%)`;
                    if (key.includes('A') || key.toUpperCase().includes('A')) {
                      color = '#37E359'; // Verde forte
                    } else if (key.includes('B') || key.toUpperCase().includes('B')) {
                      color = '#4CAF50'; // Verde médio
                    } else if (key.includes('C') || key.toUpperCase().includes('C')) {
                      color = '#FFC107'; // Amarelo
                    } else if (key.includes('D') || key.toUpperCase().includes('D')) {
                      color = '#FF5722'; // Laranja/vermelho
                    } else if (key.includes('E') || key.toUpperCase().includes('E')) {
                      color = '#F44336'; // Vermelho
                    }
                    
                    return (
                      <Line key={key} type="monotone" dataKey={key} stroke={color} strokeWidth={3} dot={{ fill: color, r: 3 }} name={key} />
                    );
                  })}
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        )}

        {/* Gráfico de Faturamento por LF */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-text-light dark:text-text-dark">
              Faturamento por Lançamento
            </h2>
            <div className="flex gap-2">
              <button
                onClick={fetchRevenueData}
                disabled={loadingRevenue}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm font-medium disabled:opacity-50"
              >
                {loadingRevenue ? (
                  <FaSpinner className="animate-spin" />
                ) : (
                  '💰 Buscar Faturamento'
                )}
              </button>
              <button
                onClick={() => setShowRevenueBars(!showRevenueBars)}
                className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark transition-colors text-sm font-medium"
              >
                {showRevenueBars ? 'LINHAS' : 'BARRAS'}
              </button>
            </div>
          </div>
          
          {loadingRevenue && (
            <div className="text-center py-8">
              <FaSpinner className="animate-spin text-4xl text-primary mx-auto mb-4" />
              <p className="text-text-light dark:text-text-dark">Buscando dados de faturamento...</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                Isso pode levar alguns minutos dependendo do número de lançamentos
              </p>
              
              {revenueProgress && (
                <div className="mt-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    Processando: {revenueProgress.launchName}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    {revenueProgress.current} de {revenueProgress.total} lançamentos ({revenueProgress.percentage}%)
                  </p>
                  <div className="w-64 bg-gray-200 dark:bg-gray-700 rounded-full h-3 mt-2 mx-auto">
                    <div 
                      className="bg-green-600 h-3 rounded-full transition-all duration-300"
                      style={{ width: `${revenueProgress.percentage}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
          
          {!loadingRevenue && revenueData && revenueData.length > 0 && (
            <ResponsiveContainer width="100%" height={400}>
              {showRevenueBars ? (
                <BarChart data={revenueData} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis 
                    dataKey="launch" 
                    stroke="#9CA3AF" 
                    tick={{ fill: '#9CA3AF' }} 
                    angle={-45} 
                    textAnchor="end" 
                    height={100} 
                  />
                  <YAxis 
                    stroke="#9CA3AF" 
                    tick={{ fill: '#9CA3AF' }}
                    tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1F2937', 
                      border: 'none',
                      borderRadius: '8px'
                    }}
                    formatter={(value, name) => [
                      revenueService.formatCurrency(value),
                      name === 'cardRevenue' ? 'Cartão (GURU)' : 
                      name === 'boletoRevenue' ? 'Boleto (TMB)' : 
                      name === 'revenue' ? 'Total' : name
                    ]}
                    labelFormatter={(label) => `LF: ${label}`}
                  />
                  <Legend />
                  <Bar 
                    dataKey="cardRevenue" 
                    fill="#3B82F6" 
                    name="Cartão (GURU)"
                    stackId="a"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar 
                    dataKey="boletoRevenue" 
                    fill="#F59E0B" 
                    name="Boleto (TMB)"
                    stackId="a"
                    radius={[0, 0, 4, 4]}
                  />
                </BarChart>
              ) : (
                <LineChart data={revenueData} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis 
                    dataKey="launch" 
                    stroke="#9CA3AF" 
                    tick={{ fill: '#9CA3AF' }} 
                    angle={-45} 
                    textAnchor="end" 
                    height={100} 
                  />
                  <YAxis 
                    stroke="#9CA3AF" 
                    tick={{ fill: '#9CA3AF' }}
                    tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1F2937', 
                      border: 'none',
                      borderRadius: '8px'
                    }}
                    formatter={(value, name) => [
                      revenueService.formatCurrency(value),
                      name === 'cardRevenue' ? 'Cartão (GURU)' : 
                      name === 'boletoRevenue' ? 'Boleto (TMB)' : 
                      name === 'revenue' ? 'Total' : name
                    ]}
                    labelFormatter={(label) => `LF: ${label}`}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="cardRevenue" 
                    stroke="#3B82F6" 
                    strokeWidth={3}
                    dot={{ fill: '#3B82F6', r: 4 }}
                    name="Cartão (GURU)"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="boletoRevenue" 
                    stroke="#F59E0B" 
                    strokeWidth={3}
                    dot={{ fill: '#F59E0B', r: 4 }}
                    name="Boleto (TMB)"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="#10B981" 
                    strokeWidth={3}
                    dot={{ fill: '#10B981', r: 4 }}
                    name="Total"
                  />
                </LineChart>
              )}
            </ResponsiveContainer>
          )}
          
          {!loadingRevenue && (!revenueData || revenueData.length === 0) && (
            <div className="text-center py-8">
              <p className="text-text-light dark:text-text-dark mb-4">
                Clique em "💰 Buscar Faturamento" para carregar os dados de faturamento por lançamento
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Os dados serão buscados usando as datas de abertura e fechamento de cada LF
              </p>
            </div>
          )}
        </div>

        {/* Gráfico de Gasto em Tráfego por LF */}
        {processedData && processedData.trafficByLaunch && processedData.trafficByLaunch.length > 0 && (
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-text-light dark:text-text-dark">
                Gasto em Tráfego por Lançamento
              </h2>
              <button
                onClick={() => setShowTrafficBars(!showTrafficBars)}
                className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark transition-colors text-sm font-medium"
              >
                {showTrafficBars ? 'LINHAS' : 'BARRAS'}
              </button>
            </div>
            <ResponsiveContainer width="100%" height={400}>
              {showTrafficBars ? (
                <BarChart data={processedData.trafficByLaunch} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis 
                    dataKey="name" 
                    stroke="#9CA3AF" 
                    tick={{ fill: '#9CA3AF' }} 
                    angle={-45} 
                    textAnchor="end" 
                    height={100} 
                  />
                  <YAxis 
                    stroke="#9CA3AF" 
                    tick={{ fill: '#9CA3AF' }}
                    tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1F2937', 
                      border: 'none',
                      borderRadius: '8px'
                    }}
                    formatter={(value) => [revenueService.formatCurrency(value), 'Gasto em Tráfego']}
                  />
                  <Legend />
                  <Bar 
                    dataKey="traffic" 
                    fill="#8B5CF6" 
                    name="Gasto em Tráfego"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              ) : (
                <LineChart data={processedData.trafficByLaunch} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis 
                    dataKey="name" 
                    stroke="#9CA3AF" 
                    tick={{ fill: '#9CA3AF' }} 
                    angle={-45} 
                    textAnchor="end" 
                    height={100} 
                  />
                  <YAxis 
                    stroke="#9CA3AF" 
                    tick={{ fill: '#9CA3AF' }}
                    tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1F2937', 
                      border: 'none',
                      borderRadius: '8px'
                    }}
                    formatter={(value) => [revenueService.formatCurrency(value), 'Gasto em Tráfego']}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="traffic" 
                    stroke="#8B5CF6" 
                    strokeWidth={3}
                    dot={{ fill: '#8B5CF6', r: 4 }}
                    name="Gasto em Tráfego"
                  />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        )}

        {/* Gráfico de Gênero por Lançamento */}
        {processedData && processedData.genderByLaunch && processedData.genderByLaunch.length > 0 && (
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-text-light dark:text-text-dark">
                Distribuição por Gênero
              </h2>
              <button
                onClick={() => setShowGenderBars(!showGenderBars)}
                className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark transition-colors text-sm font-medium"
              >
                {showGenderBars ? 'LINHAS' : 'BARRAS'}
              </button>
            </div>
            <ResponsiveContainer width="100%" height={400}>
              {showGenderBars ? (
                <BarChart 
                  data={processedData.genderByLaunch}
                  margin={{ top: 5, right: 30, left: 20, bottom: 60 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis 
                    dataKey="name" 
                    stroke="#9CA3AF"
                    tick={{ fill: '#9CA3AF' }}
                    angle={-45}
                    textAnchor="end"
                    height={100}
                  />
                  <YAxis 
                    stroke="#9CA3AF"
                    tick={{ fill: '#9CA3AF' }}
                    domain={[0, 100]}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1F2937', 
                      border: 'none',
                      borderRadius: '8px'
                    }}
                    formatter={(value) => `${value}%`}
                  />
                  <Legend />
                  <Bar 
                    dataKey="masculino" 
                    fill="#3B82F6" 
                    name="Masculino"
                    stackId="a"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar 
                    dataKey="feminino" 
                    fill="#EF4444" 
                    name="Feminino"
                    stackId="a"
                    radius={[0, 0, 4, 4]}
                  />
                </BarChart>
              ) : (
                <LineChart 
                  data={processedData.genderByLaunch}
                  margin={{ top: 5, right: 30, left: 20, bottom: 60 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis 
                    dataKey="name" 
                    stroke="#9CA3AF"
                    tick={{ fill: '#9CA3AF' }}
                    angle={-45}
                    textAnchor="end"
                    height={100}
                  />
                  <YAxis 
                    stroke="#9CA3AF"
                    tick={{ fill: '#9CA3AF' }}
                    domain={[0, 100]}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1F2937', 
                      border: 'none',
                      borderRadius: '8px'
                    }}
                    formatter={(value) => `${value}%`}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="masculino" 
                    stroke="#3B82F6" 
                    strokeWidth={3}
                    dot={{ fill: '#3B82F6', r: 3 }}
                    name="Masculino"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="feminino" 
                    stroke="#EF4444" 
                    strokeWidth={3}
                    dot={{ fill: '#EF4444', r: 3 }}
                    name="Feminino"
                  />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        )}

        {/* Gráfico de Idade por Lançamento */}
        {processedData && processedData.ageByLaunch && processedData.ageByLaunch.length > 0 && (
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-text-light dark:text-text-dark">
                Distribuição por Idade
              </h2>
              <button
                onClick={() => setShowAgeBars(!showAgeBars)}
                className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark transition-colors text-sm font-medium"
              >
                {showAgeBars ? 'LINHAS' : 'BARRAS'}
              </button>
            </div>
            <ResponsiveContainer width="100%" height={400}>
              {showAgeBars ? (
                <BarChart 
                  data={processedData.ageByLaunch}
                  margin={{ top: 5, right: 30, left: 20, bottom: 60 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis 
                    dataKey="name" 
                    stroke="#9CA3AF"
                    tick={{ fill: '#9CA3AF' }}
                    angle={-45}
                    textAnchor="end"
                    height={100}
                  />
                  <YAxis 
                    stroke="#9CA3AF"
                    tick={{ fill: '#9CA3AF' }}
                    domain={[0, 100]}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1F2937', 
                      border: 'none',
                      borderRadius: '8px'
                    }}
                    formatter={(value) => `${value}%`}
                  />
                  <Legend />
                  <Bar 
                    dataKey="18-24" 
                    fill="#10B981" 
                    name="18-24 anos"
                    stackId="a"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar 
                    dataKey="25-34" 
                    fill="#F59E0B" 
                    name="25-34 anos"
                    stackId="a"
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar 
                    dataKey="35-44" 
                    fill="#8B5CF6" 
                    name="35-44 anos"
                    stackId="a"
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar 
                    dataKey="45-54" 
                    fill="#EC4899" 
                    name="45-54 anos"
                    stackId="a"
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar 
                    dataKey="55+" 
                    fill="#6B7280" 
                    name="55+ anos"
                    stackId="a"
                    radius={[0, 0, 4, 4]}
                  />
                </BarChart>
              ) : (
                <LineChart 
                  data={processedData.ageByLaunch}
                  margin={{ top: 5, right: 30, left: 20, bottom: 60 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis 
                    dataKey="name" 
                    stroke="#9CA3AF"
                    tick={{ fill: '#9CA3AF' }}
                    angle={-45}
                    textAnchor="end"
                    height={100}
                  />
                  <YAxis 
                    stroke="#9CA3AF"
                    tick={{ fill: '#9CA3AF' }}
                    domain={[0, 100]}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1F2937', 
                      border: 'none',
                      borderRadius: '8px'
                    }}
                    formatter={(value) => `${value}%`}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="18-24" 
                    stroke="#10B981" 
                    strokeWidth={3}
                    dot={{ fill: '#10B981', r: 3 }}
                    name="18-24 anos"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="25-34" 
                    stroke="#F59E0B" 
                    strokeWidth={3}
                    dot={{ fill: '#F59E0B', r: 3 }}
                    name="25-34 anos"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="35-44" 
                    stroke="#8B5CF6" 
                    strokeWidth={3}
                    dot={{ fill: '#8B5CF6', r: 3 }}
                    name="35-44 anos"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="45-54" 
                    stroke="#EC4899" 
                    strokeWidth={3}
                    dot={{ fill: '#EC4899', r: 3 }}
                    name="45-54 anos"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="55+" 
                    stroke="#6B7280" 
                    strokeWidth={3}
                    dot={{ fill: '#6B7280', r: 3 }}
                    name="55+ anos"
                  />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        )}

        {/* NOVOS GRÁFICOS - PROFISSÃO ATUAL */}
        {processedData && processedData.currentJobByLaunch && processedData.currentJobByLaunch.length > 0 && (
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-text-light dark:text-text-dark">
                O que você faz atualmente?
              </h2>
              <button
                onClick={() => setShowCurrentJobBars(!showCurrentJobBars)}
                className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark transition-colors text-sm font-medium"
              >
                {showCurrentJobBars ? 'LINHAS' : 'BARRAS'}
              </button>
            </div>
            <ResponsiveContainer width="100%" height={400}>
              {showCurrentJobBars ? (
                <BarChart data={processedData.currentJobByLaunch} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} angle={-45} textAnchor="end" height={100} />
                  <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                  <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }} formatter={(value) => `${value}%`} />
                  <Legend />
                  {Object.keys(processedData.currentJobByLaunch[0]).filter(key => key !== 'name' && key !== 'totalLeads').map((key, idx) => (
                    <Bar key={key} dataKey={key} fill={`hsl(${idx * 40}, 70%, 50%)`} name={key} stackId="a" />
                  ))}
                </BarChart>
              ) : (
                <LineChart data={processedData.currentJobByLaunch} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} angle={-45} textAnchor="end" height={100} />
                  <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                  <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }} formatter={(value) => `${value}%`} />
                  <Legend />
                  {Object.keys(processedData.currentJobByLaunch[0]).filter(key => key !== 'name' && key !== 'totalLeads').map((key, idx) => (
                    <Line key={key} type="monotone" dataKey={key} stroke={`hsl(${idx * 40}, 70%, 50%)`} strokeWidth={3} dot={{ fill: `hsl(${idx * 40}, 70%, 50%)`, r: 3 }} name={key} />
                  ))}
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        )}

        {/* NOVOS GRÁFICOS - FAIXA SALARIAL */}
        {processedData && processedData.salaryRangeByLaunch && processedData.salaryRangeByLaunch.length > 0 && (
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-text-light dark:text-text-dark">
                Faixa Salarial
              </h2>
              <button
                onClick={() => setShowSalaryBars(!showSalaryBars)}
                className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark transition-colors text-sm font-medium"
              >
                {showSalaryBars ? 'LINHAS' : 'BARRAS'}
              </button>
            </div>
            <ResponsiveContainer width="100%" height={400}>
              {showSalaryBars ? (
                <BarChart data={processedData.salaryRangeByLaunch} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} angle={-45} textAnchor="end" height={100} />
                  <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                  <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }} formatter={(value) => `${value}%`} />
                  <Legend />
                  {Object.keys(processedData.salaryRangeByLaunch[0]).filter(key => key !== 'name' && key !== 'totalLeads').map((key, idx) => (
                    <Bar key={key} dataKey={key} fill={`hsl(${idx * 40}, 70%, 50%)`} name={key} stackId="a" />
                  ))}
                </BarChart>
              ) : (
                <LineChart data={processedData.salaryRangeByLaunch} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} angle={-45} textAnchor="end" height={100} />
                  <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                  <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }} formatter={(value) => `${value}%`} />
                  <Legend />
                  {Object.keys(processedData.salaryRangeByLaunch[0]).filter(key => key !== 'name' && key !== 'totalLeads').map((key, idx) => (
                    <Line key={key} type="monotone" dataKey={key} stroke={`hsl(${idx * 40}, 70%, 50%)`} strokeWidth={3} dot={{ fill: `hsl(${idx * 40}, 70%, 50%)`, r: 3 }} name={key} />
                  ))}
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        )}

        {/* NOVOS GRÁFICOS - CARTÃO DE CRÉDITO */}
        {processedData && processedData.creditCardByLaunch && processedData.creditCardByLaunch.length > 0 && (
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-text-light dark:text-text-dark">
                Possui Cartão de Crédito?
              </h2>
              <button
                onClick={() => setShowCreditCardBars(!showCreditCardBars)}
                className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark transition-colors text-sm font-medium"
              >
                {showCreditCardBars ? 'LINHAS' : 'BARRAS'}
              </button>
            </div>
            <ResponsiveContainer width="100%" height={400}>
              {showCreditCardBars ? (
                <BarChart data={processedData.creditCardByLaunch} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} angle={-45} textAnchor="end" height={100} />
                  <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                  <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }} formatter={(value) => `${value}%`} />
                  <Legend />
                  {Object.keys(processedData.creditCardByLaunch[0]).filter(key => key !== 'name' && key !== 'totalLeads').map((key, idx) => (
                    <Bar key={key} dataKey={key} fill={`hsl(${idx * 40}, 70%, 50%)`} name={key} stackId="a" />
                  ))}
                </BarChart>
              ) : (
                <LineChart data={processedData.creditCardByLaunch} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} angle={-45} textAnchor="end" height={100} />
                  <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                  <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }} formatter={(value) => `${value}%`} />
                  <Legend />
                  {Object.keys(processedData.creditCardByLaunch[0]).filter(key => key !== 'name' && key !== 'totalLeads').map((key, idx) => (
                    <Line key={key} type="monotone" dataKey={key} stroke={`hsl(${idx * 40}, 70%, 50%)`} strokeWidth={3} dot={{ fill: `hsl(${idx * 40}, 70%, 50%)`, r: 3 }} name={key} />
                  ))}
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        )}

        {/* NOVOS GRÁFICOS - JÁ ESTUDOU PROGRAMAÇÃO */}
        {processedData && processedData.programmingStudyByLaunch && processedData.programmingStudyByLaunch.length > 0 && (
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-text-light dark:text-text-dark">
                Já estudou programação?
              </h2>
              <button
                onClick={() => setShowProgrammingStudyBars(!showProgrammingStudyBars)}
                className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark transition-colors text-sm font-medium"
              >
                {showProgrammingStudyBars ? 'LINHAS' : 'BARRAS'}
              </button>
            </div>
            <ResponsiveContainer width="100%" height={400}>
              {showProgrammingStudyBars ? (
                <BarChart data={processedData.programmingStudyByLaunch} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} angle={-45} textAnchor="end" height={100} />
                  <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                  <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }} formatter={(value) => `${value}%`} />
                  <Legend />
                  {Object.keys(processedData.programmingStudyByLaunch[0]).filter(key => key !== 'name' && key !== 'totalLeads').map((key, idx) => (
                    <Bar key={key} dataKey={key} fill={`hsl(${idx * 40}, 70%, 50%)`} name={key} stackId="a" />
                  ))}
                </BarChart>
              ) : (
                <LineChart data={processedData.programmingStudyByLaunch} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} angle={-45} textAnchor="end" height={100} />
                  <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                  <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }} formatter={(value) => `${value}%`} />
                  <Legend />
                  {Object.keys(processedData.programmingStudyByLaunch[0]).filter(key => key !== 'name' && key !== 'totalLeads').map((key, idx) => (
                    <Line key={key} type="monotone" dataKey={key} stroke={`hsl(${idx * 40}, 70%, 50%)`} strokeWidth={3} dot={{ fill: `hsl(${idx * 40}, 70%, 50%)`, r: 3 }} name={key} />
                  ))}
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        )}

        {/* NOVOS GRÁFICOS - FACULDADE */}
        {processedData && processedData.collegeByLaunch && processedData.collegeByLaunch.length > 0 && (
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-text-light dark:text-text-dark">
                Já fez/faz/pretende fazer faculdade?
              </h2>
              <button
                onClick={() => setShowCollegeBars(!showCollegeBars)}
                className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark transition-colors text-sm font-medium"
              >
                {showCollegeBars ? 'LINHAS' : 'BARRAS'}
              </button>
            </div>
            <ResponsiveContainer width="100%" height={400}>
              {showCollegeBars ? (
                <BarChart data={processedData.collegeByLaunch} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} angle={-45} textAnchor="end" height={100} />
                  <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                  <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }} formatter={(value) => `${value}%`} />
                  <Legend />
                  {Object.keys(processedData.collegeByLaunch[0]).filter(key => key !== 'name' && key !== 'totalLeads').map((key, idx) => (
                    <Bar key={key} dataKey={key} fill={`hsl(${idx * 40}, 70%, 50%)`} name={key} stackId="a" />
                  ))}
                </BarChart>
              ) : (
                <LineChart data={processedData.collegeByLaunch} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} angle={-45} textAnchor="end" height={100} />
                  <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                  <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }} formatter={(value) => `${value}%`} />
                  <Legend />
                  {Object.keys(processedData.collegeByLaunch[0]).filter(key => key !== 'name' && key !== 'totalLeads').map((key, idx) => (
                    <Line key={key} type="monotone" dataKey={key} stroke={`hsl(${idx * 40}, 70%, 50%)`} strokeWidth={3} dot={{ fill: `hsl(${idx * 40}, 70%, 50%)`, r: 3 }} name={key} />
                  ))}
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        )}

        {/* NOVOS GRÁFICOS - CURSO ONLINE */}
        {processedData && processedData.onlineCourseByLaunch && processedData.onlineCourseByLaunch.length > 0 && (
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-text-light dark:text-text-dark">
                Já investiu em curso online?
              </h2>
              <button
                onClick={() => setShowOnlineCourseBars(!showOnlineCourseBars)}
                className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark transition-colors text-sm font-medium"
              >
                {showOnlineCourseBars ? 'LINHAS' : 'BARRAS'}
              </button>
            </div>
            <ResponsiveContainer width="100%" height={400}>
              {showOnlineCourseBars ? (
                <BarChart data={processedData.onlineCourseByLaunch} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} angle={-45} textAnchor="end" height={100} />
                  <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                  <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }} formatter={(value) => `${value}%`} />
                  <Legend />
                  {Object.keys(processedData.onlineCourseByLaunch[0]).filter(key => key !== 'name' && key !== 'totalLeads').map((key, idx) => (
                    <Bar key={key} dataKey={key} fill={`hsl(${idx * 40}, 70%, 50%)`} name={key} stackId="a" />
                  ))}
                </BarChart>
              ) : (
                <LineChart data={processedData.onlineCourseByLaunch} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} angle={-45} textAnchor="end" height={100} />
                  <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                  <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }} formatter={(value) => `${value}%`} />
                  <Legend />
                  {Object.keys(processedData.onlineCourseByLaunch[0]).filter(key => key !== 'name' && key !== 'totalLeads').map((key, idx) => (
                    <Line key={key} type="monotone" dataKey={key} stroke={`hsl(${idx * 40}, 70%, 50%)`} strokeWidth={3} dot={{ fill: `hsl(${idx * 40}, 70%, 50%)`, r: 3 }} name={key} />
                  ))}
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        )}

        {/* NOVOS GRÁFICOS - INTERESSE NA PROFISSÃO DE PROGRAMADOR */}
        {processedData && processedData.programmingInterestByLaunch && processedData.programmingInterestByLaunch.length > 0 && (
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-text-light dark:text-text-dark">
                O que mais te chama atenção na profissão de Programador?
              </h2>
              <button
                onClick={() => setShowProgrammingInterestBars(!showProgrammingInterestBars)}
                className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark transition-colors text-sm font-medium"
              >
                {showProgrammingInterestBars ? 'LINHAS' : 'BARRAS'}
              </button>
            </div>
            <ResponsiveContainer width="100%" height={400}>
              {showProgrammingInterestBars ? (
                <BarChart data={processedData.programmingInterestByLaunch} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} angle={-45} textAnchor="end" height={100} />
                  <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                  <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }} formatter={(value) => `${value}%`} />
                  <Legend />
                  {Object.keys(processedData.programmingInterestByLaunch[0]).filter(key => key !== 'name' && key !== 'totalLeads').map((key, idx) => (
                    <Bar key={key} dataKey={key} fill={`hsl(${idx * 40}, 70%, 50%)`} name={key} stackId="a" />
                  ))}
                </BarChart>
              ) : (
                <LineChart data={processedData.programmingInterestByLaunch} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} angle={-45} textAnchor="end" height={100} />
                  <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                  <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }} formatter={(value) => `${value}%`} />
                  <Legend />
                  {Object.keys(processedData.programmingInterestByLaunch[0]).filter(key => key !== 'name' && key !== 'totalLeads').map((key, idx) => (
                    <Line key={key} type="monotone" dataKey={key} stroke={`hsl(${idx * 40}, 70%, 50%)`} strokeWidth={3} dot={{ fill: `hsl(${idx * 40}, 70%, 50%)`, r: 3 }} name={key} />
                  ))}
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        )}

        {/* NOVOS GRÁFICOS - INTERESSE NO EVENTO */}
        {processedData && processedData.eventInterestByLaunch && processedData.eventInterestByLaunch.length > 0 && (
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-text-light dark:text-text-dark">
                O que mais você quer ver no evento?
              </h2>
              <button
                onClick={() => setShowEventInterestBars(!showEventInterestBars)}
                className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark transition-colors text-sm font-medium"
              >
                {showEventInterestBars ? 'LINHAS' : 'BARRAS'}
              </button>
            </div>
            <ResponsiveContainer width="100%" height={400}>
              {showEventInterestBars ? (
                <BarChart data={processedData.eventInterestByLaunch} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} angle={-45} textAnchor="end" height={100} />
                  <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                  <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }} formatter={(value) => `${value}%`} />
                  <Legend />
                  {Object.keys(processedData.eventInterestByLaunch[0]).filter(key => key !== 'name' && key !== 'totalLeads').map((key, idx) => (
                    <Bar key={key} dataKey={key} fill={`hsl(${idx * 40}, 70%, 50%)`} name={key} stackId="a" />
                  ))}
                </BarChart>
              ) : (
                <LineChart data={processedData.eventInterestByLaunch} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} angle={-45} textAnchor="end" height={100} />
                  <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                  <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }} formatter={(value) => `${value}%`} />
                  <Legend />
                  {Object.keys(processedData.eventInterestByLaunch[0]).filter(key => key !== 'name' && key !== 'totalLeads').map((key, idx) => (
                    <Line key={key} type="monotone" dataKey={key} stroke={`hsl(${idx * 40}, 70%, 50%)`} strokeWidth={3} dot={{ fill: `hsl(${idx * 40}, 70%, 50%)`, r: 3 }} name={key} />
                  ))}
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        )}

        {/* NOVOS GRÁFICOS - TEM COMPUTADOR/NOTEBOOK */}
        {processedData && processedData.computerByLaunch && processedData.computerByLaunch.length > 0 && (
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-text-light dark:text-text-dark">
                Tem computador/notebook?
              </h2>
              <button
                onClick={() => setShowComputerBars(!showComputerBars)}
                className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark transition-colors text-sm font-medium"
              >
                {showComputerBars ? 'LINHAS' : 'BARRAS'}
              </button>
            </div>
            <ResponsiveContainer width="100%" height={400}>
              {showComputerBars ? (
                <BarChart data={processedData.computerByLaunch} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} angle={-45} textAnchor="end" height={100} />
                  <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                  <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }} formatter={(value) => `${value}%`} />
                  <Legend />
                  {Object.keys(processedData.computerByLaunch[0]).filter(key => key !== 'name' && key !== 'totalLeads').map((key, idx) => (
                    <Bar key={key} dataKey={key} fill={`hsl(${idx * 40}, 70%, 50%)`} name={key} stackId="a" />
                  ))}
                </BarChart>
              ) : (
                <LineChart data={processedData.computerByLaunch} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} angle={-45} textAnchor="end" height={100} />
                  <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                  <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }} formatter={(value) => `${value}%`} />
                  <Legend />
                  {Object.keys(processedData.computerByLaunch[0]).filter(key => key !== 'name' && key !== 'totalLeads').map((key, idx) => (
                    <Line key={key} type="monotone" dataKey={key} stroke={`hsl(${idx * 40}, 70%, 50%)`} strokeWidth={3} dot={{ fill: `hsl(${idx * 40}, 70%, 50%)`, r: 3 }} name={key} />
                  ))}
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        )}

        {/* NOVOS GRÁFICOS - FATURAMENTO POR LF */}
        {processedData && processedData.revenueByLaunch && processedData.revenueByLaunch.length > 0 && (
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-text-light dark:text-text-dark">
                Faturamento por Lançamento
              </h2>
              <button
                onClick={() => setShowFaixaBars(!showFaixaBars)}
                className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark transition-colors text-sm font-medium"
              >
                {showFaixaBars ? 'LINHAS' : 'BARRAS'}
              </button>
            </div>
            <ResponsiveContainer width="100%" height={400}>
              {showFaixaBars ? (
                <BarChart data={processedData.revenueByLaunch} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} angle={-45} textAnchor="end" height={100} />
                  <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                  <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }} formatter={(value) => `${value}%`} />
                  <Legend />
                  {Object.keys(processedData.revenueByLaunch[0]).filter(key => key !== 'name' && key !== 'totalLeads').map((key, idx) => (
                    <Bar key={key} dataKey={key} fill={`hsl(${idx * 40}, 70%, 50%)`} name={key} stackId="a" />
                  ))}
                </BarChart>
              ) : (
                <LineChart data={processedData.revenueByLaunch} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} angle={-45} textAnchor="end" height={100} />
                  <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                  <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }} formatter={(value) => `${value}%`} />
                  <Legend />
                  {Object.keys(processedData.revenueByLaunch[0]).filter(key => key !== 'name' && key !== 'totalLeads').map((key, idx) => (
                    <Line key={key} type="monotone" dataKey={key} stroke={`hsl(${idx * 40}, 70%, 50%)`} strokeWidth={3} dot={{ fill: `hsl(${idx * 40}, 70%, 50%)`, r: 3 }} name={key} />
                  ))}
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        )}


      </div>
    </div>
  );
}

export default LeadScoringPage;