import {
  action,
  computed,
  effect,
  signal,
  type Action,
  type ActionOptions,
  type AsyncStatus,
  type ReadonlySignal,
  type Signal
} from "./Ity";

type Cleanup = () => void;
export type QueryKey = string | readonly unknown[];

export interface QueryLoaderContext<T> {
  key: QueryKey;
  signal: AbortSignal;
  previous: T | undefined;
  client: QueryClient;
  refreshId: number;
}

export interface QueryOptions<T, E = unknown> {
  initialData?: T;
  immediate?: boolean;
  staleTime?: number;
  keepPrevious?: boolean;
  gcTime?: number;
  name?: string;
  onSuccess?: (value: T) => void;
  onError?: (error: E) => void;
}

export interface QueryResult<T, E = unknown> {
  readonly key: ReadonlySignal<QueryKey>;
  readonly data: ReadonlySignal<T | undefined>;
  readonly error: ReadonlySignal<E | null>;
  readonly loading: ReadonlySignal<boolean>;
  readonly status: ReadonlySignal<AsyncStatus>;
  readonly stale: ReadonlySignal<boolean>;
  readonly updatedAt: ReadonlySignal<number>;
  readonly promise: ReadonlySignal<Promise<T | undefined> | null>;
  refresh(): Promise<T | undefined>;
  invalidate(): Promise<T | undefined>;
  mutate(next: T | undefined | ((previous: T | undefined) => T | undefined)): void;
  dispose(): void;
}

export interface MutationOptions<TArgs extends unknown[], TResult, E = unknown> extends ActionOptions<TResult, E> {
  invalidate?: QueryKey[] | ((value: TResult, args: TArgs) => QueryKey[]);
  optimistic?: (client: QueryClient, ...args: TArgs) => void | Cleanup;
  name?: string;
}

export interface QueryClientOptions {
  gcTime?: number;
}

export interface QueryClient {
  query<T, E = unknown>(
    key: QueryKey | ReadonlySignal<QueryKey> | (() => QueryKey),
    loader: (context: QueryLoaderContext<T>) => Promise<T> | T,
    options?: QueryOptions<T, E>
  ): QueryResult<T, E>;
  prefetch<T, E = unknown>(
    key: QueryKey,
    loader: (context: QueryLoaderContext<T>) => Promise<T> | T,
    options?: QueryOptions<T, E>
  ): Promise<T | undefined>;
  invalidate(key?: QueryKey | ((key: QueryKey) => boolean)): Promise<void>;
  getData<T>(key: QueryKey): T | undefined;
  setData<T>(key: QueryKey, next: T | undefined | ((previous: T | undefined) => T | undefined)): void;
  getStatus(key: QueryKey): AsyncStatus | "missing";
  mutation<TArgs extends unknown[], TResult, E = unknown>(
    handler: (...args: TArgs) => Promise<TResult> | TResult,
    options?: MutationOptions<TArgs, TResult, E>
  ): Action<TArgs, TResult, E>;
}

interface QueryEntry<T = unknown, E = unknown> {
  rawKey: QueryKey;
  keyString: string;
  data: Signal<T | undefined>;
  error: Signal<E | null>;
  pending: Signal<boolean>;
  status: Signal<AsyncStatus>;
  updatedAt: Signal<number>;
  invalidatedAt: Signal<number>;
  promise: Signal<Promise<T | undefined> | null>;
  refreshId: number;
  controller: AbortController | null;
  refs: number;
  gcTimer: ReturnType<typeof setTimeout> | null;
}

function stableStringify(value: unknown): string {
  if (value === undefined) return "undefined";
  if (typeof value === "number") {
    if (Number.isNaN(value)) return "number:NaN";
    if (value === Infinity) return "number:Infinity";
    if (value === -Infinity) return "number:-Infinity";
    if (Object.is(value, -0)) return "number:-0";
  }
  if (typeof value === "bigint") return `bigint:${value.toString()}`;
  if (typeof value === "symbol") return `symbol:${String(value.description || value.toString())}`;
  if (typeof value === "function") return `function:${value.name || "anonymous"}`;
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.keys(value as Record<string, unknown>)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

function serializeKey(key: QueryKey): string {
  return typeof key === "string" ? key : stableStringify(key);
}

class QueryClientImpl implements QueryClient {
  private entries = new Map<string, QueryEntry<any, any>>();
  private gcTime: number;

  constructor(options: QueryClientOptions = {}) {
    this.gcTime = options.gcTime ?? 5 * 60 * 1000;
  }

  query<T, E = unknown>(
    key: QueryKey | ReadonlySignal<QueryKey> | (() => QueryKey),
    loader: (context: QueryLoaderContext<T>) => Promise<T> | T,
    options: QueryOptions<T, E> = {}
  ): QueryResult<T, E> {
    const resolveKey = (): QueryKey => {
      if (typeof key === "function") return (key as () => QueryKey)();
      if (typeof key === "string" || Array.isArray(key)) return key as QueryKey;
      return (key as unknown as ReadonlySignal<QueryKey>)();
    };
    const currentKey = signal<QueryKey>(resolveKey(), { name: `${options.name || "query"}.key` });
    const currentEntry = signal<QueryEntry<T, E>>(this.ensureEntry<T, E>(currentKey.peek(), options), { name: `${options.name || "query"}.entry` });
    let disposed = false;
    let entryCleanup: Cleanup | null = null;

    const attachEntry = (nextKey: QueryKey): void => {
      const nextEntry = this.ensureEntry<T, E>(nextKey, options);
      const previousEntry = currentEntry.peek();
      if (previousEntry === nextEntry) return;
      if (entryCleanup) entryCleanup();
      this.releaseEntry(previousEntry);
      this.retainEntry(nextEntry);
      entryCleanup = () => this.releaseEntry(nextEntry);
      currentEntry.set(nextEntry);
    };

    this.retainEntry(currentEntry.peek());
    entryCleanup = () => this.releaseEntry(currentEntry.peek());

    const stopKeyTracking = effect(() => {
      const nextKey = resolveKey();
      currentKey.set(nextKey);
      attachEntry(nextKey);
      const entry = currentEntry();
      const staleTime = options.staleTime ?? 0;
      const shouldRefresh = entry.status() === "idle"
        || entry.invalidatedAt() >= entry.updatedAt() && entry.invalidatedAt() !== 0
        || (staleTime >= 0 && entry.updatedAt() > 0 && Date.now() - entry.updatedAt() > staleTime);
      if (options.immediate !== false && shouldRefresh) {
        this.fetchEntry(entry, loader, options);
      }
    });

    const dispose = (): void => {
      if (disposed) return;
      disposed = true;
      stopKeyTracking();
      if (entryCleanup) entryCleanup();
      entryCleanup = null;
    };

    return {
      key: computed(() => currentKey()),
      data: computed(() => currentEntry().data()),
      error: computed(() => currentEntry().error()),
      loading: computed(() => currentEntry().pending()),
      status: computed(() => currentEntry().status()),
      stale: computed(() => {
        const entry = currentEntry();
        const staleTime = options.staleTime ?? 0;
        if (entry.invalidatedAt() >= entry.updatedAt() && entry.invalidatedAt() !== 0) return true;
        if (entry.updatedAt() === 0) return true;
        return Date.now() - entry.updatedAt() > staleTime;
      }),
      updatedAt: computed(() => currentEntry().updatedAt()),
      promise: computed(() => currentEntry().promise()),
      refresh: () => this.fetchEntry(currentEntry.peek(), loader, options),
      invalidate: async () => {
        const entry = currentEntry.peek();
        entry.invalidatedAt.set(Date.now());
        return this.fetchEntry(entry, loader, options);
      },
      mutate: (next) => {
        const entry = currentEntry.peek();
        const resolved = typeof next === "function"
          ? (next as (previous: T | undefined) => T | undefined)(entry.data.peek())
          : next;
        entry.data.set(resolved);
        entry.error.set(null);
        entry.pending.set(false);
        entry.promise.set(null);
        entry.status.set(resolved === undefined ? "idle" : "success");
        entry.updatedAt.set(Date.now());
      },
      dispose
    };
  }

  async prefetch<T, E = unknown>(
    key: QueryKey,
    loader: (context: QueryLoaderContext<T>) => Promise<T> | T,
    options: QueryOptions<T, E> = {}
  ): Promise<T | undefined> {
    const entry = this.ensureEntry<T, E>(key, options);
    const result = await this.fetchEntry(entry, loader, options);
    this.scheduleGc(entry);
    return result;
  }

  async invalidate(key?: QueryKey | ((key: QueryKey) => boolean)): Promise<void> {
    const matcher = typeof key === "function"
      ? key
      : key === undefined
        ? (() => true)
        : ((candidate: QueryKey) => serializeKey(candidate) === serializeKey(key));
    for (const entry of Array.from(this.entries.values())) {
      if (!matcher(entry.rawKey)) continue;
      entry.invalidatedAt.set(Date.now());
    }
  }

  getData<T>(key: QueryKey): T | undefined {
    return this.entries.get(serializeKey(key))?.data.peek();
  }

  setData<T>(key: QueryKey, next: T | undefined | ((previous: T | undefined) => T | undefined)): void {
    const entry = this.ensureEntry<T, unknown>(key, {});
    const resolved = typeof next === "function"
      ? (next as (previous: T | undefined) => T | undefined)(entry.data.peek())
      : next;
    entry.data.set(resolved);
    entry.error.set(null);
    entry.pending.set(false);
    entry.promise.set(null);
    entry.status.set(resolved === undefined ? "idle" : "success");
    entry.updatedAt.set(Date.now());
    this.scheduleGc(entry);
  }

  getStatus(key: QueryKey): AsyncStatus | "missing" {
    return this.entries.get(serializeKey(key))?.status.peek() || "missing";
  }

  mutation<TArgs extends unknown[], TResult, E = unknown>(
    handler: (...args: TArgs) => Promise<TResult> | TResult,
    options: MutationOptions<TArgs, TResult, E> = {}
  ): Action<TArgs, TResult, E> {
    return action<TArgs, TResult, E>(async (...args: TArgs) => {
      const rollback = options.optimistic?.(this, ...args);
      try {
        const result = await handler(...args);
        const invalidations = typeof options.invalidate === "function"
          ? options.invalidate(result, args)
          : options.invalidate;
        for (const key of invalidations || []) {
          await this.invalidate(key);
        }
        return result;
      } catch (error) {
        rollback?.();
        throw error;
      }
    }, options);
  }

  private ensureEntry<T, E>(key: QueryKey, options: QueryOptions<T, E>): QueryEntry<T, E> {
    const keyString = serializeKey(key);
    if (this.entries.has(keyString)) {
      const entry = this.entries.get(keyString)! as QueryEntry<T, E>;
      entry.rawKey = key;
      return entry;
    }
    const entry: QueryEntry<T, E> = {
      rawKey: key,
      keyString,
      data: signal<T | undefined>(options.initialData, { name: `${options.name || "query"}.data` }),
      error: signal<E | null>(null, { name: `${options.name || "query"}.error` }),
      pending: signal(false, { name: `${options.name || "query"}.pending` }),
      status: signal<AsyncStatus>(options.initialData === undefined ? "idle" : "success", { name: `${options.name || "query"}.status` }),
      updatedAt: signal(options.initialData === undefined ? 0 : Date.now(), { name: `${options.name || "query"}.updatedAt` }),
      invalidatedAt: signal(0, { name: `${options.name || "query"}.invalidatedAt` }),
      promise: signal<Promise<T | undefined> | null>(null, { name: `${options.name || "query"}.promise` }),
      refreshId: 0,
      controller: null,
      refs: 0,
      gcTimer: null
    };
    this.entries.set(keyString, entry);
    return entry;
  }

  private retainEntry(entry: QueryEntry<any, any>): void {
    entry.refs += 1;
    if (entry.gcTimer) {
      clearTimeout(entry.gcTimer);
      entry.gcTimer = null;
    }
  }

  private releaseEntry(entry: QueryEntry<any, any>): void {
    entry.refs = Math.max(0, entry.refs - 1);
    if (entry.refs > 0) return;
    this.scheduleGc(entry);
  }

  private cancelEntry(entry: QueryEntry<any, any>): void {
    entry.refreshId += 1;
    entry.controller?.abort();
    entry.controller = null;
    entry.pending.set(false);
    entry.promise.set(null);
  }

  private scheduleGc(entry: QueryEntry<any, any>): void {
    if (entry.refs > 0) return;
    if (entry.gcTimer) {
      clearTimeout(entry.gcTimer);
      entry.gcTimer = null;
    }
    const gcTime = this.gcTime;
    if (gcTime <= 0) {
      this.cancelEntry(entry);
      this.entries.delete(entry.keyString);
      return;
    }
    entry.gcTimer = setTimeout(() => {
      entry.gcTimer = null;
      if (entry.refs > 0) return;
      this.cancelEntry(entry);
      this.entries.delete(entry.keyString);
    }, gcTime);
  }

  private fetchEntry<T, E>(
    entry: QueryEntry<T, E>,
    loader: (context: QueryLoaderContext<T>) => Promise<T> | T,
    options: QueryOptions<T, E>
  ): Promise<T | undefined> {
    if (entry.promise.peek()) return entry.promise.peek()!;
    entry.refreshId += 1;
    const refreshId = entry.refreshId;
    entry.controller?.abort();
    entry.controller = new AbortController();
    const previous = entry.data.peek();
    entry.pending.set(true);
    entry.status.set("loading");
    entry.error.set(null);
    if (options.keepPrevious === false) {
      entry.data.set(undefined);
    }
    const promise = Promise.resolve()
      .then(() => loader({
        key: entry.rawKey,
        signal: entry.controller!.signal,
        previous,
        client: this,
        refreshId
      }))
      .then((value) => {
        if (refreshId !== entry.refreshId) return entry.data.peek();
        entry.data.set(value);
        entry.error.set(null);
        entry.status.set("success");
        entry.updatedAt.set(Date.now());
        entry.invalidatedAt.set(0);
        options.onSuccess?.(value);
        return value;
      })
      .catch((error) => {
        if (refreshId !== entry.refreshId) return entry.data.peek();
        entry.error.set(error as E);
        entry.status.set("error");
        options.onError?.(error as E);
        return entry.data.peek();
      })
      .finally(() => {
        if (refreshId !== entry.refreshId) return;
        entry.pending.set(false);
        entry.promise.set(null);
        entry.controller = null;
        this.scheduleGc(entry);
      });
    entry.promise.set(promise);
    return promise;
  }
}

export function createQueryClient(options: QueryClientOptions = {}): QueryClient {
  return new QueryClientImpl(options);
}

export function query<T, E = unknown>(
  client: QueryClient,
  key: QueryKey | ReadonlySignal<QueryKey> | (() => QueryKey),
  loader: (context: QueryLoaderContext<T>) => Promise<T> | T,
  options: QueryOptions<T, E> = {}
): QueryResult<T, E> {
  return client.query(key, loader, options);
}

export function mutation<TArgs extends unknown[], TResult, E = unknown>(
  client: QueryClient,
  handler: (...args: TArgs) => Promise<TResult> | TResult,
  options: MutationOptions<TArgs, TResult, E> = {}
): Action<TArgs, TResult, E> {
  return client.mutation(handler, options);
}
