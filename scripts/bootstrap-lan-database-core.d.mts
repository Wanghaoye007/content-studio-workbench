export function bootstrapLanDatabase(options: {
  authFile: string;
  databaseFile: string;
  projectId: string;
  projectName: string;
  at?: string;
}): Promise<{
  created: boolean;
  tenantId: string;
  projectId: string;
  ownerUserId: string;
  creatorUserId: string;
}>;
