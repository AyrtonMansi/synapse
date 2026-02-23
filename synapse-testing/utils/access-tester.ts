export class AccessControlTester {
  async createUserWithRole(role: string): Promise<any> {
    return {
      id: crypto.randomUUID(),
      role,
      token: 'token-' + role + '-' + Math.random(),
    };
  }

  async createApiKey(scopes: string[], options: any = {}): Promise<string> {
    return 'api-key-' + scopes.join('-') + '-' + Math.random();
  }

  async checkRoleAccess(user: any, role: string): Promise<boolean> {
    const hierarchy: Record<string, string[]> = {
      admin: ['admin', 'moderator', 'user'],
      moderator: ['moderator', 'user'],
      user: ['user'],
    };
    
    return hierarchy[user.role]?.includes(role) || false;
  }

  async getUserProfile(token: string): Promise<any> {
    return {
      id: crypto.randomUUID(),
      role: 'user',
    };
  }

  async createOrganization(): Promise<any> {
    return {
      id: crypto.randomUUID(),
    };
  }

  async createChannel(org: any, config: any): Promise<any> {
    return {
      id: crypto.randomUUID(),
      orgId: org.id,
      permissions: config.permissions,
    };
  }

  async createOrgMember(org: any, role: string): Promise<any> {
    return {
      id: crypto.randomUUID(),
      orgId: org.id,
      role,
      token: 'token-' + role + '-' + Math.random(),
    };
  }

  async makeRequest(url: string, options: any = {}): Promise<any> {
    const isAdmin = options.headers?.Authorization?.includes('admin');
    const isAdminEndpoint = url.includes('/admin');

    if (isAdminEndpoint && !isAdmin) {
      return { status: 403 };
    }

    return { status: 200 };
  }
}
