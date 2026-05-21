import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'

@Injectable()
export class R2Service implements OnModuleInit {
  private logger = new Logger('R2Service')

  private s3Client: S3Client
  private bucket: string

  constructor(
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    this.s3Client = new S3Client({
      region: 'auto',
      endpoint: this.configService.getOrThrow('R2_ENDPOINT'),
      credentials: {
        accessKeyId: this.configService.getOrThrow('R2_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.getOrThrow('R2_SECRET_ACCESS_KEY'),
      },
    })
    this.bucket = this.configService.getOrThrow('R2_BUCKET')

    this.logger.log('R2 client initialized')
  }

  async upload(key: string, buffer: Buffer, contentType: string) {
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      })
    )

    this.logger.log(`File uploaded to R2: ${key}`)

    return true
  }

  async delete(key: string) {
    await this.s3Client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })
    )

    this.logger.log(`File deleted from R2: ${key}`)

    return true
  }



  setBucket(bucket: string) {
    this.bucket = bucket

    this.logger.log(`R2 bucket set to ${bucket}`)

    return this
  }
}
