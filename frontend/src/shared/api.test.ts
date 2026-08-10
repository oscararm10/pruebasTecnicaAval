import {
  formatDate,
  formatMoney,
  getErrorMessage,
  evidenciaUrl,
} from './api';

describe('api helpers', () => {
  it('formatea moneda COP', () => {
    const value = formatMoney(1500000);
    expect(value).toContain('1');
    expect(value.length).toBeGreaterThan(3);
  });

  it('formatea fecha', () => {
    const value = formatDate('2026-08-06T15:00:00.000Z');
    expect(value.length).toBeGreaterThan(5);
  });

  it('arma url de evidencia con base relativa por defecto', () => {
    expect(evidenciaUrl('abc')).toBe('/api/solicitudes/abc/evidencia.pdf');
  });

  it('extrae mensaje de error', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('boom');
    expect(getErrorMessage('x')).toBe('Error inesperado');
  });
});
