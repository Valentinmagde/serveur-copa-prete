import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as AWS from 'aws-sdk';
import { Readable } from 'stream';

@Injectable()
export class S3Service {
  private s3: AWS.S3;
  private bucket: string;

  constructor(private configService: ConfigService) {
    const region = this.configService.get<string>('aws.region');
    // const accessKeyId = this.configService.get<string>('aws.accessKeyId');
    // const secretAccessKey = this.configService.get<string>(
    //   'aws.secretAccessKey',
    // );

    this.s3 = new AWS.S3({
      region: region || 'eu-west-3',
      // accessKeyId: accessKeyId,
      // secretAccessKey: secretAccessKey,
    });

    this.bucket =
      this.configService.get<string>('aws.s3Bucket') || 'copa-platform-uploads';
  }

  async uploadFile(
    file: Buffer,
    key: string,
    mimetype: string,
  ): Promise<string> {
    const params = {
      Bucket: this.bucket,
      Key: key,
      Body: file,
      ContentType: mimetype,
    };

    const result = await this.s3.upload(params).promise();
    return result.Location;
  }

  async downloadFile(key: string): Promise<Readable> {
    const params = {
      Bucket: this.bucket,
      Key: key,
    };

    const result = await this.s3.getObject(params).promise();
    return Readable.from(result.Body as Buffer);
  }

  async deleteFile(key: string): Promise<void> {
    const params = {
      Bucket: this.bucket,
      Key: key,
    };

    await this.s3.deleteObject(params).promise();
  }
}
