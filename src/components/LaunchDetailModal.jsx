import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Grid,
  Tabs,
  Tab,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Divider,
  TextField,
  InputAdornment,
  CircularProgress
} from '@mui/material';
import {
  Close,
  Search,
  AttachMoney,
  TrendingUp,
  Facebook,
  Google,
  Email,
  People,
  Visibility,
  VisibilityOff,
  FilterList,
  Download,
  Share
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

// Cores para os gráficos
const COLORS = ['#37E359', '#051626', '#FF4500', '#1E90FF', '#FFD700', '#FF1493'];

/**
 * Modal de detalhes de lançamento
 * @param {Object} props
 * @param {boolean} props.open - Estado de abertura do modal
 * @param {function} props.onClose - Função para fechar o modal
 * @param {string} props.launchName - Nome do lançamento
 * @param {Array} props.launchData - Dados do lançamento
 * @param {Object} props.metrics - Métricas calculadas do lançamento
 */
const LaunchDetailModal = ({ open, onClose, launchName, launchData, metrics }) => {
  const [tabValue, setTabValue] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRow, setExpandedRow] = useState(null);
  
  // Se não tem dados, mostrar mensagem
  if (!launchData || launchData.length === 0) {
    return (
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Detalhes do Lançamento</Typography>
            <IconButton onClick={onClose} size="small">
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box p={3} textAlign="center">
            <Typography>Nenhum dado disponível para este lançamento</Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Fechar</Button>
        </DialogActions>
      </Dialog>
    );
  }
  
  // Função para lidar com mudança de tab
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };
  
  // Função para alternar a expansão de uma linha
  const toggleRowExpansion = (index) => {
    setExpandedRow(expandedRow === index ? null : index);
  };
  
  // Função para renderizar conteúdo baseado na tab selecionada
  const renderTabContent = () => {
    switch (tabValue) {
      case 0: // Visão Geral
        return renderOverviewTab();
      case 1: // Métricas
        return renderMetricsTab();
      case 2: // Tabela de Dados
        return renderDataTableTab();
      default:
        return null;
    }
  };
  
  // Renderizar tab de visão geral
  const renderOverviewTab = () => {
    // Dados para gráfico de ROI
    const roiData = [
      { name: 'Investimento', valor: metrics.investment },
      { name: 'Receita', valor: metrics.revenue },
      { name: 'Lucro', valor: metrics.profit }
    ];
    
    // Dados para gráfico de distribuição de investimento
    const investmentData = [
      { name: 'Facebook', valor: metrics.facebookInvestment },
      { name: 'Google', valor: metrics.googleInvestment },
      { name: 'Outros', valor: metrics.investment - metrics.facebookInvestment - metrics.googleInvestment }
    ].filter(item => item.valor > 0);
    
    // Dados para gráfico de receita
    const revenueData = [
      { name: 'GURU', valor: metrics.guruRevenue },
      { name: 'TMB', valor: metrics.tmbRevenue },
      { name: 'Outros', valor: metrics.revenue - metrics.guruRevenue - metrics.tmbRevenue }
    ].filter(item => item.valor > 0);
    
    return (
      <Box mt={2}>
        <Grid container spacing={3}>
          {/* Cards de métricas principais */}
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Box display="flex" alignItems="center" mb={2}>
                <AttachMoney color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6">ROI do Lançamento</Typography>
              </Box>
              <Box flex={1} display="flex" flexDirection="column" justifyContent="center">
                <Typography variant="h3" align="center" gutterBottom>
                  {(metrics.roi).toFixed(2)}x
                </Typography>
                <Typography variant="body2" color="text.secondary" align="center">
                  {formatCurrency(metrics.investment)} investidos geraram {formatCurrency(metrics.revenue)}
                </Typography>
                <Typography 
                  variant="subtitle1" 
                  align="center" 
                  color={metrics.profit > 0 ? "success.main" : "error.main"}
                  sx={{ mt: 2 }}
                >
                  {metrics.profit > 0 ? "Lucro: " : "Prejuízo: "}
                  {formatCurrency(Math.abs(metrics.profit))}
                </Typography>
              </Box>
            </Paper>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Box display="flex" alignItems="center" mb={2}>
                <People color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6">Leads e Conversão</Typography>
              </Box>
              <Box flex={1} display="flex" flexDirection="column" justifyContent="center">
                <Typography variant="h4" align="center" gutterBottom>
                  {metrics.leads.toLocaleString('pt-BR')}
                </Typography>
                <Typography variant="body2" color="text.secondary" align="center">
                  Total de leads captados
                </Typography>
                <Typography variant="subtitle1" align="center" sx={{ mt: 2 }}>
                  Custo por Lead: {formatCurrency(metrics.leadCost)}
                </Typography>
              </Box>
            </Paper>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Box display="flex" alignItems="center" mb={2}>
                <TrendingUp color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6">Performance de Vendas</Typography>
              </Box>
              <Box flex={1} display="flex" flexDirection="column" justifyContent="center">
                <Grid container spacing={1}>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary" align="center">
                      GURU
                    </Typography>
                    <Typography variant="h6" align="center">
                      {formatCurrency(metrics.guruRevenue)}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary" align="center">
                      TMB
                    </Typography>
                    <Typography variant="h6" align="center">
                      {formatCurrency(metrics.tmbRevenue)}
                    </Typography>
                  </Grid>
                </Grid>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle1" align="center" fontWeight="bold">
                  Total: {formatCurrency(metrics.revenue)}
                </Typography>
              </Box>
            </Paper>
          </Grid>
          
          {/* Gráficos */}
          <Grid item xs={12}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>ROI do Lançamento</Typography>
              <Box height={350}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={roiData}
                    margin={{ top: 20, right:
                    30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(value) => value >= 1000 ? `${(value/1000).toFixed(0)}k` : value} />
                    <RechartsTooltip formatter={(value) => formatCurrency(value)} />
                    <Legend />
                    <Bar 
                      dataKey="valor" 
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
          
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>Distribuição de Investimento</Typography>
              <Box height={300}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={investmentData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="valor"
                    >
                      {investmentData.map((entry, index) => (
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
                      data={revenueData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="valor"
                    >
                      {revenueData.map((entry, index) => (
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
    // Organizar métricas por categorias
    const metricCategories = {
      'ROI e Faturamento': [
        { name: 'Receita Total', value: formatCurrency(metrics.revenue) },
        { name: 'Lucro', value: formatCurrency(metrics.profit) },
        { name: 'ROI', value: `${metrics.roi.toFixed(2)}x` },
        { name: 'Receita GURU', value: formatCurrency(metrics.guruRevenue) },
        { name: 'Receita TMB', value: formatCurrency(metrics.tmbRevenue) }
      ],
      'Investimento': [
        { name: 'Investimento Total', value: formatCurrency(metrics.investment) },
        { name: 'Investimento Facebook', value: formatCurrency(metrics.facebookInvestment) },
        { name: 'Investimento Google', value: formatCurrency(metrics.googleInvestment) },
        { name: 'Outros Investimentos', value: formatCurrency(metrics.investment - metrics.facebookInvestment - metrics.googleInvestment) }
      ],
      'Leads': [
        { name: 'Total de Leads', value: metrics.leads.toLocaleString('pt-BR') },
        { name: 'Custo por Lead', value: formatCurrency(metrics.leadCost) }
      ]
    };
    
    return (
      <Box mt={2}>
        <Grid container spacing={3}>
          {Object.entries(metricCategories).map(([category, metricList]) => (
            <Grid item xs={12} md={4} key={category}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  {category}
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Box>
                  {metricList.map((metric, idx) => (
                    <Box key={idx} display="flex" justifyContent="space-between" mb={1.5}>
                      <Typography variant="body2" color="text.secondary">
                        {metric.name}:
                      </Typography>
                      <Typography variant="body2" fontWeight="medium">
                        {metric.value}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Paper>
            </Grid>
          ))}
          
          {/* Tabela de métricas adicionais */}
          <Grid item xs={12}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                Métricas Adicionais
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>Métrica</strong></TableCell>
                      <TableCell align="right"><strong>Valor</strong></TableCell>
                      <TableCell><strong>Descrição</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow>
                      <TableCell>Taxa de Conversão</TableCell>
                      <TableCell align="right">
                        {metrics.leads > 0 
                          ? `${((metrics.revenue / metrics.leads) * 100).toFixed(2)}%`
                          : "N/A"}
                      </TableCell>
                      <TableCell>Percentual de leads que converteram em vendas</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Ticket Médio</TableCell>
                      <TableCell align="right">
                        {formatCurrency(metrics.revenue / (metrics.leads * 0.05))}
                      </TableCell>
                      <TableCell>Valor médio por venda realizada</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>CPL (Custo por Lead)</TableCell>
                      <TableCell align="right">{formatCurrency(metrics.leadCost)}</TableCell>
                      <TableCell>Custo médio para adquirir um lead</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>CAC (Custo de Aquisição de Cliente)</TableCell>
                      <TableCell align="right">
                        {formatCurrency(metrics.investment / (metrics.leads * 0.05))}
                      </TableCell>
                      <TableCell>Custo médio para adquirir um cliente</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>LTV (Valor do Tempo de Vida)</TableCell>
                      <TableCell align="right">
                        {formatCurrency(metrics.revenue / (metrics.leads * 0.05) * 1.5)}
                      </TableCell>
                      <TableCell>Valor estimado que um cliente gera durante seu ciclo de vida</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
                * Algumas métricas são calculadas com base em estimativas, pois nem todos os dados estão disponíveis diretamente na planilha.
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      </Box>
    );
  };
  
  // Renderizar tab de tabela de dados
  const renderDataTableTab = () => {
    if (!launchData || launchData.length === 0) {
      return (
        <Box p={3} textAlign="center">
          <Typography>Nenhum dado disponível para este lançamento</Typography>
        </Box>
      );
    }
    
    // Obter colunas a partir do primeiro objeto
    const columns = Object.keys(launchData[0]).filter(key => key !== 'id');
    
    // Filtrar dados com base na busca
    const filteredData = searchQuery 
      ? launchData.filter(row => 
          Object.values(row).some(value => 
            value && value.toString().toLowerCase().includes(searchQuery.toLowerCase())
          )
        )
      : launchData;
    
    return (
      <Box mt={2}>
        <Box mb={2} display="flex" justifyContent="space-between">
          <TextField
            variant="outlined"
            size="small"
            placeholder="Buscar nos dados..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            }}
            sx={{ width: 300 }}
          />
          
          <Box>
            <Button
              startIcon={<FilterList />}
              variant="outlined"
              size="small"
              sx={{ mr: 1 }}
            >
              Filtrar
            </Button>
            <Button
              startIcon={<Download />}
              variant="outlined"
              size="small"
            >
              Exportar
            </Button>
          </Box>
        </Box>
        
        <Paper>
          <TableContainer sx={{ maxHeight: 440 }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell></TableCell>
                  {columns.slice(0, 5).map((column) => (
                    <TableCell key={column}>
                      <Typography variant="subtitle2">{column}</Typography>
                    </TableCell>
                  ))}
                  <TableCell align="right">
                    <Typography variant="subtitle2">Mais</Typography>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredData.slice(0, 100).map((row, index) => {
                  const isExpanded = expandedRow === index;
                  
                  return (
                    <React.Fragment key={row.id || index}>
                      <TableRow hover>
                        <TableCell padding="checkbox">
                          <IconButton size="small" onClick={() => toggleRowExpansion(index)}>
                            {isExpanded ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                          </IconButton>
                        </TableCell>
                        {columns.slice(0, 5).map((column) => (
                          <TableCell key={column}>
                            {row[column] || '-'}
                          </TableCell>
                        ))}
                        <TableCell align="right">
                          <Chip 
                            label={`+${columns.length - 5} campos`} 
                            size="small" 
                            onClick={() => toggleRowExpansion(index)}
                          />
                        </TableCell>
                      </TableRow>
                      
                      {isExpanded && (
                        <TableRow>
                          <TableCell colSpan={7} sx={{ py: 0 }}>
                            <Box sx={{ p: 2, backgroundColor: 'action.hover' }}>
                              <Grid container spacing={2}>
                                {columns.slice(5).map((column) => (
                                  <Grid item xs={12} sm={6} md={4} lg={3} key={column}>
                                    <Box>
                                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                        {column}
                                      </Typography>
                                      <Typography variant="body2">
                                        {row[column] || '-'}
                                      </Typography>
                                    </Box>
                                  </Grid>
                                ))}
                              </Grid>
                            </Box>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
                
                {filteredData.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      <Typography variant="body2" sx={{ py: 2 }}>
                        Nenhum resultado encontrado
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
                
                {filteredData.length > 100 && (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                        Exibindo 100 de {filteredData.length} resultados
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Box>
    );
  };
  
  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="lg" 
      fullWidth
      PaperProps={{
        sx: { height: '90vh' }
      }}
    >
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">
            Detalhes do Lançamento: {launchName}
          </Typography>
          <Box>
            <IconButton 
              size="small" 
              sx={{ mr: 1 }}
              title="Compartilhar"
            >
              <Share fontSize="small" />
            </IconButton>
            <IconButton 
              onClick={onClose} 
              size="small"
              title="Fechar"
            >
              <Close fontSize="small" />
            </IconButton>
          </Box>
        </Box>
      </DialogTitle>
      
      <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 3 }}>
        <Tabs 
          value={tabValue} 
          onChange={handleTabChange} 
          aria-label="launch detail tabs"
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label="Visão Geral" />
          <Tab label="Métricas" />
          <Tab label="Dados" />
        </Tabs>
      </Box>
      
      <DialogContent dividers>
        {renderTabContent()}
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose}>Fechar</Button>
      </DialogActions>
    </Dialog>
  );
};

export default LaunchDetailModal;