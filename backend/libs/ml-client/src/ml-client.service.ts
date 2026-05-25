import { Injectable, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { GetTagsResult, ML_BODY_FILE_NAME, MlClientEndpoint } from '@app/ml-client/ml-client.types'
import { slashEnded } from '@app/utils/slash-ended'

@Injectable()
export class MlClientService implements OnModuleInit {
  private token: string | null
  private apiUrl: string | null

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    this.token = this.configService.get<string>('ML_API_TOKEN') ?? null
    this.apiUrl = this.configService.get<string>('ML_API_URL') ?? null
  }

  async getTags(file: ArrayBuffer | Buffer): Promise<GetTagsResult> {
    const part: BlobPart = Buffer.isBuffer(file)
      ? new Uint8Array(file.buffer as ArrayBuffer, file.byteOffset, file.byteLength)
      : file

    const formData = new FormData()
    formData.append('file', new Blob([ part ]), ML_BODY_FILE_NAME)

    const response = await this.callApi(MlClientEndpoint.GetTags, formData)
    if (!response.ok)
      throw new Error('Third-party ML API error: ' + await response.text())

    return response.json()
  }

  async getWebpThumbnail(file: ArrayBuffer | Buffer): Promise<ArrayBuffer> {
    const part: BlobPart = Buffer.isBuffer(file)
      ? new Uint8Array(file.buffer as ArrayBuffer, file.byteOffset, file.byteLength)
      : file

    const formData = new FormData()
    formData.append('file', new Blob([ part ]), ML_BODY_FILE_NAME)

    const response = await this.callApi(MlClientEndpoint.GetThumbnail, formData)
    if (!response.ok)
      throw new Error('Third-party ML API error: ' + await response.text())

    return response.arrayBuffer()
  }

  private async callApi(endpoint: MlClientEndpoint, body: Record<string, any> | FormData) {
    if (!this.token || !this.apiUrl)
      throw new Error('ML API token or URL not configured')

    return fetch(`${slashEnded(this.apiUrl)}${endpoint}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': body instanceof FormData ?
          'multipart/form-data' :
          'application/json',
      },
      body: body instanceof FormData ?
        body :
        JSON.stringify(body),
    })
  }
}
