export interface PhoneExtractAdapter {
  platform: string;
  getPhone(uid: string): Promise<string>;
}
