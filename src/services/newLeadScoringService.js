import axios from 'axios';

const MAIN_SHEET_ID = '1kLgVsNcc8OmPMvxaTN7KM0cTB5hC0KtL02lSZMYRHBw';
const API_KEY = 'AIzaSyDefktRla6Q-o9k-yfKaLxW1nFMgAJfDt8';

// Função para esperar um tempo específico
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Função para fazer requisição com retry simples
const makeRequest = async (url, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      await sleep(500); // Delay antes de cada requisição
      const response = await axios.get(url);
      return response.data;
    } catch (error) {
      if (error.response?.status === 429 && i < retries - 1) {
        await sleep(2000 * Math.pow(2, i)); // Backoff exponencial
        continue;
      }
      throw error;
    }
  }
};

export const newLeadScoringService = {
  async fetchAllData() {
    try {
      console.log('🚀 Iniciando carregamento simplificado...');
      
      // 1. Buscar planilha principal (primeiro tentar com hyperlinks)
      let mainData;
      try {
        const hyperlinkUrl = `https://sheets.googleapis.com/v4/spreadsheets/${MAIN_SHEET_ID}?includeGridData=true&ranges=A:B&key=${API_KEY}`;
        const hyperlinkData = await makeRequest(hyperlinkUrl);
        
        // Extrair dados com hyperlinks
        const gridData = hyperlinkData.sheets[0]?.data[0];
        if (gridData?.rowData) {
          const values = [];
          gridData.rowData.forEach(rowData => {
            const row = [];
            rowData.values?.forEach(cellData => {
              if (cellData.hyperlink) {
                row.push(cellData.hyperlink);
              } else if (cellData.formattedValue) {
                row.push(cellData.formattedValue);
              } else {
                row.push('');
              }
            });
            values.push(row);
          });
          mainData = { values };
          console.log('📋 Dados extraídos com hyperlinks');
        } else {
          throw new Error('Sem dados grid');
        }
      } catch (error) {
        console.log('📋 Tentando buscar dados simples...');
        const mainUrl = `https://sheets.googleapis.com/v4/spreadsheets/${MAIN_SHEET_ID}/values/A:B?key=${API_KEY}`;
        mainData = await makeRequest(mainUrl);
      }
      
      if (!mainData.values || mainData.values.length === 0) {
        throw new Error('Planilha principal vazia');
      }
      
      // 2. Processar dados da planilha principal
      console.log('📋 Dados brutos da planilha principal:', mainData.values);
      const [headers, ...rows] = mainData.values;
      console.log('📋 Headers:', headers);
      console.log('📋 Primeiras 3 linhas:', rows.slice(0, 3));
      
      const sheets = [];
      
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const name = row[0];
        const link = row[1];
        
        console.log(`📋 Linha ${i + 1}: nome="${name}", link="${link}"`);
        
        if (!name || !link || link === 'LINK') {
          console.log(`❌ Linha ${i + 1} ignorada: nome ou link inválido`);
          continue;
        }
        
        // Extrair ID da planilha do link
        const match = link.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
        if (!match) {
          console.log(`❌ Linha ${i + 1} ignorada: link não é URL válida do Google Sheets`);
          continue;
        }
        
        const sheetId = match[1];
        console.log(`✅ Linha ${i + 1} adicionada: ${name} (ID: ${sheetId})`);
        
        sheets.push({
          name,
          link,
          sheetId,
          data: null,
          headers: null,
          error: null
        });
      }
      
      console.log(`📋 Encontradas ${sheets.length} planilhas válidas`);
      
      // 3. Buscar dados das planilhas (com limite de 5 por vez)
      const batchSize = 5;
      for (let i = 0; i < sheets.length; i += batchSize) {
        const batch = sheets.slice(i, i + batchSize);
        console.log(`📊 Processando lote ${Math.floor(i / batchSize) + 1}/${Math.ceil(sheets.length / batchSize)}`);
        
        const promises = batch.map(async (sheet) => {
          try {
            // Buscar informações da planilha
            const infoUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheet.sheetId}?key=${API_KEY}`;
            const infoData = await makeRequest(infoUrl);
            
            if (!infoData.sheets || infoData.sheets.length === 0) {
              throw new Error('Nenhuma aba encontrada');
            }
            
            const firstTabName = infoData.sheets[0].properties.title;
            
            // Buscar dados da primeira aba
            const dataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheet.sheetId}/values/'${firstTabName}'!A:Z?key=${API_KEY}`;
            const sheetData = await makeRequest(dataUrl);
            
            if (!sheetData.values || sheetData.values.length === 0) {
              throw new Error('Aba vazia');
            }
            
            const [sheetHeaders, ...sheetRows] = sheetData.values;
            
            // Converter para formato de objetos
            const data = sheetRows.map(row => {
              const obj = {};
              sheetHeaders.forEach((header, index) => {
                obj[header] = row[index] || '';
              });
              return obj;
            });
            
            sheet.headers = sheetHeaders;
            sheet.data = data;
            
            console.log(`✅ ${sheet.name}: ${data.length} registros`);
            
          } catch (error) {
            sheet.error = error.message;
            console.log(`❌ ${sheet.name}: ${error.message}`);
          }
        });
        
        await Promise.all(promises);
        
        // Pequeno delay entre lotes
        if (i + batchSize < sheets.length) {
          await sleep(1000);
        }
      }
      
      const successfulSheets = sheets.filter(sheet => sheet.data && !sheet.error);
      console.log(`🎉 Carregamento concluído: ${successfulSheets.length}/${sheets.length} planilhas`);
      
      return {
        sheets: successfulSheets,
        totalSheets: sheets.length,
        successCount: successfulSheets.length,
        errors: sheets.filter(sheet => sheet.error)
      };
      
    } catch (error) {
      console.error('💥 Erro no carregamento:', error);
      throw error;
    }
  }
};

export default newLeadScoringService;