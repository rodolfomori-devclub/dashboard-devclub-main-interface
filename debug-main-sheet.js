// Script para verificar a estrutura da planilha principal
// Execute este script no console do navegador

console.log('🔍 Verificando estrutura da planilha principal...');

// Função para verificar a estrutura da planilha principal
function checkMainSheetStructure() {
  console.log('📋 Verificando estrutura da planilha principal...');
  
  if (!allLaunchesData || !allLaunchesData.launches) {
    console.log('❌ Dados de lançamentos não encontrados');
    return;
  }
  
  if (allLaunchesData.launches.length === 0) {
    console.log('❌ Nenhum lançamento encontrado');
    return;
  }
  
  // Pegar o primeiro lançamento para análise
  const firstLaunch = allLaunchesData.launches[0];
  console.log('📊 Primeiro lançamento:', firstLaunch['Lançamento']);
  
  // Listar todas as colunas
  const allColumns = Object.keys(firstLaunch);
  console.log('📋 Total de colunas:', allColumns.length);
  console.log('📋 Todas as colunas:', allColumns);
  
  // Procurar por colunas que podem ser datas
  const possibleDateColumns = allColumns.filter(column => {
    const value = firstLaunch[column];
    if (!value) return false;
    
    // Verificar se parece uma data (contém / ou -)
    const isDateLike = /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}/.test(value);
    const hasDateKeywords = column.toLowerCase().includes('data') || 
                           column.toLowerCase().includes('início') || 
                           column.toLowerCase().includes('fim') ||
                           column.toLowerCase().includes('abertura') ||
                           column.toLowerCase().includes('fechamento') ||
                           column.toLowerCase().includes('captação');
    
    return isDateLike || hasDateKeywords;
  });
  
  console.log('📅 Colunas que podem ser datas:', possibleDateColumns);
  
  // Mostrar valores das colunas de data
  possibleDateColumns.forEach(column => {
    console.log(`📅 ${column}: "${firstLaunch[column]}"`);
  });
  
  // Verificar as últimas colunas (onde provavelmente estão as datas de carrinho)
  const lastColumns = allColumns.slice(-5);
  console.log('🔍 Últimas 5 colunas:', lastColumns);
  
  lastColumns.forEach((column, index) => {
    const value = firstLaunch[column];
    console.log(`  ${allColumns.length - 5 + index + 1}. ${column}: "${value}"`);
  });
  
  // Tentar identificar automaticamente as colunas de abertura e fechamento
  console.log('\n🎯 Tentando identificar colunas automaticamente...');
  
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

// Função para testar com um lançamento específico
function testSpecificLaunch(launchName) {
  console.log(`🔍 Testando lançamento específico: ${launchName}`);
  
  const launch = allLaunchesData.launches.find(l => l['Lançamento'] === launchName);
  if (!launch) {
    console.log(`❌ Lançamento "${launchName}" não encontrado`);
    return;
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

// Função para testar conversão de datas
function testDateConversion() {
  console.log('🔄 Testando conversão de datas...');
  
  const testDates = [
    '02/06/2025',
    '08/06/2025',
    '20/05/2025',
    '26/05/2025'
  ];
  
  testDates.forEach(date => {
    const isoDate = convertBrazilianDateToISO(date);
    console.log(`📅 "${date}" → "${isoDate}"`);
  });
}

// Executar verificações
console.log(`
🧪 INSTRUÇÕES DE DEBUG:

1. Verificar estrutura da planilha principal:
   - Execute: checkMainSheetStructure()

2. Testar lançamento específico:
   - Execute: testSpecificLaunch('LF 15')

3. Testar conversão de datas:
   - Execute: testDateConversion()

4. Executar todas as verificações:
   - Execute: runAllChecks()
`);

// Função para executar todas as verificações
function runAllChecks() {
  console.log('🧪 Executando todas as verificações...');
  
  console.log('\n=== VERIFICAÇÃO 1: Estrutura da planilha ===');
  const result = checkMainSheetStructure();
  
  console.log('\n=== VERIFICAÇÃO 2: Lançamento específico ===');
  testSpecificLaunch('LF 15');
  
  console.log('\n=== VERIFICAÇÃO 3: Conversão de datas ===');
  testDateConversion();
  
  console.log('\n✅ Todas as verificações concluídas!');
  
  if (result) {
    console.log('\n🎯 RESULTADO DA IDENTIFICAÇÃO:');
    console.log(`Coluna de abertura: ${result.openingColumn}`);
    console.log(`Coluna de fechamento: ${result.closingColumn}`);
  }
}

// Executar verificação inicial
checkMainSheetStructure(); 