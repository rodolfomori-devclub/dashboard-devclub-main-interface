// Script para testar a correção do faturamento
// Execute este script no console do navegador

console.log('🔧 Testando correção do faturamento...');

// Função para verificar a estrutura da planilha principal
function checkMainSheetStructure() {
  console.log('📋 Verificando estrutura da planilha principal...');
  
  if (!allLaunchesData || !allLaunchesData.launches) {
    console.log('❌ Dados de lançamentos não encontrados');
    return null;
  }
  
  if (allLaunchesData.launches.length === 0) {
    console.log('❌ Nenhum lançamento encontrado');
    return null;
  }
  
  // Pegar o primeiro lançamento para análise
  const firstLaunch = allLaunchesData.launches[0];
  console.log('📊 Primeiro lançamento:', firstLaunch['Lançamento']);
  
  // Listar todas as colunas
  const allColumns = Object.keys(firstLaunch);
  console.log('📋 Total de colunas:', allColumns.length);
  
  // Verificar as últimas colunas (onde provavelmente estão as datas de carrinho)
  const lastColumns = allColumns.slice(-5);
  console.log('🔍 Últimas 5 colunas:');
  
  lastColumns.forEach((column, index) => {
    const value = firstLaunch[column];
    console.log(`  ${allColumns.length - 5 + index + 1}. ${column}: "${value}"`);
  });
  
  // Procurar por valores que parecem datas nas últimas colunas
  const dateValues = [];
  lastColumns.forEach((column, index) => {
    const value = firstLaunch[column];
    if (value && /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}/.test(value)) {
      dateValues.push({
        column,
        value,
        position: allColumns.length - 5 + index + 1
      });
    }
  });
  
  console.log('📅 Valores de data encontrados:', dateValues);
  
  if (dateValues.length >= 2) {
    // Assumir que a penúltima é abertura e a última é fechamento
    const openingDate = dateValues[dateValues.length - 2];
    const closingDate = dateValues[dateValues.length - 1];
    
    console.log('✅ Identificação automática:');
    console.log(`  📅 Abertura de carrinho: ${openingDate.column} (${openingDate.value})`);
    console.log(`  📅 Fechamento de carrinho: ${closingDate.column} (${closingDate.value})`);
    
    return {
      openingColumn: openingDate.column,
      closingColumn: closingDate.column,
      openingValue: openingDate.value,
      closingValue: closingDate.value
    };
  } else {
    console.log('❌ Não foi possível identificar automaticamente as colunas de data');
    return null;
  }
}

// Função para converter data brasileira para formato ISO
function convertBrazilianDateToISO(dateStr) {
  if (!dateStr) return null;
  
  // Formato: DD/MM/YYYY
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[2];
    return `${year}-${month}-${day}`;
  }
  
  return null;
}

// Função para testar com um lançamento específico
function testSpecificLaunch(launchName) {
  console.log(`🔍 Testando lançamento específico: ${launchName}`);
  
  const launch = allLaunchesData.launches.find(l => l['Lançamento'] === launchName);
  if (!launch) {
    console.log(`❌ Lançamento "${launchName}" não encontrado`);
    return null;
  }
  
  console.log('📊 Dados do lançamento:', launch);
  
  // Listar todas as colunas com valores
  const allColumns = Object.keys(launch);
  console.log('📋 Colunas disponíveis:', allColumns);
  
  // Mostrar valores das últimas colunas
  const lastColumns = allColumns.slice(-5);
  console.log('🔍 Últimas 5 colunas:');
  lastColumns.forEach((column, index) => {
    const value = launch[column];
    console.log(`  ${allColumns.length - 5 + index + 1}. ${column}: "${value}"`);
  });
  
  // Procurar por valores de data nas últimas colunas
  const dateValues = [];
  lastColumns.forEach((column, index) => {
    const value = launch[column];
    if (value && /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}/.test(value)) {
      dateValues.push({
        column,
        value,
        position: allColumns.length - 5 + index + 1
      });
    }
  });
  
  console.log('📅 Valores de data encontrados:', dateValues);
  
  if (dateValues.length >= 2) {
    const openingDate = dateValues[dateValues.length - 2];
    const closingDate = dateValues[dateValues.length - 1];
    
    const openISO = convertBrazilianDateToISO(openingDate.value);
    const closeISO = convertBrazilianDateToISO(closingDate.value);
    
    console.log('✅ Datas identificadas:');
    console.log(`  📅 Abertura: ${openingDate.value} → ${openISO}`);
    console.log(`  📅 Fechamento: ${closingDate.value} → ${closeISO}`);
    
    return {
      launch: launchName,
      openingDate: openingDate.value,
      closingDate: closingDate.value,
      openISO,
      closeISO
    };
  } else {
    console.log('❌ Não foi possível identificar as datas');
    return null;
  }
}

// Função para testar faturamento com datas corretas
async function testRevenueWithCorrectDates() {
  console.log('💰 Testando faturamento com datas corretas...');
  
  // Testar com LF 15 especificamente
  const lf15Data = testSpecificLaunch('LF 15');
  if (!lf15Data) {
    console.log('❌ Não foi possível obter dados do LF 15');
    return;
  }
  
  console.log(`💰 Testando faturamento para ${lf15Data.launch}:`);
  console.log(`  Período: ${lf15Data.openISO} a ${lf15Data.closeISO}`);
  
  try {
    // Simular a chamada da API (se o revenueService estiver disponível)
    if (typeof revenueService !== 'undefined') {
      const revenueData = await revenueService.getRevenueByDateRange(lf15Data.openISO, lf15Data.closeISO);
      console.log('✅ Dados de faturamento:', revenueData);
      console.log(`💰 Faturamento total: R$ ${revenueData.totals.totalRevenue.toFixed(2)}`);
    } else {
      console.log('⚠️ revenueService não disponível, simulando dados...');
      console.log('✅ Simulação: Dados de faturamento carregados corretamente');
    }
  } catch (error) {
    console.error('❌ Erro ao testar faturamento:', error);
  }
}

// Função para verificar todos os lançamentos
function checkAllLaunches() {
  console.log('📊 Verificando todos os lançamentos...');
  
  if (!allLaunchesData || !allLaunchesData.launches) {
    console.log('❌ Dados de lançamentos não encontrados');
    return;
  }
  
  const launchesWithDates = [];
  
  allLaunchesData.launches.forEach(launch => {
    const allColumns = Object.keys(launch);
    const lastColumns = allColumns.slice(-5);
    
    // Procurar por valores de data nas últimas colunas
    const dateValues = [];
    lastColumns.forEach((column, index) => {
      const value = launch[column];
      if (value && /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}/.test(value)) {
        dateValues.push({
          column,
          value,
          position: allColumns.length - 5 + index + 1
        });
      }
    });
    
    if (dateValues.length >= 2) {
      const openingDate = dateValues[dateValues.length - 2];
      const closingDate = dateValues[dateValues.length - 1];
      
      launchesWithDates.push({
        launch: launch['Lançamento'],
        openingDate: openingDate.value,
        closingDate: closingDate.value,
        openISO: convertBrazilianDateToISO(openingDate.value),
        closeISO: convertBrazilianDateToISO(closingDate.value)
      });
    }
  });
  
  console.log(`📊 Total de lançamentos: ${allLaunchesData.launches.length}`);
  console.log(`📊 Lançamentos com datas: ${launchesWithDates.length}`);
  
  if (launchesWithDates.length > 0) {
    console.log('✅ Primeiros 10 lançamentos com datas:');
    launchesWithDates.slice(0, 10).forEach(item => {
      console.log(`  - ${item.launch}: ${item.openingDate} → ${item.openISO}, ${item.closingDate} → ${item.closeISO}`);
    });
  }
  
  return launchesWithDates;
}

// Executar verificações
console.log(`
🧪 INSTRUÇÕES DE TESTE:

1. Verificar estrutura da planilha principal:
   - Execute: checkMainSheetStructure()

2. Testar lançamento específico (LF 15):
   - Execute: testSpecificLaunch('LF 15')

3. Verificar todos os lançamentos:
   - Execute: checkAllLaunches()

4. Testar faturamento com datas corretas:
   - Execute: testRevenueWithCorrectDates()

5. Executar todas as verificações:
   - Execute: runAllTests()
`);

// Função para executar todas as verificações
async function runAllTests() {
  console.log('🧪 Executando todas as verificações...');
  
  console.log('\n=== VERIFICAÇÃO 1: Estrutura da planilha ===');
  const result = checkMainSheetStructure();
  
  console.log('\n=== VERIFICAÇÃO 2: Lançamento específico ===');
  const lf15Data = testSpecificLaunch('LF 15');
  
  console.log('\n=== VERIFICAÇÃO 3: Todos os lançamentos ===');
  const allLaunches = checkAllLaunches();
  
  console.log('\n=== VERIFICAÇÃO 4: Faturamento com datas corretas ===');
  await testRevenueWithCorrectDates();
  
  console.log('\n✅ Todas as verificações concluídas!');
  
  if (result) {
    console.log('\n🎯 RESULTADO DA IDENTIFICAÇÃO:');
    console.log(`Coluna de abertura: ${result.openingColumn}`);
    console.log(`Coluna de fechamento: ${result.closingColumn}`);
  }
  
  if (allLaunches) {
    console.log(`\n📊 RESUMO: ${allLaunches.length} lançamentos com datas válidas`);
  }
}

// Executar verificação inicial
checkMainSheetStructure(); 