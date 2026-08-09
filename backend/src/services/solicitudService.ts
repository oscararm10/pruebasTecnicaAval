import { v4 as uuidv4 } from 'uuid';
import { Aprobador, CreateSolicitudDto, MockMail, Solicitud } from '../domain/types';
import { MailStore, PdfStore, SolicitudStore } from '../repositories/interfaces';
import { generateOtp, hashOtp, otpExpiryIso } from '../shared/otp';
import { buildEvidenciaPdf } from './pdfService';

export class SolicitudService {
  constructor(
    private readonly solicitudes: SolicitudStore,
    private readonly mails: MailStore,
    private readonly pdfs: PdfStore,
    private readonly baseUrl: string
  ) {}

  async create(dto: CreateSolicitudDto): Promise<{ solicitud: Solicitud; mails: MockMail[] }> {
    this.validateCreate(dto);

    const now = new Date().toISOString();
    const id = uuidv4();

    const aprobadores: Aprobador[] = dto.aprobadores.map((a) => ({
      id: uuidv4(),
      nombre: a.nombre.trim(),
      email: a.email.trim().toLowerCase(),
      rol: a.rol.trim(),
      token: uuidv4(),
      estado: 'Pendiente',
    }));

    const solicitud: Solicitud = {
      id,
      titulo: dto.titulo.trim(),
      descripcion: dto.descripcion.trim(),
      monto: dto.monto,
      solicitante: dto.solicitante.trim(),
      estado: 'Pendiente',
      aprobadores,
      createdAt: now,
      updatedAt: now,
    };

    await this.solicitudes.save(solicitud);
    const mails = await this.sendApprovalMails(solicitud);
    return { solicitud: this.toPublic(solicitud), mails };
  }

  async list(): Promise<Solicitud[]> {
    const items = await this.solicitudes.findAll();
    return items.map((s) => this.toPublic(s));
  }

  async getById(id: string): Promise<Solicitud> {
    const solicitud = await this.solicitudes.findById(id);
    if (!solicitud) throw new NotFoundError('Solicitud no encontrada');
    return this.toPublic(solicitud);
  }

  async getChallenge(token: string): Promise<{
    solicitudId: string;
    aprobadorNombre: string;
    aprobadorRol: string;
    requiresOtp: boolean;
    otpHint: string;
  }> {
    const found = await this.solicitudes.findByApproverToken(token);
    if (!found) throw new NotFoundError('Token de aprobación inválido');

    const aprobador = found.solicitud.aprobadores.find((a) => a.id === found.aprobadorId);
    if (!aprobador) throw new NotFoundError('Aprobador no encontrado');

    if (aprobador.estado !== 'Pendiente') {
      return {
        solicitudId: found.solicitud.id,
        aprobadorNombre: aprobador.nombre,
        aprobadorRol: aprobador.rol,
        requiresOtp: false,
        otpHint: `Ya respondió: ${aprobador.estado}`,
      };
    }

    const otpStillValid =
      !!aprobador.otpHash &&
      !!aprobador.otpExpiresAt &&
      new Date(aprobador.otpExpiresAt).getTime() > Date.now();

    // Reutilizar OTP vigente evita invalidar el código por dobles GET
    // (p. ej. React Strict Mode en desarrollo) o al refrescar el link.
    if (!otpStillValid) {
      const otp = generateOtp();
      aprobador.otpHash = hashOtp(otp);
      aprobador.otpExpiresAt = otpExpiryIso();
      found.solicitud.updatedAt = new Date().toISOString();
      await this.solicitudes.update(found.solicitud);

      await this.mails.save({
        id: uuidv4(),
        to: aprobador.email,
        subject: `OTP para aprobar: ${found.solicitud.titulo}`,
        body: `Su código OTP es ${otp}. Válido por 3 minutos.`,
        link: '',
        otp,
        solicitudId: found.solicitud.id,
        createdAt: new Date().toISOString(),
      });
    }

    return {
      solicitudId: found.solicitud.id,
      aprobadorNombre: aprobador.nombre,
      aprobadorRol: aprobador.rol,
      requiresOtp: true,
      otpHint: otpStillValid
        ? 'OTP vigente (use el más reciente en /api/mock-mail). Válido 3 minutos.'
        : 'OTP enviado (ver /api/mock-mail). Válido 3 minutos.',
    };
  }

  async validateOtp(token: string, otp: string): Promise<{
    sessionValidUntil: string;
    solicitud: Solicitud;
  }> {
    const normalizedOtp = String(otp ?? '').trim();
    const found = await this.solicitudes.findByApproverToken(token);
    if (!found) throw new NotFoundError('Token de aprobación inválido');

    const aprobador = found.solicitud.aprobadores.find((a) => a.id === found.aprobadorId);
    if (!aprobador) throw new NotFoundError('Aprobador no encontrado');
    if (aprobador.estado !== 'Pendiente') {
      throw new BusinessError('El aprobador ya respondió esta solicitud');
    }
    if (!aprobador.otpHash || !aprobador.otpExpiresAt) {
      throw new BusinessError('Debe solicitar un OTP primero');
    }
    if (new Date(aprobador.otpExpiresAt).getTime() <= Date.now()) {
      throw new BusinessError('OTP expirado. Solicite uno nuevo abriendo el link.');
    }
    if (!normalizedOtp || hashOtp(normalizedOtp) !== aprobador.otpHash) {
      throw new BusinessError('OTP incorrecto');
    }

    const sessionValidUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    aprobador.otpSessionValidUntil = sessionValidUntil;
    aprobador.otpHash = undefined;
    aprobador.otpExpiresAt = undefined;
    found.solicitud.updatedAt = new Date().toISOString();
    await this.solicitudes.update(found.solicitud);

    return {
      sessionValidUntil,
      solicitud: this.toPublic(found.solicitud),
    };
  }

  async decide(
    token: string,
    decision: 'aprobar' | 'rechazar'
  ): Promise<Solicitud> {
    const found = await this.solicitudes.findByApproverToken(token);
    if (!found) throw new NotFoundError('Token de aprobación inválido');

    const { solicitud, aprobadorId } = found;
    const aprobador = solicitud.aprobadores.find((a) => a.id === aprobadorId);
    if (!aprobador) throw new NotFoundError('Aprobador no encontrado');

    if (aprobador.estado !== 'Pendiente') {
      throw new BusinessError('El aprobador ya respondió esta solicitud');
    }
    if (
      !aprobador.otpSessionValidUntil ||
      new Date(aprobador.otpSessionValidUntil).getTime() <= Date.now()
    ) {
      throw new BusinessError('Sesión OTP inválida o expirada. Valide el OTP nuevamente.');
    }
    if (solicitud.estado !== 'Pendiente') {
      throw new BusinessError(`La solicitud ya está en estado ${solicitud.estado}`);
    }

    const now = new Date().toISOString();

    if (decision === 'rechazar') {
      aprobador.estado = 'Rechazado';
      aprobador.firma = { nombre: aprobador.nombre, fecha: now };
      solicitud.estado = 'Rechazada';
    } else {
      aprobador.estado = 'Firmado';
      aprobador.firma = {
        nombre: aprobador.nombre,
        fecha: now,
        imagenSimulada: `signature://${aprobador.nombre}`,
      };

      const allSigned = solicitud.aprobadores.every((a) => a.estado === 'Firmado');
      if (allSigned) {
        const pdf = await buildEvidenciaPdf({ ...solicitud, estado: 'Completada' });
        const key = `evidencias/${solicitud.id}.pdf`;
        await this.pdfs.save(key, pdf);
        solicitud.evidenciaKey = key;
        solicitud.estado = 'Completada';
      }
    }

    aprobador.otpSessionValidUntil = undefined;
    solicitud.updatedAt = now;
    await this.solicitudes.update(solicitud);
    return this.toPublic(solicitud);
  }

  async getEvidencia(id: string): Promise<{ buffer: Buffer; filename: string }> {
    const solicitud = await this.solicitudes.findById(id);
    if (!solicitud) throw new NotFoundError('Solicitud no encontrada');
    if (!solicitud.evidenciaKey || solicitud.estado !== 'Completada') {
      throw new BusinessError('La evidencia PDF aún no está disponible');
    }
    const buffer = await this.pdfs.get(solicitud.evidenciaKey);
    if (!buffer) throw new NotFoundError('PDF no encontrado en almacenamiento');
    return { buffer, filename: `evidencia-${id}.pdf` };
  }

  async listMails(solicitudId?: string): Promise<MockMail[]> {
    if (solicitudId) return this.mails.findBySolicitud(solicitudId);
    return this.mails.findAll();
  }

  private async sendApprovalMails(solicitud: Solicitud): Promise<MockMail[]> {
    const sent: MockMail[] = [];
    for (const aprobador of solicitud.aprobadores) {
      const otp = generateOtp();
      aprobador.otpHash = hashOtp(otp);
      aprobador.otpExpiresAt = otpExpiryIso();

      const link = `${this.baseUrl}/approve?solicitud_id=${solicitud.id}&approver_token=${aprobador.token}`;
      const mail: MockMail = {
        id: uuidv4(),
        to: aprobador.email,
        subject: `Aprobación requerida: ${solicitud.titulo}`,
        body: [
          `Hola ${aprobador.nombre},`,
          '',
          `Se requiere su aprobación (${aprobador.rol}) para la solicitud "${solicitud.titulo}".`,
          `Monto: $${solicitud.monto.toLocaleString('es-CO')}`,
          '',
          `Link de aprobación: ${link}`,
          `OTP inicial: ${otp} (válido 3 minutos; al abrir el link se regenera).`,
        ].join('\n'),
        link,
        otp,
        solicitudId: solicitud.id,
        createdAt: new Date().toISOString(),
      };
      await this.mails.save(mail);
      sent.push(mail);
    }
    await this.solicitudes.update(solicitud);
    return sent;
  }

  private validateCreate(dto: CreateSolicitudDto): void {
    if (!dto.titulo?.trim()) throw new BusinessError('El título es obligatorio');
    if (!dto.descripcion?.trim()) throw new BusinessError('La descripción es obligatoria');
    if (typeof dto.monto !== 'number' || dto.monto <= 0) {
      throw new BusinessError('El monto debe ser un número mayor a 0');
    }
    if (!dto.solicitante?.trim()) throw new BusinessError('El solicitante es obligatorio');
    if (!Array.isArray(dto.aprobadores) || dto.aprobadores.length !== 3) {
      throw new BusinessError('Debe seleccionar exactamente 3 aprobadores');
    }

    const roles = dto.aprobadores.map((a) => a.rol.trim().toLowerCase());
    if (new Set(roles).size !== 3) {
      throw new BusinessError('Los 3 aprobadores deben tener roles distintos');
    }

    for (const a of dto.aprobadores) {
      if (!a.nombre?.trim() || !a.email?.trim() || !a.rol?.trim()) {
        throw new BusinessError('Cada aprobador requiere nombre, email y rol');
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email)) {
        throw new BusinessError(`Email inválido: ${a.email}`);
      }
    }
  }

  private toPublic(solicitud: Solicitud): Solicitud {
    return {
      ...solicitud,
      aprobadores: solicitud.aprobadores.map((a) => ({
        id: a.id,
        nombre: a.nombre,
        email: a.email,
        rol: a.rol,
        token: a.token,
        estado: a.estado,
        firma: a.firma,
      })),
    };
  }
}

export class BusinessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BusinessError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}
