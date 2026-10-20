jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

import { yieldService } from '../yieldService';

describe('Yield Service — Simulation Unit Tests', () => {
  it('debe calcular correctamente el rendimiento diario y mensual', () => {
    // Ejemplo: $100.000 con tasa diaria 0.0009 (0.09% diario ~ 32.85% TNA)
    const simulation = yieldService.simulate(100000, 0.0009);

    expect(simulation.dailyGain).toBe(90);
    expect(simulation.monthlyGain).toBe(2700);
    expect(simulation.tna).toBeCloseTo(32.85, 1);
  });

  it('debe calcular ganancia cero si el saldo es cero', () => {
    const simulation = yieldService.simulate(0, 0.0009);

    expect(simulation.dailyGain).toBe(0);
    expect(simulation.monthlyGain).toBe(0);
    expect(simulation.annualGain).toBe(0);
  });
});
