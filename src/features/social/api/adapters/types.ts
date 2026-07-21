export interface CookieRefreshAdapter {
  readonly platform: string;
  refresh(cookieHeader: string): Promise<string>;
}
