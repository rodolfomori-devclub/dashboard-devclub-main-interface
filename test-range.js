// Script para testar se o range expandido está funcionando
// Execute este script no console do navegador

console.log('🧪 Testando range expandido...');

// Função para verificar se as colunas estão sendo carregadas
function testRangeExpansion() {
  console.log('📊 Verificando se as colunas AH/AF estão sendo carregadas...');
  
  if (allLaunchesData && allLaunchesData.launches) {
    allLaunchesData.launches.forEach((launch, index) => {
      console.log(`\n🔍 Lançamento ${index + 1}: ${launch['Lançamento']}`);
      
      if (launch.sheetData && launch.sheetData.headers) {
        const headers = launch.sheetData.headers;
        console.log(`📋 Total de colunas carregadas: ${headers.length}`);
        
        // Verificar se chegamos até a coluna AH (34ª coluna)
        if (headers.length >= 34) {
          console.log(`✅ Range expandido funcionando! Coluna AH: "${headers[33]}"`);
        } else {
          console.log(`❌ Range ainda limitado. Última coluna: "${headers[headers.length - 1]}"`);
        }
        
        // Procurar por colunas de faixa
        const faixaHeaders = headers.filter(header => 
          header.toLowerCase().includes('faixa') || 
          header.toLowerCase().includes('score') ||
          header.toLowerCase().includes('pontuação') ||
          header.toLowerCase().includes('classificação') ||
          header.toLowerCase().includes('rating')
        );
        
        if (faixaHeaders.length > 0) {
          console.log(`✅ Colunas de faixa encontradas:`, faixaHeaders);
          
          // Verificar dados da primeira coluna de faixa
          const firstFaixaHeader = faixaHeaders[0];
          const faixaData = launch.sheetData.data.map(row => row[firstFaixaHeader]).filter(val => val && val.trim() !== '');
          console.log(`📊 Dados da coluna "${firstFaixaHeader}":`, faixaData);
          console.log(`📊 Total de valores não vazios:`, faixaData.length);
          console.log(`📊 Valores únicos:`, [...new Set(faixaData)]);
        } else {
          console.log(`❌ Nenhuma coluna de faixa encontrada`);
          
          // Mostrar últimas 10 colunas
          console.log(`🔍 Últimas 10 colunas:`, headers.slice(-10));
        }
      } else {
        console.log(`❌ Sem dados de planilha`);
      }
    });
  } else {
    console.log('❌ Dados não encontrados');
  }
}

// Função para forçar recarregamento
function forceReload() {
  console.log('🔄 Forçando recarregamento...');
  
  // Limpar cache
  if (leadScoringService) {
    leadScoringService.clearCache();
  }
  
  // Recarregar página
  console.log('🔄 Recarregando página...');
  window.location.reload();
}

// Executar teste
testRangeExpansion();

console.log(`
📋 INSTRUÇÕES:

1. Se o range ainda estiver limitado:
   - Execute: forceReload()
   - Aguarde o carregamento
   - Execute este script novamente

2. Se as colunas estiverem sendo carregadas mas sem dados:
   - Verifique se há dados nas colunas AH/AF das planilhas
   - Confirme se a aba é "[LF] Pesquisa"

3. Se tudo estiver funcionando:
   - O gráfico de faixa deve aparecer automaticamente
`); 