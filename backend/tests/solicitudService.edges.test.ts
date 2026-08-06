import {
  InMemoryMailStore,
  InMemoryPdfStore,
  InMemorySolicitudStore,
} from '../src/repositories/inMemoryStore';
import { BusinessError, NotFoundError, SolicitudService } from '../src/services/solicitudService';
import { CreateSolicitudDto } from '../src/domain/types';

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

describe('SolicitudService edge cases', () => {
  it('valida campos obligatorios', async () => {
    const { service } = buildService();
    await expect(service.create({ ...validDto, titulo: ' ' })).rejects.toBeInstanceOf(BusinessError);
    await expect(service.create({ ...validDto, descripcion: '' })).rejects.toBeInstanceOf(BusinessError);
    await expect(service.create({ ...validDto, monto: 0 })).rejects.toBeInstanceOf(BusinessError);
    await expect(service.create({ ...validDto, solicitante: '' })).rejects.toBeInstanceOf(BusinessError);
    await expect(
      service.create({ ...validDto, aprobadores: validDto.aprobadores.slice(0, 2) })
    ).rejects.toBeInstanceOf(BusinessError);
    await expect(
      service.create({
        ...validDto,
        aprobadores: [
          ...validDto.aprobadores.slice(0, 2),
          { nombre: '', email: 'x@y.com', rol: 'Legal' },
        ],
      })
    ).rejects.toBeInstanceOf(BusinessError);
    await expect(
      service.create({
        ...validDto,
        aprobadores: [
          ...validDto.aprobadores.slice(0, 2),
          { nombre: 'X', email: 'no-email', rol: 'Legal' },
        ],
      })
    ).rejects.toBeInstanceOf(BusinessError);
  });

  it('getById y getEvidencia fallan si no existe', async () => {
    const { service } = buildService();
    await expect(service.getById('missing')).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.getEvidencia('missing')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('challenge con token inválido', async () => {
    const { service } = buildService();
    await expect(service.getChallenge('bad')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('challenge cuando ya firmó no exige OTP', async () => {
    const { service, mails } = buildService();
    const { solicitud } = await service.create(validDto);
    const token = solicitud.aprobadores[0].token;
    await service.getChallenge(token);
    const otp = (await mails.findAll()).find((m) => m.subject.includes('OTP'))!.otp;
    await service.validateOtp(token, otp);
    await service.decide(token, 'aprobar');

    const challenge = await service.getChallenge(token);
    expect(challenge.requiresOtp).toBe(false);
    expect(challenge.otpHint).toContain('Firmado');
  });

  it('decide sin sesión OTP falla', async () => {
    const { service } = buildService();
    const { solicitud } = await service.create(validDto);
    await expect(service.decide(solicitud.aprobadores[0].token, 'aprobar')).rejects.toBeInstanceOf(
      BusinessError
    );
  });

  it('evidencia no disponible si no está completada', async () => {
    const { service } = buildService();
    const { solicitud } = await service.create(validDto);
    await expect(service.getEvidencia(solicitud.id)).rejects.toBeInstanceOf(BusinessError);
  });

  it('listMails filtra por solicitud', async () => {
    const { service } = buildService();
    const a = await service.create(validDto);
    const b = await service.create({ ...validDto, titulo: 'Otra' });
    const mailsA = await service.listMails(a.solicitud.id);
    expect(mailsA.every((m) => m.solicitudId === a.solicitud.id)).toBe(true);
    expect((await service.listMails()).length).toBeGreaterThanOrEqual(6);
    expect(b.solicitud.id).toBeTruthy();
  });
});
