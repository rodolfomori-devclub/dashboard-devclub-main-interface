// Script para testar o serviço de faturamento
// Execute este script no console do navegador

console.log('💰 Testando serviço de faturamento...');

// Função para testar busca de faturamento por período
async function testRevenueByPeriod() {
  console.log('📅 Testando busca de faturamento por período...');
  
  try {
    // Testar com um período específico
    const startDate = '2024-01-01';
    const endDate = '2024-01-31';
    
    console.log(`💰 Buscando faturamento de ${startDate} a ${endDate}`);
    
    const revenueData = await revenueService.getRevenueByDateRange(startDate, endDate);
    
    console.log('✅ Dados de faturamento:', revenueData);
    console.log(`💰 Faturamento total: ${revenueService.formatCurrency(revenueData.totals.totalRevenue)}`);
    console.log(`💳 Cartão: ${revenueService.formatCurrency(revenueData.totals.cardRevenue)}`);
    console.log(`📄 Boleto: ${revenueService.formatCurrency(revenueData.totals.boletoRevenue)}`);
    
    return revenueData;
  } catch (error) {
    console.error('❌ Erro ao testar faturamento por período:', error);
    return null;
  }
}

// Função para testar busca de faturamento por LF
async function testRevenueByLaunch() {
  console.log('🚀 Testando busca de faturamento por LF...');
  
  if (!allLaunchesData || !allLaunchesData.launches) {
    console.log('❌ Dados de lançamentos não encontrados');
    return null;
  }
  
  try {
    // Pegar apenas os primeiros 3 lançamentos para teste
    const testLaunches = allLaunchesData.launches.slice(0, 3);
    
    console.log(`💰 Testando com ${testLaunches.length} lançamentos:`);
    testLaunches.forEach(launch => {
      console.log(`  - ${launch['Lançamento']}: ${launch['Início Captação']} a ${launch['Fim Captação']}`);
    });
    
    const revenueByLaunch = await revenueService.getRevenueByLaunch(testLaunches);
    
    console.log('✅ Faturamento por LF:', revenueByLaunch);
    
    revenueByLaunch.forEach(item => {
      console.log(`💰 ${item.launch}: ${revenueService.formatCurrency(item.revenue)}`);
      if (item.error) {
        console.log(`  ❌ Erro: ${item.error}`);
      }
    });
    
    return revenueByLaunch;
  } catch (error) {
    console.error('❌ Erro ao testar faturamento por LF:', error);
    return null;
  }
}

// Função para verificar se as datas estão disponíveis
function checkLaunchDates() {
  console.log('📅 Verificando datas dos lançamentos...');
  
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
      launchesWithDates.push({
        launch: launch['Lançamento'],
        openingDate: dateValues[dateValues.length - 2],
        closingDate: dateValues[dateValues.length - 1],
        allDates: dateValues
      });
    }
  });
  
  console.log(`📊 Total de lançamentos: ${allLaunchesData.launches.length}`);
  console.log(`📊 Lançamentos com datas: ${launchesWithDates.length}`);
  
  if (launchesWithDates.length > 0) {
    console.log('✅ Primeiros 5 lançamentos com datas:');
    launchesWithDates.slice(0, 5).forEach(item => {
      console.log(`  - ${item.launch}:`);
      console.log(`    Abertura: ${item.openingDate.column} (${item.openingDate.value})`);
      console.log(`    Fechamento: ${item.closingDate.column} (${item.closingDate.value})`);
    });
    
    // Testar conversão de datas
    console.log('\n🔄 Testando conversão de datas:');
    launchesWithDates.slice(0, 3).forEach(item => {
      const openISO = convertBrazilianDateToISO(item.openingDate.value);
      const closeISO = convertBrazilianDateToISO(item.closingDate.value);
      console.log(`  ${item.launch}: ${item.openingDate.value} → ${openISO}, ${item.closingDate.value} → ${closeISO}`);
    });
  } else {
    console.log('❌ Nenhum lançamento com datas encontrado');
    console.log('🔍 Verificando colunas disponíveis...');
    
    if (allLaunchesData.launches.length > 0) {
      const firstLaunch = allLaunchesData.launches[0];
      console.log('📋 Colunas disponíveis:', Object.keys(firstLaunch));
      
      // Mostrar últimas 5 colunas
      const lastColumns = Object.keys(firstLaunch).slice(-5);
      console.log('🔍 Últimas 5 colunas:');
      lastColumns.forEach((column, index) => {
        const value = firstLaunch[column];
        console.log(`  ${Object.keys(firstLaunch).length - 5 + index + 1}. ${column}: "${value}"`);
      });
    }
  }
  
  return launchesWithDates;
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

// Executar testes
console.log(`
🧪 INSTRUÇÕES DE TESTE:

1. Verificar datas dos lançamentos:
   - Execute: checkLaunchDates()

2. Testar faturamento por período:
   - Execute: testRevenueByPeriod()

3. Testar faturamento por LF:
   - Execute: testRevenueByLaunch()

4. Executar todos os testes:
   - Execute: runAllTests()
`);

// Função para executar todos os testes
async function runAllTests() {
  console.log('🧪 Executando todos os testes...');
  
  console.log('\n=== TESTE 1: Verificar datas ===');
  checkLaunchDates();
  
  console.log('\n=== TESTE 2: Faturamento por período ===');
  await testRevenueByPeriod();
  
  console.log('\n=== TESTE 3: Faturamento por LF ===');
  await testRevenueByLaunch();
  
  console.log('\n✅ Todos os testes concluídos!');
}

// Executar verificação inicial
checkLaunchDates(); 