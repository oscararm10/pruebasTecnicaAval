import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { PdfStore } from './interfaces';

const s3 = new S3Client({});

function bucketName(): string {
  const name = process.env.BUCKET_NAME;
  if (!name) throw new Error('BUCKET_NAME no configurada');
  return name;
}

export class S3PdfStore implements PdfStore {
  async save(key: string, buffer: Buffer): Promise<string> {
    await s3.send(
      new PutObjectCommand({
        Bucket: bucketName(),
        Key: key,
        Body: buffer,
        ContentType: 'application/pdf',
      })
    );
    return key;
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      const result = await s3.send(
        new GetObjectCommand({
          Bucket: bucketName(),
          Key: key,
        })
      );
      const bytes = await result.Body?.transformToByteArray();
      return bytes ? Buffer.from(bytes) : null;
    } catch {
      return null;
    }
  }
}
