export class SynapseAPIClient {
  private baseURL: string;
  private token: string | null = null;
  private ws: WebSocket | null = null;

  auth = {
    oauth2: async (params: { clientId: string; scope: string }) => {
      const res = await this.post('/auth/oauth2', params);
      this.token = res.accessToken;
      return res;
    },
    login: async (credentials: { username: string; password: string }) => {
      const res = await this.post('/auth/login', credentials);
      this.token = res.accessToken;
      return res;
    },
    refresh: async (refreshToken: string) => {
      return this.post('/auth/refresh', { refreshToken });
    },
  };

  messages = {
    send: async (message: any) => {
      return this.post('/messages', message);
    },
    get: async (id: string) => {
      return this.get(`/messages/${id}`);
    },
    addReaction: async (messageId: string, emoji: string) => {
      return this.post(`/messages/${messageId}/reactions`, { emoji });
    },
    getReactions: async (messageId: string) => {
      return this.get(`/messages/${messageId}/reactions`);
    },
    getThread: async (parentId: string) => {
      return this.get(`/messages/${parentId}/thread`);
    },
  };

  channels = {
    create: async (data: any) => {
      return this.post('/channels', data);
    },
    get: async (id: string) => {
      return this.get(`/channels/${id}`);
    },
    update: async (id: string, data: any) => {
      return this.patch(`/channels/${id}`, data);
    },
    delete: async (id: string) => {
      return this.del(`/channels/${id}`);
    },
    setPermissions: async (id: string, permissions: any) => {
      return this.post(`/channels/${id}/permissions`, permissions);
    },
    getPermissions: async (id: string) => {
      return this.get(`/channels/${id}/permissions`);
    },
  };

  ws = {
    connect: async () => {
      return this.connectWebSocket();
    },
  };

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  async authenticate(credentials: any): Promise<void> {
    const res = await this.post('/auth/login', credentials);
    this.token = res.accessToken;
  }

  private async request(method: string, path: string, body?: any): Promise<any> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const res = await fetch(`${this.baseURL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    }

    return res.json();
  }

  private get(path: string) {
    return this.request('GET', path);
  }

  private post(path: string, body?: any) {
    return this.request('POST', path, body);
  }

  private patch(path: string, body?: any) {
    return this.request('PATCH', path, body);
  }

  private del(path: string) {
    return this.request('DELETE', path);
  }

  private connectWebSocket(): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const wsUrl = this.baseURL.replace(/^http/, 'ws');
      const ws = new WebSocket(`${wsUrl}/ws?token=${this.token}`);

      ws.onopen = () => resolve(ws);
      ws.onerror = reject;
    });
  }
}
