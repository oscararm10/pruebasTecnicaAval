import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { MockMail, Solicitud } from '../domain/types';
import { MailStore, PdfStore, SolicitudStore } from './interfaces';

export function getDefaultSqlitePath(): string {
  return process.env.SQLITE_PATH || path.join(process.cwd(), '.data', 'aval.db');
}

export function openSqliteDatabase(dbPath = getDefaultSqlitePath()): Database.Database {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS solicitudes (
      id TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS approver_tokens (
      token TEXT PRIMARY KEY,
      solicitud_id TEXT NOT NULL,
      aprobador_id TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS mails (
      id TEXT PRIMARY KEY,
      solicitud_id TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pdfs (
      key TEXT PRIMARY KEY,
      data BLOB NOT NULL
    );
  `);
  return db;
}

function cloneSolicitud(solicitud: Solicitud): Solicitud {
  return structuredClone(solicitud);
}

function cloneMail(mail: MockMail): MockMail {
  return structuredClone(mail);
}

export class SqliteSolicitudStore implements SolicitudStore {
  constructor(private readonly db: Database.Database) {}

  async save(solicitud: Solicitud): Promise<Solicitud> {
    const payload = JSON.stringify(solicitud);
    const tx = this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO solicitudes (id, payload, created_at)
           VALUES (@id, @payload, @created_at)
           ON CONFLICT(id) DO UPDATE SET
             payload = excluded.payload,
             created_at = excluded.created_at`
        )
        .run({
          id: solicitud.id,
          payload,
          created_at: solicitud.createdAt,
        });

      this.db.prepare('DELETE FROM approver_tokens WHERE solicitud_id = ?').run(solicitud.id);
      const insertToken = this.db.prepare(
        `INSERT INTO approver_tokens (token, solicitud_id, aprobador_id)
         VALUES (@token, @solicitud_id, @aprobador_id)`
      );
      for (const a of solicitud.aprobadores) {
        insertToken.run({
          token: a.token,
          solicitud_id: solicitud.id,
          aprobador_id: a.id,
        });
      }
    });
    tx();
    return cloneSolicitud(solicitud);
  }

  async findById(id: string): Promise<Solicitud | null> {
    const row = this.db.prepare('SELECT payload FROM solicitudes WHERE id = ?').get(id) as
      | { payload: string }
      | undefined;
    if (!row) return null;
    return cloneSolicitud(JSON.parse(row.payload) as Solicitud);
  }

  async findAll(): Promise<Solicitud[]> {
    const rows = this.db
      .prepare('SELECT payload FROM solicitudes ORDER BY created_at DESC')
      .all() as Array<{ payload: string }>;
    return rows.map((row) => cloneSolicitud(JSON.parse(row.payload) as Solicitud));
  }

  async findByApproverToken(
    token: string
  ): Promise<{ solicitud: Solicitud; aprobadorId: string } | null> {
    const ref = this.db
      .prepare('SELECT solicitud_id, aprobador_id FROM approver_tokens WHERE token = ?')
      .get(token) as { solicitud_id: string; aprobador_id: string } | undefined;
    if (!ref) return null;
    const solicitud = await this.findById(ref.solicitud_id);
    if (!solicitud) return null;
    return { solicitud, aprobadorId: ref.aprobador_id };
  }

  async update(solicitud: Solicitud): Promise<Solicitud> {
    const existing = this.db.prepare('SELECT id FROM solicitudes WHERE id = ?').get(solicitud.id);
    if (!existing) {
      throw new Error(`Solicitud ${solicitud.id} no encontrada`);
    }
    return this.save(solicitud);
  }
}

export class SqliteMailStore implements MailStore {
  constructor(private readonly db: Database.Database) {}

  async save(mail: MockMail): Promise<MockMail> {
    this.db
      .prepare(
        `INSERT INTO mails (id, solicitud_id, payload, created_at)
         VALUES (@id, @solicitud_id, @payload, @created_at)
         ON CONFLICT(id) DO UPDATE SET
           solicitud_id = excluded.solicitud_id,
           payload = excluded.payload,
           created_at = excluded.created_at`
      )
      .run({
        id: mail.id,
        solicitud_id: mail.solicitudId,
        payload: JSON.stringify(mail),
        created_at: mail.createdAt,
      });
    return cloneMail(mail);
  }

  async findAll(): Promise<MockMail[]> {
    const rows = this.db
      .prepare('SELECT payload FROM mails ORDER BY created_at DESC')
      .all() as Array<{ payload: string }>;
    return rows.map((row) => cloneMail(JSON.parse(row.payload) as MockMail));
  }

  async findBySolicitud(solicitudId: string): Promise<MockMail[]> {
    const rows = this.db
      .prepare(
        'SELECT payload FROM mails WHERE solicitud_id = ? ORDER BY created_at DESC'
      )
      .all(solicitudId) as Array<{ payload: string }>;
    return rows.map((row) => cloneMail(JSON.parse(row.payload) as MockMail));
  }
}

export class SqlitePdfStore implements PdfStore {
  constructor(private readonly db: Database.Database) {}

  async save(key: string, buffer: Buffer): Promise<string> {
    this.db
      .prepare(
        `INSERT INTO pdfs (key, data)
         VALUES (@key, @data)
         ON CONFLICT(key) DO UPDATE SET data = excluded.data`
      )
      .run({ key, data: buffer });
    return key;
  }

  async get(key: string): Promise<Buffer | null> {
    const row = this.db.prepare('SELECT data FROM pdfs WHERE key = ?').get(key) as
      | { data: Buffer }
      | undefined;
    if (!row) return null;
    return Buffer.from(row.data);
  }
}
