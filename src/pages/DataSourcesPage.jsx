import React from 'react';

function DataSourcesPage() {
  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-primary-dark dark:text-primary mb-6">
          Fontes de Dados
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-primary dark:text-secondary mb-4">
              Vendas por Cartão
            </h2>
            <p className="text-text-light dark:text-text-dark mb-4">
              Os dados de vendas por cartão são obtidos através da API do PagarMe/GURU.
            </p>
            <div className="flex items-center text-green-600 dark:text-green-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Conexão ativa</span>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-primary dark:text-secondary mb-4">
              Vendas por Boleto
            </h2>
            <p className="text-text-light dark:text-text-dark mb-4">
              Os dados de vendas por boleto são obtidos através do Google Sheets.
            </p>
            <p className="text-text-light dark:text-text-dark mb-4">
              <a 
                href="https://docs.google.com/spreadsheets/d/12W7rG0P4fPUHkaccJ26KNa877LkqcRo5gv4gO5RQfFA/edit" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                Ver planilha
              </a>
            </p>
            <div className="flex items-center text-green-600 dark:text-green-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Conexão ativa</span>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 md:col-span-2">
            <h2 className="text-xl font-bold text-primary dark:text-secondary mb-4">
              Formato dos Dados da Planilha
            </h2>
            <p className="text-text-light dark:text-text-dark mb-4">
              A planilha de vendas por boleto deve seguir o seguinte formato:
            </p>
            
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
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Método de Pagamento
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Canal
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-light dark:text-text-dark">
                      01/01/2023
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-light dark:text-text-dark">
                      Boleto Parcelado DevClub
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-light dark:text-text-dark">
                      R$ 2.200,00
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-light dark:text-text-dark">
                      boleto
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-light dark:text-text-dark">
                      TMB
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            
            <div className="mt-6">
              <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-2">
                Observações:
              </h3>
              <ul className="list-disc list-inside text-text-light dark:text-text-dark space-y-1">
                <li>A data deve estar no formato DD/MM/AAAA</li>
                <li>O valor deve estar no formato R$ X.XXX,XX</li>
                <li>O método de pagamento deve ser "boleto"</li>
                <li>O canal pode ser qualquer texto, mas recomendamos "TMB"</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DataSourcesPage;