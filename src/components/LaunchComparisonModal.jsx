// src/components/LaunchComparisonModal.jsx
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Divider,
  CircularProgress,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  Alert
} from '@mui/material';
import {
  Close,
  CompareArrows,
  TrendingUp,
  TrendingDown,
  RemoveCircleOutline,
  CheckCircleOutline,
  InfoOutlined,
  ExpandMore,
  ExpandLess
} from '@mui/icons-material';
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
import { formatCurrency } from '../utils/currencyUtils';
import launchService from '../services/launchService';

// Cores para os gráficos
const COLORS = ['#37E359', '#051626', '#FF4500', '#1E90FF', '#FFD700', '#FF1493'];

/**
 * Modal para comparação entre dois lançamentos
 * @param {Object} props
 * @param {boolean} props.open - Estado de abertura do modal
 * @param {function} props.onClose - Função para fechar o modal
 * @param {Array} props.launchOptions - Lista de lançamentos disponíveis para seleção
 * @param {string} props.initialLaunch - Lançamento inicial pré-selecionado (opcional)
 */
const LaunchComparisonModal = ({ open, onClose, launchOptions = [], initialLaunch = '' }) => {
  // Estados para os lançamentos selecionados
  const [firstLaunch, setFirstLaunch] = useState(initialLaunch || '');
  const [secondLaunch, setSecondLaunch] = useState('');
  
  // Estados para os dados dos lançamentos
  const [firstLaunchData, setFirstLaunchData] = useState(null);
  const [secondLaunchData, setSecondLaunchData] = useState(null);
  
  // Estado para controlar o carregamento
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Estado para controlar quais categorias de métricas estão expandidas
  const [expandedCategories, setExpandedCategories] = useState({
    investimentos: true,
    receitas: true,
    leads: true,
    conversao: true,
    outros: false
  });
  
  // Efeito para carregar os dados do primeiro lançamento quando selecionado
  useEffect(() => {
    const fetchFirstLaunchData = async () => {
      if (!firstLaunch) {
        setFirstLaunchData(null);
        return;
      }
      
      try {
        setError(null);
        setLoading(true);
        const data = await launchService.getLaunchData(firstLaunch);
        setFirstLaunchData(data);
      } catch (err) {
        console.error(`Erro ao buscar dados para ${firstLaunch}:`, err);
        setError(`Falha ao carregar dados do lançamento ${firstLaunch}`);
      } finally {
        setLoading(false);
      }
    };
    
    fetchFirstLaunchData();
  }, [firstLaunch]);
  
  // Efeito para carregar os dados do segundo lançamento quando selecionado
  useEffect(() => {
    const fetchSecondLaunchData = async () => {
      if (!secondLaunch) {
        setSecondLaunchData(null);
        return;
      }
      
      try {
        setError(null);
        setLoading(true);
        const data = await launchService.getLaunchData(secondLaunch);
        setSecondLaunchData(data);
      } catch (err) {
        console.error(`Erro ao buscar dados para ${secondLaunch}:`, err);
        setError(`Falha ao carregar dados do lançamento ${secondLaunch}`);
      } finally {
        setLoading(false);
      }
    };
    
    fetchSecondLaunchData();
  }, [secondLaunch]);
  
  // Função para alternar a expansão de uma categoria
  const toggleCategory = (category) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };
  
  // Função para extrair valor numérico de uma métrica
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
  
  // Função para verificar se uma métrica é do tipo percentual
  const isPercentageMetric = (metricName) => {
    if (!metricName) return false;
    
    const lowerMetric = metricName.toLowerCase();
    return lowerMetric.includes('faixa') || 
           lowerMetric.includes('taxa') ||
           lowerMetric.includes('percentual') ||
           lowerMetric.includes('pico') ||
           lowerMetric.includes('% ') ||
           lowerMetric.match(/^cpl\d*$/i); // Captura CPL, CPL1, CPL2, etc.
  };
  
  // Função para calcular a diferença percentual entre dois valores
  const calculateDiffPercent = (value1, value2) => {
    if (value2 === 0) return value1 === 0 ? 0 : 100;
    return ((value1 - value2) / Math.abs(value2)) * 100;
  };
  
  // Função para determinar se uma métrica é inversamente proporcional (menor é melhor)
  const isInverseDiff = (metricName) => {
    if (!metricName) return false;
    
    const lowerMetric = metricName.toLowerCase();
    return lowerMetric.includes('cpl') || 
           lowerMetric.includes('custo por lead') ||
           lowerMetric.includes('taxa de rejeição');
  };
  
  // Função para obter a cor com base na diferença (verde para melhor, vermelho para pior)
  const getDiffColor = (diff, inverse = false) => {
    // Para algumas métricas, valores menores são melhores (como CPL)
    // Para essas, usamos inverse = true
    const isPositive = inverse ? diff < 0 : diff > 0;
    return isPositive ? 'success.main' : diff < 0 ? 'error.main' : 'text.secondary';
  };
  
  // Função para formatar a diferença percentual
  const formatDiffPercent = (diff) => {
    const sign = diff > 0 ? '+' : '';
    return `${sign}${diff.toFixed(2)}%`;
  };
  
  // Função para agrupar e categorizar métricas
  const getCategorizedMetrics = () => {
    if (!firstLaunchData || !secondLaunchData) return {};
    
    // Mapeamento de categorias e suas palavras-chave
    const categoryKeywords = {
      investimentos: ['investimento', 'custo', 'gasto', 'facebook', 'google'],
      receitas: ['receita', 'faturamento', 'guru', 'tmb', 'roi'],
      leads: ['lead', 'email', 'contato', 'cadastro', 'cpl'],
      conversao: ['conversão', 'taxa', 'abertura', 'clique', 'faixa']
    };
    
    // Função para determinar a categoria de uma métrica
    const getMetricCategory = (metricName) => {
      const lowerMetric = metricName.toLowerCase();
      
      for (const [category, keywords] of Object.entries(categoryKeywords)) {
        if (keywords.some(keyword => lowerMetric.includes(keyword))) {
          return category;
        }
      }
      
      return 'outros';
    };
    
    // Combinar métricas de ambos os lançamentos
    const allMetricNames = new Set([
      ...Object.keys(firstLaunchData),
      ...Object.keys(secondLaunchData)
    ]);
    
    // Agrupar métricas por categoria
    const categorizedMetrics = {
      investimentos: [],
      receitas: [],
      leads: [],
      conversao: [],
      outros: []
    };
    
    // Priorizar métricas-chave para aparecerem primeiro
    const priorityMetrics = [
      'Investimento Total', 'Receita Total', 'ROI', 'Leads', 'CPL'
    ];
    
    // Primeiro adicionar as métricas prioritárias em ordem
    priorityMetrics.forEach(metricName => {
      if (allMetricNames.has(metricName)) {
        const category = getMetricCategory(metricName);
        
        // Obter valores de ambos os lançamentos
        const value1 = getNumericValue(firstLaunchData[metricName]);
        const value2 = getNumericValue(secondLaunchData[metricName]);
        
        // Calcular diferença percentual
        const diffPercent = calculateDiffPercent(value1, value2);
        
        // Determinar se valores menores são melhores (como CPL)
        const inverseDiff = isInverseDiff(metricName);
        
        categorizedMetrics[category].push({
          name: metricName,
          value1,
          value2,
          diff: value1 - value2,
          diffPercent,
          inverseDiff,
          isPercentage: isPercentageMetric(metricName)
        });
        
        // Remover da lista geral
        allMetricNames.delete(metricName);
      }
    });
    
    // Adicionar as métricas restantes
    allMetricNames.forEach(metricName => {
      const category = getMetricCategory(metricName);
      
      // Obter valores de ambos os lançamentos
      const value1 = getNumericValue(firstLaunchData[metricName] || 0);
      const value2 = getNumericValue(secondLaunchData[metricName] || 0);
      
      // Calcular diferença percentual
      const diffPercent = calculateDiffPercent(value1, value2);
      
      // Determinar se valores menores são melhores
      const inverseDiff = isInverseDiff(metricName);
      
      categorizedMetrics[category].push({
        name: metricName,
        value1,
        value2,
        diff: value1 - value2,
        diffPercent,
        inverseDiff,
        isPercentage: isPercentageMetric(metricName)
      });
    });
    
    return categorizedMetrics;
  };
  
  // Função para renderizar tabela comparativa de métricas por categoria
  const renderMetricsTable = (metrics, category) => {
    if (!metrics || metrics.length === 0) {
      return (
        <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
          Nenhuma métrica encontrada nesta categoria
        </Typography>
      );
    }
    
    return (
      <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell><strong>Métrica</strong></TableCell>
              <TableCell align="right"><strong>{firstLaunch}</strong></TableCell>
              <TableCell align="right"><strong>{secondLaunch}</strong></TableCell>
              <TableCell align="right"><strong>Diferença</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {metrics.map((metric, index) => {
              // Determinar se é uma métrica monetária
              const isMonetary = !metric.isPercentage && (
                metric.name.toLowerCase().includes('investimento') || 
                metric.name.toLowerCase().includes('receita') || 
                metric.name.toLowerCase().includes('faturamento') ||
                metric.name.toLowerCase().includes('custo') ||
                metric.name.toLowerCase().includes('valor')
              );
              
              return (
                <TableRow key={index} hover>
                  <TableCell>
                    {metric.name}
                    {metric.inverseDiff && (
                      <Tooltip title="Para esta métrica, valores menores são melhores">
                        <InfoOutlined fontSize="small" sx={{ ml: 1, verticalAlign: 'middle', fontSize: '1rem', color: 'text.secondary' }} />
                      </Tooltip>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    {metric.isPercentage 
                      ? `${metric.value1.toFixed(2)}%` 
                      : isMonetary 
                        ? formatCurrency(metric.value1) 
                        : metric.value1.toLocaleString('pt-BR')}
                  </TableCell>
                  <TableCell align="right">
                    {metric.isPercentage 
                      ? `${metric.value2.toFixed(2)}%` 
                      : isMonetary 
                        ? formatCurrency(metric.value2) 
                        : metric.value2.toLocaleString('pt-BR')}
                  </TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                      {metric.diff > 0 ? (
                        <TrendingUp 
                          fontSize="small" 
                          sx={{ 
                            color: getDiffColor(metric.diffPercent, metric.inverseDiff),
                            mr: 0.5
                          }} 
                        />
                      ) : metric.diff < 0 ? (
                        <TrendingDown 
                          fontSize="small" 
                          sx={{ 
                            color: getDiffColor(metric.diffPercent, metric.inverseDiff),
                            mr: 0.5
                          }} 
                        />
                      ) : (
                        <RemoveCircleOutline 
                          fontSize="small" 
                          sx={{ color: 'text.secondary', mr: 0.5 }} 
                        />
                      )}
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          fontWeight: 'medium',
                          color: getDiffColor(metric.diffPercent, metric.inverseDiff)
                        }}
                      >
                        {formatDiffPercent(metric.diffPercent)}
                        {!metric.isPercentage && isMonetary && (
                          <Typography
                            component="span"
                            variant="caption"
                            sx={{ 
                              ml: 1, 
                              color: 'text.secondary',
                              fontWeight: 'normal'
                            }}
                          >
                            ({formatCurrency(Math.abs(metric.diff))})
                          </Typography>
                        )}
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };
  
  // Função para renderizar gráficos comparativos
  const renderComparisonCharts = () => {
    if (!firstLaunchData || !secondLaunchData) return null;
    
    // Extrair métricas importantes para os gráficos
    const findMetricValue = (data, keywords) => {
      for (const key of Object.keys(data)) {
        const lowerKey = key.toLowerCase();
        if (keywords.some(keyword => lowerKey.includes(keyword))) {
          return getNumericValue(data[key]);
        }
      }
      return 0;
    };
    
    // Investimento
    const firstInvestment = findMetricValue(firstLaunchData, ['investimento total', 'total investido']);
    const secondInvestment = findMetricValue(secondLaunchData, ['investimento total', 'total investido']);
    
    // Receita
    const firstRevenue = findMetricValue(firstLaunchData, ['receita total', 'faturamento total']);
    const secondRevenue = findMetricValue(secondLaunchData, ['receita total', 'faturamento total']);
    
    // Leads
    const firstLeads = findMetricValue(firstLaunchData, ['leads total', 'total de leads', 'leads']);
    const secondLeads = findMetricValue(secondLaunchData, ['leads total', 'total de leads', 'leads']);
    
    // CPL
    const firstCPL = findMetricValue(firstLaunchData, ['cpl', 'custo por lead']);
    const secondCPL = findMetricValue(secondLaunchData, ['cpl', 'custo por lead']);
    
    // ROI
    const firstROI = firstInvestment > 0 ? firstRevenue / firstInvestment : 0;
    const secondROI = secondInvestment > 0 ? secondRevenue / secondInvestment : 0;
    
    // Dados para o gráfico de investimento vs receita
    const investmentRevenueData = [
      {
        name: 'Investimento',
        [firstLaunch]: firstInvestment,
        [secondLaunch]: secondInvestment
      },
      {
        name: 'Receita',
        [firstLaunch]: firstRevenue,
        [secondLaunch]: secondRevenue
      },
      {
        name: 'Lucro',
        [firstLaunch]: firstRevenue - firstInvestment,
        [secondLaunch]: secondRevenue - secondInvestment
      }
    ];
    
    // Dados para o gráfico de leads e CPL
    const leadsData = [
      {
        name: 'Leads',
        [firstLaunch]: firstLeads,
        [secondLaunch]: secondLeads
      }
    ];
    
    const cplData = [
      {
        name: 'CPL',
        [firstLaunch]: firstCPL,
        [secondLaunch]: secondCPL
      }
    ];
    
    // Dados para o gráfico de ROI
    const roiData = [
      {
        name: 'ROI',
        [firstLaunch]: firstROI,
        [secondLaunch]: secondROI
      }
    ];
    
    return (
      <Box mt={4}>
        <Typography variant="h6" gutterBottom>
          Gráficos Comparativos
        </Typography>
        
        <Grid container spacing={3}>
          {/* Gráfico de Investimento vs Receita */}
          <Grid item xs={12}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                Investimento vs Receita
              </Typography>
              <Box height={350}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={investmentRevenueData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(value) => formatCurrency(value).replace('R$', '').trim()} />
                    <RechartsTooltip formatter={(value) => formatCurrency(value)} />
                    <Legend />
                    <Bar dataKey={firstLaunch} fill="#37E359" name={firstLaunch} />
                    <Bar dataKey={secondLaunch} fill="#1E90FF" name={secondLaunch} />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </Paper>
          </Grid>
          
          {/* Gráfico de Leads */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                Leads Captados
              </Typography>
              <Box height={250}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={leadsData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <RechartsTooltip formatter={(value) => value.toLocaleString('pt-BR')} />
                    <Legend />
                    <Bar dataKey={firstLaunch} fill="#37E359" name={firstLaunch} />
                    <Bar dataKey={secondLaunch} fill="#1E90FF" name={secondLaunch} />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </Paper>
          </Grid>
          
          {/* Gráfico de CPL */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                Custo por Lead (CPL)
              </Typography>
              <Box height={250}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={cplData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(value) => formatCurrency(value).replace('R$', '').trim()} />
                    <RechartsTooltip formatter={(value) => formatCurrency(value)} />
                    <Legend />
                    <Bar dataKey={firstLaunch} fill="#37E359" name={firstLaunch} />
                    <Bar dataKey={secondLaunch} fill="#1E90FF" name={secondLaunch} />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </Paper>
          </Grid>
          
          {/* Gráfico de ROI */}
          <Grid item xs={12}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                ROI (Return on Investment)
              </Typography>
              <Box height={250}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={roiData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(value) => `${value.toFixed(2)}x`} />
                    <RechartsTooltip formatter={(value) => `${value.toFixed(2)}x`} />
                    <Legend />
                    <Bar dataKey={firstLaunch} fill="#37E359" name={firstLaunch} />
                    <Bar dataKey={secondLaunch} fill="#1E90FF" name={secondLaunch} />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </Box>
    );
  };
  
  // Verificar se ambos os lançamentos estão selecionados
  const bothLaunchesSelected = firstLaunch && secondLaunch;
  
  // Verificar se temos dados carregados para ambos os lançamentos
  const dataLoaded = firstLaunchData && secondLaunchData;
  
  // Obter métricas categorizadas se temos dados
  const categorizedMetrics = dataLoaded ? getCategorizedMetrics() : {};
  
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="lg"
      PaperProps={{
        sx: { height: '90vh' }
      }}
    >
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">
            Comparação entre Lançamentos
          </Typography>
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>
      
      <DialogContent dividers>
        {/* Seleção de lançamentos */}
        <Grid container spacing={3} mb={4}>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>Primeiro Lançamento</InputLabel>
              <Select
                value={firstLaunch}
                onChange={(e) => setFirstLaunch(e.target.value)}
                label="Primeiro Lançamento"
              >
                <MenuItem value="">
                  <em>Selecione um lançamento</em>
                </MenuItem>
                {launchOptions.map((option) => (
                  <MenuItem 
                    key={`first-${option}`} 
                    value={option}
                    disabled={option === secondLaunch}
                  >
                    {option}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>Segundo Lançamento</InputLabel>
              <Select
                value={secondLaunch}
                onChange={(e) => setSecondLaunch(e.target.value)}
                label="Segundo Lançamento"
              >
                <MenuItem value="">
                  <em>Selecione um lançamento</em>
                </MenuItem>
                {launchOptions.map((option) => (
                  <MenuItem 
                    key={`second-${option}`} 
                    value={option}
                    disabled={option === firstLaunch}
                  >
                    {option}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>
        
        {/* Indicador de carregamento */}
        {loading && (
          <Box display="flex" justifyContent="center" my={4}>
            <CircularProgress />
          </Box>
        )}
        
        {/* Mensagem de erro */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}
        
        {/* Instruções se não houver seleção */}
        {!bothLaunchesSelected && !loading && (
          <Box textAlign="center" py={6}>
            <Typography variant="body1" color="text.secondary" gutterBottom>
              Selecione dois lançamentos para comparar suas métricas
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Você poderá ver side-by-side os principais indicadores como investimento, receita, leads e ROI
            </Typography>
          </Box>
        )}
        
        {/* Conteúdo quando ambos os lançamentos estão selecionados e os dados carregados */}
        {bothLaunchesSelected && dataLoaded && !loading && (
          <>
            {/* Resumo de Métricas */}
            <Box mb={4}>
              <Typography variant="h6" gutterBottom>
                Resumo Comparativo
              </Typography>
              
              <Grid container spacing={2}>
                {/* Investimento */}
                <Grid item xs={12} md={4}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Investimento Total
                    </Typography>
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          {firstLaunch}
                        </Typography>
                        <Typography variant="h6">
                          {formatCurrency(getNumericValue(firstLaunchData['Investimento Total'] || 0))}
                        </Typography>
                      </Box>
                      <CompareArrows sx={{ color: 'text.disabled', mx: 1 }} />
                      <Box textAlign="right">
                        <Typography variant="body2" color="text.secondary">
                          {secondLaunch}
                        </Typography>
                        <Typography variant="h6">
                          {formatCurrency(getNumericValue(secondLaunchData['Investimento Total'] || 0))}
                        </Typography>
                      </Box>
                    </Box>
                  </Paper>
                </Grid>
                
                {/* Receita */}
                <Grid item xs={12} md={4}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Receita Total
                    </Typography>
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          {firstLaunch}
                        </Typography>
                        <Typography variant="h6">
                          {formatCurrency(getNumericValue(firstLaunchData['Receita Total'] || 0))}
                        </Typography>
                      </Box>
                      <CompareArrows sx={{ color: 'text.disabled', mx: 1 }} />
                      <Box textAlign="right">
                        <Typography variant="body2" color="text.secondary">
                          {secondLaunch}
                        </Typography>
                        <Typography variant="h6">
                          {formatCurrency(getNumericValue(secondLaunchData['Receita Total'] || 0))}
                        </Typography>
                      </Box>
                    </Box>
                  </Paper>
                </Grid>
                
                {/* ROI */}
                <Grid item xs={12} md={4}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      ROI
                    </Typography>
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          {firstLaunch}
                        </Typography>
                        <Typography variant="h6">
                          {getNumericValue(firstLaunchData['ROI'] || 0).toFixed(2)}x
                        </Typography>
                      </Box>
                      <CompareArrows sx={{ color: 'text.disabled', mx: 1 }} />
                      <Box textAlign="right">
                        <Typography variant="body2" color="text.secondary">
                          {secondLaunch}
                        </Typography>
                        <Typography variant="h6">
                          {getNumericValue(secondLaunchData['ROI'] || 0).toFixed(2)}x
                        </Typography>
                      </Box>
                    </Box>
                  </Paper>
                </Grid>
              </Grid>
            </Box>
            
            {/* Categorias de Métricas */}
            <Box mb={4}>
              <Typography variant="h6" gutterBottom>
                Comparativo Detalhado
              </Typography>
              
              {Object.entries(categorizedMetrics).map(([category, metrics]) => {
                if (metrics.length === 0) return null;
                
                const categoryTitles = {
                  investimentos: 'Investimentos',
                  receitas: 'Receitas e Faturamento',
                  leads: 'Leads e Contatos',
                  conversao: 'Conversão e Taxas',
                  outros: 'Outras Métricas'
                };
                
                const isExpanded = expandedCategories[category];
                
                return (
                  <Box key={category} mb={2}>
                    <Button
                      fullWidth
                      onClick={() => toggleCategory(category)}
                      sx={{
                        justifyContent: 'space-between',
                        backgroundColor: 'action.hover',
                        textTransform: 'none',
                        py: 1,
                        mb: 1
                      }}
                    >
                      <Typography variant="subtitle1" fontWeight="medium">
                        {categoryTitles[category]} ({metrics.length})
                      </Typography>
                      {isExpanded ? <ExpandLess /> : <ExpandMore />}
                    </Button>
                    
                    {isExpanded && renderMetricsTable(metrics, category)}
                  </Box>
                );
              })}
            </Box>
            
            {/* Gráficos Comparativos */}
            {renderComparisonCharts()}
          </>
        )}
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose} color="primary">
          Fechar
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default LaunchComparisonModal;