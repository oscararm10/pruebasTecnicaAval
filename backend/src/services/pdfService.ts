import PDFDocument from 'pdfkit';
import { Solicitud } from '../domain/types';

export async function buildEvidenciaPdf(solicitud: Solicitud): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).text('Evidencia de Aprobación', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Solicitud ID: ${solicitud.id}`);
    doc.text(`Título: ${solicitud.titulo}`);
    doc.text(`Descripción: ${solicitud.descripcion}`);
    doc.text(`Monto: $${solicitud.monto.toLocaleString('es-CO')}`);
    doc.text(`Solicitante: ${solicitud.solicitante}`);
    doc.text(`Fecha de creación: ${formatDate(solicitud.createdAt)}`);
    doc.text(`Estado: ${solicitud.estado}`);
    doc.moveDown();

    doc.fontSize(14).text('Aprobadores y firmas', { underline: true });
    doc.moveDown(0.5);

    for (const aprobador of solicitud.aprobadores) {
      doc.fontSize(12).text(`Rol: ${aprobador.rol}`);
      doc.text(`Nombre: ${aprobador.nombre}`);
      doc.text(`Email: ${aprobador.email}`);
      doc.text(`Estado: ${aprobador.estado}`);
      if (aprobador.firma) {
        doc.text(`Firma: ${aprobador.firma.nombre}`);
        doc.text(`Fecha firma: ${formatDate(aprobador.firma.fecha)}`);
        drawSimulatedSignature(doc, aprobador.firma.nombre);
      }
      doc.moveDown();
    }

    doc.moveDown();
    doc.fontSize(10).fillColor('#666').text(
      `Documento generado automáticamente el ${formatDate(new Date().toISOString())}`,
      { align: 'center' }
    );

    doc.end();
  });
}

function drawSimulatedSignature(doc: PDFKit.PDFDocument, name: string): void {
  const x = doc.x;
  const y = doc.y;
  doc.save();
  doc.fontSize(16).fillColor('#1a4a8a').font('Times-Italic').text(name, x, y + 4);
  doc.strokeColor('#1a4a8a').lineWidth(1);
  doc.moveTo(x, y + 28).lineTo(x + 160, y + 28).stroke();
  doc.restore();
  doc.fillColor('#000').font('Helvetica').fontSize(12);
  doc.moveDown(2);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'medium',
  });
}
