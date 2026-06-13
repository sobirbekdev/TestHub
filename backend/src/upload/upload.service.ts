import { Injectable } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class UploadService {
  private s3: S3Client | null = null;
  private bucket: string;
  private publicUrl: string;
  private isDevMode: boolean;
  private uploadDir: string;

  constructor() {
    this.bucket = process.env.R2_BUCKET || 'testhub-uploads';
    this.publicUrl = process.env.R2_PUBLIC_URL || '';

    // R2 sozlanmagan bo'lsa — local disk ishlatamiz
    const hasR2 =
      process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCOUNT_ID !== 'your-account-id' &&
      process.env.R2_ACCESS_KEY &&
      process.env.R2_ACCESS_KEY !== 'your-access-key';

    this.isDevMode = !hasR2;

    if (!this.isDevMode) {
      this.s3 = new S3Client({
        region: 'auto',
        endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY || '',
          secretAccessKey: process.env.R2_SECRET_KEY || '',
        },
      });
    } else {
      // Local uploads papkasi — TURG'UN YO'L (process qayta ishganda ham bir xil)
      this.uploadDir = process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads');
      if (!fs.existsSync(this.uploadDir)) {
        fs.mkdirSync(this.uploadDir, { recursive: true });
      }
      console.log(`[UploadService] DEV MODE: fayllar ${this.uploadDir} ga saqlanadi`);
    }
  }

  async uploadFile(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    folder = 'questions',
  ): Promise<string> {
    const ext = originalName.split('.').pop() || 'jpg';
    const fileName = `${uuidv4()}.${ext}`;

    if (this.isDevMode) {
      // Local diskka saqlash
      const dir = path.join(this.uploadDir, folder);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, fileName), buffer);
      return `http://localhost:4000/uploads/${folder}/${fileName}`;
    }

    const key = `${folder}/${fileName}`;
    await this.s3!.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      }),
    );
    return `${this.publicUrl}/${key}`;
  }

  async getPresignedUrl(
    fileName: string,
    mimeType: string,
    folder = 'answers',
  ): Promise<{ uploadUrl: string; publicUrl: string }> {
    if (this.isDevMode) {
      // Dev: presigned o'rniga to'g'ridan upload endpoint
      return {
        uploadUrl: 'http://localhost:4000/api/upload/file',
        publicUrl: '',
      };
    }

    const ext = fileName.split('.').pop();
    const key = `${folder}/${uuidv4()}.${ext}`;
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: mimeType,
    });
    const uploadUrl = await getSignedUrl(this.s3!, command, { expiresIn: 300 });
    return { uploadUrl, publicUrl: `${this.publicUrl}/${key}` };
  }

  async deleteFile(fileUrl: string): Promise<void> {
    if (this.isDevMode) return;
    const key = fileUrl.replace(`${this.publicUrl}/`, '');
    await this.s3!.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
