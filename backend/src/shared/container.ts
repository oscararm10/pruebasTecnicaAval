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

let sqliteStores: {
  solicitudes: SolicitudStore;
  mails: MailStore;
  pdfs: PdfStore;
  dbPath: string;
} | null = null;

export function isLocalMode(): boolean {
  return process.env.LOCAL_MODE === 'true' || !process.env.TABLE_NAME;
}

function getSqliteStores(): {
  solicitudes: SolicitudStore;
  mails: MailStore;
  pdfs: PdfStore;
  dbPath: string;
} {
  if (!sqliteStores) {
    // require dinámico: evita cargar better-sqlite3 en el bundle de Lambda
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sqlite = require('../repositories/sqliteStore') as typeof import('../repositories/sqliteStore');
    const dbPath = sqlite.getDefaultSqlitePath();
    const db = sqlite.openSqliteDatabase(dbPath);
    sqliteStores = {
      solicitudes: new sqlite.SqliteSolicitudStore(db),
      mails: new sqlite.SqliteMailStore(db),
      pdfs: new sqlite.SqlitePdfStore(db),
      dbPath,
    };
  }
  return sqliteStores;
}

export function getLocalDbPath(): string {
  return getSqliteStores().dbPath;
}

export function getStores(): {
  solicitudes: SolicitudStore;
  mails: MailStore;
  pdfs: PdfStore;
} {
  if (isLocalMode()) {
    const { solicitudes, mails, pdfs } = getSqliteStores();
    return { solicitudes, mails, pdfs };
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

/** Solo limpia stores en memoria (tests unitarios que los usan directamente). */
export function resetMemoryStores(): void {
  memorySolicitudes.clear();
  memoryMails.clear();
  memoryPdfs.clear();
}
