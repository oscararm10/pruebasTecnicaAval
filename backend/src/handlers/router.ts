import { APIGatewayProxyHandler } from 'aws-lambda';
import * as api from './api';

/**
 * Router único para API Gateway (proxy {proxy+}).
 * Facilita despliegue SAM con una sola Lambda.
 */
export const handler: APIGatewayProxyHandler = async (event) => {
  const method = event.httpMethod.toUpperCase();
  const path = normalizePath(event.path);

  if (method === 'OPTIONS') {
    return api.options();
  }

  if (method === 'POST' && path === '/api/solicitudes') {
    return api.createSolicitud(event);
  }
  if (method === 'GET' && path === '/api/solicitudes') {
    return api.listSolicitudes();
  }
  if (method === 'GET' && /^\/api\/solicitudes\/[^/]+$/.test(path)) {
    event.pathParameters = { id: path.split('/').pop()! };
    return api.getSolicitud(event);
  }
  if (method === 'GET' && /^\/api\/solicitudes\/[^/]+\/evidencia\.pdf$/.test(path)) {
    const parts = path.split('/');
    event.pathParameters = { id: parts[3] };
    return api.downloadEvidencia(event);
  }
  if (method === 'GET' && path === '/api/approve') {
    return api.getApproveChallenge(event);
  }
  if (method === 'POST' && path === '/api/approve/otp') {
    return api.validateOtp(event);
  }
  if (method === 'POST' && path === '/api/approve/decision') {
    return api.decideAprobacion(event);
  }
  if (method === 'GET' && (path === '/api/mock-mail' || path === '/mock-mail')) {
    return api.mockMail(event);
  }

  return {
    statusCode: 404,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ error: `Ruta no encontrada: ${method} ${path}` }),
  };
};

function normalizePath(path: string): string {
  const withoutStage = path.replace(/^\/Prod/, '').replace(/^\/Stage/, '');
  return withoutStage.endsWith('/') && withoutStage.length > 1
    ? withoutStage.slice(0, -1)
    : withoutStage;
}
