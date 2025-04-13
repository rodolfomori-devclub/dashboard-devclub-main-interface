// src/pages/LaunchPro.jsx
import React, { useEffect, useState } from 'react';
import { 
  Box, 
  Typography, 
  Container, 
  Grid, 
  Card, 
  CardContent, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  CircularProgress, 
  Divider,
  Button,
  Tabs,
  Tab,
  IconButton,
  Tooltip,
  Paper,
  TextField,
  InputAdornment,
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Chip
} from '@mui/material';
import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  AttachMoney, 
  People, 
  Email, 
  Campaign, 
  TrendingUp, 
  Assessment,
  Facebook,
  Google,
  LocalOffer,
  ShowChart,
  Info,
  ExpandMore,
  ExpandLess,
  Visibility,
  Search,
  FilterList,
  Download
} from '@mui/icons-material';
import { formatCurrency } from '../utils/currencyUtils';
import launchService from '../services/launchService';
import LaunchComparisonModal from '../components/LaunchComparisonModal';
import CompareButton from '../components/CompareButton';

// Cores para os gráficos
const COLORS = ['#37E359', '#051626', '#FF4500', '#1E90FF', '#FFD700', '#FF1493'];

// Componente de card métrica
const MetricCard = ({ title, value, icon, color, subtitle, change }) => (
  <Card sx={{ height: '100%', borderLeft: `4px solid ${color}` }}>
    <CardContent>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Typography variant="subtitle2" color="text.secondary">
            {title}
          </Typography>
          <Typography variant="h5" component="div" sx={{ mt: 1, fontWeight: 'bold' }}>
            {value}
          </Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {subtitle}
            </Typography>
          )}
          {change && (
            <Typography 
              variant="body2" 
              sx={{ 
                mt: 0.5, 
                color: change.startsWith('-') ? 'error.main' : 'success.main',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              {change.startsWith('-') ? <TrendingUp sx={{ fontSize: 16, transform: 'rotate(180deg)', mr: 0.5 }} /> : <TrendingUp sx={{ fontSize: 16, mr: 0.5 }} />}
              {change}
            </Typography>
          )}
        </Box>
        <Box 
          sx={{ 
            backgroundColor: `${color}20`, 
            borderRadius: '50%', 
            p: 1, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center' 
          }}
        >
          {icon}
        </Box>
      </Box>
    </CardContent>
  </Card>
);

// Componente principal
const LaunchPro = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [launchOptions, setLaunchOptions] = useState([]);
  const [selectedLaunch, setSelectedLaunch] = useState('');
  const [launchData, setLaunchData] = useState({});
  const [metrics, setMetrics] = useState([]);
  const [tabValue, setTabValue] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSections, setExpandedSections] = useState({});
  const [filteredMetrics, setFilteredMetrics] = useState([]);
  const [categoryMap, setCategoryMap] = useState({});
  const [compareModalOpen, setCompareModalOpen] = useState(false);

  // Carregar dados ao montar o componente
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Buscar lista de lançamentos
        const launches = await launchService.getLaunches();
        setLaunchOptions(launches);
        
        // Buscar lista de métricas disponíveis
        const metricsNames = await launchService.getMetrics();
        setMetrics(metricsNames);
        
        // Categorizar métricas
        const categories = {
          'Informações Gerais': [],
          'Investimentos': [],
          'Leads': [],
          'Vendas': [],
          'Receitas': [],
          'Métricas': [],
          'Outros': []
        };
        
        // Função para categorizar métricas
        const categorizeMetric = (metric) => {
          const lowerMetric = metric.toLowerCase();
          
          if (lowerMetric.includes('invest') || lowerMetric.includes('custo') || lowerMetric.includes('gasto')) {
            return 'Investimentos';
          } else if (lowerMetric.includes('lead') || lowerMetric.includes('email') || lowerMetric.includes('cadastro')) {
            return 'Leads';
          } else if (lowerMetric.includes('venda') || lowerMetric.includes('convers')) {
            return 'Vendas';
          } else if (lowerMetric.includes('receita') || lowerMetric.includes('faturamento') || lowerMetric.includes('valor')) {
            return 'Receitas';
          } else if (lowerMetric.includes('roi') || lowerMetric.includes('cpl') || lowerMetric.includes('cac')) {
            return 'Métricas';
          } else if (metricsNames.indexOf(metric) < 10) {
            return 'Informações Gerais';
          } else {
            return 'Outros';
          }
        };
        
        // Mapear cada métrica para sua categoria
        const metricCategoryMap = {};
        
        metricsNames.forEach(metric => {
          const category = categorizeMetric(metric);
          categories[category].push(metric);
          metricCategoryMap[metric] = category;
        });
        
        setCategoryMap(metricCategoryMap);
        setFilteredMetrics(metricsNames);
        
        // Selecionar o primeiro lançamento por padrão
        if (launches.length > 0) {
          setSelectedLaunch(launches[0]);
          const firstLaunchData = await launchService.getLaunchData(launches[0]);
          setLaunchData(firstLaunchData);
        }
      } catch (err) {
        console.error('Erro ao buscar dados:', err);
        setError('Falha ao carregar dados da planilha');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Atualizar dados quando o lançamento selecionado mudar
  useEffect(() => {
    const updateLaunchData = async () => {
      if (!selectedLaunch) return;
      
      try {
        setLoading(true);
        const data = await launchService.getLaunchData(selectedLaunch);
        setLaunchData(data);
      } catch (err) {
        console.error(`Erro ao buscar dados para ${selectedLaunch}:`, err);
      } finally {
        setLoading(false);
      }
    };
    
    updateLaunchData();
  }, [selectedLaunch]);

  // Filtrar métricas quando a busca mudar
  useEffect(() => {
    if (searchQuery) {
      const filtered = metrics.filter(metric => 
        metric.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredMetrics(filtered);
    } else {
      setFilteredMetrics(metrics);
    }
  }, [searchQuery, metrics]);

  // Funções para o modal de comparação
  const handleOpenCompareModal = () => {
    setCompareModalOpen(true);
  };

  const handleCloseCompareModal = () => {
    setCompareModalOpen(false);
  };

  // Alternar a expansão de uma seção
  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Formatar valor para exibição
  const formatValue = (value, metric) => {
    return launchService.formatValue(value, metric);
  };

  // Função para extrair valor numérico para cálculos
  const getNumericValue = (value) => {
    if (typeof value === 'number') return value;
    if (!value) return 0;
    
    // Tentar extrair número de string
    let numericValue = value.toString().replace(/[^\d.,\-]/g, '');
    
    // Converter vírgula para ponto, mas apenas a última (formato brasileiro)
    const lastCommaIndex = numericValue.lastIndexOf(',');
    if (lastCommaIndex !== -1) {
      numericValue = numericValue.substring(0, lastCommaIndex).replace(/\./g, '') + 
                    '.' + numericValue.substring(lastCommaIndex + 1);
    }
    
    // Remover vírgulas restantes
    numericValue = numericValue.replace(/,/g, '');
    
    return parseFloat(numericValue) || 0;
  };

  // Renderizar tab de visão geral
  const renderOverviewTab = () => {
    if (!launchData || Object.keys(launchData).length === 0) {
      return (
        <Box p={3} textAlign="center">
          <Typography>Selecione um lançamento para visualizar os dados</Typography>
        </Box>
      );
    }
    
    // Extrair valores do Facebook e Google - busca mais ampla para encontrar os valores
    const [facebookInvestment, googleInvestment] = extractAdsInvestments();
    
    // Extrair métricas importantes
    const investmentTotal = findMetricValue(['investimento total', 'total investido', 'investimentos totais', 'custo total']);
    const totalLeads = findMetricValue(['leads total', 'total de leads', 'leads']);
    const emailLeads = findMetricValue(['leads email', 'email leads', 'emails']);
    const guruRevenue = findMetricValue(['receita guru', 'faturamento guru', 'guru']);
    const tmbRevenue = findMetricValue(['receita tmb', 'faturamento tmb', 'receita boleto', 'tmb']);
    const totalRevenue = findMetricValue(['receita total', 'faturamento total', 'total receita']);
    
    // Cálculos derivados
    const effectiveRevenue = totalRevenue > 0 ? totalRevenue : (guruRevenue + tmbRevenue);
    const effectiveInvestment = investmentTotal > 0 ? investmentTotal : (facebookInvestment + googleInvestment);
    
    // Correção para custo por lead (CPL) - dividir por 1000 se for muito alto
    let leadCost = totalLeads > 0 ? effectiveInvestment / totalLeads : 0;
    if (leadCost > 1000) {
      leadCost = leadCost / 1000;
    }
    
    const profit = effectiveRevenue - effectiveInvestment;
    const roi = effectiveInvestment > 0 ? effectiveRevenue / effectiveInvestment : 0;
    
    // ROI específico para GURU (Cartão)
    const guruProfit = guruRevenue - effectiveInvestment;
    const guruRoi = effectiveInvestment > 0 ? guruRevenue / effectiveInvestment : 0;
    
    // Obter dados CPL
    const cplData = extractCPLData();
    
    // Obter dados para distribuição de investimento
    const investmentDistribution = getInvestmentDistribution();
    
    // Obter dados de lead scoring
    const leadScoring = getLeadScoring();
    
    // Dados para gráficos
    const investmentChartData = investmentDistribution.length > 0 
      ? investmentDistribution.sort((a, b) => b.value - a.value) // Ordenar por valor
      : [
          { name: 'Facebook', value: facebookInvestment },
          { name: 'Google', value: googleInvestment },
          { name: 'Outros', value: Math.max(0, effectiveInvestment - facebookInvestment - googleInvestment) }
        ].filter(item => item.value > 0);
    
    const revenueChartData = [
      { name: 'GURU', value: guruRevenue },
      { name: 'TMB', value: tmbRevenue },
      { name: 'Outros', value: Math.max(0, effectiveRevenue - guruRevenue - tmbRevenue) }
    ].filter(item => item.value > 0);
    
    const roiChartData = [
      { name: 'Investimento', value: effectiveInvestment },
      { name: 'Receita Total', value: effectiveRevenue },
      { name: 'Receita GURU', value: guruRevenue },
      { name: 'Lucro Total', value: profit },
      { name: 'Lucro GURU', value: guruProfit }
    ];
    
    // Função para extrair dados de CPL
    function extractCPLData() {
      const cplFields = ['CPL1', 'CPL2', 'CPL3', 'CPL4', 'CPL Único'];
      const result = {
        values: {},
        drops: {},
        percentages: {}
      };
      
      // Primeiro passo: buscar valores brutos de CPL
      for (const field of cplFields) {
        for (const key of Object.keys(launchData)) {
          if (key.includes(field)) {
            const value = getNumericValue(launchData[key]);
            // Normalizar valor (se for muito grande, assumir que está em milhares)
            const normalizedValue = value > 1000 ? value / 1000 : value;
            result.values[field] = normalizedValue;
            break;
          }
        }
      }
      
      // Segundo passo: calcular quedas entre CPLs consecutivos
      const orderedCPLs = ['CPL1', 'CPL2', 'CPL3', 'CPL4'].filter(cpl => result.values[cpl] !== undefined);
      
      for (let i = 0; i < orderedCPLs.length - 1; i++) {
        const currentCPL = orderedCPLs[i];
        const nextCPL = orderedCPLs[i + 1];
        
        const currentValue = result.values[currentCPL];
        const nextValue = result.values[nextCPL];
        
        if (currentValue > 0) {
          const dropPercentage = ((currentValue - nextValue) / currentValue) * 100;
          result.drops[`${currentCPL}-${nextCPL}`] = dropPercentage;
        }
      }
      
      // Terceiro passo: calcular % em relação aos leads totais
      if (totalLeads > 0) {
        // Procurar campos com informação sobre quantos leads foram atingidos em cada CPL
        const cplLeadsFields = ['Pico CPL1', 'Pico CPL2', 'Pico CPL3', 'Pico CPL4'];
        
        for (const field of cplLeadsFields) {
          for (const key of Object.keys(launchData)) {
            if (key.includes(field)) {
              const value = getNumericValue(launchData[key]);
              const cplNumber = field.replace('Pico ', '');
              // Calcular percentual em relação ao total de leads
              result.percentages[cplNumber] = value; // Já está em percentual
              break;
            }
          }
        }
      }
      
      return result;
    }
    
    // Função para encontrar valores de investimento do Facebook e Google
    function extractAdsInvestments() {
      let fbValue = 0;
      let googleValue = 0;
      
      // Procurar valores de Facebook próximos a "FACEBOOK"
      for (const key of Object.keys(launchData)) {
        if (key.toUpperCase().includes('FACEBOOK')) {
          const value = getNumericValue(launchData[key]);
          if (value > 0) {
            fbValue = value;
            break;
          }
          
          // Se o próprio campo não tem valor, verificar o próximo campo
          const keyIndex = Object.keys(launchData).indexOf(key);
          if (keyIndex >= 0 && keyIndex < Object.keys(launchData).length - 1) {
            const nextKey = Object.keys(launchData)[keyIndex + 1];
            const nextValue = getNumericValue(launchData[nextKey]);
            if (nextValue > 0) {
              fbValue = nextValue;
              break;
            }
          }
        }
      }
      
      // Procurar valores de Google próximos a "GOOGLE"
      for (const key of Object.keys(launchData)) {
        if (key.toUpperCase().includes('GOOGLE')) {
          const value = getNumericValue(launchData[key]);
          if (value > 0) {
            googleValue = value;
            break;
          }
          
          // Se o próprio campo não tem valor, verificar o próximo campo
          const keyIndex = Object.keys(launchData).indexOf(key);
          if (keyIndex >= 0 && keyIndex < Object.keys(launchData).length - 1) {
            const nextKey = Object.keys(launchData)[keyIndex + 1];
            const nextValue = getNumericValue(launchData[nextKey]);
            if (nextValue > 0) {
              googleValue = nextValue;
              break;
            }
          }
        }
      }
      
      return [fbValue, googleValue];
    }
    
    // Função auxiliar para encontrar o valor de uma métrica
    function findMetricValue(keywords) {
      for (const key of Object.keys(launchData)) {
        const lowerKey = key.toLowerCase();
        if (keywords.some(keyword => lowerKey.includes(keyword))) {
          return getNumericValue(launchData[key]);
        }
      }
      return 0;
    }
    
    // Função para obter dados de distribuição de investimento
    function getInvestmentDistribution() {
      const distribution = [];
      const investmentFields = [];
      
      // Buscar campos de investimento entre "Investimentos Totais" e "Facebook"
      let foundInvestmentTotals = false;
      let foundFacebook = false;
      
      for (const key of Object.keys(launchData)) {
        const lowerKey = key.toLowerCase();
        
        if (!foundInvestmentTotals && 
            (lowerKey.includes('investimento total') || 
             lowerKey.includes('investimentos totais'))) {
          foundInvestmentTotals = true;
          continue;
        }
        
        if (foundInvestmentTotals && !foundFacebook && 
            (lowerKey.includes('facebook') || 
             lowerKey.includes('fb '))) {
          foundFacebook = true;
          continue;
        }
        
        if (foundInvestmentTotals && !foundFacebook && 
            (lowerKey.includes('invest') || lowerKey.includes('gasto'))) {
          investmentFields.push(key);
        }
      }
      
      // Adicionar cada campo encontrado à distribuição
      investmentFields.forEach(field => {
        const value = getNumericValue(launchData[field]);
        if (value > 0) {
          distribution.push({
            name: field,
            value: value,
            // Adicionar nome abreviado para o gráfico
            shortName: field.replace('Investimento em ', '')
                          .replace('Investimento ', '')
                          .replace(' Lembrete/ Antecipação', '')
                          .replace(' Aula', '')
                          .replace(' Carta', '')
                          .replace(' Vendas/ Carrinho', '')
          });
        }
      });
      
      return distribution;
    }
    
    // Função para obter dados de lead scoring
    function getLeadScoring() {
      const scoring = {};
      const scoringPrefix = 'Faixa ';
      const scoringLetters = ['A', 'B', 'C', 'D', 'E'];
      
      scoringLetters.forEach(letter => {
        const field = `${scoringPrefix}${letter}`;
        
        // Procurar o campo exato ou similar
        for (const key of Object.keys(launchData)) {
          if (key === field || key.includes(field)) {
            const value = getNumericValue(launchData[key]);
            scoring[letter] = {
              value: value > 100 ? value / 1000 : value, // Corrigir valores muito grandes (assumir percentual)
              color: getScoreColor(letter)
            };
            break;
          }
        }
      });
      
      return scoring;
    }
    
    // Função para obter cor com base na letra da faixa
    function getScoreColor(letter) {
      switch (letter) {
        case 'A': return '#37E359'; // Verde forte
        case 'B': return '#4CAF50'; // Verde médio
        case 'C': return '#FFC107'; // Amarelo
        case 'D': return '#FF5722'; // Laranja/vermelho
        case 'E': return '#F44336'; // Vermelho
        default: return '#757575';  // Cinza (neutro)
      }
    }
    
    return (
      <Box mt={2}>
        <Grid container spacing={3} mb={4}>
          <Grid item xs={12} sm={6} md={3}>
            <MetricCard
              title="Investimentos Totais"
              value={formatCurrency(effectiveInvestment)}
              icon={<AttachMoney sx={{ color: '#FF5722' }} />}
              color="#FF5722"
              subtitle="Total investido no lançamento"
            />
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <MetricCard
              title="Custo Médio do Lead"
              value={formatCurrency(leadCost)}
              icon={<People sx={{ color: '#37E359' }} />}
              color="#37E359"
              subtitle={`Baseado em ${totalLeads.toLocaleString('pt-BR')} leads`}
            />
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <MetricCard
              title="Investimento Facebook"
              value={formatCurrency(facebookInvestment)}
              icon={<Facebook sx={{ color: '#1877F2' }} />}
              color="#1877F2"
            />
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <MetricCard
              title="Investimento Google"
              value={formatCurrency(googleInvestment)}
              icon={<Google sx={{ color: '#EA4335' }} />}
              color="#EA4335"
            />
          </Grid>
          
          <Grid item xs={12} sm={6} md={4}>
            <MetricCard
              title="Faturamento GURU"
              value={formatCurrency(guruRevenue)}
              icon={<AttachMoney sx={{ color: '#4CAF50' }} />}
              color="#4CAF50"
            />
          </Grid>
          
          <Grid item xs={12} sm={6} md={4}>
            <MetricCard
              title="Faturamento TMB"
              value={formatCurrency(tmbRevenue)}
              icon={<AttachMoney sx={{ color: '#673AB7' }} />}
              color="#673AB7"
            />
          </Grid>
          
          <Grid item xs={12} sm={6} md={4}>
            <MetricCard
              title="FATURAMENTO GERAL"
              value={formatCurrency(effectiveRevenue)}
              icon={<AttachMoney sx={{ color: '#FF5722' }} />}
              color="#FF5722"
              subtitle={`ROI Geral: ${roi.toFixed(2)}x | ROI GURU: ${guruRoi.toFixed(2)}x`}
            />
          </Grid>
        </Grid>
        
        {/* Lead Scoring */}
        {Object.keys(leadScoring).length > 0 && (
          <Grid container spacing={3} mb={4}>
            <Grid item xs={12}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>Lead Scoring</Typography>
                <Box display="flex" flexWrap="wrap" gap={2} justifyContent="center">
                  {Object.entries(leadScoring).map(([letter, data]) => (
                    <Box 
                      key={letter}
                      sx={{ 
                        width: 100, 
                        height: 100, 
                        borderRadius: '50%', 
                        display: 'flex', 
                        flexDirection: 'column',
                        justifyContent: 'center', 
                        alignItems: 'center',
                        backgroundColor: `${data.color}20`,
                        border: `2px solid ${data.color}`,
                        boxShadow: `0 0 8px ${data.color}40`
                      }}
                    >
                      <Typography variant="h4" fontWeight="bold" sx={{ color: data.color }}>
                        {letter}
                      </Typography>
                      <Typography variant="body2" fontWeight="medium">
                        {data.value ? `${data.value.toFixed(1)}%` : '-'}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Paper>
            </Grid>
          </Grid>
        )}
        
        {/* CPL Metrics */}
        {Object.keys(cplData.values).length > 0 && (
          <Grid container spacing={3} mb={4}>
            <Grid item xs={12}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>Análise de CPL (Custo por Lead)</Typography>
                <Grid container spacing={2} mb={3}>
                  {Object.entries(cplData.values).map(([cplName, value]) => (
                    <Grid item xs={6} sm={4} md={2} key={cplName}>
                      <Box 
                        sx={{ 
                          p: 2, 
                          border: '1px solid rgba(0,0,0,0.1)', 
                          borderRadius: 2, 
                          textAlign: 'center',
                          backgroundColor: '#f8f9fa',
                          boxShadow: 'rgba(0, 0, 0, 0.05) 0px 1px 2px'
                        }}
                      >
                        <Typography variant="subtitle1" gutterBottom fontWeight="medium">
                          {cplName}
                        </Typography>
                        <Typography variant="h5" color="primary">
                          {formatCurrency(value)}
                        </Typography>
                        
                        {/* Percentual em relação ao total de leads */}
                        {cplData.percentages[cplName] && (
                          <Typography variant="body2" color="text.secondary" mt={1}>
                            {cplData.percentages[cplName].toFixed(1)}% dos leads
                          </Typography>
                        )}
                      </Box>
                    </Grid>
                  ))}
                </Grid>
                
                {/* Quedas entre CPLs */}
                {Object.keys(cplData.drops).length > 0 && (
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Quedas entre CPLs
                    </Typography>
                    <Box display="flex" flexWrap="wrap" gap={2}>
                      {Object.entries(cplData.drops).map(([dropKey, percentage]) => {
                        const [from, to] = dropKey.split('-');
                        return (
                          <Chip 
                            key={dropKey}
                            label={`${from} → ${to}: ${percentage.toFixed(1)}%`}
                            color="success"
                            variant="outlined"
                            size="small"
                          />
                        );
                      })}
                    </Box>
                  </Box>
                )}
              </Paper>
            </Grid>
          </Grid>
        )}
        
        <Grid container spacing={3}>
          {/* Gráfico de ROI */}
          <Grid item xs={12}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>ROI do Lançamento</Typography>
              <Box height={300}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={roiChartData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(value) => formatCurrency(value).replace('R$', '').trim()} />
                    <RechartsTooltip formatter={(value) => formatCurrency(value)} />
                    <Legend />
                    <Bar 
                      dataKey="value" 
                      fill="#37E359" 
                      name="Valor" 
                      label={{ 
                        position: 'top', 
                        formatter: (value) => formatCurrency(value).replace('R$', '').trim()
                      }} 
                    />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </Paper>
          </Grid>
          
          {/* Gráfico de Distribuição de Investimento */}
          <Grid item xs={12}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>Distribuição de Investimento</Typography>
              <Box height={400}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={investmentChartData.map(item => ({
                      ...item,
                      // Encurtar o nome para exibição (manter apenas palavras-chave)
                      shortName: item.name.replace('Investimento em ', '').replace('Investimento ', '')
                    }))}
                    margin={{ top: 20, right: 120, left: 150, bottom: 5 }}
                    layout="vertical"
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tickFormatter={(value) => formatCurrency(value).replace('R$', '').trim()} />
                    <YAxis 
                      dataKey="shortName" 
                      type="category" 
                      width={140}
                      tick={{ fontSize: 12 }}
                    />
                    <RechartsTooltip 
                      formatter={(value) => formatCurrency(value)} 
                      labelFormatter={(label) => investmentChartData.find(item => item.shortName === label)?.name || label}
                    />
                    <Legend />
                    <Bar 
                      dataKey="value" 
                      fill="#1877F2" 
                      name="Valor" 
                      label={{
                        position: 'insideRight',
                        formatter: (value) => formatCurrency(value).replace('R$', '').trim(),
                        fill: '#fff',
                        fontSize: 12
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </Paper>
          </Grid>
          
          {/* Distribuição de Receita */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>Distribuição de Receita</Typography>
              <Box height={300}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={revenueChartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {revenueChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[(index + 3) % COLORS.length]} />
                      ))}
                    </Pie>
                    <Legend />
                    <RechartsTooltip formatter={(value) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
            </Paper>
          </Grid>
          
          {/* ROI Comparativo */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>ROI Comparativo</Typography>
              <Box p={2}>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <Box p={2} sx={{ border: '1px solid rgba(0,0,0,0.1)', borderRadius: 2 }}>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        ROI Geral (GURU + TMB)
                      </Typography>
                      <Typography variant="h4" fontWeight="bold" color={roi >= 1 ? 'success.main' : 'error.main'}>
                        {roi.toFixed(2)}x
                      </Typography>
                      <Typography variant="body2" color="text.secondary" mt={1}>
                        Faturamento: {formatCurrency(effectiveRevenue)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Lucro: {formatCurrency(profit)}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Box p={2} sx={{ border: '1px solid rgba(0,0,0,0.1)', borderRadius: 2 }}>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        ROI GURU (Cartão)
                      </Typography>
                      <Typography variant="h4" fontWeight="bold" color={guruRoi >= 1 ? 'success.main' : 'error.main'}>
                        {guruRoi.toFixed(2)}x
                      </Typography>
                      <Typography variant="body2" color="text.secondary" mt={1}>
                        Faturamento: {formatCurrency(guruRevenue)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Lucro: {formatCurrency(guruProfit)}
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </Box>
    );
  };

  // Renderizar tab de métricas
  const renderMetricsTab = () => {
    if (!launchData || Object.keys(launchData).length === 0) {
      return (
        <Box p={3} textAlign="center">
          <Typography>Selecione um lançamento para visualizar as métricas</Typography>
        </Box>
      );
    }
    
    // Agrupar métricas por categoria
    const categories = {
      'Informações Gerais': [],
      'Datas do Lançamento': [],
      'Investimentos': [],
      'Leads': [],
      'Lead Scoring': [],
      'Vendas': [],
      'Performance de Vendas': [],
      'Receitas': [],
      'Métricas': [],
      'Outros': []
    };
    
    // Identificar campos específicos
    const dateFields = [
      'Início da Captação', 'Fim da Captação', 
      'CPL1', 'CPL Único', 'CPL2', 'CPL3', 'CPL4',
      'Abertura de Carrinho', 'Fechamento de Carrinho'
    ];
    
    const leadScoringFields = ['Faixa A', 'Faixa B', 'Faixa C', 'Faixa D', 'Faixa E'];
    
    const salesPerformancePatterns = [
      'primeiros 10 minutos', '7h~7h10',
      'primeira hora', '7h~7h59',
      '7h~11h59', '7h~17h59', '7h~23h59',
      '% do todo'
    ];
    
    // Preencher categorias com métricas filtradas
    filteredMetrics.forEach(metric => {
      let category = 'Outros';
      const lowerMetric = metric.toLowerCase();
      
      // Verificar se é um campo de data
      if (dateFields.some(date => metric.includes(date))) {
        category = 'Datas do Lançamento';
      }
      // Verificar se é lead scoring
      else if (leadScoringFields.some(score => metric.includes(score))) {
        category = 'Lead Scoring';
      }
      // Verificar se é performance de vendas
      else if (salesPerformancePatterns.some(pattern => lowerMetric.includes(pattern.toLowerCase()))) {
        category = 'Performance de Vendas';
      }
      // Outras categorias
      else if (lowerMetric.includes('invest') || lowerMetric.includes('custo') || lowerMetric.includes('gasto')) {
        category = 'Investimentos';
      } else if (lowerMetric.includes('lead') || lowerMetric.includes('email') || lowerMetric.includes('cadastro')) {
        category = 'Leads';
      } else if (lowerMetric.includes('venda') || lowerMetric.includes('convers')) {
        category = 'Vendas';
      } else if (lowerMetric.includes('receita') || lowerMetric.includes('faturamento') || lowerMetric.includes('ticket')) {
        category = 'Receitas';
      } else if (lowerMetric.includes('roi') || lowerMetric.includes('cpl') || lowerMetric.includes('cac')) {
        category = 'Métricas';
      } else if (filteredMetrics.indexOf(metric) < 10) {
        category = 'Informações Gerais';
      }
      
      // Adicionar à categoria apropriada
      categories[category].push({
        name: metric,
        value: launchData[metric],
        formattedValue: formatValue(launchData[metric], metric)
      });
    });
    
    // Função para renderizar valor conforme o tipo de campo
    const renderMetricValue = (metric) => {
      // Verificar se é um campo de lead scoring
      if (leadScoringFields.some(score => metric.name.includes(score))) {
        const letter = metric.name.includes('Faixa') ? metric.name.split(' ')[1][0] : '';
        let color = '#757575';
        
        if (letter) {
          switch (letter) {
            case 'A': color = '#37E359'; break; // Verde forte
            case 'B': color = '#4CAF50'; break; // Verde médio
            case 'C': color = '#FFC107'; break; // Amarelo
            case 'D': color = '#FF5722'; break; // Laranja/vermelho
            case 'E': color = '#F44336'; break; // Vermelho
          }
        }
        
        // Corrigir valor de lead scoring se for muito grande
        let value = getNumericValue(metric.value);
        if (value > 100) {
          value = value / 1000;
        }
        
        return (
          <Typography 
            variant="body2" 
            fontWeight="medium" 
            style={{ color }}
          >
            {value ? `${value.toFixed(1)}%` : '-'}
          </Typography>
        );
      }
      
      // Verificar se é um campo de percentual
      if (metric.name.toLowerCase().includes('pico cpl') || 
          metric.name.toLowerCase().includes('% do todo')) {
        return (
          <Typography variant="body2" fontWeight="medium">
            {metric.value ? `${parseFloat(metric.value).toFixed(1)}%` : metric.formattedValue}
          </Typography>
        );
      }
      
      // Verificar se é campo de CPL
      if (metric.name.includes('CPL')) {
        // Corrigir valor de CPL se for muito grande
        let value = getNumericValue(metric.value);
        if (value > 1000) {
          value = value / 1000;
        }
        return (
          <Typography variant="body2" fontWeight="medium">
            {formatCurrency(value)}
          </Typography>
        );
      }
      
      // Para os demais campos, retornar valor formatado normal
      return (
        <Typography variant="body2" fontWeight="medium">
          {metric.formattedValue}
        </Typography>
      );
    };
    
    return (
      <Box mt={2}>
        <Box mb={3}>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Buscar métricas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            }}
            sx={{ maxWidth: 400 }}
          />
        </Box>
        
        <Grid container spacing={3}>
          {Object.entries(categories).map(([category, categoryMetrics]) => {
            if (categoryMetrics.length === 0) return null;
            
            const isExpanded = expandedSections[category] !== false; // Por padrão expandido
            
            return (
              <Grid item xs={12} key={category}>
                <Paper>
                  <Box 
                    sx={{ 
                      p: 2, 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      backgroundColor: 'action.selected',
                      cursor: 'pointer'
                    }}
                    onClick={() => toggleSection(category)}
                  >
                    <Typography variant="subtitle1" fontWeight="bold">
                      {category} ({categoryMetrics.length})
                    </Typography>
                    <IconButton size="small">
                      {isExpanded ? <ExpandLess /> : <ExpandMore />}
                    </IconButton>
                  </Box>
                  
                  {isExpanded && (
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell><strong>Métrica</strong></TableCell>
                            <TableCell align="right"><strong>Valor</strong></TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {categoryMetrics.map((metric) => (
                            <TableRow key={metric.name} hover>
                              <TableCell>{metric.name}</TableCell>
                              <TableCell align="right">
                                {renderMetricValue(metric)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </Paper>
              </Grid>
            );
          })}
        </Grid>
      </Box>
    );
  };

  // Renderizar tab de comparação
  const renderComparisonTab = () => {
    if (!launchData || Object.keys(launchData).length === 0) {
      return (
        <Box p={3} textAlign="center">
          <Typography>Selecione um lançamento para visualizar as análises</Typography>
        </Box>
      );
    }
    
    // Extrair dados de vendas por período
    const salesByPeriod = extractSalesByPeriod();
    
    // Função para extrair dados de vendas por período de tempo
    function extractSalesByPeriod() {
      const periods = {
        'primeiros_10_min': {
          title: 'Primeiros 10 minutos (7h~7h10)',
          guru: 0,
          tmb: 0,
          total: 0,
          percentage: 0
        },
        'primeira_hora': {
          title: 'Primeira hora (7h~7h59)',
          guru: 0,
          tmb: 0,
          total: 0,
          percentage: 0
        },
        'manha': {
          title: 'Manhã (7h~11h59)',
          guru: 0,
          tmb: 0,
          total: 0,
          percentage: 0
        },
        'tarde': {
          title: 'Tarde (7h~17h59)',
          guru: 0,
          tmb: 0,
          total: 0,
          percentage: 0
        },
        'dia_completo': {
          title: 'Dia Completo (7h~23h59)',
          guru: 0,
          tmb: 0,
          total: 0,
          percentage: 0
        }
      };
      
      // Procurar os campos relacionados a cada período
      Object.keys(launchData).forEach(key => {
        const lowerKey = key.toLowerCase();
        
        // Verificar período e tipo de valor
        let period = null;
        let valueType = null;
        
        if (lowerKey.includes('primeiros 10 minutos') || lowerKey.includes('7h~7h10')) {
          period = 'primeiros_10_min';
        } else if (lowerKey.includes('primeira hora') || lowerKey.includes('7h~7h59')) {
          period = 'primeira_hora';
        } else if (lowerKey.includes('7h~11h59')) {
          period = 'manha';
        } else if (lowerKey.includes('7h~17h59')) {
          period = 'tarde';
        } else if (lowerKey.includes('7h~23h59')) {
          period = 'dia_completo';
        }
        
        if (!period) return;
        
        // Verificar tipo de valor
        if (lowerKey.includes('guru')) {
          valueType = 'guru';
        } else if (lowerKey.includes('tmb')) {
          valueType = 'tmb';
        } else if (lowerKey.includes('geral') && !lowerKey.includes('%')) {
          valueType = 'total';
        } else if (lowerKey.includes('%') || lowerKey.includes('todo')) {
          valueType = 'percentage';
        }
        
        if (period && valueType) {
          const value = getNumericValue(launchData[key]);
          if (value > 0) {
            periods[period][valueType] = value;
          }
        }
      });
      
      return periods;
    }
    
    // Dados para gráfico de vendas por período
    const salesChartData = Object.values(salesByPeriod).map(period => ({
      name: period.title.split(' ')[0],
      GURU: period.guru,
      TMB: period.tmb,
      Total: period.total > 0 ? period.total : (period.guru + period.tmb)
    }));
    
    return (
      <Box mt={2}>
        <Grid container spacing={3}>
          {/* Análise de Vendas por Período */}
          <Grid item xs={12}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>Análise de Vendas por Período</Typography>
              
              {Object.values(salesByPeriod).some(p => p.guru > 0 || p.tmb > 0 || p.total > 0) ? (
                <>
                  <Box height={300} mb={4}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={salesChartData}
                        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <RechartsTooltip />
                        <Legend />
                        <Bar dataKey="GURU" fill="#4CAF50" name="GURU" />
                        <Bar dataKey="TMB" fill="#673AB7" name="TMB" />
                        <Bar dataKey="Total" fill="#FF5722" name="Total" />
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                  
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell><strong>Período</strong></TableCell>
                          <TableCell align="right"><strong>GURU</strong></TableCell>
                          <TableCell align="right"><strong>TMB</strong></TableCell>
                          <TableCell align="right"><strong>Total</strong></TableCell>
                          <TableCell align="right"><strong>% do Total</strong></TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {Object.values(salesByPeriod).map((period, index) => (
                          <TableRow key={index} hover>
                            <TableCell>{period.title}</TableCell>
                            <TableCell align="right">{period.guru.toLocaleString('pt-BR')}</TableCell>
                            <TableCell align="right">{period.tmb.toLocaleString('pt-BR')}</TableCell>
                            <TableCell align="right">
                              <Typography fontWeight="bold">
                                {(period.total > 0 ? period.total : (period.guru + period.tmb)).toLocaleString('pt-BR')}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              {period.percentage > 0 ? 
                                `${period.percentage.toFixed(2)}%` : 
                                '-'
                              }
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </>
              ) : (
                <Typography align="center" py={4}>
                  Não foram encontrados dados de vendas por período para este lançamento
                </Typography>
              )}
            </Paper>
          </Grid>
          
          {/* Previsões e Ticket Médio */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2, height: '100%' }}>
              <Typography variant="h6" gutterBottom>Previsões e Ticket Médio</Typography>
              <Box p={2}>
                <Grid container spacing={2}>
                  {['Previsão de Faturamento', 'Ticket Médio'].map((field, index) => {
                    let value = null;
                    // Buscar campo na planilha
                    for (const key of Object.keys(launchData)) {
                      if (key.includes(field)) {
                        value = getNumericValue(launchData[key]);
                        break;
                      }
                    }
                    
                    return (
                      <Grid item xs={12} key={index}>
                        <Box p={2} sx={{ border: '1px solid rgba(0,0,0,0.1)', borderRadius: 1 }}>
                          <Typography variant="body2" color="text.secondary">
                            {field}
                          </Typography>
                          <Typography variant="h5" fontWeight="medium">
                            {value ? formatCurrency(value) : '-'}
                          </Typography>
                        </Box>
                      </Grid>
                    );
                  })}
                </Grid>
              </Box>
            </Paper>
          </Grid>
          
          {/* Datas do Lançamento */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2, height: '100%' }}>
              <Typography variant="h6" gutterBottom>Datas do Lançamento</Typography>
              <TableContainer>
                <Table size="small">
                  <TableBody>
                    {['Início da Captação', 'Fim da Captação', 'Abertura de Carrinho', 'Fechamento de Carrinho'].map((dateField, index) => {
                      let dateValue = null;
                      // Buscar campo na planilha
                      for (const key of Object.keys(launchData)) {
                        if (key.includes(dateField)) {
                          dateValue = launchData[key];
                          break;
                        }
                      }
                      
                      return (
                        <TableRow key={index} hover>
                          <TableCell><strong>{dateField}</strong></TableCell>
                          <TableCell align="right">{dateValue || '-'}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
        </Grid>
      </Box>
    );
  };

  // Renderizar conteúdo baseado na tab selecionada
  const renderTabContent = () => {
    switch (tabValue) {
      case 0:
        return renderOverviewTab();
      case 1:
        return renderMetricsTab();
      case 2:
        return renderComparisonTab();
      default:
        return null;
    }
  };

  if (loading && !selectedLaunch) {
    return (
      <Container>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container>
        <Box p={3}>
          <Typography color="error">{error}</Typography>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl">
      <Box mb={4} mt={2}>
        <Typography variant="h4" component="h1" gutterBottom>
          Dashboard de Lançamentos
        </Typography>
        
        <Box mb={4}>
          <FormControl 
            variant="outlined" 
            sx={{ minWidth: 300 }}
            disabled={loading}
          >
            <InputLabel id="launch-select-label">Selecione o Lançamento</InputLabel>
            <Select
              labelId="launch-select-label"
              value={selectedLaunch}
              onChange={(e) => setSelectedLaunch(e.target.value)}
              label="Selecione o Lançamento"
            >
              {launchOptions.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          
          <CompareButton 
            onClick={handleOpenCompareModal} 
            selectedLaunch={selectedLaunch}
            disabled={loading}
          />
          
          {loading && selectedLaunch && (
            <CircularProgress size={24} sx={{ ml: 2 }} />
          )}
        </Box>
        
        {!loading && selectedLaunch && (
          <>
            <Typography variant="h5" gutterBottom>
              {selectedLaunch}
            </Typography>
            
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
              <Tabs 
                value={tabValue} 
                onChange={(e, newValue) => setTabValue(newValue)}
                variant="scrollable"
                scrollButtons="auto"
              >
                <Tab label="Visão Geral" icon={<Assessment />} iconPosition="start" />
                <Tab label="Métricas Detalhadas" icon={<ShowChart />} iconPosition="start" />
                <Tab label="Análise de Vendas" icon={<TrendingUp />} iconPosition="start" />
              </Tabs>
            </Box>
            
            {renderTabContent()}
          </>
        )}
        
        {/* Modal de Comparação */}
        <LaunchComparisonModal
          open={compareModalOpen}
          onClose={handleCloseCompareModal}
          launchOptions={launchOptions}
          initialLaunch={selectedLaunch}
        />
      </Box>
    </Container>
  );
};

export default LaunchPro;