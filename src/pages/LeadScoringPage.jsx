import { useState, useEffect } from 'react';
import { FaSync, FaChartLine, FaSpinner } from 'react-icons/fa';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import leadScoringService from '../services/leadScoringService';


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
      
      console.log('📊 Dados carregados:', allData.launches.length, 'lançamentos');
      console.log('📊 Lançamentos carregados:', allData.launches.map(l => l['Lançamento']));
      
      // Processa os dados para gráficos
      console.log('🔄 Processando dados iniciais...');
      const processed = leadScoringService.processDataForCharts(allData);
      console.log('Dados processados:', processed);
      console.log('Dados de gênero:', processed.genderByLaunch);
      console.log('Dados de gênero length:', processed.genderByLaunch?.length);
      console.log('Condição para mostrar gráfico:', processed.genderByLaunch && processed.genderByLaunch.length > 0);
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

  // Função para aplicar filtro de quantidade
  const handleFilterChange = async (filter) => {
    setSelectedFilter(filter);
    
    // Se for "todos", buscar todos os dados primeiro
    if (filter === 'todos') {
      setProcessingAll(true);
      console.log('🔄 Buscando todos os lançamentos...');
      await fetchData(null); // null = sem limite, buscar todos
      setProcessingAll(false);
      return;
    }
    
    // Se for "10" e já temos dados carregados, apenas aplicar o filtro
    if (allLaunchesData) {
      console.log(`🔍 Aplicando filtro: ${filter}`);
      console.log(`📊 Total de lançamentos disponíveis: ${allLaunchesData.launches.length}`);
      
      // Primeiro: filtrar apenas lançamentos com dados válidos de gênero OU idade
      let validLaunches = allLaunchesData.launches.filter(launch => {
        const hasValidGenderData = leadScoringService.hasValidGenderData(launch);
        const hasValidAgeData = leadScoringService.hasValidAgeData(launch);
        const hasValidData = hasValidGenderData || hasValidAgeData;
        console.log(`🔍 ${launch['Lançamento']}: Gênero=${hasValidGenderData ? '✅' : '❌'}, Idade=${hasValidAgeData ? '✅' : '❌'}, Válido=${hasValidData ? '✅' : '❌'}`);
        return hasValidData;
      });
      
      console.log(`📊 Lançamentos com dados válidos: ${validLaunches.length}`);
      console.log(`📊 Lançamentos válidos:`, validLaunches.map(l => l['Lançamento']));
      
      // Segundo: aplicar filtro de quantidade nos lançamentos válidos
      let filteredLaunches = [...validLaunches];
      
      const count = parseInt(filter);
      console.log(`🎯 Quantidade solicitada: ${count}`);
      
      // Ordenar por número do LF (maior = mais recente)
      filteredLaunches.sort((a, b) => {
        const getNum = (name) => {
          const match = name.match(/(\d+)/);
          return match ? parseInt(match[1]) : 0;
        };
        const numA = getNum(a['Lançamento']);
        const numB = getNum(b['Lançamento']);
        console.log(`📋 Comparando: ${a['Lançamento']} (${numA}) vs ${b['Lançamento']} (${numB})`);
        return numB - numA;
      });
      
      console.log(`📋 Lançamentos válidos ordenados:`, filteredLaunches.map(l => l['Lançamento']));
      console.log(`📋 Antes do slice: ${filteredLaunches.length} lançamentos`);
      
      filteredLaunches = filteredLaunches.slice(0, count);
      
      console.log(`📋 Depois do slice: ${filteredLaunches.length} lançamentos`);
      console.log(`📋 Lançamentos filtrados:`, filteredLaunches.map(l => l['Lançamento']));
      
      // Criar novo objeto com dados filtrados
      const filteredData = {
        ...allLaunchesData,
        launches: filteredLaunches,
        totalLaunches: filteredLaunches.length
      };
      
      console.log(`✅ Resultado final: ${filteredData.totalLaunches} lançamentos`);
      console.log(`📊 Lançamentos finais:`, filteredData.launches.map(l => l['Lançamento']));
      
      // Processar dados filtrados para gráficos
      console.log('🔄 Chamando processDataForCharts...');
      const processed = leadScoringService.processDataForCharts(filteredData);
      console.log('✅ processDataForCharts concluído');
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


      </div>
    </div>
  );
}

export default LeadScoringPage;