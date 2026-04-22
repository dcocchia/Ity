type Cleanup$1 = () => void;
type Subscriber<T> = (value: T, previous: T) => void;
interface ReadonlySignal<T> {
    (): T;
    get(): T;
    peek(): T;
    subscribe(callback: Subscriber<T>, options?: {
        immediate?: boolean;
    }): Cleanup$1;
    readonly isSignal: true;
}
interface Signal<T> extends ReadonlySignal<T> {
    (next: T | ((previous: T) => T)): T;
    set(next: T | ((previous: T) => T)): T;
    update(updater: (previous: T) => T): T;
}
type AsyncStatus = "idle" | "loading" | "success" | "error";
interface ActionOptions<TResult, E = unknown> {
    onSuccess?: (value: TResult) => void;
    onError?: (error: E) => void;
    name?: string;
}
interface Action<TArgs extends unknown[], TResult, E = unknown> {
    (...args: TArgs): Promise<TResult>;
    submit(...args: TArgs): Promise<TResult>;
    run(...args: TArgs): void;
    with(...args: TArgs): (...eventArgs: unknown[]) => void;
    from<TEvent = Event>(mapper: (event: TEvent) => TArgs): (event: TEvent) => void;
    readonly data: Signal<TResult | undefined>;
    readonly error: Signal<E | null>;
    readonly pending: ReadonlySignal<boolean>;
    readonly pendingCount: ReadonlySignal<number>;
    readonly status: ReadonlySignal<AsyncStatus>;
    reset(): void;
}

type Cleanup = () => void;
type QueryKey = string | readonly unknown[];
interface QueryLoaderContext<T> {
    key: QueryKey;
    signal: AbortSignal;
    previous: T | undefined;
    client: QueryClient;
    refreshId: number;
}
interface QueryOptions<T, E = unknown> {
    initialData?: T;
    immediate?: boolean;
    staleTime?: number;
    keepPrevious?: boolean;
    gcTime?: number;
    name?: string;
    onSuccess?: (value: T) => void;
    onError?: (error: E) => void;
}
interface QueryResult<T, E = unknown> {
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
interface MutationOptions<TArgs extends unknown[], TResult, E = unknown> extends ActionOptions<TResult, E> {
    invalidate?: QueryKey[] | ((value: TResult, args: TArgs) => QueryKey[]);
    optimistic?: (client: QueryClient, ...args: TArgs) => void | Cleanup;
    name?: string;
}
interface QueryClientOptions {
    gcTime?: number;
}
interface QueryClient {
    query<T, E = unknown>(key: QueryKey | ReadonlySignal<QueryKey> | (() => QueryKey), loader: (context: QueryLoaderContext<T>) => Promise<T> | T, options?: QueryOptions<T, E>): QueryResult<T, E>;
    prefetch<T, E = unknown>(key: QueryKey, loader: (context: QueryLoaderContext<T>) => Promise<T> | T, options?: QueryOptions<T, E>): Promise<T | undefined>;
    invalidate(key?: QueryKey | ((key: QueryKey) => boolean)): Promise<void>;
    getData<T>(key: QueryKey): T | undefined;
    setData<T>(key: QueryKey, next: T | undefined | ((previous: T | undefined) => T | undefined)): void;
    getStatus(key: QueryKey): AsyncStatus | "missing";
    mutation<TArgs extends unknown[], TResult, E = unknown>(handler: (...args: TArgs) => Promise<TResult> | TResult, options?: MutationOptions<TArgs, TResult, E>): Action<TArgs, TResult, E>;
}
declare function createQueryClient(options?: QueryClientOptions): QueryClient;
declare function query<T, E = unknown>(client: QueryClient, key: QueryKey | ReadonlySignal<QueryKey> | (() => QueryKey), loader: (context: QueryLoaderContext<T>) => Promise<T> | T, options?: QueryOptions<T, E>): QueryResult<T, E>;
declare function mutation<TArgs extends unknown[], TResult, E = unknown>(client: QueryClient, handler: (...args: TArgs) => Promise<TResult> | TResult, options?: MutationOptions<TArgs, TResult, E>): Action<TArgs, TResult, E>;

export { createQueryClient, mutation, query };
export type { MutationOptions, QueryClient, QueryClientOptions, QueryKey, QueryLoaderContext, QueryOptions, QueryResult };
