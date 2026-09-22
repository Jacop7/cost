export type SocialProvider = 'google' | 'apple';

export interface SocialCredential {
  provider: SocialProvider;
  token: string;
  nonce: string;
  accessToken?: string;
  /** Apple 계정 삭제 시 서버의 토큰 철회 절차에 필요한 일회용 코드. */
  authorizationCode?: string;
}

export type SocialCredentialResult =
  | { type: 'success'; credential: SocialCredential }
  | { type: 'cancelled' };

export interface SocialAvailability {
  google: boolean;
  apple: boolean;
}
