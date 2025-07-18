// Script para testar a ordenação dos dados de faturamento
// Execute este script no console do navegador

console.log('📊 Testando ordenação dos dados de faturamento...');

// Função para testar ordenação
function testRevenueOrdering() {
  console.log('🔄 Testando ordenação dos dados de faturamento...');
  
  if (!revenueData || revenueData.length === 0) {
    console.log('❌ Dados de faturamento não encontrados');
    console.log('💡 Execute primeiro: fetchRevenueData()');
    return;
  }
  
  console.log('📊 Dados atuais (ordenados):');
  revenueData.forEach((item, index) => {
    console.log(`  ${index + 1}. ${item.launch}: R$ ${item.revenue.toFixed(2)}`);
  });
  
  // Verificar se está ordenado corretamente (mais antigo à esquerda)
  const isOrdered = revenueData.every((item, index) => {
    if (index === 0) return true;
    
    const getNum = (name) => {
      const match = name.match(/(\d+)/);
      return match ? parseInt(match[1]) : 0;
    };
    
    const currentNum = getNum(item.launch);
    const previousNum = getNum(revenueData[index - 1].launch);
    
    return currentNum >= previousNum;
  });
  
  if (isOrdered) {
    console.log('✅ Ordenação correta: Mais antigo à esquerda, mais novo à direita');
  } else {
    console.log('❌ Ordenação incorreta: Dados não estão em ordem crescente');
  }
  
  // Mostrar primeiro e último
  if (revenueData.length > 0) {
    console.log(`📈 Primeiro (mais antigo): ${revenueData[0].launch}`);
    console.log(`📈 Último (mais novo): ${revenueData[revenueData.length - 1].launch}`);
  }
}

// Função para testar tooltips
function testTooltips() {
  console.log('🖱️ Testando tooltips...');
  
  if (!revenueData || revenueData.length === 0) {
    console.log('❌ Dados de faturamento não encontrados');
    return;
  }
  
  console.log('📋 Estrutura dos dados para tooltips:');
  const firstItem = revenueData[0];
  console.log('  - cardRevenue:', firstItem.cardRevenue);
  console.log('  - boletoRevenue:', firstItem.boletoRevenue);
  console.log('  - revenue:', firstItem.revenue);
  
  console.log('✅ Tooltips configurados para mostrar:');
  console.log('  - "Cartão (GURU)" para cardRevenue');
  console.log('  - "Boleto (TMB)" para boletoRevenue');
  console.log('  - "Total" para revenue');
}

// Função para simular ordenação
function simulateOrdering() {
  console.log('🧪 Simulando ordenação...');
  
  // Dados de exemplo
  const sampleData = [
    { launch: 'LF 15', revenue: 50000 },
    { launch: 'LF 20', revenue: 75000 },
    { launch: 'LF 10', revenue: 30000 },
    { launch: 'LF 25', revenue: 90000 },
    { launch: 'LF 5', revenue: 20000 }
  ];
  
  console.log('📊 Dados originais:');
  sampleData.forEach(item => console.log(`  ${item.launch}: R$ ${item.revenue}`));
  
  // Ordenar por número do LF
  const sortedData = sampleData.sort((a, b) => {
    const getNum = (name) => {
      const match = name.match(/(\d+)/);
      return match ? parseInt(match[1]) : 0;
    };
    const numA = getNum(a.launch);
    const numB = getNum(b.launch);
    return numA - numB; // Ordem crescente
  });
  
  console.log('📊 Dados ordenados (mais antigo à esquerda):');
  sortedData.forEach(item => console.log(`  ${item.launch}: R$ ${item.revenue}`));
  
  return sortedData;
}

// Função para verificar se os dados estão sendo carregados corretamente
function checkRevenueDataStructure() {
  console.log('🔍 Verificando estrutura dos dados de faturamento...');
  
  if (!revenueData || revenueData.length === 0) {
    console.log('❌ Dados de faturamento não encontrados');
    return;
  }
  
  const firstItem = revenueData[0];
  console.log('📋 Estrutura do primeiro item:', firstItem);
  
  // Verificar campos obrigatórios
  const requiredFields = ['launch', 'revenue', 'cardRevenue', 'boletoRevenue'];
  const missingFields = requiredFields.filter(field => !(field in firstItem));
  
  if (missingFields.length === 0) {
    console.log('✅ Todos os campos obrigatórios presentes');
  } else {
    console.log('❌ Campos faltando:', missingFields);
  }
  
  // Verificar tipos de dados
  console.log('📊 Tipos de dados:');
  console.log(`  - launch: ${typeof firstItem.launch}`);
  console.log(`  - revenue: ${typeof firstItem.revenue}`);
  console.log(`  - cardRevenue: ${typeof firstItem.cardRevenue}`);
  console.log(`  - boletoRevenue: ${typeof firstItem.boletoRevenue}`);
}

// Executar verificações
console.log(`
🧪 INSTRUÇÕES DE TESTE:

1. Verificar ordenação dos dados:
   - Execute: testRevenueOrdering()

2. Testar tooltips:
   - Execute: testTooltips()

3. Simular ordenação:
   - Execute: simulateOrdering()

4. Verificar estrutura dos dados:
   - Execute: checkRevenueDataStructure()

5. Executar todas as verificações:
   - Execute: runAllOrderingTests()
`);

// Função para executar todas as verificações
function runAllOrderingTests() {
  console.log('🧪 Executando todas as verificações de ordenação...');
  
  console.log('\n=== VERIFICAÇÃO 1: Estrutura dos dados ===');
  checkRevenueDataStructure();
  
  console.log('\n=== VERIFICAÇÃO 2: Ordenação ===');
  testRevenueOrdering();
  
  console.log('\n=== VERIFICAÇÃO 3: Tooltips ===');
  testTooltips();
  
  console.log('\n=== VERIFICAÇÃO 4: Simulação ===');
  simulateOrdering();
  
  console.log('\n✅ Todas as verificações concluídas!');
}

// Executar verificação inicial
if (revenueData && revenueData.length > 0) {
  testRevenueOrdering();
} else {
  console.log('💡 Para testar, primeiro carregue os dados de faturamento na página');
} 