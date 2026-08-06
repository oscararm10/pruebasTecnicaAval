import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createService } from '../shared/container';
import { fail, ok, parseBody, pdfResponse } from '../shared/response';
import { BusinessError, NotFoundError } from '../services/solicitudService';
import { CreateSolicitudDto } from '../domain/types';

function handleError(error: unknown): APIGatewayProxyResult {
  if (error instanceof NotFoundError) return fail(error.message, 404);
  if (error instanceof BusinessError) return fail(error.message, 400);
  console.error(error);
  return fail(error instanceof Error ? error.message : 'Error interno', 500);
}

export async function createSolicitud(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const dto = parseBody<CreateSolicitudDto>(event.body);
    const result = await createService().create(dto);
    return ok(result, 201);
  } catch (error) {
    return handleError(error);
  }
}

export async function listSolicitudes(): Promise<APIGatewayProxyResult> {
  try {
    const items = await createService().list();
    return ok({ items });
  } catch (error) {
    return handleError(error);
  }
}

export async function getSolicitud(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const id = event.pathParameters?.id;
    if (!id) return fail('id es requerido', 400);
    const solicitud = await createService().getById(id);
    return ok(solicitud);
  } catch (error) {
    return handleError(error);
  }
}

export async function getApproveChallenge(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const token = event.queryStringParameters?.approver_token;
    if (!token) return fail('approver_token es requerido', 400);
    const challenge = await createService().getChallenge(token);
    return ok(challenge);
  } catch (error) {
    return handleError(error);
  }
}

export async function validateOtp(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const body = parseBody<{ approver_token: string; otp: string }>(event.body);
    if (!body.approver_token || !body.otp) {
      return fail('approver_token y otp son requeridos', 400);
    }
    const result = await createService().validateOtp(body.approver_token, body.otp);
    return ok(result);
  } catch (error) {
    return handleError(error);
  }
}

export async function decideAprobacion(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const body = parseBody<{
      approver_token: string;
      decision: 'aprobar' | 'rechazar';
    }>(event.body);
    if (!body.approver_token || !['aprobar', 'rechazar'].includes(body.decision)) {
      return fail('approver_token y decision (aprobar|rechazar) son requeridos', 400);
    }
    const solicitud = await createService().decide(body.approver_token, body.decision);
    return ok(solicitud);
  } catch (error) {
    return handleError(error);
  }
}

export async function downloadEvidencia(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const id = event.pathParameters?.id;
    if (!id) return fail('id es requerido', 400);
    const { buffer, filename } = await createService().getEvidencia(id);
    return pdfResponse(buffer, filename);
  } catch (error) {
    return handleError(error);
  }
}

export async function mockMail(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const solicitudId = event.queryStringParameters?.solicitud_id;
    const mails = await createService().listMails(solicitudId || undefined);
    return ok({ items: mails });
  } catch (error) {
    return handleError(error);
  }
}

export async function options(): Promise<APIGatewayProxyResult> {
  return ok({ ok: true });
}
