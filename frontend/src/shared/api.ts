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

const approveChallengeInflight = new Map<string, Promise<ApproveChallenge>>();

export async function getApproveChallenge(
  token: string
): Promise<ApproveChallenge> {
  const existing = approveChallengeInflight.get(token);
  if (existing) return existing;

  const request = api
    .get('/api/approve', {
      params: { approver_token: token },
    })
    .then(({ data }) => data as ApproveChallenge)
    .finally(() => {
      approveChallengeInflight.delete(token);
    });

  approveChallengeInflight.set(token, request);
  return request;
}

export async function validateOtp(
  token: string,
  otp: string
): Promise<{ sessionValidUntil: string; solicitud: Solicitud }> {
  const { data } = await api.post('/api/approve/otp', {
    approver_token: token,
    otp: String(otp).trim(),
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
  const base = (process.env.API_BASE_URL || '').replace(/\/$/, '');
  return `${base}/api/solicitudes/${id}/evidencia.pdf`;
}

/**
 * Descarga el PDF como blob (Accept: application/pdf) para que API Gateway
 * trate bien el binario y no se guarde el base64 como archivo corrupto.
 */
export async function downloadEvidencia(id: string): Promise<void> {
  const response = await api.get(`/api/solicitudes/${id}/evidencia.pdf`, {
    responseType: 'arraybuffer',
    headers: { Accept: 'application/pdf' },
  });

  let bytes = new Uint8Array(response.data as ArrayBuffer);

  // Si API Gateway no decodificó, el cuerpo llega como texto base64 (JVBERi...).
  const asText = new TextDecoder().decode(bytes.subarray(0, 20));
  if (asText.startsWith('JVBERi')) {
    const base64 = new TextDecoder().decode(bytes).replace(/\s/g, '');
    const bin = atob(base64);
    bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  }

  const header = new TextDecoder().decode(bytes.subarray(0, 4));
  if (header !== '%PDF') {
    let message = 'El archivo PDF recibido está corrupto o incompleto';
    try {
      const err = JSON.parse(new TextDecoder().decode(bytes)) as { error?: string };
      if (err.error) message = err.error;
    } catch {
      // no es JSON
    }
    throw new Error(message);
  }

  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `evidencia-${id}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
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
