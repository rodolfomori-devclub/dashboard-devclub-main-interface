// Script para identificar a coluna de tráfego na planilha principal
// Execute este script no console do navegador

console.log('🚦 Verificando coluna de tráfego na planilha principal...');

// Função para verificar a coluna de tráfego na planilha principal
function checkMainSheetTrafficColumn() {
  console.log('📋 Verificando coluna de tráfego na planilha principal...');
  
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
  
  // Procurar por colunas relacionadas a tráfego
  const trafficColumns = allColumns.filter(column => {
    const lowerColumn = column.toLowerCase();
    return lowerColumn.includes('tráfego') || 
           lowerColumn.includes('trafico') || 
           lowerColumn.includes('gasto') ||
           lowerColumn.includes('investimento') ||
           lowerColumn.includes('facebook') ||
           lowerColumn.includes('google') ||
           lowerColumn.includes('ads') ||
           lowerColumn.includes('anúncio') ||
           lowerColumn.includes('anuncio') ||
           lowerColumn.includes('marketing') ||
           lowerColumn.includes('publicidade');
  });
  
  console.log('🚦 Colunas relacionadas a tráfego:', trafficColumns);
  
  // Mostrar valores das colunas de tráfego
  trafficColumns.forEach(column => {
    const value = firstLaunch[column];
    console.log(`  ${column}: "${value}"`);
  });
  
  // Verificar se há valores numéricos
  const numericTrafficColumns = trafficColumns.filter(column => {
    const value = firstLaunch[column];
    if (!value) return false;
    
    // Tentar converter para número
    const numValue = parseFloat(value.toString().replace(/[^\d,.-]/g, '').replace(',', '.'));
    return !isNaN(numValue) && numValue > 0;
  });
  
  console.log('💰 Colunas com valores numéricos de tráfego:', numericTrafficColumns);
  
  // Mostrar valores numéricos
  numericTrafficColumns.forEach(column => {
    const value = firstLaunch[column];
    const numValue = parseFloat(value.toString().replace(/[^\d,.-]/g, '').replace(',', '.'));
    console.log(`  ${column}: ${value} → R$ ${numValue.toFixed(2)}`);
  });
  
  return {
    allTrafficColumns: trafficColumns,
    numericTrafficColumns: numericTrafficColumns
  };
}

// Função para verificar todos os lançamentos
function checkAllLaunchesTrafficData() {
  console.log('📊 Verificando dados de tráfego em todos os lançamentos...');
  
  if (!allLaunchesData || !allLaunchesData.launches) {
    console.log('❌ Dados de lançamentos não encontrados');
    return;
  }
  
  const launchesWithTraffic = [];
  
  allLaunchesData.launches.forEach(launch => {
    const allColumns = Object.keys(launch);
    
    // Procurar por colunas relacionadas a tráfego
    const trafficColumns = allColumns.filter(column => {
      const lowerColumn = column.toLowerCase();
      return lowerColumn.includes('tráfego') || 
             lowerColumn.includes('trafico') || 
             lowerColumn.includes('gasto') ||
             lowerColumn.includes('investimento');
    });
    
    if (trafficColumns.length > 0) {
      const trafficData = {};
      let hasNumericValue = false;
      
      trafficColumns.forEach(column => {
        const value = launch[column];
        if (value) {
          const numValue = parseFloat(value.toString().replace(/[^\d,.-]/g, '').replace(',', '.'));
          if (!isNaN(numValue) && numValue > 0) {
            trafficData[column] = numValue;
            hasNumericValue = true;
          }
        }
      });
      
      if (hasNumericValue) {
        launchesWithTraffic.push({
          launch: launch['Lançamento'],
          trafficData: trafficData
        });
      }
    }
  });
  
  console.log(`📊 Total de lançamentos: ${allLaunchesData.launches.length}`);
  console.log(`📊 Lançamentos com dados de tráfego: ${launchesWithTraffic.length}`);
  
  if (launchesWithTraffic.length > 0) {
    console.log('✅ Primeiros 10 lançamentos com dados de tráfego:');
    launchesWithTraffic.slice(0, 10).forEach(item => {
      console.log(`  - ${item.launch}:`, item.trafficData);
    });
  } else {
    console.log('❌ Nenhum lançamento com dados de tráfego encontrado');
  }
  
  return launchesWithTraffic;
}

// Função para testar com um lançamento específico
function testSpecificLaunchTrafficData(launchName) {
  console.log(`🔍 Testando dados de tráfego do lançamento: ${launchName}`);
  
  const launch = allLaunchesData.launches.find(l => l['Lançamento'] === launchName);
  if (!launch) {
    console.log(`❌ Lançamento "${launchName}" não encontrado`);
    return null;
  }
  
  console.log('📊 Dados do lançamento:', launch);
  
  // Listar todas as colunas com valores
  const allColumns = Object.keys(launch);
  console.log('📋 Colunas disponíveis:', allColumns);
  
  // Procurar por colunas relacionadas a tráfego
  const trafficColumns = allColumns.filter(column => {
    const lowerColumn = column.toLowerCase();
    return lowerColumn.includes('tráfego') || 
           lowerColumn.includes('trafico') || 
           lowerColumn.includes('gasto') ||
           lowerColumn.includes('investimento');
  });
  
  console.log('🚦 Colunas de tráfego encontradas:', trafficColumns);
  
  // Mostrar valores das colunas de tráfego
  trafficColumns.forEach(column => {
    const value = launch[column];
    if (value) {
      const numValue = parseFloat(value.toString().replace(/[^\d,.-]/g, '').replace(',', '.'));
      console.log(`  ${column}: "${value}" → R$ ${numValue.toFixed(2)}`);
    } else {
      console.log(`  ${column}: (vazio)`);
    }
  });
  
  return {
    launch: launchName,
    trafficColumns: trafficColumns,
    trafficData: trafficColumns.reduce((acc, column) => {
      const value = launch[column];
      if (value) {
        const numValue = parseFloat(value.toString().replace(/[^\d,.-]/g, '').replace(',', '.'));
        if (!isNaN(numValue) && numValue > 0) {
          acc[column] = numValue;
        }
      }
      return acc;
    }, {})
  };
}

// Função para formatar valor monetário
function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2
  }).format(value || 0);
}

// Executar verificações
console.log(`
🧪 INSTRUÇÕES DE TESTE:

1. Verificar coluna de tráfego na planilha principal:
   - Execute: checkMainSheetTrafficColumn()

2. Verificar todos os lançamentos:
   - Execute: checkAllLaunchesTrafficData()

3. Testar lançamento específico:
   - Execute: testSpecificLaunchTrafficData('LF 15')

4. Executar todas as verificações:
   - Execute: runAllMainSheetTrafficTests()
`);

// Função para executar todas as verificações
function runAllMainSheetTrafficTests() {
  console.log('🧪 Executando todas as verificações de tráfego da planilha principal...');
  
  console.log('\n=== VERIFICAÇÃO 1: Coluna de tráfego ===');
  const result = checkMainSheetTrafficColumn();
  
  console.log('\n=== VERIFICAÇÃO 2: Todos os lançamentos ===');
  const allLaunches = checkAllLaunchesTrafficData();
  
  console.log('\n=== VERIFICAÇÃO 3: Lançamento específico ===');
  const specificLaunch = testSpecificLaunchTrafficData('LF 15');
  
  console.log('\n✅ Todas as verificações concluídas!');
  
  if (result) {
    console.log('\n🎯 RESULTADO DA IDENTIFICAÇÃO:');
    console.log(`Colunas de tráfego encontradas: ${result.allTrafficColumns.length}`);
    console.log(`Colunas com valores numéricos: ${result.numericTrafficColumns.length}`);
  }
  
  if (allLaunches) {
    console.log(`\n📊 RESUMO: ${allLaunches.length} lançamentos com dados de tráfego`);
  }
}

// Executar verificação inicial
checkMainSheetTrafficColumn(); 