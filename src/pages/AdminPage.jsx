import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, getDocs, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { formatCurrency } from '../utils/currencyUtils';

// Valores dos produtos de boleto
const BOLETO_PRODUCTS = {
  'Boleto Parcelado DevClub': 2200,
  'Boleto Parcelado Front End': 1200,
  'Boleto Parcelado Vitalício': 1200,
  'Boleto Parcelado TMB': 2500
};

function AdminPage() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [quantity, setQuantity] = useState(1);
  const [product, setProduct] = useState(Object.keys(BOLETO_PRODUCTS)[0]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [recentSales, setRecentSales] = useState([]);

  // Buscar vendas recentes ao carregar
  useEffect(() => {
    const fetchRecentSales = async () => {
      try {
        const salesRef = collection(db, 'tmb_boleto_sales');
        const q = query(salesRef, orderBy('timestamp', 'desc'));
        const snapshot = await getDocs(q);
        
        const sales = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate() || new Date()
        }));
        
        setRecentSales(sales);
      } catch (error) {
        console.error('Erro ao buscar vendas recentes:', error);
      }
    };

    fetchRecentSales();
  }, []);

  const handleAddSales = async () => {
    try {
      setLoading(true);
      
      // Converter a data string para objeto Date
      const saleDate = new Date(date);
      
      // Ajustar fuso horário para meio-dia (para evitar problemas de fuso horário)
      saleDate.setHours(12, 0, 0, 0);
      
      const productValue = BOLETO_PRODUCTS[product];
      
      // Criar múltiplas vendas conforme a quantidade
      const salesPromises = [];
      
      for (let i = 0; i < quantity; i++) {
        const saleData = {
          product: product,
          value: productValue,
          timestamp: Timestamp.fromDate(saleDate),
          payment_method: 'boleto',
          created_at: Timestamp.now()
        };
        
        salesPromises.push(addDoc(collection(db, 'tmb_boleto_sales'), saleData));
      }
      
      await Promise.all(salesPromises);
      
      setMessage({
        type: 'success',
        text: `${quantity} venda(s) de ${product} adicionada(s) com sucesso para ${saleDate.toLocaleDateString('pt-BR')}`
      });
      
      // Atualizar lista de vendas recentes
      const salesRef = collection(db, 'tmb_boleto_sales');
      const q = query(salesRef, orderBy('timestamp', 'desc'));
      const snapshot = await getDocs(q);
      
      const sales = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date()
      }));
      
      setRecentSales(sales);
      
    } catch (error) {
      console.error('Erro ao adicionar vendas:', error);
      setMessage({
        type: 'error',
        text: `Erro ao adicionar vendas: ${error.message}`
      });
    } finally {
      setLoading(false);
      
      // Limpar mensagem após 5 segundos
      setTimeout(() => {
        setMessage(null);
      }, 5000);
    }
  };

  const handleDateChange = (e) => {
    setDate(e.target.value);
  };

  const handleQuantityChange = (e) => {
    const value = parseInt(e.target.value) || 1;
    setQuantity(Math.max(1, value)); // Garantir que quantidade mínima é 1
  };

  const handleProductChange = (e) => {
    setProduct(e.target.value);
  };

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-primary-dark dark:text-primary">
            Administração de Vendas Boleto (TMB)
          </h1>
          <p className="mt-2 text-text-light dark:text-text-dark">
            Esta página é temporária para inserção manual de vendas de boleto até a integração com a API da TMB.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Formulário de Inserção */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-primary-dark dark:text-primary mb-4">
              Adicionar Vendas
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-text-light dark:text-text-dark mb-1">
                  Data da Venda
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={handleDateChange}
                  className="w-full px-3 py-2 border rounded-lg bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark"
                />
              </div>
              
              <div>
                <label className="block text-text-light dark:text-text-dark mb-1">
                  Produto
                </label>
                <select
                  value={product}
                  onChange={handleProductChange}
                  className="w-full px-3 py-2 border rounded-lg bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark"
                >
                  {Object.keys(BOLETO_PRODUCTS).map((productName) => (
                    <option key={productName} value={productName}>
                      {productName} - {formatCurrency(BOLETO_PRODUCTS[productName])}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-text-light dark:text-text-dark mb-1">
                  Quantidade
                </label>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={handleQuantityChange}
                  className="w-full px-3 py-2 border rounded-lg bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark"
                />
              </div>
              
              <div className="pt-4">
                <button
                  onClick={handleAddSales}
                  disabled={loading}
                  className="w-full px-4 py-2 bg-primary text-white dark:bg-secondary dark:text-primary-dark rounded-lg hover:bg-opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Adicionando...' : 'Adicionar Vendas'}
                </button>
              </div>
              
              {message && (
                <div className={`mt-4 p-3 rounded-lg ${
                  message.type === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                }`}>
                  {message.text}
                </div>
              )}
            </div>
          </div>
          
          {/* Vendas Recentes */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-primary-dark dark:text-primary mb-4">
              Vendas Recentes
            </h2>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Data
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Produto
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Valor
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {recentSales.length === 0 ? (
                    <tr>
                      <td colSpan="3" className="px-6 py-4 text-center text-text-light dark:text-text-dark">
                        Nenhuma venda registrada
                      </td>
                    </tr>
                  ) : (
                    recentSales.map((sale) => (
                      <tr key={sale.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-text-light dark:text-text-dark">
                          {sale.timestamp.toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-text-light dark:text-text-dark">
                          {sale.product}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-text-light dark:text-text-dark">
                          {formatCurrency(sale.value)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminPage;