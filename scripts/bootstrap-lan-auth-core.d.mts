export type LanAuthUser = {
  id: string;
  tenantId: string;
  email: string;
  displayName: string;
  passwordHash: string;
  role: 'owner' | 'creator';
  status: 'active';
  projectIds: string[];
  mfaEnabled: boolean;
  mfaSecret?: string;
};

export type LanAuthBundle = {
  authDocument: { schemaVersion: 1; users: LanAuthUser[] };
  credentialsText: string;
};

export function createLanAuthBundle(options: {
  tenantId: string;
  projectId: string;
  ownerEmail: string;
  creatorEmail: string;
  ownerPassword?: string;
  creatorPassword?: string;
  ownerTotpSecret?: string;
  ownerId?: string;
  creatorId?: string;
}): LanAuthBundle;

export function writeLanAuthBundle(options: {
  authFile: string;
  credentialsFile: string;
  bundle: LanAuthBundle;
}): Promise<void>;
