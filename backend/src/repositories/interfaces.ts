import { Solicitud, MockMail } from '../domain/types';

export interface SolicitudStore {
  save(solicitud: Solicitud): Promise<Solicitud>;
  findById(id: string): Promise<Solicitud | null>;
  findAll(): Promise<Solicitud[]>;
  findByApproverToken(token: string): Promise<{ solicitud: Solicitud; aprobadorId: string } | null>;
  update(solicitud: Solicitud): Promise<Solicitud>;
}

export interface MailStore {
  save(mail: MockMail): Promise<MockMail>;
  findAll(): Promise<MockMail[]>;
  findBySolicitud(solicitudId: string): Promise<MockMail[]>;
}

export interface PdfStore {
  save(key: string, buffer: Buffer): Promise<string>;
  get(key: string): Promise<Buffer | null>;
}
