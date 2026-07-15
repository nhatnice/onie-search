export interface UploadResult {
  key: string;
  path: string;
  size: number;
  hash: string;
  url: string;
}

export interface ObjectStorage {
  upload(key: string, body: Buffer, mimeType: string): Promise<UploadResult>;
  exists(hash: string): Promise<string | undefined>;
}

export function buildPublicUrl(path: string, baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}
