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
    const numericValue = value.toString().replace(/[^\d.,\-]/g, '').replace(',', '.');
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
    
    // Extrair métricas importantes
    const investmentTotal = findMetricValue(['investimento total', 'total investido', 'custo total']);
    const facebookInvestment = findMetricValue(['investimento facebook', 'facebook ads', 'facebook gasto']);
    const googleInvestment = findMetricValue(['investimento google', 'google ads', 'google gasto']);
    const totalLeads = findMetricValue(['leads total', 'total de leads', 'leads']);
    const emailLeads = findMetricValue(['leads email', 'email leads', 'emails']);
    const guruRevenue = findMetricValue(['receita guru', 'faturamento guru', 'guru']);
    const tmbRevenue = findMetricValue(['receita tmb', 'faturamento tmb', 'receita boleto', 'tmb']);
    const totalRevenue = findMetricValue(['receita total', 'faturamento total', 'total receita']);
    
    // Cálculos derivados
    const effectiveRevenue = totalRevenue > 0 ? totalRevenue : (guruRevenue + tmbRevenue);
    const effectiveInvestment = investmentTotal > 0 ? investmentTotal : (facebookInvestment + googleInvestment);
    const leadCost = totalLeads > 0 ? effectiveInvestment / totalLeads : 0;
    const profit = effectiveRevenue - effectiveInvestment;
    const roi = effectiveInvestment > 0 ? effectiveRevenue / effectiveInvestment : 0;
    
    // Dados para gráficos
    const investmentChartData = [
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
      { name: 'Receita', value: effectiveRevenue },
      { name: 'Lucro', value: profit }
    ];
    
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
    
    return (
      <Box mt={2}>
        <Grid container spacing={3} mb={4}>
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
          
          <Grid item xs={12} sm={6} md={3}>
            <MetricCard
              title="Leads de Email"
              value={emailLeads.toLocaleString('pt-BR')}
              icon={<Email sx={{ color: '#FF9800' }} />}
              color="#FF9800"
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
              subtitle={`ROI: ${roi.toFixed(2)}x`}
            />
          </Grid>
        </Grid>
        
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
                    <YAxis tickFormatter={(value) => value >= 1000 ? `${(value/1000).toFixed(0)}k` : value} />
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
          
          {/* Gráficos de distribuição */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>Distribuição de Investimento</Typography>
              <Box height={300}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={investmentChartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {investmentChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Legend />
                    <RechartsTooltip formatter={(value) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
            </Paper>
          </Grid>
          
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
      'Investimentos': [],
      'Leads': [],
      'Vendas': [],
      'Receitas': [],
      'Métricas': [],
      'Outros': []
    };
    
    // Preencher categorias com métricas filtradas
    filteredMetrics.forEach(metric => {
      const category = categoryMap[metric] || 'Outros';
      categories[category].push({
        name: metric,
        value: launchData[metric],
        formattedValue: formatValue(launchData[metric], metric)
      });
    });
    
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
                              <TableCell align="right">{metric.formattedValue}</TableCell>
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
    return (
      <Box p={3} textAlign="center">
        <Typography variant="h6" gutterBottom>Comparação entre Lançamentos</Typography>
        <Typography>
          Nesta aba será implementada a comparação entre diferentes lançamentos.
        </Typography>
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
                <Tab label="Comparação" icon={<TrendingUp />} iconPosition="start" />
              </Tabs>
            </Box>
            
            {renderTabContent()}
          </>
        )}
      </Box>
    </Container>
  );
};

export default LaunchPro;