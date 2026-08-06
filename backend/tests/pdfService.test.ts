import { buildEvidenciaPdf } from '../src/services/pdfService';
import { Solicitud } from '../src/domain/types';

describe('pdfService', () => {
  it('genera un buffer PDF con datos de solicitud y firmas', async () => {
    const solicitud: Solicitud = {
      id: 'sol-1',
      titulo: 'Compra servidores',
      descripcion: 'Infraestructura cloud',
      monto: 1000,
      solicitante: 'Ana',
      estado: 'Completada',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      aprobadores: [
        {
          id: '1',
          nombre: 'Carlos',
          email: 'c@e.com',
          rol: 'Gerente',
          token: 't1',
          estado: 'Firmado',
          firma: { nombre: 'Carlos', fecha: new Date().toISOString() },
        },
        {
          id: '2',
          nombre: 'Laura',
          email: 'l@e.com',
          rol: 'Finanzas',
          token: 't2',
          estado: 'Firmado',
          firma: { nombre: 'Laura', fecha: new Date().toISOString() },
        },
        {
          id: '3',
          nombre: 'Pedro',
          email: 'p@e.com',
          rol: 'Compras',
          token: 't3',
          estado: 'Firmado',
          firma: { nombre: 'Pedro', fecha: new Date().toISOString() },
        },
      ],
    };

    const pdf = await buildEvidenciaPdf(solicitud);
    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
    expect(pdf.length).toBeGreaterThan(500);
  });
});
