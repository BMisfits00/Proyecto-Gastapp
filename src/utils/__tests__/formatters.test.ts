import { formatCurrency, todayISO } from '../formatters';

describe('Formatters — Unit Test Suite', () => {
  describe('formatCurrency', () => {
    it('debe formatear números a moneda sin decimales extras', () => {
      const formatted = formatCurrency(15000, 'ARS');
      expect(formatted).toContain('15.000');
    });

    it('debe manejar montos cero correctamente', () => {
      const formatted = formatCurrency(0, 'ARS');
      expect(formatted).toContain('0');
    });
  });

  describe('todayISO', () => {
    it('debe retornar fecha con formato YYYY-MM-DD', () => {
      const date = todayISO();
      expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });
});
