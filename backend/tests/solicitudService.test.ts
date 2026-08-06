import {
  InMemoryMailStore,
  InMemoryPdfStore,
  InMemorySolicitudStore,
} from '../src/repositories/inMemoryStore';
import { BusinessError, SolicitudService } from '../src/services/solicitudService';
import { CreateSolicitudDto } from '../src/domain/types';
import { hashOtp } from '../src/shared/otp';

function buildService() {
  const solicitudes = new InMemorySolicitudStore();
  const mails = new InMemoryMailStore();
  const pdfs = new InMemoryPdfStore();
  const service = new SolicitudService(
    solicitudes,
    mails,
    pdfs,
    'http://localhost:3000'
  );
  return { service, solicitudes, mails, pdfs };
}

const validDto: CreateSolicitudDto = {
  titulo: 'Laptops desarrollo',
  descripcion: 'Compra de 10 laptops',
  monto: 25000000,
  solicitante: 'Ana Pérez',
  aprobadores: [
    { nombre: 'Carlos Ruiz', email: 'carlos@empresa.com', rol: 'Gerente' },
    { nombre: 'Laura Gómez', email: 'laura@empresa.com', rol: 'Finanzas' },
    { nombre: 'Pedro Díaz', email: 'pedro@empresa.com', rol: 'Compras' },
  ],
};

describe('SolicitudService', () => {
  it('crea solicitud pendiente y simula 3 mails', async () => {
    const { service, mails } = buildService();
    const { solicitud } = await service.create(validDto);

    expect(solicitud.estado).toBe('Pendiente');
    expect(solicitud.aprobadores).toHaveLength(3);
    expect(solicitud.aprobadores.every((a) => a.estado === 'Pendiente')).toBe(true);

    const storedMails = await mails.findAll();
    expect(storedMails).toHaveLength(3);
    expect(storedMails[0].link).toContain('approver_token=');
  });

  it('rechaza crear con roles duplicados', async () => {
    const { service } = buildService();
    await expect(
      service.create({
        ...validDto,
        aprobadores: validDto.aprobadores.map((a, i) =>
          i === 1 ? { ...a, rol: 'Gerente' } : a
        ),
      })
    ).rejects.toBeInstanceOf(BusinessError);
  });

  it('valida OTP y permite firmar hasta completar PDF', async () => {
    const { service, solicitudes, mails, pdfs } = buildService();
    const { solicitud } = await service.create(validDto);
    const tokens = solicitud.aprobadores.map((a) => a.token);

    for (const token of tokens) {
      await service.getChallenge(token);
      const mail = (await mails.findAll()).find((m) => m.link.includes(token) || m.otp);
      const latestOtpMail = (await mails.findAll()).find((m) => m.subject.includes('OTP'));
      const otp = latestOtpMail!.otp;

      await service.validateOtp(token, otp);
      await service.decide(token, 'aprobar');
    }

    const completed = await service.getById(solicitud.id);
    expect(completed.estado).toBe('Completada');
    expect(completed.evidenciaKey).toBeTruthy();

    const evidencia = await service.getEvidencia(solicitud.id);
    expect(evidencia.buffer.length).toBeGreaterThan(100);
    expect(evidencia.filename).toContain(solicitud.id);

    const stored = await solicitudes.findById(solicitud.id);
    expect(stored?.aprobadores.every((a) => a.estado === 'Firmado')).toBe(true);
    const pdf = await pdfs.get(stored!.evidenciaKey!);
    expect(pdf).not.toBeNull();
  });

  it('marca solicitud como rechazada si un aprobador rechaza', async () => {
    const { service, mails } = buildService();
    const { solicitud } = await service.create(validDto);
    const token = solicitud.aprobadores[0].token;

    await service.getChallenge(token);
    const otpMail = (await mails.findAll()).find((m) => m.subject.includes('OTP'));
    await service.validateOtp(token, otpMail!.otp);
    const updated = await service.decide(token, 'rechazar');

    expect(updated.estado).toBe('Rechazada');
    expect(updated.aprobadores[0].estado).toBe('Rechazado');
  });

  it('falla con OTP incorrecto o expirado', async () => {
    const { service, solicitudes } = buildService();
    const { solicitud } = await service.create(validDto);
    const token = solicitud.aprobadores[0].token;

    await service.getChallenge(token);
    await expect(service.validateOtp(token, '000000')).rejects.toBeInstanceOf(BusinessError);

    const stored = await solicitudes.findById(solicitud.id);
    stored!.aprobadores[0].otpExpiresAt = new Date(Date.now() - 1000).toISOString();
    stored!.aprobadores[0].otpHash = hashOtp('111111');
    await solicitudes.update(stored!);

    await expect(service.validateOtp(token, '111111')).rejects.toBeInstanceOf(BusinessError);
  });

  it('lista solicitudes', async () => {
    const { service } = buildService();
    await service.create(validDto);
    await service.create({ ...validDto, titulo: 'Otra' });
    const list = await service.list();
    expect(list.length).toBe(2);
  });
});
