import React, { useState, useEffect } from 'react';
import { formatCurrency } from '../utils/currencyUtils';

const PaymentMethodCards = ({ salesData }) => {
  const [paymentMethods, setPaymentMethods] = useState({});
  
  useEffect(() => {
    if (!salesData || !salesData.length) return;
    
    // Agrupar vendas por método de pagamento
    const methodsMap = {};
    
    salesData.forEach(sale => {
      const method = sale.paymentMethod || 'Desconhecido';
      
      if (!methodsMap[method]) {
        methodsMap[method] = {
          count: 0,
          value: 0,
        };
      }
      
      methodsMap[method].count += 1;
      methodsMap[method].value += (sale.value || 0);
    });
    
    // Calcular totais
    let totalCount = 0;
    let totalValue = 0;
    
    Object.values(methodsMap).forEach(method => {
      totalCount += method.count;
      totalValue += method.value;
    });
    
    // Adicionar percentuais e ticket médio
    Object.keys(methodsMap).forEach(key => {
      methodsMap[key].percentCount = totalCount ? (methodsMap[key].count / totalCount) * 100 : 0;
      methodsMap[key].percentValue = totalValue ? (methodsMap[key].value / totalValue) * 100 : 0;
      methodsMap[key].ticketAvg = methodsMap[key].count ? methodsMap[key].value / methodsMap[key].count : 0;
    });
    
    setPaymentMethods(methodsMap);
  }, [salesData]);

  // Função para obter cor baseada no método de pagamento
  const getMethodColor = (method) => {
    const methodLower = method.toLowerCase();
    
    if (methodLower.includes('cartão') || methodLower.includes('cartao') || methodLower.includes('card')) {
      return 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200';
    } else if (methodLower.includes('boleto')) {
      return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200';
    } else if (methodLower.includes('pix')) {
      return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200';
    } else if (methodLower.includes('dinheiro') || methodLower.includes('cash')) {
      return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200';
    }
    
    return 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200';
  };

  // Ordenar métodos por valor total (decrescente)
  const sortedMethods = Object.keys(paymentMethods)
    .sort((a, b) => paymentMethods[b].value - paymentMethods[a].value);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
      <h3 className="text-xl font-bold text-primary dark:text-secondary mb-6">
        Resumo por Método de Pagamento
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sortedMethods.map(method => (
          <div 
            key={method} 
            className={`p-4 rounded-lg ${getMethodColor(method)} shadow-sm`}
          >
            <h4 className="text-lg font-bold mb-2">
              {method}
            </h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm opacity-80">Vendas</p>
                <p className="text-2xl font-bold">{paymentMethods[method].count}</p>
                <p className="text-sm opacity-70">
                  {paymentMethods[method].percentCount.toFixed(1)}% do total
                </p>
              </div>
              
              <div>
                <p className="text-sm opacity-80">Valor</p>
                <p className="text-2xl font-bold">{formatCurrency(paymentMethods[method].value)}</p>
                <p className="text-sm opacity-70">
                  {paymentMethods[method].percentValue.toFixed(1)}% da receita
                </p>
              </div>
            </div>
            
            <div className="mt-4 pt-3 border-t border-current border-opacity-20">
              <div className="flex justify-between items-center">
                <span className="text-sm opacity-80">Ticket Médio:</span>
                <span className="font-bold">
                  {formatCurrency(paymentMethods[method].ticketAvg)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PaymentMethodCards;