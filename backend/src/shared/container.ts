import {
  InMemoryMailStore,
  InMemoryPdfStore,
  InMemorySolicitudStore,
} from '../repositories/inMemoryStore';
import { DynamoMailStore, DynamoSolicitudStore } from '../repositories/dynamoStore';
import { S3PdfStore } from '../repositories/s3Store';
import { MailStore, PdfStore, SolicitudStore } from '../repositories/interfaces';
import { SolicitudService } from '../services/solicitudService';

const memorySolicitudes = new InMemorySolicitudStore();
const memoryMails = new InMemoryMailStore();
const memoryPdfs = new InMemoryPdfStore();

export function isLocalMode(): boolean {
  return process.env.LOCAL_MODE === 'true' || !process.env.TABLE_NAME;
}

export function getStores(): {
  solicitudes: SolicitudStore;
  mails: MailStore;
  pdfs: PdfStore;
} {
  if (isLocalMode()) {
    return {
      solicitudes: memorySolicitudes,
      mails: memoryMails,
      pdfs: memoryPdfs,
    };
  }
  return {
    solicitudes: new DynamoSolicitudStore(),
    mails: new DynamoMailStore(),
    pdfs: new S3PdfStore(),
  };
}

export function createService(): SolicitudService {
  const stores = getStores();
  const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
  return new SolicitudService(stores.solicitudes, stores.mails, stores.pdfs, baseUrl);
}

export function resetMemoryStores(): void {
  memorySolicitudes.clear();
  memoryMails.clear();
  memoryPdfs.clear();
}
