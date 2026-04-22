import { type Action, type ActionOptions, type AsyncStatus, type ReadonlySignal } from "./Ity";
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
    query<T, E = unknown>(key: QueryKey | ReadonlySignal<QueryKey> | (() => QueryKey), loader: (context: QueryLoaderContext<T>) => Promise<T> | T, options?: QueryOptions<T, E>): QueryResult<T, E>;
    prefetch<T, E = unknown>(key: QueryKey, loader: (context: QueryLoaderContext<T>) => Promise<T> | T, options?: QueryOptions<T, E>): Promise<T | undefined>;
    invalidate(key?: QueryKey | ((key: QueryKey) => boolean)): Promise<void>;
    getData<T>(key: QueryKey): T | undefined;
    setData<T>(key: QueryKey, next: T | undefined | ((previous: T | undefined) => T | undefined)): void;
    getStatus(key: QueryKey): AsyncStatus | "missing";
    mutation<TArgs extends unknown[], TResult, E = unknown>(handler: (...args: TArgs) => Promise<TResult> | TResult, options?: MutationOptions<TArgs, TResult, E>): Action<TArgs, TResult, E>;
}
export declare function createQueryClient(options?: QueryClientOptions): QueryClient;
export declare function query<T, E = unknown>(client: QueryClient, key: QueryKey | ReadonlySignal<QueryKey> | (() => QueryKey), loader: (context: QueryLoaderContext<T>) => Promise<T> | T, options?: QueryOptions<T, E>): QueryResult<T, E>;
export declare function mutation<TArgs extends unknown[], TResult, E = unknown>(client: QueryClient, handler: (...args: TArgs) => Promise<TResult> | TResult, options?: MutationOptions<TArgs, TResult, E>): Action<TArgs, TResult, E>;
export {};
