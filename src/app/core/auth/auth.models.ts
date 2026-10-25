export interface AccessTokenResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
}

export interface PortalMembership {
  id: string;
  name: string;
  slug: string;
  profile: string;
}

export interface Me {
  id: string;
  email: string;
  fullName: string;
  portals: PortalMembership[];
}

/** A support session: a platform admin acting as this user (from the token's `act`/`imp` claims). */
export interface Impersonation {
  adminName: string;
  expiresAt: Date;
}
