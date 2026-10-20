import { supabase } from '../lib/supabase';
import { DailyYield } from '../types';
import { todayISO } from '../utils/formatters';

export const yieldService = {
  // Obtener historial de rendimientos diarios de una cuenta
  async getByAccount(accountId: string): Promise<DailyYield[]> {
    const { data, error } = await supabase
      .from('daily_yields')
      .select('*')
      .eq('account_id', accountId)
      .order('date', { ascending: false });

    if (error) throw error;
    return (data ?? []) as DailyYield[];
  },

  // Registrar liquidación de rendimiento diario
  async registerYield(
    userId: string,
    accountId: string,
    balance: number,
    yieldRate: number
  ): Promise<DailyYield> {
    const yieldAmount = Math.round(balance * yieldRate * 100) / 100;
    const date = todayISO();

    // 1. Insertar en daily_yields
    const { data, error } = await supabase
      .from('daily_yields')
      .insert({
        user_id: userId,
        account_id: accountId,
        date,
        balance,
        yield_rate: yieldRate,
        yield_amount: yieldAmount,
      })
      .select()
      .single();

    if (error) throw error;

    // 2. Registrar movimiento de ingreso para sumar al balance atómicamente
    await supabase.from('transactions').insert({
      user_id: userId,
      account_id: accountId,
      type: 'income',
      amount: yieldAmount,
      currency: 'ARS',
      description: 'Rendimiento diario (Mercado Fondo / Billetera)',
      date,
    });

    return data as DailyYield;
  },

  // Simular rendimientos estimados basados en saldo y tasa
  simulate(balance: number, dailyRate: number) {
    const dailyGain = balance * dailyRate;
    const monthlyGain = dailyGain * 30;
    const annualGain = balance * (Math.pow(1 + dailyRate, 365) - 1);

    return {
      dailyGain: Math.round(dailyGain * 100) / 100,
      monthlyGain: Math.round(monthlyGain * 100) / 100,
      annualGain: Math.round(annualGain * 100) / 100,
      tna: Math.round(dailyRate * 365 * 10000) / 100, // Tasa Nominal Anual estimada (%)
    };
  },
};
