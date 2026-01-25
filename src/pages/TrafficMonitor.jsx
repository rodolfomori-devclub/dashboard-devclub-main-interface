import React, { useState, useEffect } from 'react';
import {
  Container,
  Grid,
  Paper,
  Typography,
  Box,
  Card,
  CardContent,
  LinearProgress,
  Chip,
  IconButton,
  Tooltip,
  Alert,
  Button,
  ButtonGroup,
  ToggleButton,
  ToggleButtonGroup,
  Skeleton,
  Fade,
  Grow,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  Divider,
  useTheme,
  alpha
} from '@mui/material';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import ptBR from 'date-fns/locale/pt-BR';
import {
  TrendingUp,
  TrendingDown,
  Refresh,
  AccessTime,
  Visibility,
  MouseOutlined,
  AttachMoney,
  People,
  Speed,
  PercentOutlined,
  CalendarToday,
  CalendarMonth,
  Today,
  DateRange,
  AutorenewOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  ShowChart,
  TrendingFlat,
  Assessment,
  ArrowUpward,
  ArrowDownward
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import trafficSheetsService from '../services/trafficSheetsService';

// Componente estilizado para o container principal
const StyledContainer = styled(Container)(({ theme }) => ({
  paddingTop: theme.spacing(4),
  paddingBottom: theme.spacing(4),
  background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.02)} 0%, ${alpha(theme.palette.secondary.main, 0.02)} 100%)`,
  minHeight: '100vh'
}));

// Card principal estilizado
const MainCard = styled(Card)(({ theme }) => ({
  background: 'rgba(255, 255, 255, 0.98)',
  backdropFilter: 'blur(20px)',
  borderRadius: theme.spacing(3),
  boxShadow: '0 10px 40px rgba(0,0,0,0.08)',
  overflow: 'visible',
  marginBottom: theme.spacing(3),
  border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`
}));

// Componente estilizado para cards de métricas
const MetricCard = styled(Card)(({ theme, trend, color = 'primary' }) => ({
  height: '100%',
  position: 'relative',
  overflow: 'hidden',
  transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
  background: `linear-gradient(135deg, ${alpha(theme.palette[color].light, 0.05)} 0%, ${alpha(theme.palette[color].main, 0.08)} 100%)`,
  borderRadius: theme.spacing(2),
  border: `1px solid ${alpha(theme.palette[color].main, 0.15)}`,
  boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
  '&:hover': {
    transform: 'translateY(-8px)',
    boxShadow: `0 12px 28px ${alpha(theme.palette[color].main, 0.15)}`,
    border: `1px solid ${alpha(theme.palette[color].main, 0.3)}`
  },
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    width: '4px',
    height: '100%',
    background: `linear-gradient(180deg, ${theme.palette[color].main} 0%, ${theme.palette[color].dark} 100%)`,
  }
}));

// Header estilizado
const HeaderSection = styled(Box)(({ theme }) => ({
  background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
  borderRadius: theme.spacing(3),
  padding: theme.spacing(4),
  marginBottom: theme.spacing(4),
  color: 'white',
  position: 'relative',
  overflow: 'hidden',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: '-50%',
    right: '-10%',
    width: '50%',
    height: '200%',
    background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
    transform: 'rotate(-15deg)'
  }
}));

// Botão de período estilizado
const PeriodButton = styled(Button)(({ theme, active }) => ({
  borderRadius: theme.spacing(1.5),
  textTransform: 'none',
  fontWeight: active ? 600 : 400,
  padding: theme.spacing(1, 2.5),
  background: active ? theme.palette.primary.main : 'transparent',
  color: active ? 'white' : theme.palette.text.primary,
  border: `1px solid ${active ? theme.palette.primary.main : theme.palette.divider}`,
  transition: 'all 0.3s ease',
  '&:hover': {
    background: active ? theme.palette.primary.dark : alpha(theme.palette.primary.main, 0.08),
    borderColor: theme.palette.primary.main
  }
}));

// Componente para exibir uma métrica individual
const MetricDisplay = ({ icon, title, value, previousValue, unit = '', color = 'primary', format = 'number' }) => {
  const theme = useTheme();
  const variation = previousValue ? ((value - previousValue) / previousValue * 100).toFixed(1) : 0;
  const trend = variation > 0 ? 'up' : variation < 0 ? 'down' : 'neutral';

  const formatValue = (val) => {
    if (format === 'currency') {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2
      }).format(val);
    } else if (format === 'percent') {
      return `${parseFloat(val).toFixed(2)}%`;
    } else {
      return val.toLocaleString('pt-BR');
    }
  };

  return (
    <Grow in={true} timeout={800}>
      <MetricCard color={color} trend={trend}>
        <CardContent sx={{ p: 3 }}>
          <Box display="flex" justifyContent="space-between" alignItems="start">
            <Box flex={1}>
              <Box display="flex" alignItems="center" mb={2}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 48,
                    height: 48,
                    borderRadius: 2,
                    background: `linear-gradient(135deg, ${alpha(theme.palette[color].main, 0.2)} 0%, ${alpha(theme.palette[color].dark, 0.3)} 100%)`,
                    mr: 2
                  }}
                >
                  {React.cloneElement(icon, { sx: { color: theme.palette[color].main } })}
                </Box>
                <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                  {title}
                </Typography>
              </Box>

              <Typography variant="h4" component="div" fontWeight="700" sx={{ mb: 1, color: theme.palette[color].dark }}>
                {formatValue(value)}
                {unit && <Typography variant="h6" component="span" sx={{ ml: 0.5, color: 'text.secondary' }}> {unit}</Typography>}
              </Typography>

              {previousValue !== undefined && variation !== 0 && (
                <Box display="flex" alignItems="center" gap={1}>
                  {trend === 'up' ? (
                    <ArrowUpward sx={{ fontSize: 16, color: theme.palette.success.main }} />
                  ) : trend === 'down' ? (
                    <ArrowDownward sx={{ fontSize: 16, color: theme.palette.error.main }} />
                  ) : (
                    <TrendingFlat sx={{ fontSize: 16, color: theme.palette.grey[500] }} />
                  )}
                  <Typography
                    variant="caption"
                    sx={{
                      color: trend === 'up' ? theme.palette.success.main : theme.palette.error.main,
                      fontWeight: 600
                    }}
                  >
                    {variation > 0 ? '+' : ''}{variation}%
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    vs período anterior
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>
        </CardContent>
      </MetricCard>
    </Grow>
  );
};

// Componente principal
const TrafficMonitor = () => {
  const theme = useTheme();
  const [trafficData, setTrafficData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(60000);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [updateIntervalId, setUpdateIntervalId] = useState(null);

  // Estados para filtros de período
  const [selectedPeriod, setSelectedPeriod] = useState('last7days');
  const [customDateRange, setCustomDateRange] = useState({
    start: null,
    end: null
  });
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  // Busca inicial de dados
  useEffect(() => {
    loadData();
  }, []);

  // Aplica filtro quando período muda
  useEffect(() => {
    if (trafficData.length > 0) {
      applyPeriodFilter();
    }
  }, [selectedPeriod, customDateRange, trafficData]);

  // Configura auto-refresh
  useEffect(() => {
    if (autoRefresh) {
      const intervalId = trafficSheetsService.startRealTimeUpdates(
        handleDataUpdate,
        refreshInterval
      );
      setUpdateIntervalId(intervalId);

      return () => {
        trafficSheetsService.stopRealTimeUpdates(intervalId);
      };
    } else {
      if (updateIntervalId) {
        trafficSheetsService.stopRealTimeUpdates(updateIntervalId);
        setUpdateIntervalId(null);
      }
    }
  }, [autoRefresh, refreshInterval]);

  // Aplica filtro de período nos dados
  const applyPeriodFilter = () => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    let startDate = new Date();
    let filtered = [...trafficData];

    switch (selectedPeriod) {
      case 'today':
        startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'last7days':
        startDate = new Date();
        startDate.setDate(today.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'last30days':
        startDate = new Date();
        startDate.setDate(today.getDate() - 30);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'custom':
        if (customDateRange.start && customDateRange.end) {
          startDate = new Date(customDateRange.start);
          const endDate = new Date(customDateRange.end);
          filtered = trafficData.filter(row => {
            if (!row.DATA) return false;
            const [day, month, year] = row.DATA.split('/');
            const rowDate = new Date(year || today.getFullYear(), month - 1, day);
            return rowDate >= startDate && rowDate <= endDate;
          });
          setFilteredData(filtered);
          const newMetrics = trafficSheetsService.calculateMetrics(filtered);
          setMetrics(newMetrics);
          return;
        }
        break;
      default:
        startDate = new Date();
        startDate.setDate(today.getDate() - 7);
    }

    // Filtra dados baseado no período
    filtered = trafficData.filter(row => {
      if (!row.DATA) return false;
      const [day, month, year] = row.DATA.split('/');
      const rowDate = new Date(year || today.getFullYear(), month - 1, day);
      return rowDate >= startDate && rowDate <= today;
    });

    setFilteredData(filtered);
    const newMetrics = trafficSheetsService.calculateMetrics(filtered);
    setMetrics(newMetrics);
  };

  // Carrega dados da planilha
  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await trafficSheetsService.fetchTrafficData();
      setTrafficData(data);
      setLastUpdate(new Date());
    } catch (err) {
      setError('Erro ao carregar dados da planilha. Verifique a conexão.');
    } finally {
      setLoading(false);
    }
  };

  // Callback para atualização de dados
  const handleDataUpdate = ({ data, metrics, error }) => {
    if (error) {
      setError('Erro na atualização automática');
      return;
    }

    setTrafficData(data || []);
    setLastUpdate(new Date());
  };

  // Handlers
  const handlePeriodChange = (period) => {
    if (period === 'custom') {
      setDatePickerOpen(true);
    } else {
      setSelectedPeriod(period);
    }
  };

  const handleCustomDateConfirm = () => {
    if (customDateRange.start && customDateRange.end) {
      setSelectedPeriod('custom');
      setDatePickerOpen(false);
    }
  };

  const handleManualRefresh = () => {
    loadData();
  };

  const handleIntervalChange = (event, newInterval) => {
    if (newInterval !== null) {
      setRefreshInterval(newInterval);
    }
  };

  const toggleAutoRefresh = () => {
    setAutoRefresh(!autoRefresh);
  };

  // Renderiza loading
  if (loading && !metrics) {
    return (
      <StyledContainer maxWidth="xl">
        <Grid container spacing={3}>
          {[1, 2, 3, 4, 5, 6].map(item => (
            <Grid item xs={12} sm={6} md={4} key={item}>
              <Skeleton variant="rectangular" height={180} sx={{ borderRadius: 2 }} />
            </Grid>
          ))}
        </Grid>
      </StyledContainer>
    );
  }

  const latestData = metrics?.latest || {};
  const totals = metrics?.totals || {};
  const averages = metrics?.averages || {};

  const getPeriodLabel = () => {
    switch (selectedPeriod) {
      case 'today': return 'Hoje';
      case 'last7days': return 'Últimos 7 dias';
      case 'last30days': return 'Últimos 30 dias';
      case 'custom': return `${customDateRange.start?.toLocaleDateString('pt-BR')} - ${customDateRange.end?.toLocaleDateString('pt-BR')}`;
      default: return '';
    }
  };

  return (
    <StyledContainer maxWidth="xl">
      {/* Header Principal */}
      <Fade in={true} timeout={600}>
        <HeaderSection>
          <Box position="relative" zIndex={1}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
              <Box>
                <Typography variant="h3" component="h1" fontWeight="800" gutterBottom>
                  Monitor de Tráfego
                </Typography>
                <Typography variant="h6" sx={{ opacity: 0.9 }}>
                  Acompanhe as métricas de performance em tempo real
                </Typography>
              </Box>

              <Box display="flex" alignItems="center" gap={2}>
                {/* Status de atualização */}
                {lastUpdate && (
                  <Chip
                    icon={<AccessTime />}
                    label={`${lastUpdate.toLocaleTimeString('pt-BR')}`}
                    sx={{
                      background: 'rgba(255,255,255,0.2)',
                      color: 'white',
                      border: '1px solid rgba(255,255,255,0.3)'
                    }}
                  />
                )}

                {/* Controles de refresh */}
                <ButtonGroup variant="contained" sx={{ background: 'rgba(255,255,255,0.1)' }}>
                  <Tooltip title={autoRefresh ? "Pausar" : "Iniciar"}>
                    <IconButton onClick={toggleAutoRefresh} sx={{ color: 'white' }}>
                      {autoRefresh ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Atualizar agora">
                    <IconButton onClick={handleManualRefresh} sx={{ color: 'white' }}>
                      <Refresh />
                    </IconButton>
                  </Tooltip>
                </ButtonGroup>
              </Box>
            </Box>

            {/* Filtros de Período */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 2, opacity: 0.9 }}>
                Período de análise
              </Typography>
              <Stack direction="row" spacing={1.5} flexWrap="wrap">
                <PeriodButton
                  startIcon={<Today />}
                  active={selectedPeriod === 'today'}
                  onClick={() => handlePeriodChange('today')}
                >
                  Hoje
                </PeriodButton>
                <PeriodButton
                  startIcon={<DateRange />}
                  active={selectedPeriod === 'last7days'}
                  onClick={() => handlePeriodChange('last7days')}
                >
                  Últimos 7 dias
                </PeriodButton>
                <PeriodButton
                  startIcon={<CalendarMonth />}
                  active={selectedPeriod === 'last30days'}
                  onClick={() => handlePeriodChange('last30days')}
                >
                  Últimos 30 dias
                </PeriodButton>
                <PeriodButton
                  startIcon={<CalendarToday />}
                  active={selectedPeriod === 'custom'}
                  onClick={() => handlePeriodChange('custom')}
                >
                  Personalizado
                </PeriodButton>
              </Stack>
            </Box>
          </Box>
        </HeaderSection>
      </Fade>

      {/* Configuração de intervalo */}
      {autoRefresh && (
        <Fade in={true} timeout={800}>
          <Alert
            severity="info"
            icon={<AutorenewOutlined />}
            sx={{
              mb: 3,
              borderRadius: 2,
              background: `linear-gradient(135deg, ${alpha(theme.palette.info.light, 0.1)} 0%, ${alpha(theme.palette.info.main, 0.05)} 100%)`
            }}
            action={
              <ToggleButtonGroup
                value={refreshInterval}
                exclusive
                onChange={handleIntervalChange}
                size="small"
              >
                <ToggleButton value={30000}>30s</ToggleButton>
                <ToggleButton value={60000}>1m</ToggleButton>
                <ToggleButton value={300000}>5m</ToggleButton>
              </ToggleButtonGroup>
            }
          >
            Atualização automática ativa - Período: <strong>{getPeriodLabel()}</strong>
          </Alert>
        </Fade>
      )}

      {/* Erro */}
      {error && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
          {error}
        </Alert>
      )}

      {/* Cards de Métricas Principais */}
      <Typography variant="h5" component="h2" fontWeight="700" sx={{ mb: 3, color: theme.palette.text.primary }}>
        <Assessment sx={{ mr: 1, verticalAlign: 'middle' }} />
        Indicadores Principais
      </Typography>

      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} sm={6} lg={3}>
          <MetricDisplay
            icon={<AttachMoney />}
            title="Investimento Total"
            value={totals.investimento || 0}
            format="currency"
            color="success"
          />
        </Grid>

        <Grid item xs={12} sm={6} lg={3}>
          <MetricDisplay
            icon={<Visibility />}
            title="Impressões"
            value={totals.impressoes || 0}
            color="primary"
          />
        </Grid>

        <Grid item xs={12} sm={6} lg={3}>
          <MetricDisplay
            icon={<MouseOutlined />}
            title="Cliques"
            value={totals.cliques || 0}
            color="info"
          />
        </Grid>

        <Grid item xs={12} sm={6} lg={3}>
          <MetricDisplay
            icon={<People />}
            title="Leads Gerados"
            value={totals.leads || 0}
            color="warning"
          />
        </Grid>
      </Grid>

      {/* Métricas de Performance */}
      <Typography variant="h5" component="h2" fontWeight="700" sx={{ mb: 3, color: theme.palette.text.primary }}>
        <ShowChart sx={{ mr: 1, verticalAlign: 'middle' }} />
        Performance e Conversão
      </Typography>

      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} sm={6} lg={3}>
          <MetricDisplay
            icon={<Speed />}
            title="CTR Médio"
            value={averages.ctr || 0}
            format="percent"
            color="primary"
          />
        </Grid>

        <Grid item xs={12} sm={6} lg={3}>
          <MetricDisplay
            icon={<AttachMoney />}
            title="CPC Médio"
            value={averages.cpc || 0}
            format="currency"
            color="success"
          />
        </Grid>

        <Grid item xs={12} sm={6} lg={3}>
          <MetricDisplay
            icon={<People />}
            title="CPL Médio"
            value={averages.cpl || 0}
            format="currency"
            color="warning"
          />
        </Grid>

        <Grid item xs={12} sm={6} lg={3}>
          <MetricDisplay
            icon={<PercentOutlined />}
            title="Taxa de Conversão"
            value={averages.conversaoPagina || 0}
            format="percent"
            color="info"
          />
        </Grid>
      </Grid>

      {/* Resumo do Período */}
      <MainCard>
        <CardContent sx={{ p: 4 }}>
          <Box display="flex" alignItems="center" mb={3}>
            <CalendarToday sx={{ mr: 1, color: theme.palette.primary.main }} />
            <Typography variant="h5" component="h3" fontWeight="700">
              Resumo do Período
            </Typography>
            <Chip
              label={getPeriodLabel()}
              color="primary"
              sx={{ ml: 2 }}
              variant="outlined"
            />
          </Box>

          <Divider sx={{ mb: 3 }} />

          <Grid container spacing={4}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Dados do Período
              </Typography>
              <Box sx={{ mt: 2 }}>
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography variant="body2">Total de dias analisados:</Typography>
                  <Typography variant="body2" fontWeight="600">{metrics?.dataCount || 0}</Typography>
                </Box>
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography variant="body2">ROI estimado:</Typography>
                  <Typography variant="body2" fontWeight="600" color="success.main">
                    {totals.leads > 0 ? ((totals.leads * 100 / totals.investimento) || 0).toFixed(1) : 0}%
                  </Typography>
                </Box>
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography variant="body2">Custo por mil (CPM):</Typography>
                  <Typography variant="body2" fontWeight="600">
                    {new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL'
                    }).format(averages.cpm || 0)}
                  </Typography>
                </Box>
              </Box>
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Estatísticas de Engajamento
              </Typography>
              <Box sx={{ mt: 2 }}>
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography variant="body2">Taxa de carregamento:</Typography>
                  <Typography variant="body2" fontWeight="600">
                    {averages.carregamentoPagina?.toFixed(2) || 0}%
                  </Typography>
                </Box>
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography variant="body2">Média de pageviews:</Typography>
                  <Typography variant="body2" fontWeight="600">
                    {(totals.pageviews / (metrics?.dataCount || 1)).toFixed(0).toLocaleString('pt-BR')}
                  </Typography>
                </Box>
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography variant="body2">Eficiência do investimento:</Typography>
                  <Typography variant="body2" fontWeight="600" color="primary.main">
                    {totals.cliques > 0 ? ((totals.leads / totals.cliques * 100) || 0).toFixed(1) : 0}%
                  </Typography>
                </Box>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </MainCard>

      {/* Dialog para seleção de período personalizado */}
      <Dialog open={datePickerOpen} onClose={() => setDatePickerOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Selecionar Período Personalizado</DialogTitle>
        <DialogContent>
          <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ptBR}>
            <Box sx={{ mt: 2 }}>
              <DatePicker
                label="Data Inicial"
                value={customDateRange.start}
                onChange={(newValue) => setCustomDateRange({ ...customDateRange, start: newValue })}
                renderInput={(params) => <TextField {...params} fullWidth sx={{ mb: 2 }} />}
              />
              <DatePicker
                label="Data Final"
                value={customDateRange.end}
                onChange={(newValue) => setCustomDateRange({ ...customDateRange, end: newValue })}
                renderInput={(params) => <TextField {...params} fullWidth />}
                minDate={customDateRange.start}
              />
            </Box>
          </LocalizationProvider>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDatePickerOpen(false)}>Cancelar</Button>
          <Button onClick={handleCustomDateConfirm} variant="contained" disabled={!customDateRange.start || !customDateRange.end}>
            Confirmar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Indicador de loading para atualizações */}
      {loading && <LinearProgress sx={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999 }} />}
    </StyledContainer>
  );
};

export default TrafficMonitor;