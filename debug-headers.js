// Script para verificar headers das planilhas
// Execute este script no console do navegador

console.log('🔍 Verificando headers das planilhas...');

if (allLaunchesData && allLaunchesData.launches) {
  console.log(`📊 Total de lançamentos: ${allLaunchesData.launches.length}`);
  
  allLaunchesData.launches.forEach((launch, index) => {
    console.log(`\n🔍 Lançamento ${index + 1}: ${launch['Lançamento']}`);
    
    if (launch.sheetData && launch.sheetData.headers) {
      console.log(`📋 Headers disponíveis (${launch.sheetData.headers.length} colunas):`);
      console.log(launch.sheetData.headers);
      
      // Procurar por colunas relacionadas a faixa
      const faixaHeaders = launch.sheetData.headers.filter(header => 
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
        
        // Mostrar todas as colunas para debug
        console.log(`🔍 Todas as colunas disponíveis:`);
        launch.sheetData.headers.forEach((header, idx) => {
          console.log(`${idx + 1}. "${header}"`);
        });
      }
      
      // Verificar se há dados na planilha
      console.log(`📊 Total de linhas de dados: ${launch.sheetData.data.length}`);
      
      if (launch.sheetData.data.length > 0) {
        // Mostrar primeira linha como exemplo
        console.log(`📋 Exemplo da primeira linha:`, launch.sheetData.data[0]);
      }
    } else {
      console.log(`❌ Sem dados de planilha para este lançamento`);
    }
  });
} else {
  console.log('❌ Dados de lançamentos não encontrados');
}

console.log('\n📋 RESUMO:');
console.log('1. Verifique se alguma coluna de faixa foi encontrada');
console.log('2. Se não foi encontrada, verifique o nome exato da coluna');
console.log('3. Se foi encontrada mas sem dados, verifique se há valores na coluna');
console.log('4. Se há dados, verifique se o processamento está funcionando'); 