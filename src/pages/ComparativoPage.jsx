// src/pages/ComparativoPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import boletoService from '../services/boletoService';
import { FaChartBar, FaChartLine, FaCalendarAlt, FaExchangeAlt, FaSyncAlt } from 'react-icons/fa';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Area,
  AreaChart,
  ComposedChart
} from 'recharts';
import { formatCurrency } from '../utils/currencyUtils';
import DateRangePicker from '../components/DateRangePicker';

// Cores para os gráficos
const COLORS = ['#37E359', '#051626', '#FF4500', '#1E90FF', '#FFD700', '#FF1493'];

// Cores para comparativo
const PRIMARY_COLOR = '#37E359';     // Verde para o primeiro período
const SECONDARY_COLOR = '#1E90FF';   // Azul para o segundo período

function ComparativoPage() {
  // Estados para controle do tipo de comparação
  const [compareType, setCompareType] = useState('days'); // 'days' ou 'periods'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Estados para datas de comparação
  const [firstDate, setFirstDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  const [secondDate, setSecondDate] = useState(() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  });

  // Estados para períodos de comparação
  const [firstPeriodStart, setFirstPeriodStart] = useState(() => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return weekAgo.toISOString().split('T')[0];
  });

  const [firstPeriodEnd, setFirstPeriodEnd] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  const [secondPeriodStart, setSecondPeriodStart] = useState(() => {
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    return twoWeeksAgo.toISOString().split('T')[0];
  });

  const [secondPeriodEnd, setSecondPeriodEnd] = useState(() => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 8);
    return weekAgo.toISOString().split('T')[0];
  });

  // Dados dos comparativos
  const [firstData, setFirstData] = useState(null);
  const [secondData, setSecondData] = useState(null);
  const [comparativeResults, setComparativeResults] = useState(null);

  // Função para calcular a diferença entre períodos
  const calculateDaysDifference = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const differenceInTime = end.getTime() - start.getTime();
    return Math.ceil(differenceInTime / (1000 * 3600 * 24)) + 1; // +1 para incluir o dia final
  };

  // Função para validar que o segundo período tem a mesma duração que o primeiro
  const validatePeriods = useCallback(() => {
    if (compareType === 'periods') {
      const firstPeriodDays = calculateDaysDifference(firstPeriodStart, firstPeriodEnd);
      const secondPeriodDays = calculateDaysDifference(secondPeriodStart, secondPeriodEnd);
      
      return firstPeriodDays === secondPeriodDays;
    }
    return true;
  }, [compareType, firstPeriodStart, firstPeriodEnd, secondPeriodStart, secondPeriodEnd]);

  // Estado para mensagem de validação
  const [periodValidationMessage, setPeriodValidationMessage] = useState("");

  // Verificar e mostrar mensagem de validação quando necessário
  useEffect(() => {
    if (compareType === 'periods') {
      const firstPeriodDays = calculateDaysDifference(firstPeriodStart, firstPeriodEnd);
      const secondPeriodDays = calculateDaysDifference(secondPeriodStart, secondPeriodEnd);
      
      if (firstPeriodDays !== secondPeriodDays) {
        setPeriodValidationMessage(`Os períodos devem ter a mesma duração. O primeiro período tem ${firstPeriodDays} dias, mas o segundo tem ${secondPeriodDays} dias.`);
      } else {
        setPeriodValidationMessage("");
      }
    }
  }, [firstPeriodStart, firstPeriodEnd, secondPeriodStart, secondPeriodEnd, compareType, calculateDaysDifference]);

  // CORREÇÃO: Função auxiliar para ajustar a data para o fuso horário local
  const adjustDateToLocalTimezone = (dateString) => {
    // Criar uma data com a string fornecida, mas forçando o horário para meio-dia
    // para evitar problemas com o fuso horário
    const dateParts = dateString.split('-');
    const year = parseInt(dateParts[0]);
    const month = parseInt(dateParts[1]) - 1; // Mês em JavaScript é de 0-11
    const day = parseInt(dateParts[2]);
    
    // Criar uma data às 12:00 (meio-dia) no fuso horário local
    const date = new Date(year, month, day, 12, 0, 0);
    return date;
  };

  // Função para buscar dados de um dia específico
  const fetchDayData = useCallback(async (date) => {
    try {
      setLoading(true);

      // CORREÇÃO: Ajustar a data para o fuso horário local
      const selectedDate = adjustDateToLocalTimezone(date);
      const apiDateString = date; // formato YYYY-MM-DD para a API

      // Buscar transações aprovadas
      const transactionsResponse = await axios.post(
        `${import.meta.env.VITE_API_URL}/transactions`,
        {
          ordered_at_ini: apiDateString,
          ordered_at_end: apiDateString,
        }
      );

      // Buscar transações reembolsadas
      const refundsResponse = await axios.post(
        `${import.meta.env.VITE_API_URL}/refunds`,
        {
          ordered_at_ini: apiDateString,
          ordered_at_end: apiDateString,
        }
      );

      // Buscar vendas de boleto (TMB)
      const boletoSales = await boletoService.getSalesByDate(selectedDate);

      // Processar dados de transações
      const hourlyData = Array(24)
        .fill()
        .map((_, index) => ({
          hour: index,
          sales: 0,
          value: 0,
          affiliateValue: 0,
          refundCount: 0,
          refundValue: 0,
          commercialSales: 0,
          commercialValue: 0,
          boletoSales: 0,
          boletoValue: 0,
          productSales: {}, // Armazenar vendas por produto por hora
        }));

      let totalSales = 0;
      let totalValue = 0;
      let totalAffiliateValue = 0;
      let totalCommercialValue = 0;
      let totalCommercialSales = 0;
      let totalBoletoSales = 0;
      let totalBoletoValue = 0;
      let totalRefunds = 0;
      let totalRefundAmount = 0;
      const productSales = {};

      // Processar vendas por cartão
      transactionsResponse.data.data.forEach((transaction) => {
        const timestamp = transaction.dates.created_at * 1000;
        const date = new Date(timestamp);
        const hour = date.getHours();

        const netAmount = Number(
          transaction?.calculation_details?.net_amount || 0
        );
        const affiliateValue = Number(
          transaction?.calculation_details?.net_affiliate_value || 0
        );

        const isCommercial = transaction.trackings?.utm_source === 'comercial';

        hourlyData[hour].sales += 1;
        hourlyData[hour].value += netAmount;
        hourlyData[hour].affiliateValue += affiliateValue;

        // Registro das vendas por produto por hora
        const productName = transaction.product.name;
        if (!hourlyData[hour].productSales[productName]) {
          hourlyData[hour].productSales[productName] = 0;
        }
        hourlyData[hour].productSales[productName] += 1;

        if (isCommercial) {
          hourlyData[hour].commercialSales += 1;
          hourlyData[hour].commercialValue += netAmount;
          totalCommercialSales += 1;
          totalCommercialValue += netAmount;
        }

        totalSales += 1;
        totalValue += netAmount;
        totalAffiliateValue += affiliateValue;

        if (!productSales[productName]) {
          productSales[productName] = {
            quantity: 0,
            value: 0,
            commercialQuantity: 0,
            commercialValue: 0,
            boletoQuantity: 0,
            boletoValue: 0,
          };
        }
        productSales[productName].quantity += 1;
        productSales[productName].value += netAmount;

        if (isCommercial) {
          productSales[productName].commercialQuantity += 1;
          productSales[productName].commercialValue += netAmount;
        }
      });

      // Processar vendas de boleto
      boletoSales.forEach((boletoSale) => {
        const date = new Date(boletoSale.timestamp);
        const hour = date.getHours();

        const saleValue = boletoSale.value || 0;

        hourlyData[hour].boletoSales += 1;
        hourlyData[hour].boletoValue += saleValue;

        // Adicionar às vendas totais
        totalBoletoSales += 1;
        totalBoletoValue += saleValue;

        // Adicionar às vendas por produto
        const productName = boletoSale.product;
        if (!productSales[productName]) {
          productSales[productName] = {
            quantity: 0,
            value: 0,
            commercialQuantity: 0,
            commercialValue: 0,
            boletoQuantity: 0,
            boletoValue: 0,
          };
        }

        productSales[productName].boletoQuantity =
          (productSales[productName].boletoQuantity || 0) + 1;
        productSales[productName].boletoValue =
          (productSales[productName].boletoValue || 0) + saleValue;
        productSales[productName].quantity += 1;
        productSales[productName].value += saleValue;
      });

      // Processar dados de reembolsos
      refundsResponse.data.data.forEach((refund) => {
        const refundAmount = Number(refund.calculation_details?.net_amount || 0);
        totalRefunds += 1;
        totalRefundAmount += refundAmount;
      });

      // Converter para array para o gráfico
      const productData = Object.entries(productSales).map(([name, data]) => ({
        name,
        quantity: data.quantity,
        value: data.value,
        commercialQuantity: data.commercialQuantity || 0,
        commercialValue: data.commercialValue || 0,
        boletoQuantity: data.boletoQuantity || 0,
        boletoValue: data.boletoValue || 0,
      }));

      // Calcular a soma de cartão e boleto para o total
      const totalCombinedSales = totalSales + totalBoletoSales;
      const totalCombinedValue = totalValue + totalBoletoValue;

      return {
        hourlyData,
        productData,
        summary: {
          totalSales: totalCombinedSales,
          totalValue: totalCombinedValue,
          cardSales: totalSales,
          cardValue: totalValue,
          boletoSales: totalBoletoSales,
          boletoValue: totalBoletoValue,
          affiliateValue: totalAffiliateValue,
          commercialSales: totalCommercialSales,
          commercialValue: totalCommercialValue,
          refunds: totalRefunds,
          refundAmount: totalRefundAmount,
          date: apiDateString // Usar a data original para exibição consistente
        }
      };
    } catch (error) {
      console.error('Erro ao buscar dados para a data:', date, error);
      throw error;
    }
  }, []);

  // Função para buscar dados de um período
  const fetchPeriodData = useCallback(async (startDate, endDate) => {
    try {
      setLoading(true);

      // CORREÇÃO: Ajustar as datas para o fuso horário local
      const startDateObj = adjustDateToLocalTimezone(startDate);
      const endDateObj = adjustDateToLocalTimezone(endDate);

      // Buscar transações aprovadas
      const transactionsResponse = await axios.post(
        `${import.meta.env.VITE_API_URL}/transactions`,
        {
          ordered_at_ini: startDate,
          ordered_at_end: endDate,
        }
      );

      // Buscar transações reembolsadas
      const refundsResponse = await axios.post(
        `${import.meta.env.VITE_API_URL}/refunds`,
        {
          ordered_at_ini: startDate,
          ordered_at_end: endDate,
        }
      );

      // Buscar vendas de boleto (TMB)
      const boletoSales = await boletoService.getSalesByDateRange(startDateObj, endDateObj);

      // Inicializar dados por dia
      const dailyData = {};
      const currentDate = new Date(startDateObj);
      const lastDate = new Date(endDateObj);
      
      while (currentDate <= lastDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        dailyData[dateStr] = {
          date: dateStr,
          sales: 0,
          value: 0,
          affiliateValue: 0,
          refundCount: 0,
          refundValue: 0,
          commercialSales: 0,
          commercialValue: 0,
          boletoSales: 0,
          boletoValue: 0,
        };
        
        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Inicializar dados por hora (para média)
      const hourlyData = Array(24)
        .fill()
        .map((_, index) => ({
          hour: index,
          sales: 0,
          value: 0,
          affiliateValue: 0,
          refundCount: 0,
          refundValue: 0,
          commercialSales: 0,
          commercialValue: 0,
          boletoSales: 0,
          boletoValue: 0,
        }));

      let totalSales = 0;
      let totalValue = 0;
      let totalAffiliateValue = 0;
      let totalCommercialValue = 0;
      let totalCommercialSales = 0;
      let totalBoletoSales = 0;
      let totalBoletoValue = 0;
      let totalRefunds = 0;
      let totalRefundAmount = 0;
      const productSales = {};

      // Processar vendas por cartão
      transactionsResponse.data.data.forEach((transaction) => {
        const timestamp = transaction.dates.created_at * 1000;
        const date = new Date(timestamp);
        const dateStr = date.toISOString().split('T')[0];
        const hour = date.getHours();

        const netAmount = Number(
          transaction?.calculation_details?.net_amount || 0
        );
        const affiliateValue = Number(
          transaction?.calculation_details?.net_affiliate_value || 0
        );

        const isCommercial = transaction.trackings?.utm_source === 'comercial';

        // Adicionar aos dados diários
        if (dailyData[dateStr]) {
          dailyData[dateStr].sales += 1;
          dailyData[dateStr].value += netAmount;
          dailyData[dateStr].affiliateValue += affiliateValue;
          
          if (isCommercial) {
            dailyData[dateStr].commercialSales += 1;
            dailyData[dateStr].commercialValue += netAmount;
          }
        }

        // Adicionar aos dados por hora
        hourlyData[hour].sales += 1;
        hourlyData[hour].value += netAmount;
        hourlyData[hour].affiliateValue += affiliateValue;
        
        if (isCommercial) {
          hourlyData[hour].commercialSales += 1;
          hourlyData[hour].commercialValue += netAmount;
          totalCommercialSales += 1;
          totalCommercialValue += netAmount;
        }

        // Totais
        totalSales += 1;
        totalValue += netAmount;
        totalAffiliateValue += affiliateValue;

        // Vendas por produto
        const productName = transaction.product.name;
        if (!productSales[productName]) {
          productSales[productName] = {
            quantity: 0,
            value: 0,
            commercialQuantity: 0,
            commercialValue: 0,
            boletoQuantity: 0,
            boletoValue: 0,
          };
        }
        productSales[productName].quantity += 1;
        productSales[productName].value += netAmount;

        if (isCommercial) {
          productSales[productName].commercialQuantity += 1;
          productSales[productName].commercialValue += netAmount;
        }
      });

      // Processar vendas de boleto
      boletoSales.forEach((boletoSale) => {
        const date = new Date(boletoSale.timestamp);
        const dateStr = date.toISOString().split('T')[0];
        const hour = date.getHours();

        const saleValue = boletoSale.value || 0;

        // Adicionar aos dados diários
        if (dailyData[dateStr]) {
          dailyData[dateStr].boletoSales += 1;
          dailyData[dateStr].boletoValue += saleValue;
          dailyData[dateStr].sales += 1; // Incluir na contagem total
          dailyData[dateStr].value += saleValue; // Incluir no valor total
        }

        // Adicionar aos dados por hora
        hourlyData[hour].boletoSales += 1;
        hourlyData[hour].boletoValue += saleValue;

        // Totais
        totalBoletoSales += 1;
        totalBoletoValue += saleValue;

        // Adicionar às vendas por produto
        const productName = boletoSale.product;
        if (!productSales[productName]) {
          productSales[productName] = {
            quantity: 0,
            value: 0,
            commercialQuantity: 0,
            commercialValue: 0,
            boletoQuantity: 0,
            boletoValue: 0,
          };
        }

        productSales[productName].boletoQuantity =
          (productSales[productName].boletoQuantity || 0) + 1;
        productSales[productName].boletoValue =
          (productSales[productName].boletoValue || 0) + saleValue;
        productSales[productName].quantity += 1;
        productSales[productName].value += saleValue;
      });

      // Processar dados de reembolsos
      refundsResponse.data.data.forEach((refund) => {
        const timestamp = refund.dates.created_at * 1000;
        const date = new Date(timestamp);
        const dateStr = date.toISOString().split('T')[0];
        
        const refundAmount = Number(refund.calculation_details?.net_amount || 0);
        
        // Adicionar aos dados diários
        if (dailyData[dateStr]) {
          dailyData[dateStr].refundCount += 1;
          dailyData[dateStr].refundValue += refundAmount;
        }
        
        totalRefunds += 1;
        totalRefundAmount += refundAmount;
      });

      // Converter dados diários para array
      const dailyDataArray = Object.values(dailyData).sort((a, b) => 
        new Date(a.date) - new Date(b.date)
      );

      // Converter para array para o gráfico
      const productData = Object.entries(productSales).map(([name, data]) => ({
        name,
        quantity: data.quantity,
        value: data.value,
        commercialQuantity: data.commercialQuantity || 0,
        commercialValue: data.commercialValue || 0,
        boletoQuantity: data.boletoQuantity || 0,
        boletoValue: data.boletoValue || 0,
      }));

      // Calcular dia médio para cada métrica
      const days = calculateDaysDifference(startDate, endDate);
      const avgDailySales = totalSales / days;
      const avgDailyValue = totalValue / days;
      const avgDailyBoletoSales = totalBoletoSales / days;
      const avgDailyBoletoValue = totalBoletoValue / days;

      // Calcular a soma de cartão e boleto para o total
      const totalCombinedSales = totalSales + totalBoletoSales;
      const totalCombinedValue = totalValue + totalBoletoValue;

      return {
        dailyData: dailyDataArray,
        hourlyData,
        productData,
        summary: {
          totalSales: totalCombinedSales,
          totalValue: totalCombinedValue,
          cardSales: totalSales,
          cardValue: totalValue,
          boletoSales: totalBoletoSales,
          boletoValue: totalBoletoValue,
          affiliateValue: totalAffiliateValue,
          commercialSales: totalCommercialSales,
          commercialValue: totalCommercialValue,
          refunds: totalRefunds,
          refundAmount: totalRefundAmount,
          avgDailySales,
          avgDailyValue,
          avgDailyBoletoSales,
          avgDailyBoletoValue,
          days,
          startDate,
          endDate
        }
      };
    } catch (error) {
      console.error('Erro ao buscar dados para o período:', startDate, 'a', endDate, error);
      throw error;
    }
  }, []);

  // Função para buscar dados comparativos
  const fetchComparativeData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let firstDataResult, secondDataResult;

      if (compareType === 'days') {
        // Comparar dias específicos
        firstDataResult = await fetchDayData(firstDate);
        secondDataResult = await fetchDayData(secondDate);
      } else {
        // Comparar períodos
        firstDataResult = await fetchPeriodData(firstPeriodStart, firstPeriodEnd);
        secondDataResult = await fetchPeriodData(secondPeriodStart, secondPeriodEnd);
      }

      setFirstData(firstDataResult);
      setSecondData(secondDataResult);

      // Calcular resultados comparativos
      const comparativeData = calculateComparativeResults(firstDataResult, secondDataResult);
      setComparativeResults(comparativeData);

      setLoading(false);
    } catch (error) {
      console.error('Erro ao buscar dados comparativos:', error);
      setError('Falha ao carregar dados comparativos. Por favor, tente novamente.');
      setLoading(false);
    }
  }, [compareType, firstDate, secondDate, firstPeriodStart, firstPeriodEnd, secondPeriodStart, secondPeriodEnd, fetchDayData, fetchPeriodData]);

  // Calcular resultados comparativos
  const calculateComparativeResults = (first, second) => {
    if (!first || !second) return null;

    // Calcular diferenças percentuais
    const calculatePercentageDiff = (a, b) => {
      if (b === 0) return a === 0 ? 0 : 100; // Evitar divisão por zero
      return ((a - b) / Math.abs(b)) * 100;
    };

    // Calcular diferenças absolutas e percentuais para as principais métricas
    const salesDiff = first.summary.totalSales - second.summary.totalSales;
    const salesPercentDiff = calculatePercentageDiff(first.summary.totalSales, second.summary.totalSales);
    
    const valueDiff = first.summary.totalValue - second.summary.totalValue;
    const valuePercentDiff = calculatePercentageDiff(first.summary.totalValue, second.summary.totalValue);
    
    const cardSalesDiff = first.summary.cardSales - second.summary.cardSales;
    const cardSalesPercentDiff = calculatePercentageDiff(first.summary.cardSales, second.summary.cardSales);
    
    const cardValueDiff = first.summary.cardValue - second.summary.cardValue;
    const cardValuePercentDiff = calculatePercentageDiff(first.summary.cardValue, second.summary.cardValue);
    
    const boletoSalesDiff = first.summary.boletoSales - second.summary.boletoSales;
    const boletoSalesPercentDiff = calculatePercentageDiff(first.summary.boletoSales, second.summary.boletoSales);
    
    const boletoValueDiff = first.summary.boletoValue - second.summary.boletoValue;
    const boletoValuePercentDiff = calculatePercentageDiff(first.summary.boletoValue, second.summary.boletoValue);
    
    const refundsDiff = first.summary.refunds - second.summary.refunds;
    const refundsPercentDiff = calculatePercentageDiff(first.summary.refunds, second.summary.refunds);
    
    const refundAmountDiff = first.summary.refundAmount - second.summary.refundAmount;
    const refundAmountPercentDiff = calculatePercentageDiff(first.summary.refundAmount, second.summary.refundAmount);

    // Preparar dados para gráficos comparativos por hora
    const hourlyComparison = [];
    for (let i = 0; i < 24; i++) {
      hourlyComparison.push({
        hour: i,
        firstSales: first.hourlyData[i].sales + first.hourlyData[i].boletoSales,
        secondSales: second.hourlyData[i].sales + second.hourlyData[i].boletoSales,
        firstValue: first.hourlyData[i].value + first.hourlyData[i].boletoValue,
        secondValue: second.hourlyData[i].value + second.hourlyData[i].boletoValue,
        firstCardSales: first.hourlyData[i].sales,
        secondCardSales: second.hourlyData[i].sales,
        firstCardValue: first.hourlyData[i].value,
        secondCardValue: second.hourlyData[i].value,
        firstBoletoSales: first.hourlyData[i].boletoSales,
        secondBoletoSales: second.hourlyData[i].boletoSales,
        firstBoletoValue: first.hourlyData[i].boletoValue,
        secondBoletoValue: second.hourlyData[i].boletoValue,
      });
    }

    // Preparar dados para gráficos comparativos diários (quando comparando períodos)
    let dailyComparison = null;
    if (compareType === 'periods' && first.dailyData && second.dailyData) {
      // Normalizar os dias para facilitar a comparação (Dia 1, Dia 2, etc.)
      const firstDays = first.dailyData.map((day, index) => ({
        ...day,
        dayNumber: index + 1
      }));
      
      const secondDays = second.dailyData.map((day, index) => ({
        ...day,
        dayNumber: index + 1
      }));
      
      // Combinar os dados normalizados para o gráfico
      dailyComparison = [];
      for (let i = 0; i < Math.max(firstDays.length, secondDays.length); i++) {
        if (i < firstDays.length && i < secondDays.length) {
          dailyComparison.push({
            dayNumber: i + 1,
            firstDate: firstDays[i].date,
            secondDate: secondDays[i].date,
            firstSales: firstDays[i].sales,
            secondSales: secondDays[i].sales,
            firstValue: firstDays[i].value,
            secondValue: secondDays[i].value,
            firstCardSales: firstDays[i].sales - firstDays[i].boletoSales,
            secondCardSales: secondDays[i].sales - secondDays[i].boletoSales,
            firstBoletoSales: firstDays[i].boletoSales,
            secondBoletoSales: secondDays[i].boletoSales,
            firstRefunds: firstDays[i].refundCount,
            secondRefunds: secondDays[i].refundCount,
          });
        }
      }
    }

    // Preparar dados para comparativo de produtos
    const productComparison = {};
    
    // Adicionar todos os produtos do primeiro conjunto
    first.productData.forEach(product => {
      productComparison[product.name] = {
        name: product.name,
        firstQuantity: product.quantity,
        firstValue: product.value,
        secondQuantity: 0,
        secondValue: 0,
      };
    });
    
    // Adicionar/atualizar com produtos do segundo conjunto
    second.productData.forEach(product => {
      if (productComparison[product.name]) {
        productComparison[product.name].secondQuantity = product.quantity;
        productComparison[product.name].secondValue = product.value;
      } else {
        productComparison[product.name] = {
          name: product.name,
          firstQuantity: 0,
          firstValue: 0,
          secondQuantity: product.quantity,
          secondValue: product.value,
        };
      }
    });
    
    // Converter para array e calcular diferenças
    const productComparisonArray = Object.values(productComparison).map(product => ({
      ...product,
      quantityDiff: product.firstQuantity - product.secondQuantity,
      valueDiff: product.firstValue - product.secondValue,
      quantityPercentDiff: calculatePercentageDiff(product.firstQuantity, product.secondQuantity),
      valuePercentDiff: calculatePercentageDiff(product.firstValue, product.secondValue),
    })).sort((a, b) => b.firstValue - a.firstValue); // Ordenar por valor no primeiro período

    return {
      // Diferenças resumidas
      differences: {
        sales: {
          absolute: salesDiff,
          percent: salesPercentDiff
        },
        value: {
          absolute: valueDiff,
          percent: valuePercentDiff
        },
        cardSales: {
          absolute: cardSalesDiff,
          percent: cardSalesPercentDiff
        },
        cardValue: {
          absolute: cardValueDiff,
          percent: cardValuePercentDiff
        },
        boletoSales: {
          absolute: boletoSalesDiff,
          percent: boletoSalesPercentDiff
        },
        boletoValue: {
          absolute: boletoValueDiff,
          percent: boletoValuePercentDiff
        },
        refunds: {
          absolute: refundsDiff,
          percent: refundsPercentDiff
        },
        refundAmount: {
          absolute: refundAmountDiff,
          percent: refundAmountPercentDiff
        }
      },
      // Dados para gráficos
      hourlyComparison,
      dailyComparison,
      productComparison: productComparisonArray
    };
  };

  // Atualizar os dados quando o usuário clicar em "Comparar"
  const handleCompare = () => {
    // Verificar se os períodos têm a mesma duração quando em modo de comparação de períodos
    if (compareType === 'periods' && !validatePeriods()) {
      setError("Os dois períodos precisam ter o mesmo número de dias para uma comparação válida.");
      return;
    }
    
    // Limpar qualquer erro anterior
    setError(null);
    fetchComparativeData();
  };

  // CORREÇÃO: Função para formatar data para exibição brasileira
  const formatDateBR = (dateString) => {
    if (!dateString) return '';
    
    // Garantir que estamos usando uma string de data no formato YYYY-MM-DD
    const parts = dateString.split('-');
    if (parts.length !== 3) return dateString; // Retornar a data original se não estiver no formato esperado
    
    // Retornar no formato DD/MM/YYYY
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  // Formatar rótulos para os períodos de comparação
  const getFirstLabel = () => {
    if (compareType === 'days') {
      // CORREÇÃO: Usar a função formatDateBR para exibir a data corretamente
      return formatDateBR(firstDate);
    } else {
      return `${formatDateBR(firstPeriodStart)} a ${formatDateBR(firstPeriodEnd)}`;
    }
  };

  const getSecondLabel = () => {
    if (compareType === 'days') {
      // CORREÇÃO: Usar a função formatDateBR para exibir a data corretamente
      return formatDateBR(secondDate);
    } else {
      return `${formatDateBR(secondPeriodStart)} a ${formatDateBR(secondPeriodEnd)}`;
    }
  };

  // Formatar rótulo para o gráfico por dia
  const formatDayLabel = (dayNumber, dataKey) => {
    const results = comparativeResults?.dailyComparison;
    if (!results || !results[dayNumber - 1]) return `Dia ${dayNumber}`;
    
    const item = results[dayNumber - 1];
    const date = dataKey.startsWith('first') ? item.firstDate : item.secondDate;
    
    // CORREÇÃO: Usar a função formatDateBR para exibir a data corretamente
    return `${dayNumber} (${formatDateBR(date).slice(0, 5)})`;
  };

  // Estilo condicional para indicar aumento/diminuição
  const getDiffStyle = (value) => {
    if (value > 0) return 'text-green-500 dark:text-green-400';
    if (value < 0) return 'text-red-500 dark:text-red-400';
    return 'text-gray-500 dark:text-gray-400';
  };

  // Formatar porcentagem com sinal
  const formatPercentage = (percent) => {
    const sign = percent > 0 ? '+' : '';
    return `${sign}${percent.toFixed(2)}%`;
  };

  // Handlers para o DateRangePicker
  const handleFirstPeriodChange = (start, end) => {
    setFirstPeriodStart(start);
    setFirstPeriodEnd(end);
  };

  const handleSecondPeriodChange = (start, end) => {
    setSecondPeriodStart(start);
    setSecondPeriodEnd(end);
  };

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-primary-dark dark:text-primary mb-6 flex items-center">
          <FaChartLine className="mr-3" /> Comparativo de Vendas
        </h1>

        {/* Controles de comparação */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-bold text-primary dark:text-secondary mb-4 flex items-center">
            <FaCalendarAlt className="mr-2" /> Selecione o tipo de comparativo
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Seleção do tipo de comparação */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tipo de Comparação
              </label>
              <div className="flex space-x-4">
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    value="days"
                    checked={compareType === 'days'}
                    onChange={() => setCompareType('days')}
                    className="h-4 w-4 text-primary focus:ring-primary dark:focus:ring-secondary rounded border-gray-300 dark:border-gray-600"
                  />
                  <span className="ml-2 text-text-light dark:text-text-dark">
                    Comparar Dias
                  </span>
                </label>
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    value="periods"
                    checked={compareType === 'periods'}
                    onChange={() => setCompareType('periods')}
                    className="h-4 w-4 text-primary focus:ring-primary dark:focus:ring-secondary rounded border-gray-300 dark:border-gray-600"
                  />
                  <span className="ml-2 text-text-light dark:text-text-dark">
                    Comparar Períodos
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Seleção de dias ou períodos */}
          {compareType === 'periods' ? (
            <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-gray-50 dark:bg-gray-750 p-4 rounded-lg">
                <h3 className="text-lg font-medium text-primary dark:text-secondary mb-3">
                  Primeiro Período
                </h3>
                <DateRangePicker 
                  startDate={firstPeriodStart}
                  endDate={firstPeriodEnd}
                  onDateChange={handleFirstPeriodChange}
                />
                <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  Duração: {calculateDaysDifference(firstPeriodStart, firstPeriodEnd)} dias
                </div>
              </div>
              
              <div className="bg-gray-50 dark:bg-gray-750 p-4 rounded-lg">
                <h3 className="text-lg font-medium text-primary dark:text-secondary mb-3">
                  Segundo Período
                </h3>
                <DateRangePicker 
                  startDate={secondPeriodStart}
                  endDate={secondPeriodEnd}
                  onDateChange={handleSecondPeriodChange}
                />
                <div className="mt-2 flex flex-col">
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Duração: {calculateDaysDifference(secondPeriodStart, secondPeriodEnd)} dias
                  </div>
                  {periodValidationMessage && (
                    <div className="mt-2 text-sm text-red-500 dark:text-red-400">
                      {periodValidationMessage}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Primeira Data
                </label>
                <input
                  type="date"
                  value={firstDate}
                  onChange={(e) => setFirstDate(e.target.value)}
                  className="w-full border rounded-lg bg-white dark:bg-gray-700 text-text-light dark:text-text-dark px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Segunda Data
                </label>
                <input
                  type="date"
                  value={secondDate}
                  onChange={(e) => setSecondDate(e.target.value)}
                  className="w-full border rounded-lg bg-white dark:bg-gray-700 text-text-light dark:text-text-dark px-3 py-2"
                />
              </div>
            </div>
          )}
          
          <div className="mt-6 flex justify-center">
            <button
              onClick={handleCompare}
              disabled={loading}
              className="px-6 py-3 bg-primary hover:bg-primary-dark text-white dark:bg-secondary dark:hover:bg-secondary-light dark:text-primary-dark rounded-lg shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {loading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processando...
                </span>
              ) : (
                <span className="flex items-center">
                  <FaExchangeAlt className="mr-2" />
                  Comparar
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Mensagem de erro */}
        {error && (
          <div className="bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-300 px-4 py-3 rounded relative mb-6" role="alert">
            <strong className="font-bold">Erro! </strong>
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        {/* Restante do código permanece o mesmo - visualizações dos dados comparativos */}
        {!loading && comparativeResults && (
          <>
            {/* Legenda de Cores */}
            <div className="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <h2 className="text-lg font-medium text-text-light dark:text-text-dark mb-2">
                Legenda
              </h2>
              <div className="flex space-x-4 flex-wrap">
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-green-500 rounded mr-2"></div>
                  <span className="text-text-light dark:text-text-dark">{getFirstLabel()}</span>
                </div>
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-blue-500 rounded mr-2"></div>
                  <span className="text-text-light dark:text-text-dark">{getSecondLabel()}</span>
                </div>
              </div>
            </div>
            
            {/* CORREÇÃO: Cards de Resumo - Alterados para máximo 3 por linha */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {/* Total de Vendas */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-text-light dark:text-text-dark">
                  Total de Vendas
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="border-r border-gray-200 dark:border-gray-700 pr-2">
                    <p className="text-2xl font-bold text-green-500 dark:text-green-400">
                      {firstData.summary.totalSales}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {getFirstLabel()}
                    </p>
                    {/* Adicionado: Comparação em relação ao segundo valor */}
                    {secondData.summary.totalSales > 0 && (
                      <p className={`text-xs font-medium mt-1 ${getDiffStyle(firstData.summary.totalSales - secondData.summary.totalSales)}`}>
                        {firstData.summary.totalSales > secondData.summary.totalSales ? '+' : ''}
                        {((firstData.summary.totalSales - secondData.summary.totalSales) / secondData.summary.totalSales * 100).toFixed(2)}% 
                        ({firstData.summary.totalSales - secondData.summary.totalSales})
                      </p>
                    )}
                  </div>
                  <div className="pl-2">
                    <p className="text-2xl font-bold text-blue-500 dark:text-blue-400">
                      {secondData.summary.totalSales}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {getSecondLabel()}
                    </p>
                    {/* Adicionado: Comparação em relação ao primeiro valor */}
                    {firstData.summary.totalSales > 0 && (
                      <p className={`text-xs font-medium mt-1 ${getDiffStyle(secondData.summary.totalSales - firstData.summary.totalSales)}`}>
                        {secondData.summary.totalSales > firstData.summary.totalSales ? '+' : ''}
                        {((secondData.summary.totalSales - firstData.summary.totalSales) / firstData.summary.totalSales * 100).toFixed(2)}% 
                        ({secondData.summary.totalSales - firstData.summary.totalSales})
                      </p>
                    )}
                  </div>
                </div>
       
              </div>

              {/* Valor Total */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-text-light dark:text-text-dark">
                  Valor Total
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="border-r border-gray-200 dark:border-gray-700 pr-2">
                    <p className="text-2xl font-bold text-green-500 dark:text-green-400">
                      {formatCurrency(firstData.summary.totalValue)}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {getFirstLabel()}
                    </p>
                    {/* Adicionado: Comparação em relação ao segundo valor */}
                    {secondData.summary.totalValue > 0 && (
                      <p className={`text-xs font-medium mt-1 ${getDiffStyle(firstData.summary.totalValue - secondData.summary.totalValue)}`}>
                        {firstData.summary.totalValue > secondData.summary.totalValue ? '+' : ''}
                        {((firstData.summary.totalValue - secondData.summary.totalValue) / secondData.summary.totalValue * 100).toFixed(2)}% 
                        ({formatCurrency(firstData.summary.totalValue - secondData.summary.totalValue)})
                      </p>
                    )}
                  </div>
                  <div className="pl-2">
                    <p className="text-2xl font-bold text-blue-500 dark:text-blue-400">
                      {formatCurrency(secondData.summary.totalValue)}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {getSecondLabel()}
                    </p>
                    {/* Adicionado: Comparação em relação ao primeiro valor */}
                    {firstData.summary.totalValue > 0 && (
                      <p className={`text-xs font-medium mt-1 ${getDiffStyle(secondData.summary.totalValue - firstData.summary.totalValue)}`}>
                        {secondData.summary.totalValue > firstData.summary.totalValue ? '+' : ''}
                        {((secondData.summary.totalValue - firstData.summary.totalValue) / firstData.summary.totalValue * 100).toFixed(2)}% 
                        ({formatCurrency(secondData.summary.totalValue - firstData.summary.totalValue)})
                      </p>
                    )}
                  </div>
                </div>
         
              </div>

              {/* Vendas por Cartão */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-text-light dark:text-text-dark">
                  Vendas por Cartão
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="border-r border-gray-200 dark:border-gray-700 pr-2">
                    <p className="text-xl font-bold text-green-500 dark:text-green-400">
                      {firstData.summary.cardSales} / {formatCurrency(firstData.summary.cardValue)}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {getFirstLabel()}
                    </p>
                    {/* Adicionado: Comparação em relação ao segundo valor */}
                    {secondData.summary.cardSales > 0 && (
                      <p className={`text-xs font-medium mt-1 ${getDiffStyle(firstData.summary.cardSales - secondData.summary.cardSales)}`}>
                        {firstData.summary.cardSales > secondData.summary.cardSales ? '+' : ''}
                        {((firstData.summary.cardSales - secondData.summary.cardSales) / secondData.summary.cardSales * 100).toFixed(2)}% 
                        ({firstData.summary.cardSales - secondData.summary.cardSales})
                      </p>
                    )}
                    {secondData.summary.cardValue > 0 && (
                      <p className={`text-xs font-medium ${getDiffStyle(firstData.summary.cardValue - secondData.summary.cardValue)}`}>
                        {firstData.summary.cardValue > secondData.summary.cardValue ? '+' : ''}
                        {((firstData.summary.cardValue - secondData.summary.cardValue) / secondData.summary.cardValue * 100).toFixed(2)}% 
                        ({formatCurrency(firstData.summary.cardValue - secondData.summary.cardValue)})
                      </p>
                    )}
                  </div>
                  <div className="pl-2">
                    <p className="text-xl font-bold text-blue-500 dark:text-blue-400">
                      {secondData.summary.cardSales} / {formatCurrency(secondData.summary.cardValue)}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {getSecondLabel()}
                    </p>
                    {/* Adicionado: Comparação em relação ao primeiro valor */}
                    {firstData.summary.cardSales > 0 && (
                      <p className={`text-xs font-medium mt-1 ${getDiffStyle(secondData.summary.cardSales - firstData.summary.cardSales)}`}>
                        {secondData.summary.cardSales > firstData.summary.cardSales ? '+' : ''}
                        {((secondData.summary.cardSales - firstData.summary.cardSales) / firstData.summary.cardSales * 100).toFixed(2)}% 
                        ({secondData.summary.cardSales - firstData.summary.cardSales})
                      </p>
                    )}
                    {firstData.summary.cardValue > 0 && (
                      <p className={`text-xs font-medium ${getDiffStyle(secondData.summary.cardValue - firstData.summary.cardValue)}`}>
                        {secondData.summary.cardValue > firstData.summary.cardValue ? '+' : ''}
                        {((secondData.summary.cardValue - firstData.summary.cardValue) / firstData.summary.cardValue * 100).toFixed(2)}% 
                        ({formatCurrency(secondData.summary.cardValue - firstData.summary.cardValue)})
                      </p>
                    )}
                  </div>
                </div>
   
              </div>

              {/* Vendas por Boleto */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-text-light dark:text-text-dark">
                  Vendas por Boleto
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="border-r border-gray-200 dark:border-gray-700 pr-2">
                    <p className="text-xl font-bold text-green-500 dark:text-green-400">
                      {firstData.summary.boletoSales} / {formatCurrency(firstData.summary.boletoValue)}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {getFirstLabel()}
                    </p>
                    {/* Adicionado: Comparação em relação ao segundo valor */}
                    {secondData.summary.boletoSales > 0 && (
                      <p className={`text-xs font-medium mt-1 ${getDiffStyle(firstData.summary.boletoSales - secondData.summary.boletoSales)}`}>
                        {firstData.summary.boletoSales > secondData.summary.boletoSales ? '+' : ''}
                        {((firstData.summary.boletoSales - secondData.summary.boletoSales) / secondData.summary.boletoSales * 100).toFixed(2)}% 
                        ({firstData.summary.boletoSales - secondData.summary.boletoSales})
                      </p>
                    )}
                    {secondData.summary.boletoValue > 0 && (
                      <p className={`text-xs font-medium ${getDiffStyle(firstData.summary.boletoValue - secondData.summary.boletoValue)}`}>
                        {firstData.summary.boletoValue > secondData.summary.boletoValue ? '+' : ''}
                        {((firstData.summary.boletoValue - secondData.summary.boletoValue) / secondData.summary.boletoValue * 100).toFixed(2)}% 
                        ({formatCurrency(firstData.summary.boletoValue - secondData.summary.boletoValue)})
                      </p>
                    )}
                  </div>
                  <div className="pl-2">
                    <p className="text-xl font-bold text-blue-500 dark:text-blue-400">
                      {secondData.summary.boletoSales} / {formatCurrency(secondData.summary.boletoValue)}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {getSecondLabel()}
                    </p>
                    {/* Adicionado: Comparação em relação ao primeiro valor */}
                    {firstData.summary.boletoSales > 0 && (
                      <p className={`text-xs font-medium mt-1 ${getDiffStyle(secondData.summary.boletoSales - firstData.summary.boletoSales)}`}>
                        {secondData.summary.boletoSales > firstData.summary.boletoSales ? '+' : ''}
                        {((secondData.summary.boletoSales - firstData.summary.boletoSales) / firstData.summary.boletoSales * 100).toFixed(2)}% 
                        ({secondData.summary.boletoSales - firstData.summary.boletoSales})
                      </p>
                    )}
                    {firstData.summary.boletoValue > 0 && (
                      <p className={`text-xs font-medium ${getDiffStyle(secondData.summary.boletoValue - firstData.summary.boletoValue)}`}>
                        {secondData.summary.boletoValue > firstData.summary.boletoValue ? '+' : ''}
                        {((secondData.summary.boletoValue - firstData.summary.boletoValue) / firstData.summary.boletoValue * 100).toFixed(2)}% 
                        ({formatCurrency(secondData.summary.boletoValue - firstData.summary.boletoValue)})
                      </p>
                    )}
                  </div>
                </div>

              </div>

              {/* Reembolsos */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-text-light dark:text-text-dark">
                  Reembolsos
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="border-r border-gray-200 dark:border-gray-700 pr-2">
                    <p className="text-xl font-bold text-green-500 dark:text-green-400">
                      {firstData.summary.refunds} / {formatCurrency(firstData.summary.refundAmount)}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {getFirstLabel()}
                    </p>
                    {/* Adicionado: Comparação em relação ao segundo valor */}
                    {secondData.summary.refunds > 0 && (
                      <p className={`text-xs font-medium mt-1 ${getDiffStyle(-1 * (firstData.summary.refunds - secondData.summary.refunds))}`}>
                        {firstData.summary.refunds < secondData.summary.refunds ? '-' : '+'}
                        {((firstData.summary.refunds - secondData.summary.refunds) / secondData.summary.refunds * 100).toFixed(2)}% 
                        ({firstData.summary.refunds - secondData.summary.refunds})
                      </p>
                    )}
                    {secondData.summary.refundAmount > 0 && (
                      <p className={`text-xs font-medium ${getDiffStyle(-1 * (firstData.summary.refundAmount - secondData.summary.refundAmount))}`}>
                        {firstData.summary.refundAmount < secondData.summary.refundAmount ? '-' : '+'}
                        {((firstData.summary.refundAmount - secondData.summary.refundAmount) / secondData.summary.refundAmount * 100).toFixed(2)}% 
                        ({formatCurrency(firstData.summary.refundAmount - secondData.summary.refundAmount)})
                      </p>
                    )}
                  </div>
                  <div className="pl-2">
                    <p className="text-xl font-bold text-blue-500 dark:text-blue-400">
                      {secondData.summary.refunds} / {formatCurrency(secondData.summary.refundAmount)}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {getSecondLabel()}
                    </p>
                    {/* Adicionado: Comparação em relação ao primeiro valor */}
                    {firstData.summary.refunds > 0 && (
                      <p className={`text-xs font-medium mt-1 ${getDiffStyle(-1 * (secondData.summary.refunds - firstData.summary.refunds))}`}>
                        {secondData.summary.refunds < firstData.summary.refunds ? '-' : '+'}
                        {((secondData.summary.refunds - firstData.summary.refunds) / firstData.summary.refunds * 100).toFixed(2)}% 
                        ({secondData.summary.refunds - firstData.summary.refunds})
                      </p>
                    )}
                    {firstData.summary.refundAmount > 0 && (
                      <p className={`text-xs font-medium ${getDiffStyle(-1 * (secondData.summary.refundAmount - firstData.summary.refundAmount))}`}>
                        {secondData.summary.refundAmount < firstData.summary.refundAmount ? '-' : '+'}
                        {((secondData.summary.refundAmount - firstData.summary.refundAmount) / firstData.summary.refundAmount * 100).toFixed(2)}% 
                        ({formatCurrency(secondData.summary.refundAmount - firstData.summary.refundAmount)})
                      </p>
                    )}
                  </div>
                </div>
    
              </div>
            </div>

            {/* Gráficos Comparativos */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Comparativo de Vendas por Hora - Apenas mostrar quando comparando dias */}
              {compareType === 'days' && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                  <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-4">
                    Comparativo de Vendas por Hora
                  </h3>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={comparativeResults.hourlyComparison}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="hour" tickFormatter={(hour) => `${hour}h`} />
                        <YAxis />
                        <Tooltip 
                          content={({ active, payload, label }) => {
                            if (!active || !payload || !payload.length) return null;
                            
                            // Ordenar para mostrar o maior valor primeiro
                            const sortedPayload = [...payload].sort((a, b) => b.value - a.value);
                            const hour = label;
                            
                            return (
                              <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded shadow-md">
                                <p className="font-bold text-gray-800 dark:text-white">{`${hour}:00h`}</p>
                                {sortedPayload.map((entry, index) => {
                                  const isFirst = entry.dataKey === 'firstSales';
                                  const salesValue = entry.value;
                                  const monetaryValue = isFirst 
                                    ? comparativeResults.hourlyComparison[hour].firstValue 
                                    : comparativeResults.hourlyComparison[hour].secondValue;
                                  const period = isFirst ? getFirstLabel() : getSecondLabel();
                                  const color = isFirst ? PRIMARY_COLOR : SECONDARY_COLOR;
                                  
                                  return (
                                    <div key={index} className="flex items-center mt-1">
                                      <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: color }}></div>
                                      <p className="text-sm">
                                        <span className="font-medium">{period}:</span>{' '}
                                        {`${salesValue} vendas (${formatCurrency(monetaryValue)})`}
                                      </p>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          }}
                        />
                        <Legend 
                          formatter={(value) => {
                            if (value === 'firstSales') return getFirstLabel();
                            if (value === 'secondSales') return getSecondLabel();
                            return value;
                          }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="firstSales" 
                          name="firstSales" 
                          stroke={PRIMARY_COLOR} 
                          strokeWidth={2} 
                          dot={true} 
                          activeDot={{ r: 6 }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="secondSales" 
                          name="secondSales" 
                          stroke={SECONDARY_COLOR} 
                          strokeWidth={2} 
                          dot={true} 
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Comparativo de Valor por Hora - Apenas mostrar quando comparando dias */}
              {compareType === 'days' && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                  <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-4">
                    Comparativo de Valor por Hora
                  </h3>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={comparativeResults.hourlyComparison}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="hour" tickFormatter={(hour) => `${hour}h`} />
                        <YAxis tickFormatter={(value) => formatCurrency(value).slice(0, -3)} />
                        <Tooltip 
                          content={({ active, payload, label }) => {
                            if (!active || !payload || !payload.length) return null;
                            
                            // Ordenar para mostrar o maior valor primeiro
                            const sortedPayload = [...payload].sort((a, b) => b.value - a.value);
                            const hour = label;
                            
                            return (
                              <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded shadow-md">
                                <p className="font-bold text-gray-800 dark:text-white">{`${hour}:00h`}</p>
                                {sortedPayload.map((entry, index) => {
                                  const isFirst = entry.dataKey === 'firstValue';
                                  const monetaryValue = entry.value;
                                  const salesValue = isFirst 
                                    ? comparativeResults.hourlyComparison[hour].firstSales 
                                    : comparativeResults.hourlyComparison[hour].secondSales;
                                  const period = isFirst ? getFirstLabel() : getSecondLabel();
                                  const color = isFirst ? PRIMARY_COLOR : SECONDARY_COLOR;
                                  
                                  return (
                                    <div key={index} className="flex items-center mt-1">
                                      <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: color }}></div>
                                      <p className="text-sm">
                                        <span className="font-medium">{period}:</span>{' '}
                                        {`${formatCurrency(monetaryValue)} (${salesValue} vendas)`}
                                      </p>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          }}
                        />
                        <Legend 
                          formatter={(value) => {
                            if (value === 'firstValue') return getFirstLabel();
                            if (value === 'secondValue') return getSecondLabel();
                            return value;
                          }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="firstValue" 
                          name="firstValue" 
                          stroke={PRIMARY_COLOR} 
                          strokeWidth={2} 
                          dot={true} 
                          activeDot={{ r: 6 }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="secondValue" 
                          name="secondValue" 
                          stroke={SECONDARY_COLOR} 
                          strokeWidth={2} 
                          dot={true} 
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Comparativo de vendas por dia (para períodos) */}
              {compareType === 'periods' && comparativeResults.dailyComparison && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                  <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-4">
                    Comparativo de Vendas por Dia
                  </h3>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={comparativeResults.dailyComparison}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="dayNumber" 
                          tickFormatter={(day) => `Dia ${day}`}
                        />
                        <YAxis />
                        <Tooltip 
                          content={({ active, payload, label }) => {
                            if (!active || !payload || !payload.length) return null;
                            
                            // Ordenar para mostrar o maior valor primeiro
                            const sortedPayload = [...payload].sort((a, b) => b.value - a.value);
                            const dayIndex = parseInt(label) - 1;
                            
                            return (
                              <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded shadow-md">
                                <p className="font-bold text-gray-800 dark:text-white">
                                  {`Dia ${label} (${formatDateBR(comparativeResults.dailyComparison[dayIndex].firstDate)})`}
                                </p>
                                {sortedPayload.map((entry, index) => {
                                  const isFirst = entry.dataKey === 'firstSales';
                                  const salesValue = entry.value;
                                  const monetaryValue = isFirst 
                                    ? comparativeResults.dailyComparison[dayIndex].firstValue 
                                    : comparativeResults.dailyComparison[dayIndex].secondValue;
                                  const period = isFirst ? getFirstLabel() : getSecondLabel();
                                  const color = isFirst ? PRIMARY_COLOR : SECONDARY_COLOR;
                                  
                                  return (
                                    <div key={index} className="flex items-center mt-1">
                                      <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: color }}></div>
                                      <p className="text-sm">
                                        <span className="font-medium">{period}:</span>{' '}
                                        {`${salesValue} vendas (${formatCurrency(monetaryValue)})`}
                                      </p>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          }}
                        />
                        <Legend 
                          formatter={(value) => {
                            if (value === 'firstSales') return getFirstLabel();
                            if (value === 'secondSales') return getSecondLabel();
                            return value;
                          }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="firstSales" 
                          name="firstSales" 
                          stroke={PRIMARY_COLOR} 
                          strokeWidth={2} 
                          dot={true} 
                          activeDot={{ r: 6 }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="secondSales" 
                          name="secondSales" 
                          stroke={SECONDARY_COLOR} 
                          strokeWidth={2} 
                          dot={true} 
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
              
              {/* Comparativo de Valor por Dia (para períodos) - VISUALIZAÇÃO ALTERNATIVA */}
              {compareType === 'periods' && comparativeResults.dailyComparison && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                  <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-4">
                    Comparativo de Valor por Dia
                  </h3>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={comparativeResults.dailyComparison}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="dayNumber" 
                          tickFormatter={(day) => `Dia ${day}`}
                        />
                        <YAxis 
                          yAxisId="left"
                          tickFormatter={(value) => formatCurrency(value).slice(0, -3)} 
                        />
                        <YAxis 
                          yAxisId="right"
                          orientation="right"
                          tickFormatter={(value) => formatCurrency(value).slice(0, -3)} 
                        />
                        <Tooltip 
                          content={({ active, payload, label }) => {
                            if (!active || !payload || !payload.length) return null;
                            
                            // Ordenar para mostrar o maior valor primeiro
                            const sortedPayload = [...payload].sort((a, b) => {
                              // Apenas ordenar os valores (não os pontos de comparação)
                              if (a.dataKey === 'diffBar') return 1; // Sempre por último
                              if (b.dataKey === 'diffBar') return -1;
                              return b.value - a.value;
                            });
                            
                            const dayIndex = parseInt(label) - 1;
                            const firstValue = comparativeResults.dailyComparison[dayIndex].firstValue;
                            const secondValue = comparativeResults.dailyComparison[dayIndex].secondValue;
                            const diffValue = firstValue - secondValue;
                            const diffPercent = secondValue !== 0 
                              ? (diffValue / secondValue) * 100 
                              : (diffValue > 0 ? 100 : 0);
                            
                            return (
                              <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded shadow-md">
                                <p className="font-bold text-gray-800 dark:text-white">
                                  {`Dia ${label} (${formatDateBR(comparativeResults.dailyComparison[dayIndex].firstDate)})`}
                                </p>
                                
                                {/* Valores individuais */}
                                {sortedPayload.map((entry, index) => {
                                  if (entry.dataKey === 'diffBar') return null; // Não mostrar a barra de diferença aqui
                                  
                                  const isFirst = entry.dataKey === 'firstValue';
                                  const monetaryValue = entry.value;
                                  const salesValue = isFirst 
                                    ? comparativeResults.dailyComparison[dayIndex].firstSales 
                                    : comparativeResults.dailyComparison[dayIndex].secondSales;
                                  const period = isFirst ? getFirstLabel() : getSecondLabel();
                                  const color = isFirst ? PRIMARY_COLOR : SECONDARY_COLOR;
                                  
                                  return (
                                    <div key={index} className="flex items-center mt-1">
                                      <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: color }}></div>
                                      <p className="text-sm">
                                        <span className="font-medium">{period}:</span>{' '}
                                        {`${formatCurrency(monetaryValue)} (${salesValue} vendas)`}
                                      </p>
                                    </div>
                                  );
                                })}
                                
                                {/* Diferença */}
                                <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                                  <p className={`text-sm font-semibold ${getDiffStyle(diffValue)}`}>
                                    Diferença: {formatCurrency(diffValue)} ({diffValue > 0 ? '+' : ''}{diffPercent.toFixed(2)}%)
                                  </p>
                                </div>
                              </div>
                            );
                          }}
                        />
                        <Legend 
                          formatter={(value) => {
                            if (value === 'firstValue') return getFirstLabel();
                            if (value === 'secondValue') return getSecondLabel();
                            if (value === 'diffBar') return 'Diferença';
                            return value;
                          }}
                        />
                        <Bar 
                          dataKey="firstValue" 
                          name="firstValue" 
                          yAxisId="left"
                          fill={PRIMARY_COLOR} 
                          fillOpacity={0.7}
                          barSize={20}
                        />
                        <Bar 
                          dataKey="secondValue" 
                          name="secondValue" 
                          yAxisId="left"
                          fill={SECONDARY_COLOR} 
                          fillOpacity={0.7}
                          barSize={20}
                        />
                        <Line 
                          type="monotone" 
                          dataKey={(dataPoint) => dataPoint.firstValue - dataPoint.secondValue}
                          name="diffBar"
                          yAxisId="right"
                          stroke="#FF6B6B" 
                          strokeWidth={2}
                          dot={{ fill: '#FF6B6B', r: 6 }}
                          activeDot={{ r: 8 }}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
              

              {/* Comparativo de Cartão vs Boleto */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-4">
                  Comparativo de Vendas: Cartão vs Boleto
                </h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[
                      {
                        name: 'Cartão',
                        first: firstData.summary.cardSales,
                        second: secondData.summary.cardSales
                      },
                      {
                        name: 'Boleto',
                        first: firstData.summary.boletoSales,
                        second: secondData.summary.boletoSales
                      }
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip formatter={(value, name) => {
                        return [`${value} vendas`, name === 'first' ? getFirstLabel() : getSecondLabel()];
                      }} />
                      <Legend 
                        formatter={(value) => {
                          if (value === 'first') return getFirstLabel();
                          if (value === 'second') return getSecondLabel();
                          return value;
                        }}
                      />
                      <Bar dataKey="first" name="first" fill={PRIMARY_COLOR} />
                      <Bar dataKey="second" name="second" fill={SECONDARY_COLOR} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Comparativo de Valor: Cartão vs Boleto */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-4">
                  Comparativo de Valor: Cartão vs Boleto
                </h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[
                      {
                        name: 'Cartão',
                        first: firstData.summary.cardValue,
                        second: secondData.summary.cardValue
                      },
                      {
                        name: 'Boleto',
                        first: firstData.summary.boletoValue,
                        second: secondData.summary.boletoValue
                      }
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis tickFormatter={(value) => formatCurrency(value).slice(0, -3)} />
                      <Tooltip formatter={(value, name) => {
                        return [formatCurrency(value), name === 'first' ? getFirstLabel() : getSecondLabel()];
                      }} />
                      <Legend 
                        formatter={(value) => {
                          if (value === 'first') return getFirstLabel();
                          if (value === 'second') return getSecondLabel();
                          return value;
                        }}
                      />
                      <Bar dataKey="first" name="first" fill={PRIMARY_COLOR} />
                      <Bar dataKey="second" name="second" fill={SECONDARY_COLOR} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Se estiver comparando períodos, mostrar o gráfico diário */}
              {compareType === 'periods' && comparativeResults.dailyComparison && (
                <>
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 lg:col-span-2">
                    <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-4">
                      Comparativo de Vendas por Dia
                    </h3>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={comparativeResults.dailyComparison}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey="dayNumber" 
                            tickFormatter={(day) => `Dia ${day}`}
                          />
                          <YAxis />
                          <Tooltip 
                            formatter={(value, name) => {
                              return [`${value} vendas`, name.includes('first') ? getFirstLabel() : getSecondLabel()];
                            }}
                            labelFormatter={(day) => `Dia ${day}`}
                          />
                          <Legend 
                            formatter={(value) => {
                              if (value === 'firstSales') return getFirstLabel();
                              if (value === 'secondSales') return getSecondLabel();
                              return value;
                            }}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="firstSales" 
                            name="firstSales" 
                            stroke={PRIMARY_COLOR} 
                            strokeWidth={2} 
                            dot={true} 
                            activeDot={{ r: 6 }}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="secondSales" 
                            name="secondSales" 
                            stroke={SECONDARY_COLOR} 
                            strokeWidth={2} 
                            dot={true} 
                            activeDot={{ r: 6 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 lg:col-span-2">
                    <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-4">
                      Comparativo de Valor por Dia
                    </h3>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={comparativeResults.dailyComparison}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey="dayNumber" 
                            tickFormatter={(day) => `Dia ${day}`}
                          />
                          <YAxis tickFormatter={(value) => formatCurrency(value).slice(0, -3)} />
                          <Tooltip 
                            formatter={(value, name) => {
                              if (name.includes('Value')) return [formatCurrency(value), name.includes('first') ? getFirstLabel() : getSecondLabel()];
                              return [value, name.includes('first') ? getFirstLabel() : getSecondLabel()];
                            }}
                            labelFormatter={(day) => `Dia ${day}`}
                          />
                          <Legend 
                            formatter={(value) => {
                              if (value === 'firstValue') return `${getFirstLabel()} (valor)`;
                              if (value === 'secondValue') return `${getSecondLabel()} (valor)`;
                              return value;
                            }}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="firstValue" 
                            name="firstValue" 
                            fill={PRIMARY_COLOR} 
                            stroke={PRIMARY_COLOR} 
                            fillOpacity={0.3}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="secondValue" 
                            name="secondValue" 
                            fill={SECONDARY_COLOR} 
                            stroke={SECONDARY_COLOR} 
                            fillOpacity={0.3}
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Comparativo de Produtos */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
              <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-4">
                Comparativo por Produto
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Produto
                      </th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        {getFirstLabel()} (Qtd)
                      </th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        {getSecondLabel()} (Qtd)
                      </th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Diferença
                      </th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        {getFirstLabel()} (Valor)
                      </th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        {getSecondLabel()} (Valor)
                      </th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Diferença
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {comparativeResults.productComparison.map((product, index) => (
                      <tr key={index} className={index % 2 === 0 ? 'bg-gray-50 dark:bg-gray-700' : ''}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                          {product.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white text-right">
                          {product.firstQuantity}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white text-right">
                          {product.secondQuantity}
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium text-right ${getDiffStyle(product.quantityDiff)}`}>
                          {product.quantityDiff > 0 ? '+' : ''}{product.quantityDiff} 
                          ({formatPercentage(product.quantityPercentDiff)})
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white text-right">
                          {formatCurrency(product.firstValue)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white text-right">
                          {formatCurrency(product.secondValue)}
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium text-right ${getDiffStyle(product.valueDiff)}`}>
                          {product.valueDiff > 0 ? '+' : ''}{formatCurrency(product.valueDiff)} 
                          ({formatPercentage(product.valuePercentDiff)})
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Gráficos de Produto */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Top 5 Produtos por Quantidade */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-4">
                  Top 5 Produtos por Quantidade
                </h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart 
                      data={comparativeResults.productComparison
                        .sort((a, b) => (a.firstQuantity + a.secondQuantity) > (b.firstQuantity + b.secondQuantity) ? -1 : 1)
                        .slice(0, 5)
                      }
                      layout="vertical"
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis 
                        dataKey="name" 
                        type="category" 
                        width={150} 
                        tick={{ fontSize: 12 }}
                      />
                      <Tooltip formatter={(value, name) => {
                        return [`${value} vendas`, name === 'firstQuantity' ? getFirstLabel() : getSecondLabel()];
                      }} />
                      <Legend 
                        formatter={(value) => {
                          if (value === 'firstQuantity') return getFirstLabel();
                          if (value === 'secondQuantity') return getSecondLabel();
                          return value;
                        }}
                      />
                      <Bar dataKey="firstQuantity" name="firstQuantity" fill={PRIMARY_COLOR} />
                      <Bar dataKey="secondQuantity" name="secondQuantity" fill={SECONDARY_COLOR} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Top 5 Produtos por Valor */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-text-light dark:text-text-dark mb-4">
                  Top 5 Produtos por Valor
                </h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart 
                      data={comparativeResults.productComparison
                        .sort((a, b) => (a.firstValue + a.secondValue) > (b.firstValue + b.secondValue) ? -1 : 1)
                        .slice(0, 5)
                      }
                      layout="vertical"
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tickFormatter={(value) => formatCurrency(value).slice(0, -3)} />
                      <YAxis 
                        dataKey="name" 
                        type="category" 
                        width={150} 
                        tick={{ fontSize: 12 }}
                      />
                      <Tooltip formatter={(value, name) => {
                        return [formatCurrency(value), name === 'firstValue' ? getFirstLabel() : getSecondLabel()];
                      }} />
                      <Legend 
                        formatter={(value) => {
                          if (value === 'firstValue') return getFirstLabel();
                          if (value === 'secondValue') return getSecondLabel();
                          return value;
                        }}
                      />
                      <Bar dataKey="firstValue" name="firstValue" fill={PRIMARY_COLOR} />
                      <Bar dataKey="secondValue" name="secondValue" fill={SECONDARY_COLOR} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default ComparativoPage;