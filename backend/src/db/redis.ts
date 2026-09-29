import { env } from '../config/env';

// WHY: High-performance caching and rate limiting client.
// Uses Upstash Redis REST API via native fetch (no heavyweight socket/TCP dependencies),
// with an in-memory fallback for offline/local resilience.

class RedisClient {
  private url: string;
  private token: string;
  private memoryStore: Map<string, { value: string; expiresAt?: number }> = new Map();

  constructor() {
    this.url = env.UPSTASH_REDIS_REST_URL.replace(/\/+$/, '');
    this.token = env.UPSTASH_REDIS_REST_TOKEN;
  }

  private isConfigured(): boolean {
    return Boolean(this.url && this.token);
  }

  private async executeCommand<T = any>(command: any[]): Promise<T> {
    if (!this.isConfigured()) {
      return this.executeInMemory<T>(command);
    }

    try {
      const response = await fetch(this.url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(command),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Redis API Error:', errorText);
        throw new Error(`Upstash Redis error: ${response.status} - ${errorText}`);
      }

      const data = (await response.json()) as { result: T };
      return data.result;
    } catch (error) {
      console.warn('Upstash Redis request failed, falling back to local store:', error);
      return this.executeInMemory<T>(command);
    }
  }

  private executeInMemory<T>(command: any[]): T {
    const action = String(command[0]).toUpperCase();
    const key = String(command[1]);
    const now = Date.now();

    if (action === 'GET') {
      const entry = this.memoryStore.get(key);
      if (!entry) return null as T;
      if (entry.expiresAt && entry.expiresAt < now) {
        this.memoryStore.delete(key);
        return null as T;
      }
      return entry.value as T;
    }

    if (action === 'SET') {
      const value = String(command[2]);
      let expiresAt: number | undefined;
      if (command[3] && String(command[3]).toUpperCase() === 'EX') {
        const seconds = parseInt(command[4], 10);
        expiresAt = now + seconds * 1000;
      }
      this.memoryStore.set(key, { value, expiresAt });
      return 'OK' as T;
    }

    if (action === 'DEL') {
      this.memoryStore.delete(key);
      return 1 as T;
    }

    if (action === 'INCR') {
      const entry = this.memoryStore.get(key);
      let current = 0;
      if (entry && (!entry.expiresAt || entry.expiresAt >= now)) {
        current = parseInt(entry.value, 10) || 0;
      }
      current += 1;
      this.memoryStore.set(key, { value: String(current), expiresAt: entry?.expiresAt });
      return current as T;
    }

    if (action === 'EXPIRE') {
      const seconds = parseInt(command[2], 10);
      const entry = this.memoryStore.get(key);
      if (entry) {
        entry.expiresAt = now + seconds * 1000;
      }
      return 1 as T;
    }

    return null as T;
  }

  async get(key: string): Promise<string | null> {
    return this.executeCommand<string | null>(['GET', key]);
  }

  async set(key: string, value: string, exSeconds?: number): Promise<void> {
    if (exSeconds) {
      await this.executeCommand(['SET', key, value, 'EX', exSeconds]);
    } else {
      await this.executeCommand(['SET', key, value]);
    }
  }

  async del(key: string): Promise<void> {
    await this.executeCommand(['DEL', key]);
  }

  async incr(key: string): Promise<number> {
    return this.executeCommand<number>(['INCR', key]);
  }

  async expire(key: string, seconds: number): Promise<void> {
    await this.executeCommand(['EXPIRE', key, seconds]);
  }
}

export const redis = new RedisClient();
