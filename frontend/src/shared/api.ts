import axios from 'axios';
import {
  ApproveChallenge,
  CreateSolicitudPayload,
  MockMail,
  Solicitud,
} from './types';

const api = axios.create({
  baseURL: process.env.API_BASE_URL || '',
  headers: { 'Content-Type': 'application/json' },
});

export async function createSolicitud(
  payload: CreateSolicitudPayload
): Promise<{ solicitud: Solicitud; mails: MockMail[] }> {
  const { data } = await api.post('/api/solicitudes', payload);
  return data;
}

export async function listSolicitudes(): Promise<Solicitud[]> {
  const { data } = await api.get('/api/solicitudes');
  return data.items;
}

export async function getSolicitud(id: string): Promise<Solicitud> {
  const { data } = await api.get(`/api/solicitudes/${id}`);
  return data;
}

export async function getApproveChallenge(
  token: string
): Promise<ApproveChallenge> {
  const { data } = await api.get('/api/approve', {
    params: { approver_token: token },
  });
  return data;
}

export async function validateOtp(
  token: string,
  otp: string
): Promise<{ sessionValidUntil: string; solicitud: Solicitud }> {
  const { data } = await api.post('/api/approve/otp', {
    approver_token: token,
    otp,
  });
  return data;
}

export async function decideAprobacion(
  token: string,
  decision: 'aprobar' | 'rechazar'
): Promise<Solicitud> {
  const { data } = await api.post('/api/approve/decision', {
    approver_token: token,
    decision,
  });
  return data;
}

export async function listMockMails(solicitudId?: string): Promise<MockMail[]> {
  const { data } = await api.get('/api/mock-mail', {
    params: solicitudId ? { solicitud_id: solicitudId } : undefined,
  });
  return data.items;
}

export function evidenciaUrl(id: string): string {
  return `/api/solicitudes/${id}/evidencia.pdf`;
}

export function formatMoney(value: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    return (error.response?.data as { error?: string })?.error || error.message;
  }
  if (error instanceof Error) return error.message;
  return 'Error inesperado';
}
