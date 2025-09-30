import React from 'react';

function DataSourcesPage() {
  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-primary-dark dark:text-primary mb-6">
          Fontes de Dados
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
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

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-primary dark:text-secondary mb-4">
              Vendas por Boleto TMB
            </h2>
            <p className="text-text-light dark:text-text-dark mb-4">
              Dados específicos de vendas por boleto do canal TMB via Google Sheets.
            </p>
            <p className="text-text-light dark:text-text-dark mb-4">
              <a 
                href="https://docs.google.com/spreadsheets/d/1jPCyVkRImt8yYPgMlBAeMZPqwdyQvy9P_KpWmo2PHBU/edit" 
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

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-primary dark:text-secondary mb-4">
              Despesas
            </h2>
            <p className="text-text-light dark:text-text-dark mb-4">
              Os dados de despesas são obtidos através do Google Sheets.
            </p>
            <p className="text-text-light dark:text-text-dark mb-4">
              <a 
                href="https://docs.google.com/spreadsheets/d/1cvaU5eUOez8F_1c0Xn3zRJTSFFHblSEJLoK7ZW9dUt8/edit" 
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

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-primary dark:text-secondary mb-4">
              Dados Comerciais
            </h2>
            <p className="text-text-light dark:text-text-dark mb-4">
              Planilha com dados de vendas comerciais e vendedores via Google Sheets.
            </p>
            <p className="text-text-light dark:text-text-dark mb-4">
              <a 
                href="https://docs.google.com/spreadsheets/d/1sLPgeIYpAGWnUXolgWqSskKhbWYmwZZXo-86EDHZ8lI/edit" 
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

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-primary dark:text-secondary mb-4">
              Dados de Launches
            </h2>
            <p className="text-text-light dark:text-text-dark mb-4">
              Planilha com dados de launches e métricas de performance via Google Sheets.
            </p>
            <p className="text-text-light dark:text-text-dark mb-4">
              <a 
                href="https://docs.google.com/spreadsheets/d/11l2oWgWgOzZHKVSCh3HQanVirSvQPLT11UGr1IYZoeY/edit" 
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

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-primary dark:text-secondary mb-4">
              Lead Scoring (Principal)
            </h2>
            <p className="text-text-light dark:text-text-dark mb-4">
              Planilha principal do Lead Scoring com links para outras planilhas de launches via Google Sheets.
            </p>
            <p className="text-text-light dark:text-text-dark mb-4">
              <a 
                href="https://docs.google.com/spreadsheets/d/1kLgVsNcc8OmPMvxaTN7KM0cTB5hC0KtL02lSZMYRHBw/edit" 
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

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 lg:col-span-3">
            <h2 className="text-xl font-bold text-primary dark:text-secondary mb-4">
              Formato dos Dados da Planilha de Boletos
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
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 lg:col-span-3">
            <h2 className="text-xl font-bold text-primary dark:text-secondary mb-4">
              Formato dos Dados da Planilha de Despesas
            </h2>
            <p className="text-text-light dark:text-text-dark mb-4">
              A planilha de despesas deve seguir o seguinte formato:
            </p>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Nome
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Categoria
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Valor
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Data
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Tag
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-light dark:text-text-dark">
                      Aluguel de Escritório
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-light dark:text-text-dark">
                      Infraestrutura
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-light dark:text-text-dark">
                      R$ 3.500,00
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-light dark:text-text-dark">
                      05/01/2023
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-light dark:text-text-dark">
                      Fixo
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
                <li>A planilha pode ter múltiplas abas, todas serão lidas</li>
                <li>A data deve estar no formato DD/MM/AAAA</li>
                <li>O valor deve estar no formato R$ X.XXX,XX</li>
                <li>A categoria e tag são campos de classificação opcionais</li>
                <li>O campo de tag é utilizado para filtros adicionais no relatório de DRE</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DataSourcesPage;