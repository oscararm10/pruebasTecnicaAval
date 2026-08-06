import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import { MockMail, Solicitud } from '../domain/types';
import { MailStore, SolicitudStore } from './interfaces';

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

function tableName(): string {
  const name = process.env.TABLE_NAME;
  if (!name) throw new Error('TABLE_NAME no configurada');
  return name;
}

export class DynamoSolicitudStore implements SolicitudStore {
  async save(solicitud: Solicitud): Promise<Solicitud> {
    await client.send(
      new PutCommand({
        TableName: tableName(),
        Item: {
          PK: `SOL#${solicitud.id}`,
          SK: 'META',
          entityType: 'SOLICITUD',
          GSI1PK: 'SOLICITUDES',
          GSI1SK: solicitud.createdAt,
          ...solicitud,
        },
      })
    );

    for (const aprobador of solicitud.aprobadores) {
      await client.send(
        new PutCommand({
          TableName: tableName(),
          Item: {
            PK: `TOKEN#${aprobador.token}`,
            SK: 'META',
            entityType: 'TOKEN',
            solicitudId: solicitud.id,
            aprobadorId: aprobador.id,
          },
        })
      );
    }

    return solicitud;
  }

  async findById(id: string): Promise<Solicitud | null> {
    const result = await client.send(
      new GetCommand({
        TableName: tableName(),
        Key: { PK: `SOL#${id}`, SK: 'META' },
      })
    );
    if (!result.Item) return null;
    return toSolicitud(result.Item);
  }

  async findAll(): Promise<Solicitud[]> {
    const result = await client.send(
      new QueryCommand({
        TableName: tableName(),
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :pk',
        ExpressionAttributeValues: { ':pk': 'SOLICITUDES' },
        ScanIndexForward: false,
      })
    );
    return (result.Items ?? []).map(toSolicitud);
  }

  async findByApproverToken(
    token: string
  ): Promise<{ solicitud: Solicitud; aprobadorId: string } | null> {
    const tokenResult = await client.send(
      new GetCommand({
        TableName: tableName(),
        Key: { PK: `TOKEN#${token}`, SK: 'META' },
      })
    );
    if (!tokenResult.Item) return null;

    const solicitud = await this.findById(tokenResult.Item.solicitudId as string);
    if (!solicitud) return null;

    return {
      solicitud,
      aprobadorId: tokenResult.Item.aprobadorId as string,
    };
  }

  async update(solicitud: Solicitud): Promise<Solicitud> {
    await client.send(
      new PutCommand({
        TableName: tableName(),
        Item: {
          PK: `SOL#${solicitud.id}`,
          SK: 'META',
          entityType: 'SOLICITUD',
          GSI1PK: 'SOLICITUDES',
          GSI1SK: solicitud.createdAt,
          ...solicitud,
        },
      })
    );
    return solicitud;
  }
}

export class DynamoMailStore implements MailStore {
  async save(mail: MockMail): Promise<MockMail> {
    await client.send(
      new PutCommand({
        TableName: tableName(),
        Item: {
          PK: `MAIL#${mail.id}`,
          SK: 'META',
          entityType: 'MAIL',
          GSI1PK: 'MAILS',
          GSI1SK: mail.createdAt,
          ...mail,
        },
      })
    );
    return mail;
  }

  async findAll(): Promise<MockMail[]> {
    const result = await client.send(
      new QueryCommand({
        TableName: tableName(),
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :pk',
        ExpressionAttributeValues: { ':pk': 'MAILS' },
        ScanIndexForward: false,
      })
    );
    return (result.Items ?? []).map(toMail);
  }

  async findBySolicitud(solicitudId: string): Promise<MockMail[]> {
    const all = await this.findAll();
    return all.filter((m) => m.solicitudId === solicitudId);
  }
}

function toSolicitud(item: Record<string, unknown>): Solicitud {
  return {
    id: item.id as string,
    titulo: item.titulo as string,
    descripcion: item.descripcion as string,
    monto: item.monto as number,
    solicitante: item.solicitante as string,
    estado: item.estado as Solicitud['estado'],
    aprobadores: item.aprobadores as Solicitud['aprobadores'],
    createdAt: item.createdAt as string,
    updatedAt: item.updatedAt as string,
    evidenciaKey: item.evidenciaKey as string | undefined,
  };
}

function toMail(item: Record<string, unknown>): MockMail {
  return {
    id: item.id as string,
    to: item.to as string,
    subject: item.subject as string,
    body: item.body as string,
    link: item.link as string,
    otp: item.otp as string,
    solicitudId: item.solicitudId as string,
    createdAt: item.createdAt as string,
  };
}

/** Scan helper useful for diagnostics (not used in happy path). */
export async function scanTable(): Promise<unknown[]> {
  const result = await client.send(new ScanCommand({ TableName: tableName() }));
  return result.Items ?? [];
}
