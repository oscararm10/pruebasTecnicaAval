export type SolicitudEstado = 'Pendiente' | 'Completada' | 'Rechazada';
export type AprobadorEstado = 'Pendiente' | 'Firmado' | 'Rechazado';

export interface Firma {
  nombre: string;
  fecha: string;
  imagenSimulada?: string;
}

export interface Aprobador {
  id: string;
  nombre: string;
  email: string;
  rol: string;
  token: string;
  estado: AprobadorEstado;
  firma?: Firma;
}

export interface Solicitud {
  id: string;
  titulo: string;
  descripcion: string;
  monto: number;
  solicitante: string;
  estado: SolicitudEstado;
  aprobadores: Aprobador[];
  createdAt: string;
  updatedAt: string;
  evidenciaKey?: string;
}

export interface AprobadorInput {
  nombre: string;
  email: string;
  rol: string;
}

export interface CreateSolicitudPayload {
  titulo: string;
  descripcion: string;
  monto: number;
  solicitante: string;
  aprobadores: AprobadorInput[];
}

export interface MockMail {
  id: string;
  to: string;
  subject: string;
  body: string;
  link: string;
  otp: string;
  solicitudId: string;
  createdAt: string;
}

export interface ApproveChallenge {
  solicitudId: string;
  aprobadorNombre: string;
  aprobadorRol: string;
  requiresOtp: boolean;
  otpHint: string;
}
