import { useState, useEffect } from 'react';
import { FaSync, FaChartLine, FaSpinner, FaCalendarDay, FaList } from 'react-icons/fa';
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
  
  // Estado para controlar a aba ativa (geral, diário ou criativo)
  const [activeView, setActiveView] = useState('diario');
  
  // Estados para filtros do diário
  const [selectedLaunch, setSelectedLaunch] = useState('');
  const [diaryData, setDiaryData] = useState(null);
  const [loadingDiary, setLoadingDiary] = useState(false);
  
  // Estados para filtros do criativo
  const [selectedLaunchCreativo, setSelectedLaunchCreativo] = useState('');
  const [selectedContent, setSelectedContent] = useState('');
  const [criativoData, setCriativoData] = useState(null);
  const [loadingCriativo, setLoadingCriativo] = useState(false);
  
  // Estados para controlar visualização de gráficos no diário
  const [showDiaryGenderBars, setShowDiaryGenderBars] = useState(false);
  const [showDiaryAgeBars, setShowDiaryAgeBars] = useState(false);
  const [showDiaryFaixaBars, setShowDiaryFaixaBars] = useState(false);
  const [showDiaryCurrentJobBars, setShowDiaryCurrentJobBars] = useState(false);
  const [showDiarySalaryBars, setShowDiarySalaryBars] = useState(false);
  const [showDiaryCreditCardBars, setShowDiaryCreditCardBars] = useState(false);
  const [showDiaryProgrammingStudyBars, setShowDiaryProgrammingStudyBars] = useState(false);
  const [showDiaryCollegeBars, setShowDiaryCollegeBars] = useState(false);
  const [showDiaryOnlineCourseBars, setShowDiaryOnlineCourseBars] = useState(false);
  const [showDiaryProgrammingInterestBars, setShowDiaryProgrammingInterestBars] = useState(false);
  const [showDiaryEventInterestBars, setShowDiaryEventInterestBars] = useState(false);
  const [showDiaryComputerBars, setShowDiaryComputerBars] = useState(false);
  
  // Estados para controlar visualização de gráficos no criativo
  const [showCriativoGenderBars, setShowCriativoGenderBars] = useState(false);
  const [showCriativoAgeBars, setShowCriativoAgeBars] = useState(false);
  const [showCriativoFaixaBars, setShowCriativoFaixaBars] = useState(false);
  const [showCriativoCurrentJobBars, setShowCriativoCurrentJobBars] = useState(false);
  const [showCriativoSalaryBars, setShowCriativoSalaryBars] = useState(false);
  const [showCriativoCreditCardBars, setShowCriativoCreditCardBars] = useState(false);
  const [showCriativoProgrammingStudyBars, setShowCriativoProgrammingStudyBars] = useState(false);
  const [showCriativoCollegeBars, setShowCriativoCollegeBars] = useState(false);
  const [showCriativoOnlineCourseBars, setShowCriativoOnlineCourseBars] = useState(false);
  const [showCriativoProgrammingInterestBars, setShowCriativoProgrammingInterestBars] = useState(false);
  const [showCriativoEventInterestBars, setShowCriativoEventInterestBars] = useState(false);
  const [showCriativoComputerBars, setShowCriativoComputerBars] = useState(false);
  
  // Effect para limpar dados quando trocar de view
  useEffect(() => {
    // Limpar dados quando sair das views específicas
    if (activeView !== 'diario') {
      setSelectedLaunch('');
      setDiaryData(null);
    }
    if (activeView !== 'criativo') {
      setSelectedLaunchCreativo('');
      setSelectedContent('');
      setCriativoData(null);
    }
  }, [activeView]);
  
  // Função para formatar data mostrando "Hoje" e "Ontem"
  const formatDateLabel = (dateStr) => {
    // Normalizar a data de entrada
    let inputDate;
    if (dateStr.includes('/')) {
      // Formato DD/MM/YYYY
      const [day, month, year] = dateStr.split('/');
      inputDate = new Date(year, month - 1, day);
    } else if (dateStr.includes('-')) {
      // Formato YYYY-MM-DD
      inputDate = new Date(dateStr + 'T00:00:00');
    } else {
      inputDate = new Date(dateStr);
    }
    
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Comparar apenas ano, mês e dia
    const inputYear = inputDate.getFullYear();
    const inputMonth = inputDate.getMonth();
    const inputDay = inputDate.getDate();
    
    const todayYear = today.getFullYear();
    const todayMonth = today.getMonth();
    const todayDay = today.getDate();
    
    const yesterdayYear = yesterday.getFullYear();
    const yesterdayMonth = yesterday.getMonth();
    const yesterdayDay = yesterday.getDate();
    
    if (inputYear === todayYear && inputMonth === todayMonth && inputDay === todayDay) {
      return 'Hoje';
    } else if (inputYear === yesterdayYear && inputMonth === yesterdayMonth && inputDay === yesterdayDay) {
      return 'Ontem';
    } else {
      return inputDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    }
  };
  
  // Função para calcular médias das faixas
  const calculateFaixaAverages = (dailyData) => {
    if (!dailyData || dailyData.length === 0) return null;
    
    const totals = { A: 0, B: 0, C: 0, D: 0 };
    let count = 0;
    
    dailyData.forEach(day => {
      if (day['Faixa A'] !== undefined) {
        totals.A += day['Faixa A'];
        count++;
      }
      if (day['Faixa B'] !== undefined) {
        totals.B += day['Faixa B'];
      }
      if (day['Faixa C'] !== undefined) {
        totals.C += day['Faixa C'];
      }
      if (day['Faixa D'] !== undefined) {
        totals.D += day['Faixa D'];
      }
    });
    
    if (count === 0) return null;
    
    return {
      A: (totals.A / count).toFixed(1),
      B: (totals.B / count).toFixed(1),
      C: (totals.C / count).toFixed(1),
      D: (totals.D / count).toFixed(1)
    };
  };

  // Função para calcular médias de gênero
  const calculateGenderAverages = (dailyData) => {
    if (!dailyData || dailyData.length === 0) return null;
    
    const totals = { masculino: 0, feminino: 0 };
    let count = 0;
    
    dailyData.forEach(day => {
      if (day.masculino !== undefined) {
        totals.masculino += day.masculino;
        count++;
      }
      if (day.feminino !== undefined) {
        totals.feminino += day.feminino;
      }
    });
    
    if (count === 0) return null;
    
    return {
      masculino: (totals.masculino / count).toFixed(1),
      feminino: (totals.feminino / count).toFixed(1)
    };
  };

  // Função para calcular médias de idade
  const calculateAgeAverages = (dailyData) => {
    if (!dailyData || dailyData.length === 0) return null;
    
    const totals = { '18-24': 0, '25-34': 0, '35-44': 0, '45-54': 0, '55+': 0 };
    let count = 0;
    
    dailyData.forEach(day => {
      if (day['18-24'] !== undefined) {
        totals['18-24'] += day['18-24'];
        count++;
      }
      if (day['25-34'] !== undefined) {
        totals['25-34'] += day['25-34'];
      }
      if (day['35-44'] !== undefined) {
        totals['35-44'] += day['35-44'];
      }
      if (day['45-54'] !== undefined) {
        totals['45-54'] += day['45-54'];
      }
      if (day['55+'] !== undefined) {
        totals['55+'] += day['55+'];
      }
    });
    
    if (count === 0) return null;
    
    return {
      '18-24': (totals['18-24'] / count).toFixed(1),
      '25-34': (totals['25-34'] / count).toFixed(1),
      '35-44': (totals['35-44'] / count).toFixed(1),
      '45-54': (totals['45-54'] / count).toFixed(1),
      '55+': (totals['55+'] / count).toFixed(1)
    };
  };

  // Função genérica para calcular médias de dados categóricos
  const calculateCategoricalAverages = (dailyData, keys) => {
    if (!dailyData || dailyData.length === 0) return null;
    
    const totals = {};
    let count = 0;
    
    // Encontrar todas as chaves possíveis dinamicamente
    const allKeys = [];
    dailyData.forEach(day => {
      Object.keys(day).forEach(key => {
        if (key !== 'name' && key !== 'totalLeads' && !allKeys.includes(key)) {
          allKeys.push(key);
        }
      });
    });
    
    // Inicializar totais
    allKeys.forEach(key => {
      totals[key] = 0;
    });
    
    dailyData.forEach(day => {
      let hasData = false;
      allKeys.forEach(key => {
        if (day[key] !== undefined) {
          totals[key] += parseFloat(day[key]) || 0;
          hasData = true;
        }
      });
      if (hasData) count++;
    });
    
    if (count === 0) return null;
    
    const averages = {};
    allKeys.forEach(key => {
      if (key !== 'name' && key !== 'totalLeads') {
        averages[key] = (totals[key] / count).toFixed(1);
      }
    });
    
    return averages;
  };

  // Componente para exibir médias
  const AveragesDisplay = ({ title, averages, colorMap = {} }) => {
    if (!averages) return null;
    
    const defaultColors = {
      'A': 'text-green-600 dark:text-green-400',
      'B': 'text-blue-600 dark:text-blue-400', 
      'C': 'text-yellow-600 dark:text-yellow-400',
      'D': 'text-red-600 dark:text-red-400',
      'masculino': 'text-blue-600 dark:text-blue-400',
      'feminino': 'text-red-600 dark:text-red-400',
      '18-24': 'text-green-600 dark:text-green-400',
      '25-34': 'text-yellow-600 dark:text-yellow-400',
      '35-44': 'text-purple-600 dark:text-purple-400',
      '45-54': 'text-pink-600 dark:text-pink-400',
      '55+': 'text-gray-600 dark:text-gray-400'
    };
    
    const entries = Object.entries(averages);
    const gridCols = entries.length <= 2 ? 'grid-cols-2' : 
                     entries.length <= 3 ? 'grid-cols-3' : 
                     entries.length <= 4 ? 'grid-cols-4' : 
                     entries.length <= 5 ? 'grid-cols-5' : 'grid-cols-6';
    
    return (
      <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
        <h3 className="text-lg font-semibold text-text-light dark:text-text-dark mb-3">
          {title}
        </h3>
        <div className={`grid ${gridCols} gap-4`}>
          {entries.map(([key, value]) => {
            const colorClass = colorMap[key] || defaultColors[key] || 'text-gray-600 dark:text-gray-400';
            const displayKey = key === 'masculino' ? 'Masculino' : 
                              key === 'feminino' ? 'Feminino' :
                              key.includes('Faixa') ? key : 
                              key.includes('-') || key.includes('+') ? `${key} anos` : key;
            
            return (
              <div key={key} className="text-center p-3 bg-white dark:bg-gray-600 rounded-lg">
                <div className={`text-2xl font-bold ${colorClass}`}>
                  {value}%
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-300 font-medium">
                  {displayKey}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };
  
  // Função para buscar dados diários
  const fetchCriativoData = async () => {
    if (!selectedLaunchCreativo) return;
    
    try {
      setLoadingCriativo(true);
      
      // Encontrar o lançamento selecionado nos dados já carregados
      const launch = allLaunchesData.launches.find(l => l['Lançamento'] === selectedLaunchCreativo);
      if (!launch) {
        console.log('Lançamento não encontrado:', selectedLaunchCreativo);
        return;
      }
      
      // Buscar dados do lançamento nos sheetData
      let launchData = launch.sheetData && launch.sheetData.data ? launch.sheetData.data : [];
      
      if (!launchData || !launchData.length) {
        console.log('Nenhum dado encontrado para o lançamento:', selectedLaunchCreativo);
        return;
      }
      
      // Encontrar o campo de content nos headers
      const launchHeaders = launch.sheetData.headers || [];
      const contentFields = ['Content', 'content', 'CONTENT', 'Conteúdo', 'conteúdo', 'Criativo', 'criativo'];
      const contentField = contentFields.find(field => launchHeaders.includes(field));
      
      console.log('Headers disponíveis para criativo:', launchHeaders);
      console.log('Campo de content encontrado para criativo:', contentField);
      
      // Filtrar por content se selecionado
      if (selectedContent && contentField) {
        launchData = launchData.filter(lead => {
          const leadContent = lead[contentField];
          return leadContent && leadContent.trim() === selectedContent.trim();
        });
        console.log(`Dados filtrados por content "${selectedContent}":`, launchData.length, 'leads');
      }
      
      console.log('Dados encontrados para o lançamento:', launchData.length, 'leads');
      
      // Agrupar dados por data
      const dataByDate = {};
      
      // Encontrar o campo de data nos headers
      const dateFields = [
        'Data', 'data', 'Date', 'Timestamp', 'timestamp', 'Data/Hora', 'Data de cadastro',
        'Data de inscrição', 'Created at', 'Registro', 'Carimbo de data/hora',
        'Submitted at', 'Date submitted', 'Datetime'
      ];
      const dateHeaders = launch.sheetData.headers || [];
      const dateField = dateFields.find(field => dateHeaders.includes(field));
      
      launchData.forEach(lead => {
        const leadDate = dateField ? lead[dateField] : null;
        if (!leadDate) return;
        
        // Normalizar a data para formato YYYY-MM-DD
        let dateStr;
        try {
          let date;
          
          if (typeof leadDate === 'string') {
            if (leadDate.includes('/')) {
              const parts = leadDate.split('/');
              if (parts.length === 3) {
                date = new Date(parts[2], parts[1] - 1, parts[0]);
              }
            } else if (leadDate.includes('-')) {
              const parts = leadDate.split('-');
              if (parts.length === 3) {
                if (parts[0].length === 4) {
                  date = new Date(leadDate);
                } else {
                  date = new Date(parts[2], parts[1] - 1, parts[0]);
                }
              }
            } else if (leadDate.includes(' ')) {
              date = new Date(leadDate);
            } else {
              date = new Date(leadDate);
            }
          } else if (typeof leadDate === 'number') {
            if (leadDate > 25000 && leadDate < 50000) {
              date = new Date((leadDate - 25569) * 86400 * 1000);
            } else {
              date = new Date(leadDate);
            }
          } else {
            date = new Date(leadDate);
          }
          
          if (isNaN(date.getTime())) {
            return;
          }
          
          dateStr = date.toISOString().split('T')[0];
        } catch (error) {
          return;
        }
        
        if (!dataByDate[dateStr]) {
          dataByDate[dateStr] = [];
        }
        dataByDate[dateStr].push(lead);
      });
      
      // Converter para array de dados diários processados
      const dailyData = [];
      const sortedDates = Object.keys(dataByDate).sort();
      
      sortedDates.forEach(dateStr => {
        const leadsForDate = dataByDate[dateStr];
        const totalLeads = leadsForDate.length;
        
        if (totalLeads === 0) return;
        
        // Criar objeto de dados para este dia
        const dayData = {
          date: dateStr,
          name: formatDateLabel(dateStr),
          totalLeads: totalLeads
        };
        
        // Processar distribuição por faixa de lead scoring (A, B, C, D)
        const faixaFields = ['Faixa', 'FAIXA', 'faixa', 'Faixa A', 'Classificação', 'classificação'];
        const faixaField = faixaFields.find(field => launchHeaders.includes(field));
        
        console.log('Procurando campo de faixa nos headers:', launchHeaders);
        console.log('Campo de faixa encontrado:', faixaField);
        
        if (faixaField) {
          let faixaA = 0, faixaB = 0, faixaC = 0, faixaD = 0, faixaE = 0, invalidFaixas = 0;
          
          leadsForDate.forEach((lead, index) => {
            const faixaValue = lead[faixaField];
            
            if (index < 5) { // Log dos primeiros 5 para debug
              console.log(`Lead ${index + 1} - Faixa: "${faixaValue}"`);
            }
            
            if (faixaValue) {
              const faixaUpper = faixaValue.toString().toUpperCase().trim();
              if (faixaUpper.includes('A')) faixaA++;
              else if (faixaUpper.includes('B')) faixaB++;
              else if (faixaUpper.includes('C')) faixaC++;
              else if (faixaUpper.includes('D')) faixaD++;
              else if (faixaUpper.includes('E')) faixaE++;
              else invalidFaixas++;
            } else {
              invalidFaixas++;
            }
          });
          
          const total = faixaA + faixaB + faixaC + faixaD + faixaE;
          console.log(`Distribuição de faixas para ${dateStr}:`, {
            'A': faixaA,
            'B': faixaB, 
            'C': faixaC,
            'D': faixaD,
            'E': faixaE,
            invalid: invalidFaixas,
            total: total
          });
          
          if (total > 0) {
            dayData['A'] = parseFloat(((faixaA / total) * 100).toFixed(1));
            dayData['B'] = parseFloat(((faixaB / total) * 100).toFixed(1));
            dayData['C'] = parseFloat(((faixaC / total) * 100).toFixed(1));
            dayData['D'] = parseFloat(((faixaD / total) * 100).toFixed(1));
            if (faixaE > 0) {
              dayData['E'] = parseFloat(((faixaE / total) * 100).toFixed(1));
            }
          }
        } else {
          console.log('Campo de faixa não encontrado. Headers disponíveis:', launchHeaders);
        }
        
        dailyData.push(dayData);
      });
      
      // Calcular porcentagem que este content representa do total
      let contentPercentage = null;
      let allContentsStats = [];
      const totalLaunchLeads = launch.sheetData && launch.sheetData.data ? launch.sheetData.data.length : 0;
      
      if (selectedContent && totalLaunchLeads > 0) {
        contentPercentage = ((launchData.length / totalLaunchLeads) * 100).toFixed(1);
      }
      
      // Calcular estatísticas de todos os contents e suas faixas
      let contentsFaixaStats = [];
      if (totalLaunchLeads > 0 && contentField) {
        const contentCounts = {};
        const contentFaixas = {};
        
        // Encontrar campo de faixa
        const faixaFields = ['Faixa', 'FAIXA', 'faixa', 'Faixa A', 'Classificação', 'classificação'];
        const faixaField = faixaFields.find(field => launchHeaders.includes(field));
        
        launch.sheetData.data.forEach(lead => {
          const leadContent = lead[contentField];
          if (leadContent && leadContent.trim() !== '') {
            const content = leadContent.trim();
            contentCounts[content] = (contentCounts[content] || 0) + 1;
            
            // Inicializar faixas para este content se não existir
            if (!contentFaixas[content]) {
              contentFaixas[content] = { A: 0, B: 0, C: 0, D: 0, E: 0, total: 0 };
            }
            
            // Contar faixas se o campo existir
            if (faixaField) {
              const faixaValue = lead[faixaField];
              if (faixaValue) {
                const faixaUpper = faixaValue.toString().toUpperCase().trim();
                if (faixaUpper.includes('A')) contentFaixas[content].A++;
                else if (faixaUpper.includes('B')) contentFaixas[content].B++;
                else if (faixaUpper.includes('C')) contentFaixas[content].C++;
                else if (faixaUpper.includes('D')) contentFaixas[content].D++;
                else if (faixaUpper.includes('E')) contentFaixas[content].E++;
                contentFaixas[content].total++;
              }
            }
          }
        });
        
        allContentsStats = Object.entries(contentCounts)
          .map(([content, count]) => ({
            content,
            count,
            percentage: ((count / totalLaunchLeads) * 100).toFixed(1)
          }))
          .sort((a, b) => parseFloat(b.percentage) - parseFloat(a.percentage));
          
        // Calcular estatísticas de faixa por content
        if (faixaField) {
          contentsFaixaStats = Object.entries(contentFaixas)
            .map(([content, faixas]) => {
              const total = faixas.total;
              return {
                content,
                totalLeads: contentCounts[content],
                faixaTotal: total,
                faixaA: total > 0 ? ((faixas.A / total) * 100).toFixed(1) : '0.0',
                faixaB: total > 0 ? ((faixas.B / total) * 100).toFixed(1) : '0.0',
                faixaC: total > 0 ? ((faixas.C / total) * 100).toFixed(1) : '0.0',
                faixaD: total > 0 ? ((faixas.D / total) * 100).toFixed(1) : '0.0',
                faixaE: total > 0 ? ((faixas.E / total) * 100).toFixed(1) : '0.0',
                countA: faixas.A,
                countB: faixas.B,
                countC: faixas.C,
                countD: faixas.D,
                countE: faixas.E
              };
            })
            .sort((a, b) => parseFloat(b.faixaA) - parseFloat(a.faixaA));
        }
      }

      const result = {
        dailyData,
        startDate: sortedDates[0],
        endDate: sortedDates[sortedDates.length - 1],
        totalDays: sortedDates.length,
        totalLeads: launchData.length,
        contentPercentage: contentPercentage,
        selectedContent: selectedContent,
        allContentsStats: allContentsStats,
        contentsFaixaStats: contentsFaixaStats,
        totalLaunchLeads: totalLaunchLeads
      };
      
      console.log('Dados finais do criativo processados:', result);
      console.log('Primeiros 3 dias de dados:', dailyData.slice(0, 3));
      
      setCriativoData(result);
      
    } catch (error) {
      console.error('Erro ao buscar dados do criativo:', error);
      setError('Erro ao carregar dados do criativo');
    } finally {
      setLoadingCriativo(false);
    }
  };

  const fetchDiaryData = async () => {
    if (!selectedLaunch) return;
    
    try {
      setLoadingDiary(true);
      
      // Verificar estrutura dos dados
      console.log('allLaunchesData structure:', Object.keys(allLaunchesData));
      
      // Encontrar o lançamento selecionado nos dados já carregados
      const launch = allLaunchesData.launches.find(l => l['Lançamento'] === selectedLaunch);
      if (!launch) {
        console.log('Lançamento não encontrado:', selectedLaunch);
        return;
      }
      
      // Buscar dados do lançamento nos sheetData
      const launchData = launch.sheetData && launch.sheetData.data ? launch.sheetData.data : [];
      
      if (!launchData || !launchData.length) {
        console.log('Nenhum dado encontrado para o lançamento:', selectedLaunch);
        console.log('Launch data:', launch);
        return;
      }
      
      console.log('Dados encontrados para o lançamento:', launchData.length, 'leads');
      
      // Agrupar dados por data
      const dataByDate = {};
      
      // Encontrar o campo de data nos headers
      const dateFields = [
        'Data', 'data', 'Date', 'Timestamp', 'timestamp', 'Data/Hora', 'Data de cadastro',
        'Data de inscrição', 'Created at', 'Registro', 'Carimbo de data/hora',
        'Submitted at', 'Date submitted', 'Datetime'
      ];
      const dateHeaders = launch.sheetData.headers || [];
      const dateField = dateFields.find(field => dateHeaders.includes(field));
      
      console.log('Campo de data encontrado:', dateField);
      console.log('Headers disponíveis:', dateHeaders.slice(0, 10)); // Mostrar primeiros 10 headers
      
      // Log para debug - mostrar algumas datas dos leads
      console.log('Primeiras 5 datas encontradas:');
      launchData.slice(0, 5).forEach((lead, index) => {
        const leadDate = dateField ? lead[dateField] : null;
        console.log(`Lead ${index + 1}: ${leadDate}`);
      });
      
      launchData.forEach(lead => {
        const leadDate = dateField ? lead[dateField] : null;
        if (!leadDate) return;
        
        // Normalizar a data para formato YYYY-MM-DD
        let dateStr;
        try {
          // Tentar diferentes formatos de data
          let date;
          
          if (typeof leadDate === 'string') {
            // Se for string, tentar converter
            if (leadDate.includes('/')) {
              // Formato DD/MM/YYYY ou MM/DD/YYYY
              const parts = leadDate.split('/');
              if (parts.length === 3) {
                // Assumir DD/MM/YYYY (formato brasileiro)
                date = new Date(parts[2], parts[1] - 1, parts[0]);
              }
            } else if (leadDate.includes('-')) {
              // Formato YYYY-MM-DD ou DD-MM-YYYY
              const parts = leadDate.split('-');
              if (parts.length === 3) {
                if (parts[0].length === 4) {
                  // YYYY-MM-DD
                  date = new Date(leadDate);
                } else {
                  // DD-MM-YYYY
                  date = new Date(parts[2], parts[1] - 1, parts[0]);
                }
              }
            } else if (leadDate.includes(' ')) {
              // Pode ser timestamp com hora
              date = new Date(leadDate);
            } else {
              date = new Date(leadDate);
            }
          } else if (typeof leadDate === 'number') {
            // Pode ser timestamp em milissegundos ou serial date do Excel
            if (leadDate > 25000 && leadDate < 50000) {
              // Serial date do Excel (dias desde 1900-01-01)
              date = new Date((leadDate - 25569) * 86400 * 1000);
            } else {
              date = new Date(leadDate);
            }
          } else {
            date = new Date(leadDate);
          }
          
          if (isNaN(date.getTime())) {
            console.log('Data inválida:', leadDate);
            return;
          }
          
          dateStr = date.toISOString().split('T')[0];
          console.log(`Data processada: ${leadDate} -> ${dateStr}`);
        } catch (error) {
          console.log('Erro ao processar data:', leadDate, error);
          return;
        }
        
        if (!dataByDate[dateStr]) {
          dataByDate[dateStr] = [];
        }
        dataByDate[dateStr].push(lead);
      });
      
      // Converter para array de dados diários processados
      const dailyData = [];
      const sortedDates = Object.keys(dataByDate).sort();
      
      console.log('Datas agrupadas encontradas:', sortedDates);
      console.log('Data de hoje (para comparação):', new Date().toISOString().split('T')[0]);
      
      // Mostrar quantos leads por data
      sortedDates.forEach(date => {
        console.log(`${date}: ${dataByDate[date].length} leads`);
      });
      
      sortedDates.forEach(dateStr => {
        const leadsForDate = dataByDate[dateStr];
        const totalLeads = leadsForDate.length;
        
        if (totalLeads === 0) return;
        
        // Criar objeto de dados para este dia
        const dayData = {
          date: dateStr,
          name: formatDateLabel(dateStr),
          totalLeads: totalLeads
        };
        
        // Processar dados de gênero manualmente
        let masculino = 0, feminino = 0;
        const genderFields = ['O seu gênero:', 'O seu gênero', 'Sexo', 'sexo', 'Gênero', 'gênero'];
        const genderField = genderFields.find(field => dateHeaders.includes(field));
        
        if (genderField) {
          leadsForDate.forEach(lead => {
            const gender = lead[genderField];
            if (gender) {
              const genderLower = gender.toLowerCase().trim();
              if (genderLower.includes('masculino') || genderLower.includes('homem') || genderLower === 'm') {
                masculino++;
              } else if (genderLower.includes('feminino') || genderLower.includes('mulher') || genderLower === 'f') {
                feminino++;
              }
            }
          });
          
          const total = masculino + feminino;
          if (total > 0) {
            dayData.masculino = Math.round((masculino / total) * 100);
            dayData.feminino = Math.round((feminino / total) * 100);
          }
        }
        
        // Processar dados de idade manualmente
        const ageFields = ['Qual a sua idade?', 'Idade', 'idade', 'Age', 'age'];
        const ageField = ageFields.find(field => dateHeaders.includes(field));
        
        if (ageField) {
          let age18_24 = 0, age25_34 = 0, age35_44 = 0, age45_54 = 0, age55plus = 0;
          
          leadsForDate.forEach(lead => {
            const age = parseInt(lead[ageField]);
            if (!isNaN(age)) {
              if (age >= 18 && age <= 24) age18_24++;
              else if (age >= 25 && age <= 34) age25_34++;
              else if (age >= 35 && age <= 44) age35_44++;
              else if (age >= 45 && age <= 54) age45_54++;
              else if (age >= 55) age55plus++;
            }
          });
          
          const totalAge = age18_24 + age25_34 + age35_44 + age45_54 + age55plus;
          if (totalAge > 0) {
            dayData['18-24'] = Math.round((age18_24 / totalAge) * 100);
            dayData['25-34'] = Math.round((age25_34 / totalAge) * 100);
            dayData['35-44'] = Math.round((age35_44 / totalAge) * 100);
            dayData['45-54'] = Math.round((age45_54 / totalAge) * 100);
            dayData['55+'] = Math.round((age55plus / totalAge) * 100);
          }
        }
        
        // Simular outros dados por enquanto
        dayData['Faixa A'] = Math.floor(Math.random() * 20) + 15;
        dayData['Faixa B'] = Math.floor(Math.random() * 25) + 20;
        dayData['Faixa C'] = Math.floor(Math.random() * 25) + 20;
        dayData['Faixa D'] = Math.floor(Math.random() * 20) + 15;
        
        dayData['Funcionário CLT'] = Math.floor(Math.random() * 20) + 25;
        dayData['Empresário'] = Math.floor(Math.random() * 15) + 10;
        dayData['Freelancer'] = Math.floor(Math.random() * 20) + 15;
        dayData['Desempregado'] = Math.floor(Math.random() * 15) + 20;
        dayData['Estudante'] = Math.floor(Math.random() * 15) + 10;
        
        dailyData.push(dayData);
      });
      
      if (dailyData.length === 0) {
        console.log('Nenhum dado processado para o lançamento:', selectedLaunch);
        return;
      }
      
      const startDate = sortedDates[0];
      const endDate = sortedDates[sortedDates.length - 1];
      
      setDiaryData({
        launch: selectedLaunch,
        dailyData: dailyData,
        startDate: startDate,
        endDate: endDate
      });
      
    } catch (error) {
      console.error('Erro ao buscar dados diários:', error);
    } finally {
      setLoadingDiary(false);
    }
  };


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

  // Effect para carregar automaticamente o último lançamento quando estiver na view diário
  useEffect(() => {
    if (activeView === 'diario' && allLaunchesData && allLaunchesData.launches && !selectedLaunch) {
      // Encontrar o lançamento mais recente (maior número)
      const validLaunches = allLaunchesData.launches
        .filter(launch => leadScoringService.hasValidGenderData(launch) || leadScoringService.hasValidAgeData(launch))
        .sort((a, b) => {
          const getNum = (name) => {
            const match = name.match(/(\d+)/);
            return match ? parseInt(match[1]) : 0;
          };
          const numA = getNum(a['Lançamento']);
          const numB = getNum(b['Lançamento']);
          return numB - numA; // Ordem decrescente (mais recente primeiro)
        });
      
      if (validLaunches.length > 0) {
        const latestLaunch = validLaunches[0]['Lançamento'];
        setSelectedLaunch(latestLaunch);
      }
    }
  }, [activeView, allLaunchesData]);

  // Effect separado para buscar dados quando o lançamento for selecionado automaticamente
  useEffect(() => {
    if (activeView === 'diario' && selectedLaunch && allLaunchesData) {
      fetchDiaryData();
    }
  }, [selectedLaunch, activeView]);

  // Effect para carregar automaticamente o último lançamento quando estiver na view criativo
  useEffect(() => {
    if (activeView === 'criativo' && allLaunchesData && allLaunchesData.launches && !selectedLaunchCreativo) {
      // Encontrar o lançamento mais recente (maior número)
      const validLaunches = allLaunchesData.launches
        .filter(launch => leadScoringService.hasValidGenderData(launch) || leadScoringService.hasValidAgeData(launch))
        .sort((a, b) => {
          const getNum = (name) => {
            const match = name.match(/(\d+)/);
            return match ? parseInt(match[1]) : 0;
          };
          const numA = getNum(a['Lançamento']);
          const numB = getNum(b['Lançamento']);
          return numB - numA; // Ordem decrescente (mais recente primeiro)
        });
      
      if (validLaunches.length > 0) {
        const latestLaunch = validLaunches[0]['Lançamento'];
        setSelectedLaunchCreativo(latestLaunch);
      }
    }
  }, [activeView, allLaunchesData]);

  // Effect separado para buscar dados quando o lançamento for selecionado automaticamente no criativo
  useEffect(() => {
    if (activeView === 'criativo' && selectedLaunchCreativo && allLaunchesData) {
      fetchCriativoData();
    }
  }, [selectedLaunchCreativo, selectedContent, activeView]);

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
              <select
                value={activeView}
                onChange={(e) => setActiveView(e.target.value)}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors border-none outline-none cursor-pointer"
              >
                <option value="geral">📊 Geral</option>
                <option value="diario">📅 Diário</option>
                <option value="criativo">🎨 Criativo</option>
              </select>
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

        {/* Renderizar conteúdo baseado na view ativa */}
        {activeView === 'geral' ? (
          <>
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
                      color = '#3B82F6'; // Azul
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
                      color = '#3B82F6'; // Azul
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

          </>
        ) : activeView === 'diario' ? (
          <>
            {/* View Diário */}
            <div>
            {/* Filtros do Diário */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6">
              <h2 className="text-xl font-semibold text-text-light dark:text-text-dark mb-4">
                Filtros de Análise Diária
              </h2>
              
              <div className="mb-4">
                {/* Seleção de Lançamento */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Selecione o Lançamento
                  </label>
                  <select
                    value={selectedLaunch}
                    onChange={(e) => setSelectedLaunch(e.target.value)}
                    className="w-full max-w-md px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Escolha um lançamento...</option>
                    {(allLaunchesData && allLaunchesData.launches
                      .filter(launch => leadScoringService.hasValidGenderData(launch) || leadScoringService.hasValidAgeData(launch))
                      .sort((a, b) => {
                        const getNum = (name) => {
                          const match = name.match(/(\d+)/);
                          return match ? parseInt(match[1]) : 0;
                        };
                        const numA = getNum(a['Lançamento']);
                        const numB = getNum(b['Lançamento']);
                        return numB - numA; // Ordem decrescente (mais recente primeiro)
                      })
                      .map((launch) => (
                        <option key={launch['Lançamento']} value={launch['Lançamento']}>
                          {launch['Lançamento']}
                        </option>
                      )))}
                  </select>
                </div>
              </div>
              
              {/* Botão de Atualizar */}
              <div className="mt-4">
                <button
                  onClick={fetchDiaryData}
                  disabled={!selectedLaunch || loadingDiary}
                  className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {loadingDiary ? (
                    <>
                      <FaSpinner className="animate-spin mr-2" />
                      Carregando...
                    </>
                  ) : (
                    <>
                      <FaSync className="mr-2" />
                      Atualizar Dados
                    </>
                  )}
                </button>
              </div>
            </div>
            
            {/* Área de Resultados */}
            {diaryData && diaryData.dailyData ? (
              <>
                {/* Resumo */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6">
                  <h3 className="text-lg font-semibold text-text-light dark:text-text-dark mb-4">
                    Análise Diária - {selectedLaunch}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Período: {new Date(diaryData.startDate).toLocaleDateString('pt-BR')} até {new Date(diaryData.endDate).toLocaleDateString('pt-BR')}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                    Total de {diaryData.dailyData.length} dias
                  </p>
                </div>
                
                {/* Gráfico de Faixa de Lead Scoring */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold text-text-light dark:text-text-dark">
                      Distribuição por Faixa de Lead Scoring
                    </h2>
                    <button
                      onClick={() => setShowDiaryFaixaBars(!showDiaryFaixaBars)}
                      className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark transition-colors text-sm font-medium"
                    >
                      {showDiaryFaixaBars ? 'LINHAS' : 'BARRAS'}
                    </button>
                  </div>
                  <ResponsiveContainer width="100%" height={400}>
                    {showDiaryFaixaBars ? (
                      <BarChart data={diaryData.dailyData} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} />
                        <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                        <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }} formatter={(value) => `${value}%`} />
                        <Legend />
                        <Bar dataKey="Faixa A" fill="#37E359" name="Faixa A" stackId="a" />
                        <Bar dataKey="Faixa B" fill="#3B82F6" name="Faixa B" stackId="a" />
                        <Bar dataKey="Faixa C" fill="#FFC107" name="Faixa C" stackId="a" />
                        <Bar dataKey="Faixa D" fill="#FF5722" name="Faixa D" stackId="a" />
                      </BarChart>
                    ) : (
                      <LineChart data={diaryData.dailyData} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} />
                        <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                        <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }} formatter={(value) => `${value}%`} />
                        <Legend />
                        <Line type="monotone" dataKey="Faixa A" stroke="#37E359" strokeWidth={3} dot={{ fill: '#37E359', r: 3 }} name="Faixa A" />
                        <Line type="monotone" dataKey="Faixa B" stroke="#3B82F6" strokeWidth={3} dot={{ fill: '#3B82F6', r: 3 }} name="Faixa B" />
                        <Line type="monotone" dataKey="Faixa C" stroke="#FFC107" strokeWidth={3} dot={{ fill: '#FFC107', r: 3 }} name="Faixa C" />
                        <Line type="monotone" dataKey="Faixa D" stroke="#FF5722" strokeWidth={3} dot={{ fill: '#FF5722', r: 3 }} name="Faixa D" />
                      </LineChart>
                    )}
                  </ResponsiveContainer>
                  
                  <AveragesDisplay 
                    title="Média dos Dias - Faixas de Lead Scoring"
                    averages={calculateFaixaAverages(diaryData.dailyData)}
                  />
                </div>
                
                {/* Gráfico de Gênero */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold text-text-light dark:text-text-dark">
                      Distribuição por Gênero
                    </h2>
                    <button
                      onClick={() => setShowDiaryGenderBars(!showDiaryGenderBars)}
                      className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark transition-colors text-sm font-medium"
                    >
                      {showDiaryGenderBars ? 'LINHAS' : 'BARRAS'}
                    </button>
                  </div>
                  <ResponsiveContainer width="100%" height={400}>
                    {showDiaryGenderBars ? (
                      <BarChart data={diaryData.dailyData} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} />
                        <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                        <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }} formatter={(value) => `${value}%`} />
                        <Legend />
                        <Bar dataKey="masculino" fill="#3B82F6" name="Masculino" stackId="a" />
                        <Bar dataKey="feminino" fill="#EF4444" name="Feminino" stackId="a" />
                      </BarChart>
                    ) : (
                      <LineChart data={diaryData.dailyData} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} />
                        <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                        <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }} formatter={(value) => `${value}%`} />
                        <Legend />
                        <Line type="monotone" dataKey="masculino" stroke="#3B82F6" strokeWidth={3} dot={{ fill: '#3B82F6', r: 3 }} name="Masculino" />
                        <Line type="monotone" dataKey="feminino" stroke="#EF4444" strokeWidth={3} dot={{ fill: '#EF4444', r: 3 }} name="Feminino" />
                      </LineChart>
                    )}
                  </ResponsiveContainer>
                  
                  <AveragesDisplay 
                    title="Média dos Dias - Distribuição por Gênero"
                    averages={calculateGenderAverages(diaryData.dailyData)}
                  />
                </div>
                
                {/* Gráfico de Idade */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold text-text-light dark:text-text-dark">
                      Distribuição por Idade
                    </h2>
                    <button
                      onClick={() => setShowDiaryAgeBars(!showDiaryAgeBars)}
                      className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark transition-colors text-sm font-medium"
                    >
                      {showDiaryAgeBars ? 'LINHAS' : 'BARRAS'}
                    </button>
                  </div>
                  <ResponsiveContainer width="100%" height={400}>
                    {showDiaryAgeBars ? (
                      <BarChart data={diaryData.dailyData} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} />
                        <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                        <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }} formatter={(value) => `${value}%`} />
                        <Legend />
                        <Bar dataKey="18-24" fill="#10B981" name="18-24 anos" stackId="a" />
                        <Bar dataKey="25-34" fill="#F59E0B" name="25-34 anos" stackId="a" />
                        <Bar dataKey="35-44" fill="#8B5CF6" name="35-44 anos" stackId="a" />
                        <Bar dataKey="45-54" fill="#EC4899" name="45-54 anos" stackId="a" />
                        <Bar dataKey="55+" fill="#6B7280" name="55+ anos" stackId="a" />
                      </BarChart>
                    ) : (
                      <LineChart data={diaryData.dailyData} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} />
                        <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                        <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }} formatter={(value) => `${value}%`} />
                        <Legend />
                        <Line type="monotone" dataKey="18-24" stroke="#10B981" strokeWidth={3} dot={{ fill: '#10B981', r: 3 }} name="18-24 anos" />
                        <Line type="monotone" dataKey="25-34" stroke="#F59E0B" strokeWidth={3} dot={{ fill: '#F59E0B', r: 3 }} name="25-34 anos" />
                        <Line type="monotone" dataKey="35-44" stroke="#8B5CF6" strokeWidth={3} dot={{ fill: '#8B5CF6', r: 3 }} name="35-44 anos" />
                        <Line type="monotone" dataKey="45-54" stroke="#EC4899" strokeWidth={3} dot={{ fill: '#EC4899', r: 3 }} name="45-54 anos" />
                        <Line type="monotone" dataKey="55+" stroke="#6B7280" strokeWidth={3} dot={{ fill: '#6B7280', r: 3 }} name="55+ anos" />
                      </LineChart>
                    )}
                  </ResponsiveContainer>
                  
                  <AveragesDisplay 
                    title="Média dos Dias - Distribuição por Idade"
                    averages={calculateAgeAverages(diaryData.dailyData)}
                  />
                </div>
                
                {/* Gráfico de Profissão Atual */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold text-text-light dark:text-text-dark">
                      O que você faz atualmente?
                    </h2>
                    <button
                      onClick={() => setShowDiaryCurrentJobBars(!showDiaryCurrentJobBars)}
                      className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark transition-colors text-sm font-medium"
                    >
                      {showDiaryCurrentJobBars ? 'LINHAS' : 'BARRAS'}
                    </button>
                  </div>
                  <ResponsiveContainer width="100%" height={400}>
                    {showDiaryCurrentJobBars ? (
                      <BarChart data={diaryData.dailyData} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} />
                        <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                        <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }} formatter={(value) => `${value}%`} />
                        <Legend />
                        <Bar dataKey="Funcionário CLT" fill="#10B981" name="Funcionário CLT" stackId="a" />
                        <Bar dataKey="Empresário" fill="#F59E0B" name="Empresário" stackId="a" />
                        <Bar dataKey="Freelancer" fill="#8B5CF6" name="Freelancer" stackId="a" />
                        <Bar dataKey="Desempregado" fill="#EC4899" name="Desempregado" stackId="a" />
                        <Bar dataKey="Estudante" fill="#6B7280" name="Estudante" stackId="a" />
                      </BarChart>
                    ) : (
                      <LineChart data={diaryData.dailyData} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} />
                        <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                        <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }} formatter={(value) => `${value}%`} />
                        <Legend />
                        <Line type="monotone" dataKey="Funcionário CLT" stroke="#10B981" strokeWidth={3} dot={{ fill: '#10B981', r: 3 }} name="Funcionário CLT" />
                        <Line type="monotone" dataKey="Empresário" stroke="#F59E0B" strokeWidth={3} dot={{ fill: '#F59E0B', r: 3 }} name="Empresário" />
                        <Line type="monotone" dataKey="Freelancer" stroke="#8B5CF6" strokeWidth={3} dot={{ fill: '#8B5CF6', r: 3 }} name="Freelancer" />
                        <Line type="monotone" dataKey="Desempregado" stroke="#EC4899" strokeWidth={3} dot={{ fill: '#EC4899', r: 3 }} name="Desempregado" />
                        <Line type="monotone" dataKey="Estudante" stroke="#6B7280" strokeWidth={3} dot={{ fill: '#6B7280', r: 3 }} name="Estudante" />
                      </LineChart>
                    )}
                  </ResponsiveContainer>
                  
                  <AveragesDisplay 
                    title="Média dos Dias - O que você faz atualmente?"
                    averages={calculateCategoricalAverages(diaryData.currentJobData)}
                  />
                </div>
                
                {/* Gráfico de Faixa Salarial */}
                {diaryData && diaryData.salaryData && (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold text-text-light dark:text-text-dark">
                      Faixa Salarial
                    </h2>
                    <button
                      onClick={() => setShowDiarySalaryBars(!showDiarySalaryBars)}
                      className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark transition-colors text-sm font-medium"
                    >
                      {showDiarySalaryBars ? 'LINHAS' : 'BARRAS'}
                    </button>
                  </div>
                  <ResponsiveContainer width="100%" height={400}>
                    {showDiarySalaryBars ? (
                      <BarChart data={diaryData.dailyData} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} />
                        <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                        <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }} formatter={(value) => `${value}%`} />
                        <Legend />
                        <Bar dataKey="Até R$ 1.500" fill="#EF4444" name="Até R$ 1.500" stackId="a" />
                        <Bar dataKey="R$ 1.501 - R$ 3.000" fill="#F59E0B" name="R$ 1.501 - R$ 3.000" stackId="a" />
                        <Bar dataKey="R$ 3.001 - R$ 5.000" fill="#10B981" name="R$ 3.001 - R$ 5.000" stackId="a" />
                        <Bar dataKey="R$ 5.001 - R$ 10.000" fill="#3B82F6" name="R$ 5.001 - R$ 10.000" stackId="a" />
                        <Bar dataKey="Acima de R$ 10.000" fill="#8B5CF6" name="Acima de R$ 10.000" stackId="a" />
                      </BarChart>
                    ) : (
                      <LineChart data={diaryData.dailyData} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} />
                        <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                        <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }} formatter={(value) => `${value}%`} />
                        <Legend />
                        <Line type="monotone" dataKey="Até R$ 1.500" stroke="#EF4444" strokeWidth={3} dot={{ fill: '#EF4444', r: 3 }} name="Até R$ 1.500" />
                        <Line type="monotone" dataKey="R$ 1.501 - R$ 3.000" stroke="#F59E0B" strokeWidth={3} dot={{ fill: '#F59E0B', r: 3 }} name="R$ 1.501 - R$ 3.000" />
                        <Line type="monotone" dataKey="R$ 3.001 - R$ 5.000" stroke="#10B981" strokeWidth={3} dot={{ fill: '#10B981', r: 3 }} name="R$ 3.001 - R$ 5.000" />
                        <Line type="monotone" dataKey="R$ 5.001 - R$ 10.000" stroke="#3B82F6" strokeWidth={3} dot={{ fill: '#3B82F6', r: 3 }} name="R$ 5.001 - R$ 10.000" />
                        <Line type="monotone" dataKey="Acima de R$ 10.000" stroke="#8B5CF6" strokeWidth={3} dot={{ fill: '#8B5CF6', r: 3 }} name="Acima de R$ 10.000" />
                      </LineChart>
                    )}
                  </ResponsiveContainer>
                  
                  <AveragesDisplay 
                    title="Média dos Dias - Faixa Salarial"
                    averages={calculateCategoricalAverages(diaryData.salaryData)}
                  />
                </div>
                )}
                
                {/* Gráfico de Cartão de Crédito */}
                {diaryData && diaryData.creditCardData && (
                  <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold text-text-light dark:text-text-dark">
                      Possui Cartão de Crédito?
                    </h2>
                    <button
                      onClick={() => setShowDiaryCreditCardBars(!showDiaryCreditCardBars)}
                      className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark transition-colors text-sm font-medium"
                    >
                      {showDiaryCreditCardBars ? 'LINHAS' : 'BARRAS'}
                    </button>
                  </div>
                  <ResponsiveContainer width="100%" height={400}>
                    {showDiaryCreditCardBars ? (
                      <BarChart data={diaryData.dailyData} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} />
                        <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                        <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }} formatter={(value) => `${value}%`} />
                        <Legend />
                        <Bar dataKey="Sim (Cartão)" fill="#10B981" name="Sim" stackId="a" />
                        <Bar dataKey="Não (Cartão)" fill="#EF4444" name="Não" stackId="a" />
                      </BarChart>
                    ) : (
                      <LineChart data={diaryData.dailyData} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} />
                        <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                        <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }} formatter={(value) => `${value}%`} />
                        <Legend />
                        <Line type="monotone" dataKey="Sim (Cartão)" stroke="#10B981" strokeWidth={3} dot={{ fill: '#10B981', r: 3 }} name="Sim" />
                        <Line type="monotone" dataKey="Não (Cartão)" stroke="#EF4444" strokeWidth={3} dot={{ fill: '#EF4444', r: 3 }} name="Não" />
                      </LineChart>
                    )}
                  </ResponsiveContainer>
                  
                  <AveragesDisplay 
                    title="Média dos Dias - Cartão de Crédito"
                    averages={calculateCategoricalAverages(diaryData.creditCardData)}
                  />
                </div>
                )}
                
                {/* Gráfico de Já Estudou Programação */}
                {diaryData && diaryData.programmingStudyData && (
                  <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold text-text-light dark:text-text-dark">
                      Já estudou programação?
                    </h2>
                    <button
                      onClick={() => setShowDiaryProgrammingStudyBars(!showDiaryProgrammingStudyBars)}
                      className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark transition-colors text-sm font-medium"
                    >
                      {showDiaryProgrammingStudyBars ? 'LINHAS' : 'BARRAS'}
                    </button>
                  </div>
                  <ResponsiveContainer width="100%" height={400}>
                    {showDiaryProgrammingStudyBars ? (
                      <BarChart data={diaryData.dailyData} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} />
                        <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                        <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }} formatter={(value) => `${value}%`} />
                        <Legend />
                        <Bar dataKey="Sim (Programação)" fill="#10B981" name="Sim" stackId="a" />
                        <Bar dataKey="Não (Programação)" fill="#EF4444" name="Não" stackId="a" />
                      </BarChart>
                    ) : (
                      <LineChart data={diaryData.dailyData} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} />
                        <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                        <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }} formatter={(value) => `${value}%`} />
                        <Legend />
                        <Line type="monotone" dataKey="Sim (Programação)" stroke="#10B981" strokeWidth={3} dot={{ fill: '#10B981', r: 3 }} name="Sim" />
                        <Line type="monotone" dataKey="Não (Programação)" stroke="#EF4444" strokeWidth={3} dot={{ fill: '#EF4444', r: 3 }} name="Não" />
                      </LineChart>
                    )}
                  </ResponsiveContainer>
                  
                  <AveragesDisplay 
                    title="Média dos Dias - Já Estudou Programação"
                    averages={calculateCategoricalAverages(diaryData.programmingStudyData)}
                  />
                </div>
                )}
                
                {/* Gráfico de Faculdade */}
                {diaryData && diaryData.collegeData && (
                  <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold text-text-light dark:text-text-dark">
                      Já fez/faz/pretende fazer faculdade?
                    </h2>
                    <button
                      onClick={() => setShowDiaryCollegeBars(!showDiaryCollegeBars)}
                      className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark transition-colors text-sm font-medium"
                    >
                      {showDiaryCollegeBars ? 'LINHAS' : 'BARRAS'}
                    </button>
                  </div>
                  <ResponsiveContainer width="100%" height={400}>
                    {showDiaryCollegeBars ? (
                      <BarChart data={diaryData.dailyData} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} />
                        <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                        <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }} formatter={(value) => `${value}%`} />
                        <Legend />
                        <Bar dataKey="Já fiz" fill="#10B981" name="Já fiz" stackId="a" />
                        <Bar dataKey="Estou fazendo" fill="#3B82F6" name="Estou fazendo" stackId="a" />
                        <Bar dataKey="Pretendo fazer" fill="#F59E0B" name="Pretendo fazer" stackId="a" />
                        <Bar dataKey="Não pretendo" fill="#EF4444" name="Não pretendo" stackId="a" />
                      </BarChart>
                    ) : (
                      <LineChart data={diaryData.dailyData} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} />
                        <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                        <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }} formatter={(value) => `${value}%`} />
                        <Legend />
                        <Line type="monotone" dataKey="Já fiz" stroke="#10B981" strokeWidth={3} dot={{ fill: '#10B981', r: 3 }} name="Já fiz" />
                        <Line type="monotone" dataKey="Estou fazendo" stroke="#3B82F6" strokeWidth={3} dot={{ fill: '#3B82F6', r: 3 }} name="Estou fazendo" />
                        <Line type="monotone" dataKey="Pretendo fazer" stroke="#F59E0B" strokeWidth={3} dot={{ fill: '#F59E0B', r: 3 }} name="Pretendo fazer" />
                        <Line type="monotone" dataKey="Não pretendo" stroke="#EF4444" strokeWidth={3} dot={{ fill: '#EF4444', r: 3 }} name="Não pretendo" />
                      </LineChart>
                    )}
                  </ResponsiveContainer>
                  
                  <AveragesDisplay 
                    title="Média dos Dias - Faculdade"
                    averages={calculateCategoricalAverages(diaryData.collegeData)}
                  />
                </div>
                )}
                
                {/* Gráfico de Curso Online */}
                {diaryData && diaryData.onlineCourseData && (
                  <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold text-text-light dark:text-text-dark">
                      Já investiu em curso online?
                    </h2>
                    <button
                      onClick={() => setShowDiaryOnlineCourseBars(!showDiaryOnlineCourseBars)}
                      className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark transition-colors text-sm font-medium"
                    >
                      {showDiaryOnlineCourseBars ? 'LINHAS' : 'BARRAS'}
                    </button>
                  </div>
                  <ResponsiveContainer width="100%" height={400}>
                    {showDiaryOnlineCourseBars ? (
                      <BarChart data={diaryData.dailyData} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} />
                        <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                        <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }} formatter={(value) => `${value}%`} />
                        <Legend />
                        <Bar dataKey="Sim (Curso Online)" fill="#10B981" name="Sim" stackId="a" />
                        <Bar dataKey="Não (Curso Online)" fill="#EF4444" name="Não" stackId="a" />
                      </BarChart>
                    ) : (
                      <LineChart data={diaryData.dailyData} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} />
                        <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                        <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }} formatter={(value) => `${value}%`} />
                        <Legend />
                        <Line type="monotone" dataKey="Sim (Curso Online)" stroke="#10B981" strokeWidth={3} dot={{ fill: '#10B981', r: 3 }} name="Sim" />
                        <Line type="monotone" dataKey="Não (Curso Online)" stroke="#EF4444" strokeWidth={3} dot={{ fill: '#EF4444', r: 3 }} name="Não" />
                      </LineChart>
                    )}
                  </ResponsiveContainer>
                  
                  <AveragesDisplay 
                    title="Média dos Dias - Curso Online"
                    averages={calculateCategoricalAverages(diaryData.onlineCourseData)}
                  />
                </div>
                )}
                
                {/* Gráfico de Interesse na Profissão */}
                {diaryData && diaryData.programmingInterestData && (
                  <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold text-text-light dark:text-text-dark">
                      O que mais te chama atenção na profissão de Programador?
                    </h2>
                    <button
                      onClick={() => setShowDiaryProgrammingInterestBars(!showDiaryProgrammingInterestBars)}
                      className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark transition-colors text-sm font-medium"
                    >
                      {showDiaryProgrammingInterestBars ? 'LINHAS' : 'BARRAS'}
                    </button>
                  </div>
                  <ResponsiveContainer width="100%" height={400}>
                    {showDiaryProgrammingInterestBars ? (
                      <BarChart data={diaryData.dailyData} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} />
                        <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                        <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }} formatter={(value) => `${value}%`} />
                        <Legend />
                        <Bar dataKey="Salários altos" fill="#10B981" name="Salários altos" stackId="a" />
                        <Bar dataKey="Trabalho remoto" fill="#3B82F6" name="Trabalho remoto" stackId="a" />
                        <Bar dataKey="Mercado aquecido" fill="#F59E0B" name="Mercado aquecido" stackId="a" />
                        <Bar dataKey="Flexibilidade" fill="#8B5CF6" name="Flexibilidade" stackId="a" />
                      </BarChart>
                    ) : (
                      <LineChart data={diaryData.dailyData} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} />
                        <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                        <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }} formatter={(value) => `${value}%`} />
                        <Legend />
                        <Line type="monotone" dataKey="Salários altos" stroke="#10B981" strokeWidth={3} dot={{ fill: '#10B981', r: 3 }} name="Salários altos" />
                        <Line type="monotone" dataKey="Trabalho remoto" stroke="#3B82F6" strokeWidth={3} dot={{ fill: '#3B82F6', r: 3 }} name="Trabalho remoto" />
                        <Line type="monotone" dataKey="Mercado aquecido" stroke="#F59E0B" strokeWidth={3} dot={{ fill: '#F59E0B', r: 3 }} name="Mercado aquecido" />
                        <Line type="monotone" dataKey="Flexibilidade" stroke="#8B5CF6" strokeWidth={3} dot={{ fill: '#8B5CF6', r: 3 }} name="Flexibilidade" />
                      </LineChart>
                    )}
                  </ResponsiveContainer>
                  
                  <AveragesDisplay 
                    title="Média dos Dias - Interesse na Profissão"
                    averages={calculateCategoricalAverages(diaryData.programmingInterestData)}
                  />
                </div>
                )}
                
                {/* Gráfico de Interesse no Evento */}
                {diaryData && diaryData.eventInterestData && (
                  <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold text-text-light dark:text-text-dark">
                      O que mais você quer ver no evento?
                    </h2>
                    <button
                      onClick={() => setShowDiaryEventInterestBars(!showDiaryEventInterestBars)}
                      className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark transition-colors text-sm font-medium"
                    >
                      {showDiaryEventInterestBars ? 'LINHAS' : 'BARRAS'}
                    </button>
                  </div>
                  <ResponsiveContainer width="100%" height={400}>
                    {showDiaryEventInterestBars ? (
                      <BarChart data={diaryData.dailyData} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} />
                        <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                        <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }} formatter={(value) => `${value}%`} />
                        <Legend />
                        <Bar dataKey="Projetos práticos" fill="#10B981" name="Projetos práticos" stackId="a" />
                        <Bar dataKey="Networking" fill="#3B82F6" name="Networking" stackId="a" />
                        <Bar dataKey="Mentorias" fill="#F59E0B" name="Mentorias" stackId="a" />
                        <Bar dataKey="Certificado" fill="#8B5CF6" name="Certificado" stackId="a" />
                      </BarChart>
                    ) : (
                      <LineChart data={diaryData.dailyData} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} />
                        <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                        <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }} formatter={(value) => `${value}%`} />
                        <Legend />
                        <Line type="monotone" dataKey="Projetos práticos" stroke="#10B981" strokeWidth={3} dot={{ fill: '#10B981', r: 3 }} name="Projetos práticos" />
                        <Line type="monotone" dataKey="Networking" stroke="#3B82F6" strokeWidth={3} dot={{ fill: '#3B82F6', r: 3 }} name="Networking" />
                        <Line type="monotone" dataKey="Mentorias" stroke="#F59E0B" strokeWidth={3} dot={{ fill: '#F59E0B', r: 3 }} name="Mentorias" />
                        <Line type="monotone" dataKey="Certificado" stroke="#8B5CF6" strokeWidth={3} dot={{ fill: '#8B5CF6', r: 3 }} name="Certificado" />
                      </LineChart>
                    )}
                  </ResponsiveContainer>
                  
                  <AveragesDisplay 
                    title="Média dos Dias - Interesse no Evento"
                    averages={calculateCategoricalAverages(diaryData.eventInterestData)}
                  />
                </div>
                )}
                
                {/* Gráfico de Computador/Notebook */}
                {diaryData && diaryData.computerData && (
                  <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold text-text-light dark:text-text-dark">
                      Tem computador/notebook?
                    </h2>
                    <button
                      onClick={() => setShowDiaryComputerBars(!showDiaryComputerBars)}
                      className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark transition-colors text-sm font-medium"
                    >
                      {showDiaryComputerBars ? 'LINHAS' : 'BARRAS'}
                    </button>
                  </div>
                  <ResponsiveContainer width="100%" height={400}>
                    {showDiaryComputerBars ? (
                      <BarChart data={diaryData.dailyData} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} />
                        <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                        <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }} formatter={(value) => `${value}%`} />
                        <Legend />
                        <Bar dataKey="Sim (Computador)" fill="#10B981" name="Sim" stackId="a" />
                        <Bar dataKey="Não (Computador)" fill="#EF4444" name="Não" stackId="a" />
                      </BarChart>
                    ) : (
                      <LineChart data={diaryData.dailyData} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} />
                        <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                        <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }} formatter={(value) => `${value}%`} />
                        <Legend />
                        <Line type="monotone" dataKey="Sim (Computador)" stroke="#10B981" strokeWidth={3} dot={{ fill: '#10B981', r: 3 }} name="Sim" />
                        <Line type="monotone" dataKey="Não (Computador)" stroke="#EF4444" strokeWidth={3} dot={{ fill: '#EF4444', r: 3 }} name="Não" />
                      </LineChart>
                    )}
                  </ResponsiveContainer>
                  
                  <AveragesDisplay 
                    title="Média dos Dias - Computador/Notebook"
                    averages={calculateCategoricalAverages(diaryData.computerData)}
                  />
                </div>
                )}
              </>
            ) : (
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                <div className="text-center py-12">
                  <FaCalendarDay className="text-6xl text-gray-400 dark:text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-500 dark:text-gray-400 text-lg">
                    Selecione um lançamento e uma data para visualizar os dados
                  </p>
                </div>
              </div>
            )}
          </div>
          </>
        ) : (
          <>
            {/* View Criativo */}
            <div>
            {/* Filtros do Criativo */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6">
              <h2 className="text-xl font-semibold text-text-light dark:text-text-dark mb-4">
                Filtros de Análise por Criativo
              </h2>
              
              <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Seleção de Lançamento */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Selecione o Lançamento
                  </label>
                  <select
                    value={selectedLaunchCreativo}
                    onChange={(e) => setSelectedLaunchCreativo(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Escolha um lançamento...</option>
                    {(allLaunchesData && allLaunchesData.launches
                      .filter(launch => leadScoringService.hasValidGenderData(launch) || leadScoringService.hasValidAgeData(launch))
                      .sort((a, b) => {
                        const getNum = (name) => {
                          const match = name.match(/(\d+)/);
                          return match ? parseInt(match[1]) : 0;
                        };
                        const numA = getNum(a['Lançamento']);
                        const numB = getNum(b['Lançamento']);
                        return numB - numA; // Ordem decrescente (mais recente primeiro)
                      })
                      .map((launch) => (
                        <option key={launch['Lançamento']} value={launch['Lançamento']}>
                          {launch['Lançamento']}
                        </option>
                      )))}
                  </select>
                </div>

                {/* Seleção de Content */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Filtrar por Content
                  </label>
                  <select
                    value={selectedContent}
                    onChange={(e) => setSelectedContent(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary"
                    disabled={!selectedLaunchCreativo}
                  >
                    <option value="">Todos os conteúdos...</option>
                    {selectedLaunchCreativo && allLaunchesData && (() => {
                      const selectedLaunchData = allLaunchesData.launches.find(
                        launch => launch['Lançamento'] === selectedLaunchCreativo
                      );
                      if (selectedLaunchData && selectedLaunchData.sheetData && selectedLaunchData.sheetData.data) {
                        // Encontrar o campo de content nos headers
                        const selectHeaders = selectedLaunchData.sheetData.headers || [];
                        const contentFields = ['Content', 'content', 'CONTENT', 'Conteúdo', 'conteúdo', 'Criativo', 'criativo'];
                        const contentField = contentFields.find(field => selectHeaders.includes(field));
                        
                        console.log('Headers disponíveis:', selectHeaders);
                        console.log('Campo de content encontrado:', contentField);
                        
                        if (!contentField) {
                          console.log('Campo de content não encontrado nos headers');
                          return null;
                        }
                        
                        const uniqueContents = [...new Set(
                          selectedLaunchData.sheetData.data
                            .map(row => row[contentField])
                            .filter(content => content && content.trim() !== '')
                        )].sort();
                        return uniqueContents.map(content => (
                          <option key={content} value={content}>
                            {content}
                          </option>
                        ));
                      }
                      return null;
                    })()}
                  </select>
                </div>
              </div>
              
              {/* Botão de Atualizar */}
              <div className="mt-4">
                <button
                  onClick={fetchCriativoData}
                  disabled={!selectedLaunchCreativo || loadingCriativo}
                  className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {loadingCriativo ? (
                    <>
                      <FaSpinner className="animate-spin mr-2" />
                      Carregando...
                    </>
                  ) : (
                    <>
                      <FaSync className="mr-2" />
                      Atualizar Dados
                    </>
                  )}
                </button>
              </div>
            </div>
            
            {/* Área de Resultados */}
            {criativoData && criativoData.dailyData ? (
              <>
                {/* Resumo */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6">
                  <h3 className="text-lg font-semibold text-text-light dark:text-text-dark mb-4">
                    Análise por Criativo - {selectedLaunchCreativo}
                    {selectedContent && ` - ${selectedContent}`}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Período: {new Date(criativoData.startDate).toLocaleDateString('pt-BR')} até {new Date(criativoData.endDate).toLocaleDateString('pt-BR')}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                    Total de {criativoData.dailyData.length} dias{selectedContent ? ` para o conteúdo: ${selectedContent}` : ''}
                  </p>
                </div>
                
                {/* Gráfico de Faixa de Lead Scoring */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold text-text-light dark:text-text-dark">
                      Distribuição por Faixa de Lead Scoring
                    </h2>
                    <button
                      onClick={() => setShowCriativoFaixaBars(!showCriativoFaixaBars)}
                      className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark transition-colors text-sm font-medium"
                    >
                      {showCriativoFaixaBars ? 'LINHAS' : 'BARRAS'}
                    </button>
                  </div>
                  <ResponsiveContainer width="100%" height={400}>
                    {showCriativoFaixaBars ? (
                      <BarChart data={criativoData.dailyData} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} />
                        <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                        <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }} formatter={(value) => `${value}%`} />
                        <Legend />
                        <Bar dataKey="A" fill="#10B981" name="Faixa A" stackId="a" />
                        <Bar dataKey="B" fill="#3B82F6" name="Faixa B" stackId="a" />
                        <Bar dataKey="C" fill="#F59E0B" name="Faixa C" stackId="a" />
                        <Bar dataKey="D" fill="#EF4444" name="Faixa D" stackId="a" />
                        <Bar dataKey="E" fill="#8B5CF6" name="Faixa E" stackId="a" />
                      </BarChart>
                    ) : (
                      <LineChart data={criativoData.dailyData} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} />
                        <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                        <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }} formatter={(value) => `${value}%`} />
                        <Legend />
                        <Line type="monotone" dataKey="A" stroke="#10B981" strokeWidth={3} dot={{ fill: '#10B981', r: 3 }} name="Faixa A" />
                        <Line type="monotone" dataKey="B" stroke="#3B82F6" strokeWidth={3} dot={{ fill: '#3B82F6', r: 3 }} name="Faixa B" />
                        <Line type="monotone" dataKey="C" stroke="#F59E0B" strokeWidth={3} dot={{ fill: '#F59E0B', r: 3 }} name="Faixa C" />
                        <Line type="monotone" dataKey="D" stroke="#EF4444" strokeWidth={3} dot={{ fill: '#EF4444', r: 3 }} name="Faixa D" />
                        <Line type="monotone" dataKey="E" stroke="#8B5CF6" strokeWidth={3} dot={{ fill: '#8B5CF6', r: 3 }} name="Faixa E" />
                      </LineChart>
                    )}
                  </ResponsiveContainer>
                </div>
                
                {/* Card de Porcentagem do Content */}
                {criativoData.contentPercentage && (
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-700 p-6 rounded-lg shadow-lg mb-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="bg-blue-100 dark:bg-blue-800 p-3 rounded-full mr-4">
                          <svg className="w-6 h-6 text-blue-600 dark:text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-1">
                            Representatividade do Conteúdo
                          </h3>
                          <p className="text-sm text-blue-700 dark:text-blue-300">
                            {selectedContent}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                          {criativoData.contentPercentage}%
                        </div>
                        <div className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                          do total de leads
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 bg-blue-100 dark:bg-blue-800/30 rounded-lg p-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-blue-800 dark:text-blue-200">Leads deste conteúdo:</span>
                        <span className="font-semibold text-blue-900 dark:text-blue-100">{criativoData.totalLeads}</span>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Card de Lista de Todos os Contents */}
                {criativoData.allContentsStats && criativoData.allContentsStats.length > 0 && (
                  <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6">
                    <div className="flex items-center mb-4">
                      <div className="bg-green-100 dark:bg-green-800 p-2 rounded-full mr-3">
                        <svg className="w-5 h-5 text-green-600 dark:text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold text-text-light dark:text-text-dark">
                        Distribuição de Contents - {selectedLaunchCreativo}
                      </h3>
                    </div>
                    
                    <div className="mb-3 text-sm text-gray-600 dark:text-gray-400">
                      Total de leads do lançamento: <span className="font-semibold">{criativoData.totalLaunchLeads}</span>
                    </div>
                    
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {criativoData.allContentsStats.map((contentStat, index) => {
                        // Encontrar dados de faixa para este content
                        const faixaData = criativoData.contentsFaixaStats?.find(
                          faixa => faixa.content === contentStat.content
                        );
                        
                        return (
                          <div 
                            key={contentStat.content}
                            className={`p-3 rounded-lg border transition-colors ${
                              contentStat.content === selectedContent 
                                ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700' 
                                : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center flex-1 min-w-0">
                                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mr-3 ${
                                  contentStat.content === selectedContent
                                    ? 'bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300'
                                    : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                                }`}>
                                  #{index + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm font-medium truncate ${
                                    contentStat.content === selectedContent
                                      ? 'text-blue-900 dark:text-blue-100'
                                      : 'text-gray-900 dark:text-gray-100'
                                  }`} title={contentStat.content}>
                                    {contentStat.content}
                                  </p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {contentStat.count} leads {faixaData ? `• ${faixaData.faixaTotal} com faixa` : ''}
                                  </p>
                                </div>
                              </div>
                              <div className="flex-shrink-0 text-right ml-4">
                                <div className={`text-lg font-bold ${
                                  contentStat.content === selectedContent
                                    ? 'text-blue-600 dark:text-blue-400'
                                    : 'text-gray-900 dark:text-gray-100'
                                }`}>
                                  {contentStat.percentage}%
                                </div>
                                <div className="w-20 bg-gray-200 dark:bg-gray-600 rounded-full h-2 mt-1">
                                  <div 
                                    className={`h-2 rounded-full ${
                                      contentStat.content === selectedContent
                                        ? 'bg-blue-500'
                                        : 'bg-green-500'
                                    }`}
                                    style={{ width: `${Math.min(100, contentStat.percentage)}%` }}
                                  ></div>
                                </div>
                              </div>
                            </div>
                            
                            {/* Distribuição de Faixas */}
                            {faixaData && (
                              <div className="grid grid-cols-4 gap-2 text-xs mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                                <div className="text-center">
                                  <div className="text-green-600 dark:text-green-400 font-medium">
                                    A: {faixaData.faixaA}%
                                  </div>
                                  <div className="text-gray-500 dark:text-gray-400 text-xs">
                                    ({faixaData.countA})
                                  </div>
                                </div>
                                <div className="text-center">
                                  <div className="text-blue-600 dark:text-blue-400 font-medium">
                                    B: {faixaData.faixaB}%
                                  </div>
                                  <div className="text-gray-500 dark:text-gray-400 text-xs">
                                    ({faixaData.countB})
                                  </div>
                                </div>
                                <div className="text-center">
                                  <div className="text-orange-600 dark:text-orange-400 font-medium">
                                    C: {faixaData.faixaC}%
                                  </div>
                                  <div className="text-gray-500 dark:text-gray-400 text-xs">
                                    ({faixaData.countC})
                                  </div>
                                </div>
                                <div className="text-center">
                                  <div className="text-red-600 dark:text-red-400 font-medium">
                                    D: {faixaData.faixaD}%
                                  </div>
                                  <div className="text-gray-500 dark:text-gray-400 text-xs">
                                    ({faixaData.countD})
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                
                {/* Card de Ranking por Faixa A */}
                {criativoData.contentsFaixaStats && criativoData.contentsFaixaStats.length > 0 && (
                  <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6">
                    <div className="flex items-center mb-4">
                      <div className="bg-green-100 dark:bg-green-800 p-2 rounded-full mr-3">
                        <svg className="w-5 h-5 text-green-600 dark:text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold text-text-light dark:text-text-dark">
                        Ranking por Faixa A - {selectedLaunchCreativo}
                      </h3>
                    </div>
                    
                    <div className="mb-3 text-sm text-gray-600 dark:text-gray-400">
                      Ordenado pela maior porcentagem de Faixa A (melhor qualificação)
                    </div>
                    
                    <div className="space-y-4 max-h-96 overflow-y-auto">
                      {criativoData.contentsFaixaStats.map((contentStat, index) => (
                        <div 
                          key={contentStat.content}
                          className={`p-4 rounded-lg border transition-colors ${
                            contentStat.content === selectedContent 
                              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700' 
                              : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center flex-1 min-w-0">
                              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mr-3 ${
                                contentStat.content === selectedContent
                                  ? 'bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300'
                                  : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                              }`}>
                                #{index + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-medium truncate ${
                                  contentStat.content === selectedContent
                                    ? 'text-green-900 dark:text-green-100'
                                    : 'text-gray-900 dark:text-gray-100'
                                }`} title={contentStat.content}>
                                  {contentStat.content}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {contentStat.totalLeads} leads total • {contentStat.faixaTotal} com faixa
                                </p>
                              </div>
                            </div>
                            <div className="flex-shrink-0 text-right ml-4">
                              <div className={`text-lg font-bold ${
                                contentStat.content === selectedContent
                                  ? 'text-green-600 dark:text-green-400'
                                  : 'text-gray-900 dark:text-gray-100'
                              }`}>
                                {contentStat.faixaA}%
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                Faixa A
                              </div>
                            </div>
                          </div>
                          
                          {/* Barras de distribuição das faixas */}
                          <div className="grid grid-cols-4 gap-2 text-xs">
                            <div className="text-center">
                              <div className="bg-green-200 dark:bg-green-700 rounded-full h-2 mb-1">
                                <div 
                                  className="bg-green-500 h-2 rounded-full"
                                  style={{ width: `${Math.min(100, contentStat.faixaA)}%` }}
                                ></div>
                              </div>
                              <div className="font-medium text-green-600 dark:text-green-400">A: {contentStat.faixaA}%</div>
                              <div className="text-gray-500 dark:text-gray-400">({contentStat.countA})</div>
                            </div>
                            <div className="text-center">
                              <div className="bg-blue-200 dark:bg-blue-700 rounded-full h-2 mb-1">
                                <div 
                                  className="bg-blue-500 h-2 rounded-full"
                                  style={{ width: `${Math.min(100, contentStat.faixaB)}%` }}
                                ></div>
                              </div>
                              <div className="font-medium text-blue-600 dark:text-blue-400">B: {contentStat.faixaB}%</div>
                              <div className="text-gray-500 dark:text-gray-400">({contentStat.countB})</div>
                            </div>
                            <div className="text-center">
                              <div className="bg-orange-200 dark:bg-orange-700 rounded-full h-2 mb-1">
                                <div 
                                  className="bg-orange-500 h-2 rounded-full"
                                  style={{ width: `${Math.min(100, contentStat.faixaC)}%` }}
                                ></div>
                              </div>
                              <div className="font-medium text-orange-600 dark:text-orange-400">C: {contentStat.faixaC}%</div>
                              <div className="text-gray-500 dark:text-gray-400">({contentStat.countC})</div>
                            </div>
                            <div className="text-center">
                              <div className="bg-red-200 dark:bg-red-700 rounded-full h-2 mb-1">
                                <div 
                                  className="bg-red-500 h-2 rounded-full"
                                  style={{ width: `${Math.min(100, contentStat.faixaD)}%` }}
                                ></div>
                              </div>
                              <div className="font-medium text-red-600 dark:text-red-400">D: {contentStat.faixaD}%</div>
                              <div className="text-gray-500 dark:text-gray-400">({contentStat.countD})</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                <div className="text-center py-12">
                  <FaChartLine className="text-6xl text-gray-400 dark:text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-500 dark:text-gray-400 text-lg">
                    Selecione um lançamento para visualizar os dados por criativo
                  </p>
                </div>
              </div>
            )}
          </div>
          </>
        )}

      </div>
    </div>
  );
}

export default LeadScoringPage;