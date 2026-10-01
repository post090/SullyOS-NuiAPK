export interface Statement {
  bind(...values: unknown[]): Statement;
  first<T = Record<string, any>>(): Promise<T | null>;
  all<T = Record<string, any>>(): Promise<{ results: T[] }>;
  run(): Promise<{ meta: { changes: number } }>;
}
export interface Env {
  DB: { prepare(query: string): Statement; batch(statements: Statement[]): Promise<{ meta: { changes: number } }[]> };
  FILES: {
    put(key: string, value: string, options?: unknown): Promise<unknown>;
    get(key: string): Promise<{ body: ReadableStream; size: number } | null>;
    delete(key: string): Promise<unknown>;
  };
  ASSETS: { fetch(request: Request): Promise<Response> };
  AUTH_PEPPER: string;
  BOOTSTRAP_HASH?: string;
  UPLOADS_ENABLED?: string;
  DAILY_UPLOAD_BYTES?: string;
  TOTAL_STORAGE_BYTES?: string;
}
