// Script simples para debug do ROI
// Execute este script no console do navegador

console.log('🔍 DEBUG SIMPLES DO ROI');

// Verificar se há dados de ROI
console.log('1. Verificando dados de ROI...');
if (window.roiData) {
  console.log('✅ roiData existe');
  console.log('📊 Tipo:', typeof window.roiData);
  console.log('📊 É array:', Array.isArray(window.roiData));
  console.log('📊 Comprimento:', window.roiData.length);
  console.log('📊 Primeiro item:', window.roiData[0]);
} else {
  console.log('❌ roiData não existe');
}

// Verificar se há dados de faturamento
console.log('\n2. Verificando dados de faturamento...');
if (window.revenueData) {
  console.log('✅ revenueData existe');
  console.log('📊 Comprimento:', window.revenueData.length);
} else {
  console.log('❌ revenueData não existe');
}

// Verificar se há dados de tráfego
console.log('\n3. Verificando dados de tráfego...');
if (window.processedData && window.processedData.trafficByLaunch) {
  console.log('✅ trafficByLaunch existe');
  console.log('📊 Comprimento:', window.processedData.trafficByLaunch.length);
} else {
  console.log('❌ trafficByLaunch não existe');
}

// Verificar se o gráfico está sendo renderizado
console.log('\n4. Verificando renderização...');
const allHeaders = Array.from(document.querySelectorAll('h2'));
console.log('📊 Total de headers encontrados:', allHeaders.length);

allHeaders.forEach((header, index) => {
  if (header.textContent.includes('Faturamento x Investimento')) {
    console.log(`✅ Gráfico de ROI encontrado no header ${index + 1}`);
    const container = header.closest('.bg-white, .bg-gray-800');
    if (container) {
      const rect = container.getBoundingClientRect();
      console.log(`📊 Posição: top=${rect.top}, bottom=${rect.bottom}`);
      console.log(`📊 Visível: ${rect.top < window.innerHeight && rect.bottom > 0 ? '✅' : '❌'}`);
    }
  }
});

// Verificar se há algum erro no console
console.log('\n5. Verificando erros...');
const originalError = console.error;
let errorCount = 0;

console.error = function(...args) {
  errorCount++;
  console.log(`❌ Erro ${errorCount}:`, ...args);
  originalError.apply(console, args);
};

// Forçar um erro para testar
setTimeout(() => {
  console.error = originalError;
  console.log(`📊 Total de erros capturados: ${errorCount}`);
}, 1000);

// Criar gráfico de teste simples
console.log('\n6. Criando gráfico de teste...');
const testDiv = document.createElement('div');
testDiv.style.cssText = `
  position: fixed;
  top: 20px;
  left: 20px;
  width: 300px;
  height: 200px;
  background: red;
  color: white;
  padding: 20px;
  border-radius: 8px;
  z-index: 9999;
  font-family: Arial, sans-serif;
`;

testDiv.innerHTML = `
  <h3 style="margin: 0 0 10px 0;">TESTE ROI</h3>
  <p style="margin: 5px 0;">roiData: ${window.roiData ? 'EXISTE' : 'NÃO EXISTE'}</p>
  <p style="margin: 5px 0;">Comprimento: ${window.roiData ? window.roiData.length : 'N/A'}</p>
  <p style="margin: 5px 0;">Headers: ${allHeaders.length}</p>
  <button onclick="this.parentElement.remove()" style="background: white; color: red; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; margin-top: 10px;">Fechar</button>
`;

document.body.appendChild(testDiv);
console.log('✅ Gráfico de teste criado no canto superior esquerdo');

// Verificar se o React está funcionando
console.log('\n7. Verificando React...');
if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
  console.log('✅ React DevTools disponível');
} else {
  console.log('❌ React DevTools não disponível');
}

const reactRoot = document.querySelector('#root');
if (reactRoot) {
  console.log('✅ React root encontrado');
} else {
  console.log('❌ React root não encontrado');
}

console.log('\n🎯 RESUMO:');
console.log('- roiData:', window.roiData ? 'EXISTE' : 'NÃO EXISTE');
console.log('- revenueData:', window.revenueData ? 'EXISTE' : 'NÃO EXISTE');
console.log('- trafficByLaunch:', window.processedData?.trafficByLaunch ? 'EXISTE' : 'NÃO EXISTE');
console.log('- Gráfico renderizado:', allHeaders.some(h => h.textContent.includes('Faturamento x Investimento')) ? 'SIM' : 'NÃO');
console.log('- React funcionando:', window.__REACT_DEVTOOLS_GLOBAL_HOOK__ ? 'SIM' : 'NÃO'); 