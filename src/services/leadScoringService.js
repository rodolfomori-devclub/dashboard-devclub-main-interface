import axios from 'axios';

const MAIN_SHEET_ID = '1kLgVsNcc8OmPMvxaTN7KM0cTB5hC0KtL02lSZMYRHBw';
const API_KEY = 'AIzaSyDefktRla6Q-o9k-yfKaLxW1nFMgAJfDt8';
const MAIN_RANGE = 'A:Z';
const LF_PESQUISA_RANGE = "'[LF] Pesquisa'!A:AI";

const cache = new Map();
const CACHE_DURATION = 5 * 60 * 1000;

function extractSheetId(url) {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

export const leadScoringService = {
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
      
      console.log(`📊 Headers carregados para ${launchName}:`, headers);
      console.log(`📊 Total de colunas: ${headers.length}`);
      console.log(`📊 Últimas 10 colunas:`, headers.slice(-10));
      
      const data = rows.map(row => {
        const obj = {
          launch: launchName
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

  async fetchAllLaunchesData(onProgress, limit = null) {
    try {
      const mainData = await this.fetchMainSheetData();
      
      let launchesToProcess = [...mainData.data];
      if (limit) {
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
      }
      
      const allLaunchesData = [];
      const errors = [];
      
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
              ...launch,
              sheetData: launchData
            });
          } else {
            errors.push({
              launchName,
              error: 'Não foi possível carregar os dados'
            });
          }
        } else {
          allLaunchesData.push({
            ...launch,
            sheetData: null
          });
          errors.push({
            launchName,
            error: 'Link da planilha inválido ou não fornecido'
          });
        }
        
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

  processDataForCharts(allLaunchesData) {
    const aggregatedData = {
      totalLeads: 0,
      leadsByLaunch: [],
      leadsByDate: {},
      leadsBySource: {},
      conversionByLaunch: [],
      genderByLaunch: [],
      ageByLaunch: [],
      currentJobByLaunch: [],
      salaryRangeByLaunch: [],
      creditCardByLaunch: [],
      programmingStudyByLaunch: [],
      collegeByLaunch: [],
      onlineCourseByLaunch: [],
      programmingInterestByLaunch: [],
      eventInterestByLaunch: [],
      computerByLaunch: [],
      faixaByLaunch: [],
      trafficByLaunch: []
    };

    allLaunchesData.launches.forEach((launch) => {
      if (launch.sheetData && launch.sheetData.data) {
        const launchLeadsCount = launch.sheetData.totalRows;
        aggregatedData.totalLeads += launchLeadsCount;
        
        aggregatedData.leadsByLaunch.push({
          name: launch['Lançamento'],
          leads: launchLeadsCount,
          startDate: launch['Início Captação'],
          endDate: launch['Fim Captação']
        });

        let masculino = 0;
        let feminino = 0;
        let outros = 0;

        launch.sheetData.data.forEach(lead => {
          const genderFields = ['O seu gênero:', 'O seu gênero', 'Sexo', 'sexo', 'Gênero', 'gênero', 'Gender', 'gender', 'Genero', 'genero'];
          const genderField = genderFields.find(field => launch.sheetData.headers.includes(field));
          
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

          const dateFields = ['Data', 'data', 'Date', 'Timestamp', 'timestamp'];
          const dateField = dateFields.find(field => lead[field]);
          if (dateField && lead[dateField]) {
            const date = new Date(lead[dateField]).toLocaleDateString('pt-BR');
            aggregatedData.leadsByDate[date] = (aggregatedData.leadsByDate[date] || 0) + 1;
          }

          const sourceFields = ['Fonte', 'fonte', 'Source', 'source', 'Canal', 'canal'];
          const sourceField = sourceFields.find(field => lead[field]);
          if (sourceField && lead[sourceField]) {
            const source = lead[sourceField];
            aggregatedData.leadsBySource[source] = (aggregatedData.leadsBySource[source] || 0) + 1;
          }
        });

        const total = masculino + feminino + outros;
        
        if (total > 0) {
          aggregatedData.genderByLaunch.push({
            name: launch['Lançamento'],
            masculino: Number(((masculino / total) * 100).toFixed(1)),
            feminino: Number(((feminino / total) * 100).toFixed(1)),
            outros: Number(((outros / total) * 100).toFixed(1)),
            totalLeads: total
          });
        }

        let ageGroups = {
          '18-24': 0,
          '25-34': 0,
          '35-44': 0,
          '45-54': 0,
          '55+': 0
        };

        launch.sheetData.data.forEach(lead => {
          const ageFields = ['Qual a sua idade?', 'Qual a sua idade', 'Idade', 'idade', 'Age', 'age'];
          const ageField = ageFields.find(field => launch.sheetData.headers.includes(field));
          
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

        const totalAge = Object.values(ageGroups).reduce((sum, count) => sum + count, 0);
        
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
        }

        const currentJobData = this.processCategoricalData(launch, 'O que você faz atualmente?', 'O que você faz atualmente', 'Profissão', 'profissão', 'Trabalho', 'trabalho');
        if (currentJobData.total > 0) {
          aggregatedData.currentJobByLaunch.push({
            name: launch['Lançamento'],
            ...currentJobData.percentages,
            totalLeads: currentJobData.total
          });
        }

        const salaryData = this.processCategoricalData(launch, 'Atualmente, qual a sua faixa salarial?', 'Atualmente, qual a sua faixa salarial', 'Faixa salarial', 'faixa salarial', 'Salário', 'salário');
        if (salaryData.total > 0) {
          aggregatedData.salaryRangeByLaunch.push({
            name: launch['Lançamento'],
            ...salaryData.percentages,
            totalLeads: salaryData.total
          });
        }

        const creditCardData = this.processCategoricalData(launch, 'Você possui cartão de crédito?', 'Você possui cartão de crédito', 'Cartão de crédito', 'cartão de crédito', 'Cartão', 'cartão');
        if (creditCardData.total > 0) {
          aggregatedData.creditCardByLaunch.push({
            name: launch['Lançamento'],
            ...creditCardData.percentages,
            totalLeads: creditCardData.total
          });
        }

        const programmingStudyData = this.processCategoricalData(launch, 'Já estudou programação?', 'Já estudou programação', 'Estudou programação', 'estudou programação', 'Programação', 'programação');
        if (programmingStudyData.total > 0) {
          aggregatedData.programmingStudyByLaunch.push({
            name: launch['Lançamento'],
            ...programmingStudyData.percentages,
            totalLeads: programmingStudyData.total
          });
        }

        const collegeData = this.processCategoricalData(launch, 'Você já fez/faz/pretende fazer faculdade?', 'Você já fez/faz/pretende fazer faculdade', 'Faculdade', 'faculdade', 'Ensino superior', 'ensino superior');
        if (collegeData.total > 0) {
          aggregatedData.collegeByLaunch.push({
            name: launch['Lançamento'],
            ...collegeData.percentages,
            totalLeads: collegeData.total
          });
        }

        const onlineCourseData = this.processCategoricalData(launch, 'Já investiu em algum curso online para aprender uma nova forma de ganhar dinheiro?', 'Já investiu em algum curso online para aprender uma nova forma de ganhar dinheiro', 'Curso online', 'curso online', 'Investimento curso', 'investimento curso');
        if (onlineCourseData.total > 0) {
          aggregatedData.onlineCourseByLaunch.push({
            name: launch['Lançamento'],
            ...onlineCourseData.percentages,
            totalLeads: onlineCourseData.total
          });
        }

        const programmingInterestData = this.processCategoricalData(launch, 'O que mais te chama atenção na profissão de Programador?', 'O que mais te chama atenção na profissão de Programador', 'Interesse programação', 'interesse programação', 'Programador', 'programador');
        if (programmingInterestData.total > 0) {
          aggregatedData.programmingInterestByLaunch.push({
            name: launch['Lançamento'],
            ...programmingInterestData.percentages,
            totalLeads: programmingInterestData.total
          });
        }

        const eventInterestData = this.processCategoricalData(launch, 'O que mais você quer ver no evento?', 'O que mais você quer ver no evento', 'Interesse evento', 'interesse evento', 'Evento', 'evento');
        if (eventInterestData.total > 0) {
          aggregatedData.eventInterestByLaunch.push({
            name: launch['Lançamento'],
            ...eventInterestData.percentages,
            totalLeads: eventInterestData.total
          });
        }

        const computerData = this.processCategoricalData(launch, 'Tem computador/notebook?', 'Tem computador/notebook', 'Computador', 'computador', 'Notebook', 'notebook');
        if (computerData.total > 0) {
          aggregatedData.computerByLaunch.push({
            name: launch['Lançamento'],
            ...computerData.percentages,
            totalLeads: computerData.total
          });
        }

        const faixaData = this.processCategoricalData(launch, 'Faixa', 'FAIXA', 'faixa', 'Faixa A', 'Faixa B', 'Faixa C', 'Faixa D', 'Faixa E', 'Score', 'score', 'Pontuação', 'pontuação');
        if (faixaData.total > 0) {
          console.log(`📊 Processando faixa para ${launch['Lançamento']}:`, faixaData);
          
          // Ordenar as faixas para melhor visualização
          const sortedPercentages = {};
          const faixaOrder = ['A', 'B', 'C', 'D', 'E'];
          
          faixaOrder.forEach(faixa => {
            const faixaKey = Object.keys(faixaData.percentages).find(key => 
              key.includes(faixa) || key.toUpperCase().includes(faixa)
            );
            if (faixaKey) {
              sortedPercentages[faixaKey] = faixaData.percentages[faixaKey];
            }
          });
          
          // Adicionar outras faixas que não estão na ordem padrão
          Object.keys(faixaData.percentages).forEach(key => {
            if (!Object.keys(sortedPercentages).includes(key)) {
              sortedPercentages[key] = faixaData.percentages[key];
            }
          });
          
          console.log(`📊 Faixas ordenadas para ${launch['Lançamento']}:`, sortedPercentages);
          
          aggregatedData.faixaByLaunch.push({
            name: launch['Lançamento'],
            ...sortedPercentages,
            totalLeads: faixaData.total
          });
        } else {
          console.log(`⚠️ Nenhum dado de faixa encontrado para ${launch['Lançamento']}`);
          console.log(`🔍 Headers disponíveis:`, launch.sheetData?.headers);
          
          // Verificar se há alguma coluna que possa ser faixa
          if (launch.sheetData?.headers) {
            const possibleFaixaHeaders = launch.sheetData.headers.filter(header => 
              header.toLowerCase().includes('faixa') || 
              header.toLowerCase().includes('score') ||
              header.toLowerCase().includes('pontuação') ||
              header.toLowerCase().includes('classificação')
            );
            console.log(`🔍 Possíveis colunas de faixa encontradas:`, possibleFaixaHeaders);
          }
        }

        // Processar dados de tráfego da planilha principal
        const trafficData = this.processMainSheetTrafficData(launch);
        if (trafficData.total > 0) {
          console.log(`🚦 Processando tráfego da planilha principal para ${launch['Lançamento']}:`, trafficData);
          
          aggregatedData.trafficByLaunch.push({
            name: launch['Lançamento'],
            traffic: trafficData.total,
            trafficFormatted: this.formatCurrency(trafficData.total)
          });
        } else {
          console.log(`⚠️ Nenhum dado de tráfego encontrado na planilha principal para ${launch['Lançamento']}`);
        }
      }
    });

    aggregatedData.leadsByLaunch.sort((a, b) => b.leads - a.leads);

    const getLaunchNumber = (launchName) => {
      const match = launchName.match(/(\d+)/);
      return match ? parseInt(match[1]) : 0;
    };

    if (aggregatedData.genderByLaunch.length > 0) {
      aggregatedData.genderByLaunch.sort((a, b) => getLaunchNumber(a.name) - getLaunchNumber(b.name));
    }

    if (aggregatedData.ageByLaunch.length > 0) {
      aggregatedData.ageByLaunch.sort((a, b) => getLaunchNumber(a.name) - getLaunchNumber(b.name));
    }

    if (aggregatedData.currentJobByLaunch.length > 0) {
      aggregatedData.currentJobByLaunch.sort((a, b) => getLaunchNumber(a.name) - getLaunchNumber(b.name));
    }

    if (aggregatedData.salaryRangeByLaunch.length > 0) {
      aggregatedData.salaryRangeByLaunch.sort((a, b) => getLaunchNumber(a.name) - getLaunchNumber(b.name));
    }

    if (aggregatedData.creditCardByLaunch.length > 0) {
      aggregatedData.creditCardByLaunch.sort((a, b) => getLaunchNumber(a.name) - getLaunchNumber(b.name));
    }

    if (aggregatedData.programmingStudyByLaunch.length > 0) {
      aggregatedData.programmingStudyByLaunch.sort((a, b) => getLaunchNumber(a.name) - getLaunchNumber(b.name));
    }

    if (aggregatedData.collegeByLaunch.length > 0) {
      aggregatedData.collegeByLaunch.sort((a, b) => getLaunchNumber(a.name) - getLaunchNumber(b.name));
    }

    if (aggregatedData.onlineCourseByLaunch.length > 0) {
      aggregatedData.onlineCourseByLaunch.sort((a, b) => getLaunchNumber(a.name) - getLaunchNumber(b.name));
    }

    if (aggregatedData.programmingInterestByLaunch.length > 0) {
      aggregatedData.programmingInterestByLaunch.sort((a, b) => getLaunchNumber(a.name) - getLaunchNumber(b.name));
    }

    if (aggregatedData.eventInterestByLaunch.length > 0) {
      aggregatedData.eventInterestByLaunch.sort((a, b) => getLaunchNumber(a.name) - getLaunchNumber(b.name));
    }

    if (aggregatedData.computerByLaunch.length > 0) {
      aggregatedData.computerByLaunch.sort((a, b) => getLaunchNumber(a.name) - getLaunchNumber(b.name));
    }

    if (aggregatedData.faixaByLaunch.length > 0) {
      aggregatedData.faixaByLaunch.sort((a, b) => getLaunchNumber(a.name) - getLaunchNumber(b.name));
    }

    if (aggregatedData.trafficByLaunch.length > 0) {
      aggregatedData.trafficByLaunch.sort((a, b) => getLaunchNumber(a.name) - getLaunchNumber(b.name));
    }

    console.log(`   📊 Dados de faixa processados: ${aggregatedData.faixaByLaunch.length}`);
    console.log(`   🚦 Dados de tráfego processados: ${aggregatedData.trafficByLaunch.length}`);

    return aggregatedData;
  },

  processCategoricalData(launch, ...fieldNames) {
    const categories = {};
    let total = 0;

    const field = fieldNames.find(fieldName => launch.sheetData.headers.includes(fieldName));
    
    if (!field) {
      console.log(`🔍 Campo não encontrado para:`, fieldNames);
      console.log(`🔍 Headers disponíveis:`, launch.sheetData.headers);
      return { total: 0, percentages: {} };
    }

    console.log(`✅ Campo encontrado: "${field}" para ${launch['Lançamento']}`);

    launch.sheetData.data.forEach(lead => {
      if (lead[field]) {
        const value = lead[field].trim();
        if (value) {
          categories[value] = (categories[value] || 0) + 1;
          total++;
        }
      }
    });

    const percentages = {};
    Object.keys(categories).forEach(category => {
      percentages[category] = Number(((categories[category] / total) * 100).toFixed(1));
    });

    console.log(`📊 Categorias encontradas para "${field}":`, categories);
    console.log(`📊 Percentuais calculados:`, percentages);

    return { total, percentages };
  },

  processTrafficData(launch) {
    const categories = {};
    let total = 0;

    const trafficFields = ['Fonte', 'fonte', 'Source', 'source', 'Canal', 'canal'];
    const trafficField = trafficFields.find(field => launch.sheetData.headers.includes(field));
    
    if (!trafficField) {
      console.log(`🔍 Campo de tráfego não encontrado para ${launch['Lançamento']}`);
      console.log(`🔍 Headers disponíveis:`, launch.sheetData.headers);
      return { total: 0, categories: {} };
    }

    console.log(`✅ Campo de tráfego encontrado: "${trafficField}" para ${launch['Lançamento']}`);

    launch.sheetData.data.forEach(lead => {
      if (lead[trafficField]) {
        const value = lead[trafficField].trim();
        if (value) {
          categories[value] = (categories[value] || 0) + 1;
          total++;
        }
      }
    });

    const percentages = {};
    Object.keys(categories).forEach(category => {
      percentages[category] = Number(((categories[category] / total) * 100).toFixed(1));
    });

    console.log(`📊 Categorias de tráfego encontradas para "${trafficField}":`, categories);
    console.log(`📊 Percentuais calculados:`, percentages);

    return { total, categories: percentages };
  },

  processMainSheetTrafficData(launch) {
    // Buscar dados de tráfego diretamente da planilha principal
    const trafficValue = launch['Tráfego'] || launch['Trafico'] || launch['tráfego'] || launch['trafico'];
    
    if (!trafficValue) {
      console.log(`🔍 Campo de tráfego não encontrado na planilha principal para ${launch['Lançamento']}`);
      console.log(`🔍 Colunas disponíveis:`, Object.keys(launch));
      return { total: 0 };
    }

    console.log(`✅ Campo de tráfego encontrado na planilha principal para ${launch['Lançamento']}: "${trafficValue}"`);

    // Converter valor monetário para número
    let numericValue = 0;
    
    if (typeof trafficValue === 'string') {
      // Remover R$, pontos, vírgulas e espaços
      const cleanValue = trafficValue.replace(/[R$\s.]/g, '').replace(',', '.');
      numericValue = parseFloat(cleanValue);
    } else if (typeof trafficValue === 'number') {
      numericValue = trafficValue;
    }

    if (isNaN(numericValue) || numericValue <= 0) {
      console.log(`⚠️ Valor de tráfego inválido para ${launch['Lançamento']}: "${trafficValue}"`);
      return { total: 0 };
    }

    console.log(`💰 Valor de tráfego processado para ${launch['Lançamento']}: R$ ${numericValue.toFixed(2)}`);

    return { total: numericValue };
  },

  formatCurrency(value) {
    if (typeof value !== 'number') {
      return value;
    }
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  },

  hasValidGenderData(launch) {
    if (!launch.sheetData || !launch.sheetData.data || launch.sheetData.data.length === 0) {
      return false;
    }

    const genderFields = ['O seu gênero:', 'O seu gênero', 'Sexo', 'sexo', 'Gênero', 'gênero', 'Gender', 'gender', 'Genero', 'genero'];
    const genderField = genderFields.find(field => launch.sheetData.headers.includes(field));
    
    if (!genderField) {
      return false;
    }

    let hasValidData = false;
    for (const row of launch.sheetData.data) {
      if (row[genderField]) {
        hasValidData = true;
        break;
      }
    }

    return hasValidData;
  },

  hasValidAgeData(launch) {
    if (!launch.sheetData || !launch.sheetData.data || launch.sheetData.data.length === 0) {
      return false;
    }

    const ageFields = ['Qual a sua idade?', 'Qual a sua idade', 'Idade', 'idade', 'Age', 'age'];
    const ageField = ageFields.find(field => launch.sheetData.headers.includes(field));
    
    if (!ageField) {
      return false;
    }

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
    console.log('🧹 Cache limpo - forçando recarregamento dos dados');
    cache.clear();
  }
};

export default leadScoringService;