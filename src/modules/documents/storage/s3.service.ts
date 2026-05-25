import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as AWS from 'aws-sdk';
import { Readable } from 'stream';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private s3: AWS.S3;
  private bucket: string;
  private isLocal: boolean;
  private localUploadDir: string;

  constructor(private configService: ConfigService) {
    const region = this.configService.get<string>('aws.region');
    const accessKeyId = this.configService.get<string>('aws.accessKeyId');
    const secretAccessKey = this.configService.get<string>('aws.secretAccessKey');

    this.isLocal = this.configService.get<string>('app.nodeEnv') === 'local';

    if (this.isLocal) {
      this.localUploadDir = path.resolve(process.cwd(), 'uploads');
      if (!fs.existsSync(this.localUploadDir)) {
        fs.mkdirSync(this.localUploadDir, { recursive: true });
      }
      this.logger.warn('AWS credentials not configured — using local disk storage (uploads/)');
    } else {
      this.s3 = new AWS.S3({
        region: region || 'eu-west-3',
        // accessKeyId,
        // secretAccessKey,
      });
      this.bucket = this.configService.get<string>('aws.s3Bucket') || 'copa-platform-uploads';
    }
  }

  async uploadFile(file: Buffer, key: string, mimetype: string): Promise<string> {
    if (this.isLocal) {
      const filePath = path.join(this.localUploadDir, key);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, file);
      return `local://${key}`;
    }

    const result = await this.s3.upload({
      Bucket: this.bucket,
      Key: key,
      Body: file,
      ContentType: mimetype,
    }).promise();

    return result.Location;
  }

  async downloadFile(key: string): Promise<Readable> {
    if (this.isLocal) {
      const localKey = key.startsWith('local://') ? key.slice(8) : key;
      const filePath = path.join(this.localUploadDir, localKey);
      return Readable.from(fs.readFileSync(filePath));
    }

    const result = await this.s3.getObject({
      Bucket: this.bucket,
      Key: key,
    }).promise();

    return Readable.from(result.Body as Buffer);
  }

  async deleteFile(key: string): Promise<void> {
    if (this.isLocal) {
      const localKey = key.startsWith('local://') ? key.slice(8) : key;
      const filePath = path.join(this.localUploadDir, localKey);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return;
    }

    await this.s3.deleteObject({
      Bucket: this.bucket,
      Key: key,
    }).promise();
  }
}
