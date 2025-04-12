import React, { useEffect, useState } from 'react';
import launchService from '../services/launchService';

const LaunchPro = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const leadsData = await launchService.logDataToConsole();
        setData(leadsData);
      } catch (err) {
        console.error('Erro ao buscar dados:', err);
        setError('Falha ao carregar dados da planilha');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) return <div>Carregando dados da planilha...</div>;
  if (error) return <div>Erro: {error}</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Teste de Dados da Planilha</h1>
      <p className="mb-4">Os dados foram carregados e impressos no console! Abra o console do navegador para visualizá-los.</p>
      <p>Total de registros: {data.length}</p>
    </div>
  );
};

export default LaunchPro;