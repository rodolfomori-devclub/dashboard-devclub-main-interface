import axios from 'axios';

// Configuração da planilha
const SPREADSHEET_ID = '1dGBzqdZpenGDy5RB6K_RXvq7qA5lMgeGWK818a7q5iU';
const SHEET_NAME = 'AUX | Dashboard';

console.log('🧪 Testando integração com Google Sheets - Dados de Tráfego\n');

// URL para buscar dados em formato CSV
const csvUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SHEET_NAME)}`;

console.log('📊 URL da planilha:', csvUrl);
console.log('Iniciando busca de dados...\n');

async function testSheetIntegration() {
  try {
    const startTime = Date.now();

    // Buscar dados
    const response = await axios.get(csvUrl, {
      timeout: 15000,
      headers: {
        'Accept': 'text/csv',
        'Cache-Control': 'no-cache'
      }
    });

    const endTime = Date.now();
    console.log(`✅ Dados recebidos em ${endTime - startTime}ms`);

    // Parse simples do CSV
    const lines = response.data.split('\n');
    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());

    console.log('\n📋 Headers encontrados:');
    headers.forEach((header, index) => {
      console.log(`  ${index + 1}. ${header}`);
    });

    // Contar linhas de dados
    const dataLines = lines.filter(line => line.trim()).length - 1;
    console.log(`\n📈 Total de linhas de dados: ${dataLines}`);

    // Mostrar primeiras 3 linhas de dados
    console.log('\n🔍 Primeiras 3 linhas de dados:');
    for (let i = 1; i <= Math.min(3, dataLines); i++) {
      const values = lines[i].split(',').map(v => v.replace(/"/g, '').trim());
      console.log(`\n  Linha ${i}:`);
      headers.forEach((header, index) => {
        if (values[index]) {
          console.log(`    ${header}: ${values[index]}`);
        }
      });
    }

    // Verificar métricas importantes
    console.log('\n✨ Métricas identificadas:');
    const metricsHeaders = [
      'CTR', 'CPC', 'CPL', 'CPM',
      'INVESTIMENTO', 'Nº IMPRESSÕES',
      'Nº CLIQUES', 'Nº LEADS'
    ];

    const foundMetrics = headers.filter(h =>
      metricsHeaders.some(m => h.includes(m))
    );

    foundMetrics.forEach(metric => {
      console.log(`  ✓ ${metric}`);
    });

    console.log('\n🎉 Teste concluído com sucesso!');
    console.log('   A integração com o Google Sheets está funcionando corretamente.\n');

  } catch (error) {
    console.error('\n❌ Erro ao buscar dados:', error.message);

    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Headers:', error.response.headers);
    }

    console.log('\n💡 Sugestões:');
    console.log('   1. Verifique se a planilha está com compartilhamento público');
    console.log('   2. Confirme se o nome da aba está correto: "AUX | Dashboard"');
    console.log('   3. Tente acessar a URL diretamente no navegador');
  }
}

// Executar teste
testSheetIntegration();