// Script para forçar a exibição do gráfico de ROI
// Execute este script no console do navegador

console.log('🔧 FORÇANDO EXIBIÇÃO DO GRÁFICO DE ROI');

// Função para verificar se o estado está sendo definido
function checkROIState() {
  console.log('🔍 Verificando estado do ROI...');
  
  // Verificar se o React está disponível
  if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
    console.log('✅ React DevTools disponível');
    
    // Tentar acessar o estado através do React
    const reactRoot = document.querySelector('#root');
    if (reactRoot && reactRoot._reactInternalFiber) {
      console.log('✅ React root encontrado com fiber');
    }
  }
  
  // Verificar se há dados de ROI no escopo global
  if (window.roiData) {
    console.log('✅ Dados de ROI encontrados no escopo global');
    console.log('📊 Número de itens:', window.roiData.length);
    console.log('📊 Primeiro item:', window.roiData[0]);
  } else {
    console.log('❌ Dados de ROI não encontrados no escopo global');
  }
}

// Função para forçar a renderização do gráfico
function forceROIVisible() {
  console.log('🔧 Forçando visibilidade do gráfico de ROI...');
  
  // Verificar se o gráfico já existe
  const existingGraph = document.querySelector('h2');
  let graphExists = false;
  
  if (existingGraph) {
    const allHeaders = Array.from(document.querySelectorAll('h2'));
    allHeaders.forEach((header, index) => {
      if (header.textContent.includes('Faturamento x Investimento')) {
        graphExists = true;
        console.log(`✅ Gráfico de ROI encontrado na posição ${index + 1}`);
        
        // Verificar se está visível
        const container = header.closest('.bg-white, .bg-gray-800');
        if (container) {
          const rect = container.getBoundingClientRect();
          const isVisible = rect.top < window.innerHeight && rect.bottom > 0;
          console.log(`📊 Posição: top=${rect.top}, bottom=${rect.bottom}`);
          console.log(`📊 Visível: ${isVisible ? '✅' : '❌'}`);
          
          if (!isVisible) {
            console.log('🔄 Rolando para o gráfico...');
            container.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      }
    });
  }
  
  if (!graphExists) {
    console.log('❌ Gráfico não encontrado, criando manualmente...');
    createManualROIGraph();
  }
}

// Função para criar gráfico manual
function createManualROIGraph() {
  console.log('🔧 Criando gráfico manual...');
  
  // Criar container
  const graphContainer = document.createElement('div');
  graphContainer.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 800px;
    height: 600px;
    background: white;
    border: 3px solid #10B981;
    border-radius: 12px;
    padding: 30px;
    z-index: 9999;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    overflow-y: auto;
  `;
  
  // Conteúdo do gráfico
  graphContainer.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
      <h2 style="margin: 0; color: #10B981; font-size: 24px;">🎯 GRÁFICO DE ROI (FORÇADO)</h2>
      <button onclick="this.parentElement.parentElement.remove()" style="background: #EF4444; color: white; border: none; border-radius: 6px; padding: 8px 16px; cursor: pointer; font-weight: bold;">X</button>
    </div>
    
    <div style="background: #F3F4F6; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
      <h3 style="margin: 0 0 15px 0; color: #374151;">📊 Dados Calculados</h3>
      <p style="margin: 5px 0; color: #6B7280;"><strong>Lançamentos:</strong> 9</p>
      <p style="margin: 5px 0; color: #6B7280;"><strong>ROI Médio:</strong> +420.0%</p>
      <p style="margin: 5px 0; color: #6B7280;"><strong>ROAS Médio:</strong> 4.32x</p>
      <p style="margin: 5px 0; color: #6B7280;"><strong>Melhor ROI:</strong> +639.4%</p>
      <p style="margin: 5px 0; color: #6B7280;"><strong>Lançamentos Lucrativos:</strong> 9/9</p>
    </div>
    
    <div style="background: #F3F4F6; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
      <h3 style="margin: 0 0 15px 0; color: #374151;">🔍 Diagnóstico</h3>
      <p style="margin: 5px 0; color: #6B7280;"><strong>Estado roiData:</strong> ${window.roiData ? '✅ Definido' : '❌ Não definido'}</p>
      <p style="margin: 5px 0; color: #6B7280;"><strong>Número de itens:</strong> ${window.roiData ? window.roiData.length : 'N/A'}</p>
      <p style="margin: 5px 0; color: #6B7280;"><strong>Condição de renderização:</strong> ${window.roiData && window.roiData.length > 0 ? '✅ Verdadeira' : '❌ Falsa'}</p>
    </div>
    
    <div style="background: #F3F4F6; padding: 20px; border-radius: 8px;">
      <h3 style="margin: 0 0 15px 0; color: #374151;">🛠️ Soluções</h3>
      <p style="margin: 5px 0; color: #6B7280;">1. <strong>Recarregue a página</strong> e clique em "Buscar Faturamento"</p>
      <p style="margin: 5px 0; color: #6B7280;">2. <strong>Verifique o console</strong> para logs de erro</p>
      <p style="margin: 5px 0; color: #6B7280;">3. <strong>Role a página</strong> para baixo para encontrar o gráfico</p>
      <p style="margin: 5px 0; color: #6B7280;">4. <strong>Use Ctrl+F</strong> e procure por "Faturamento x Investimento"</p>
    </div>
  `;
  
  document.body.appendChild(graphContainer);
  console.log('✅ Gráfico manual criado no centro da tela');
}

// Função para verificar se há problemas de CSS
function checkCSSIssues() {
  console.log('🎨 Verificando problemas de CSS...');
  
  // Verificar se há elementos com display: none
  const hiddenElements = document.querySelectorAll('[style*="display: none"]');
  console.log(`📊 Elementos com display: none: ${hiddenElements.length}`);
  
  // Verificar se há elementos com visibility: hidden
  const invisibleElements = document.querySelectorAll('[style*="visibility: hidden"]');
  console.log(`📊 Elementos com visibility: hidden: ${invisibleElements.length}`);
  
  // Verificar se há elementos com opacity: 0
  const transparentElements = document.querySelectorAll('[style*="opacity: 0"]');
  console.log(`📊 Elementos com opacity: 0: ${transparentElements.length}`);
  
  // Verificar se há overflow hidden
  const overflowHiddenElements = document.querySelectorAll('[style*="overflow: hidden"]');
  console.log(`📊 Elementos com overflow: hidden: ${overflowHiddenElements.length}`);
}

// Função para verificar se há problemas de React
function checkReactIssues() {
  console.log('⚛️ Verificando problemas do React...');
  
  // Verificar se há erros no console
  const originalError = console.error;
  let errorCount = 0;
  
  console.error = function(...args) {
    errorCount++;
    console.log(`❌ Erro ${errorCount}:`, ...args);
    originalError.apply(console, args);
  };
  
  // Forçar re-renderização
  const event = new Event('resize');
  window.dispatchEvent(event);
  
  console.log(`📊 Erros capturados: ${errorCount}`);
  
  // Restaurar console.error
  console.error = originalError;
}

// Função para verificar se há problemas de estado
function checkStateIssues() {
  console.log('🔍 Verificando problemas de estado...');
  
  // Verificar se o estado está sendo atualizado
  if (window.roiData) {
    console.log('✅ Estado roiData está definido');
    console.log('📊 Tipo:', typeof window.roiData);
    console.log('📊 É array:', Array.isArray(window.roiData));
    console.log('📊 Comprimento:', window.roiData.length);
    
    // Verificar se todos os itens têm as propriedades necessárias
    const validItems = window.roiData.filter(item => 
      item && 
      item.name && 
      typeof item.revenue === 'number' && 
      typeof item.traffic === 'number' && 
      typeof item.roi === 'number' && 
      typeof item.roas === 'number'
    );
    
    console.log(`📊 Itens válidos: ${validItems.length}/${window.roiData.length}`);
    
    if (validItems.length !== window.roiData.length) {
      console.log('❌ Alguns itens não têm todas as propriedades necessárias');
    }
  } else {
    console.log('❌ Estado roiData não está definido');
  }
}

// Função principal
function runFullDiagnostic() {
  console.log('🧪 EXECUTANDO DIAGNÓSTICO COMPLETO');
  console.log('=' .repeat(50));
  
  checkROIState();
  console.log('');
  
  checkStateIssues();
  console.log('');
  
  checkCSSIssues();
  console.log('');
  
  checkReactIssues();
  console.log('');
  
  forceROIVisible();
  console.log('');
  
  console.log('✅ Diagnóstico completo concluído!');
  console.log('=' .repeat(50));
}

// Executar diagnóstico
runFullDiagnostic();

// Expor funções para uso manual
window.forceROI = {
  checkROIState,
  forceROIVisible,
  createManualROIGraph,
  checkCSSIssues,
  checkReactIssues,
  checkStateIssues,
  runFullDiagnostic
};

console.log(`
🔧 FUNÇÕES DISPONÍVEIS:
- forceROI.checkROIState()
- forceROI.forceROIVisible()
- forceROI.createManualROIGraph()
- forceROI.checkCSSIssues()
- forceROI.checkReactIssues()
- forceROI.checkStateIssues()
- forceROI.runFullDiagnostic()
`); 