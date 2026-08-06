import { MockMail, Solicitud } from '../domain/types';
import { MailStore, PdfStore, SolicitudStore } from './interfaces';

export class InMemorySolicitudStore implements SolicitudStore {
  private items = new Map<string, Solicitud>();
  private tokenIndex = new Map<string, { solicitudId: string; aprobadorId: string }>();

  async save(solicitud: Solicitud): Promise<Solicitud> {
    this.items.set(solicitud.id, structuredClone(solicitud));
    for (const a of solicitud.aprobadores) {
      this.tokenIndex.set(a.token, { solicitudId: solicitud.id, aprobadorId: a.id });
    }
    return structuredClone(solicitud);
  }

  async findById(id: string): Promise<Solicitud | null> {
    const item = this.items.get(id);
    return item ? structuredClone(item) : null;
  }

  async findAll(): Promise<Solicitud[]> {
    return Array.from(this.items.values())
      .map((s) => structuredClone(s))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async findByApproverToken(
    token: string
  ): Promise<{ solicitud: Solicitud; aprobadorId: string } | null> {
    const ref = this.tokenIndex.get(token);
    if (!ref) return null;
    const solicitud = await this.findById(ref.solicitudId);
    if (!solicitud) return null;
    return { solicitud, aprobadorId: ref.aprobadorId };
  }

  async update(solicitud: Solicitud): Promise<Solicitud> {
    if (!this.items.has(solicitud.id)) {
      throw new Error(`Solicitud ${solicitud.id} no encontrada`);
    }
    return this.save(solicitud);
  }

  clear(): void {
    this.items.clear();
    this.tokenIndex.clear();
  }
}

export class InMemoryMailStore implements MailStore {
  private items: MockMail[] = [];

  async save(mail: MockMail): Promise<MockMail> {
    this.items.unshift(structuredClone(mail));
    return structuredClone(mail);
  }

  async findAll(): Promise<MockMail[]> {
    return this.items.map((m) => structuredClone(m));
  }

  async findBySolicitud(solicitudId: string): Promise<MockMail[]> {
    return this.items.filter((m) => m.solicitudId === solicitudId).map((m) => structuredClone(m));
  }

  clear(): void {
    this.items = [];
  }
}

export class InMemoryPdfStore implements PdfStore {
  private files = new Map<string, Buffer>();

  async save(key: string, buffer: Buffer): Promise<string> {
    this.files.set(key, Buffer.from(buffer));
    return key;
  }

  async get(key: string): Promise<Buffer | null> {
    const buf = this.files.get(key);
    return buf ? Buffer.from(buf) : null;
  }

  clear(): void {
    this.files.clear();
  }
}
