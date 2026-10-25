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
