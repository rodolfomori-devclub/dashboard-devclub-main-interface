import axios from 'axios';

const MAIN_SHEET_ID = '1kLgVsNcc8OmPMvxaTN7KM0cTB5hC0KtL02lSZMYRHBw';
const API_KEY = 'AIzaSyDefktRla6Q-o9k-yfKaLxW1nFMgAJfDt8';
const MAIN_RANGE = 'A:Z'; // Pega todas as colunas da planilha principal
const LF_PESQUISA_RANGE = "'[LF] Pesquisa'!A:Z"; // Range da aba [LF] Pesquisa com aspas simples

const cache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

// Função para extrair o ID da planilha a partir do URL
function extractSheetId(url) {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

export const leadScoringService = {
  // Busca os dados da planilha principal
  async fetchMainSheetData() {
    const cacheKey = 'mainSheet';
    const cached = cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.data;
    }

    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${MAIN_SHEET_ID}/values/${MAIN_RANGE}?key=${API_KEY}`;
      const response = await axios.get(url);
      
      if (!response.data.values || response.data.values.length === 0) {
        throw new Error('Nenhum dado encontrado na planilha principal');
      }

      const headers = response.data.values[0];
      const rows = response.data.values.slice(1);
      
      const data = rows.map(row => {
        const obj = {};
        headers.forEach((header, index) => {
          obj[header] = row[index] || '';
        });
        return obj;
      });

      const result = {
        headers,
        data,
        totalLaunches: data.length,
        lastUpdate: new Date().toISOString()
      };

      cache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });

      return result;
    } catch (error) {
      console.error('Erro ao buscar dados da planilha principal:', error);
      throw error;
    }
  },

  // Busca dados de uma planilha específica
  async fetchSheetData(sheetUrl, launchName) {
    const sheetId = extractSheetId(sheetUrl);
    if (!sheetId) {
      console.warn(`ID da planilha não encontrado para ${launchName}:`, sheetUrl);
      return null;
    }

    const cacheKey = `sheet_${sheetId}`;
    const cached = cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.data;
    }

    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${LF_PESQUISA_RANGE}?key=${API_KEY}`;
      const response = await axios.get(url);
      
      if (!response.data.values || response.data.values.length === 0) {
        console.warn(`Nenhum dado encontrado na aba [LF] Pesquisa para ${launchName}`);
        return null;
      }

      const headers = response.data.values[0];
      const rows = response.data.values.slice(1);
      
      const data = rows.map(row => {
        const obj = {
          launch: launchName // Adiciona o nome do lançamento
        };
        headers.forEach((header, index) => {
          obj[header] = row[index] || '';
        });
        return obj;
      });

      const result = {
        launchName,
        sheetId,
        headers,
        data,
        totalRows: data.length
      };

      cache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });

      return result;
    } catch (error) {
      console.error(`Erro ao buscar dados da planilha ${launchName}:`, error);
      return null;
    }
  },

  // Busca dados de todas as planilhas listadas
  async fetchAllLaunchesData(onProgress, limit = null) {
    try {
      // Primeiro busca a planilha principal
      const mainData = await this.fetchMainSheetData();
      
      // Se limit for especificado, ordenar e limitar os lançamentos
      let launchesToProcess = [...mainData.data];
      if (limit) {
        console.log(`🎯 Limitando a ${limit} lançamentos mais recentes`);
        
        // Ordenar por número do LF (maior = mais recente)
        launchesToProcess.sort((a, b) => {
          const getNum = (name) => {
            const match = name.match(/(\d+)/);
            return match ? parseInt(match[1]) : 0;
          };
          const numA = getNum(a['Lançamento']);
          const numB = getNum(b['Lançamento']);
          return numB - numA;
        });
        
        launchesToProcess = launchesToProcess.slice(0, limit);
        console.log(`📊 Lançamentos selecionados:`, launchesToProcess.map(l => l['Lançamento']));
      }
      
      const allLaunchesData = [];
      const errors = [];
      
      // Para cada lançamento, busca os dados da planilha correspondente
      for (let i = 0; i < launchesToProcess.length; i++) {
        const launch = launchesToProcess[i];
        const sheetUrl = launch['Link Planilha'];
        const launchName = launch['Lançamento'];
        
        if (onProgress) {
          onProgress({
            current: i + 1,
            total: launchesToProcess.length,
            launchName
          });
        }
        
        if (sheetUrl && sheetUrl.includes('docs.google.com/spreadsheets')) {
          const launchData = await this.fetchSheetData(sheetUrl, launchName);
          if (launchData) {
            allLaunchesData.push({
              ...launch, // Dados da planilha principal
              sheetData: launchData // Dados da aba [LF] Pesquisa
            });
          } else {
            errors.push({
              launchName,
              error: 'Não foi possível carregar os dados'
            });
          }
        } else {
          // URL inválido ou não fornecido
          allLaunchesData.push({
            ...launch,
            sheetData: null
          });
          errors.push({
            launchName,
            error: 'Link da planilha inválido ou não fornecido'
          });
        }
        
        // Pequeno delay para evitar rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      return {
        launches: allLaunchesData,
        errors,
        totalLaunches: allLaunchesData.length,
        lastUpdate: new Date().toISOString()
      };
    } catch (error) {
      console.error('Erro ao buscar dados de todos os lançamentos:', error);
      throw error;
    }
  },

  // Função para processar e agregar dados para gráficos
  processDataForCharts(allLaunchesData) {
    console.log('🚀 processDataForCharts iniciado');
    console.log('📊 Total de lançamentos recebidos:', allLaunchesData.launches.length);
    console.log('📊 Lançamentos:', allLaunchesData.launches.map(l => l['Lançamento']));
    console.log('📊 RESUMO: Processando dados de gênero para', allLaunchesData.launches.length, 'lançamentos...');
    
    const aggregatedData = {
      totalLeads: 0,
      leadsByLaunch: [],
      leadsByDate: {},
      leadsBySource: {},
      conversionByLaunch: [],
      genderByLaunch: [], // Dados de gênero por lançamento
      ageByLaunch: [] // Novo: dados de idade por lançamento
    };

        allLaunchesData.launches.forEach((launch, index) => {
      console.log(`📋 Processando lançamento ${index + 1}/${allLaunchesData.launches.length}: ${launch['Lançamento']}`);
      console.log(`  📋 sheetData existe:`, !!launch.sheetData);
      console.log(`  📋 sheetData.data existe:`, !!launch.sheetData?.data);
      console.log(`  📋 sheetData.data length:`, launch.sheetData?.data?.length);
      
      if (launch.sheetData && launch.sheetData.data) {
          const launchLeadsCount = launch.sheetData.totalRows;
          console.log(`  ✅ ${launch['Lançamento']}: ${launchLeadsCount} leads, dados disponíveis`);
          aggregatedData.totalLeads += launchLeadsCount;
        
        // Leads por lançamento
        aggregatedData.leadsByLaunch.push({
          name: launch['Lançamento'],
          leads: launchLeadsCount,
          startDate: launch['Início Captação'],
          endDate: launch['Fim Captação']
        });

        // Processar dados de gênero
        let masculino = 0;
        let feminino = 0;
        let outros = 0;

        // Debug: verificar headers disponíveis
        console.log(`🔍 Processando gênero para ${launch['Lançamento']}:`);
        console.log(`   Headers disponíveis:`, launch.sheetData.headers);

        // Processar dados detalhados se disponíveis
        launch.sheetData.data.forEach(lead => {
          // Buscar campo de sexo/gênero - verificar se existe nos headers primeiro
          const genderFields = ['O seu gênero:', 'O seu gênero', 'Sexo', 'sexo', 'Gênero', 'gênero', 'Gender', 'gender', 'Genero', 'genero'];
          const genderField = genderFields.find(field => launch.sheetData.headers.includes(field));
          
          // Debug: verificar se encontrou o campo
          if (genderField) {
            console.log(`   ✅ Campo de gênero encontrado: "${genderField}"`);
            // Mostrar alguns valores de exemplo (apenas na primeira iteração)
            if (launch.sheetData.data.indexOf(lead) < 5) {
              console.log(`   📝 Valor de exemplo: "${lead[genderField]}"`);
            }
          }
          
          if (genderField && lead[genderField]) {
            const gender = lead[genderField].toLowerCase().trim();
            if (gender === 'masculino' || gender === 'homem' || gender === 'm' || gender === 'male' || gender.includes('masculino') || gender.includes('homem')) {
              masculino++;
            } else if (gender === 'feminino' || gender === 'mulher' || gender === 'f' || gender === 'female' || gender.includes('feminino') || gender.includes('mulher')) {
              feminino++;
            } else {
              outros++;
            }
          }

          // Agregar por data se houver campo de data
          const dateFields = ['Data', 'data', 'Date', 'Timestamp', 'timestamp'];
          const dateField = dateFields.find(field => lead[field]);
          if (dateField && lead[dateField]) {
            const date = new Date(lead[dateField]).toLocaleDateString('pt-BR');
            aggregatedData.leadsByDate[date] = (aggregatedData.leadsByDate[date] || 0) + 1;
          }

          // Agregar por fonte se houver
          const sourceFields = ['Fonte', 'fonte', 'Source', 'source', 'Canal', 'canal'];
          const sourceField = sourceFields.find(field => lead[field]);
          if (sourceField && lead[sourceField]) {
            const source = lead[sourceField];
            aggregatedData.leadsBySource[source] = (aggregatedData.leadsBySource[source] || 0) + 1;
          }
        });

        // Calcular percentuais
        const total = masculino + feminino + outros;
        console.log(`   📊 Resultado gênero: Masculino=${masculino}, Feminino=${feminino}, Outros=${outros}, Total=${total}`);
        
        if (total > 0) {
          aggregatedData.genderByLaunch.push({
            name: launch['Lançamento'],
            masculino: Number(((masculino / total) * 100).toFixed(1)),
            feminino: Number(((feminino / total) * 100).toFixed(1)),
            outros: Number(((outros / total) * 100).toFixed(1)),
            totalLeads: total
          });
          console.log(`   ✅ Dados de gênero adicionados para ${launch['Lançamento']}`);
                } else {
          console.log(`   ❌ Nenhum dado de gênero válido para ${launch['Lançamento']}`);
        }

        // Processar dados de idade
        let ageGroups = {
          '18-24': 0,
          '25-34': 0,
          '35-44': 0,
          '45-54': 0,
          '55+': 0
        };

        // Debug: verificar headers disponíveis para idade
        console.log(`🔍 Processando idade para ${launch['Lançamento']}:`);
        console.log(`   Headers disponíveis:`, launch.sheetData.headers);

        // Processar dados detalhados se disponíveis
        launch.sheetData.data.forEach(lead => {
          // Buscar campo de idade - verificar se existe nos headers primeiro
          const ageFields = ['Qual a sua idade?', 'Qual a sua idade', 'Idade', 'idade', 'Age', 'age'];
          const ageField = ageFields.find(field => launch.sheetData.headers.includes(field));
          
          // Debug: verificar se encontrou o campo
          if (ageField) {
            console.log(`   ✅ Campo de idade encontrado: "${ageField}"`);
            // Mostrar alguns valores de exemplo (apenas na primeira iteração)
            if (launch.sheetData.data.indexOf(lead) < 5) {
              console.log(`   📝 Valor de exemplo: "${lead[ageField]}"`);
            }
          }
          
          if (ageField && lead[ageField]) {
            const age = parseInt(lead[ageField]);
            if (!isNaN(age)) {
              if (age >= 18 && age <= 24) {
                ageGroups['18-24']++;
              } else if (age >= 25 && age <= 34) {
                ageGroups['25-34']++;
              } else if (age >= 35 && age <= 44) {
                ageGroups['35-44']++;
              } else if (age >= 45 && age <= 54) {
                ageGroups['45-54']++;
              } else if (age >= 55) {
                ageGroups['55+']++;
              }
            }
          }
        });

        // Calcular percentuais de idade
        const totalAge = Object.values(ageGroups).reduce((sum, count) => sum + count, 0);
        console.log(`   📊 Resultado idade: 18-24=${ageGroups['18-24']}, 25-34=${ageGroups['25-34']}, 35-44=${ageGroups['35-44']}, 45-54=${ageGroups['45-54']}, 55+=${ageGroups['55+']}, Total=${totalAge}`);
        
        if (totalAge > 0) {
          aggregatedData.ageByLaunch.push({
            name: launch['Lançamento'],
            '18-24': Number(((ageGroups['18-24'] / totalAge) * 100).toFixed(1)),
            '25-34': Number(((ageGroups['25-34'] / totalAge) * 100).toFixed(1)),
            '35-44': Number(((ageGroups['35-44'] / totalAge) * 100).toFixed(1)),
            '45-54': Number(((ageGroups['45-54'] / totalAge) * 100).toFixed(1)),
            '55+': Number(((ageGroups['55+'] / totalAge) * 100).toFixed(1)),
            totalLeads: totalAge
          });
          console.log(`   ✅ Dados de idade adicionados para ${launch['Lançamento']}`);
        } else {
          console.log(`   ❌ Nenhum dado de idade válido para ${launch['Lançamento']}`);
        }
      } else {
        console.log(`  ❌ ${launch['Lançamento']}: sem dados de planilha`);
      }
    });

    // Ordenar por quantidade de leads
    aggregatedData.leadsByLaunch.sort((a, b) => b.leads - a.leads);

    console.log(`🎯 RESUMO FINAL:`);
    console.log(`   📥 Lançamentos carregados: ${allLaunchesData.launches.length}`);
    console.log(`   ✅ Lançamentos com dados válidos: ${aggregatedData.leadsByLaunch.length}`);
    console.log(`   📊 Dados de gênero processados: ${aggregatedData.genderByLaunch.length}`);
    console.log(`   📊 Dados de idade processados: ${aggregatedData.ageByLaunch.length}`);
    console.log(`   📈 Dados de gênero:`, aggregatedData.genderByLaunch);
    console.log(`   📈 Dados de idade:`, aggregatedData.ageByLaunch);

    return aggregatedData;
  },

  // Função para verificar se um lançamento tem dados válidos de gênero
  hasValidGenderData(launch) {
    if (!launch.sheetData || !launch.sheetData.data || launch.sheetData.data.length === 0) {
      return false;
    }

    // Verificar se tem campo de gênero
    const genderFields = ['O seu gênero:', 'O seu gênero', 'Sexo', 'sexo', 'Gênero', 'gênero', 'Gender', 'gender', 'Genero', 'genero'];
    const genderField = genderFields.find(field => launch.sheetData.headers.includes(field));
    
    if (!genderField) {
      return false;
    }

    // Verificar se tem pelo menos um lead com dados de gênero válidos
    let hasValidData = false;
    for (const row of launch.sheetData.data) {
      if (row[genderField]) {
        hasValidData = true;
        break;
      }
    }

    return hasValidData;
  },

  // Função para verificar se um lançamento tem dados válidos de idade
  hasValidAgeData(launch) {
    if (!launch.sheetData || !launch.sheetData.data || launch.sheetData.data.length === 0) {
      return false;
    }

    // Verificar se tem campo de idade
    const ageFields = ['Qual a sua idade?', 'Qual a sua idade', 'Idade', 'idade', 'Age', 'age'];
    const ageField = ageFields.find(field => launch.sheetData.headers.includes(field));
    
    if (!ageField) {
      return false;
    }

    // Verificar se tem pelo menos um lead com dados de idade válidos
    let hasValidData = false;
    for (const row of launch.sheetData.data) {
      if (row[ageField]) {
        hasValidData = true;
        break;
      }
    }

    return hasValidData;
  },

  clearCache() {
    cache.clear();
  }
};

export default leadScoringService;