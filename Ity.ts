// Ity.ts 3.0.0
// (c) 2026 Dominic Cocchiarella
// Tiny dependency-free reactive app kernel with V1 MVC compatibility.
declare var define: any;
declare var module: any;

type Cleanup = () => void;
type Equality<T> = (prev: T, next: T) => boolean;
type Subscriber<T> = (value: T, previous: T) => void;
type MaybeSignal<T> = T | ReadonlySignal<T>;
type TemplateValue =
  | TemplateResult
  | UnsafeHTML
  | RepeatResult
  | Node
  | string
  | number
  | boolean
  | null
  | undefined
  | TemplateValue[]
  | ReadonlySignal<any>;

interface ReadonlySignal<T> {
  (): T;
  get(): T;
  peek(): T;
  subscribe(callback: Subscriber<T>, options?: { immediate?: boolean }): Cleanup;
  readonly isSignal: true;
}

interface Signal<T> extends ReadonlySignal<T> {
  (next: T | ((previous: T) => T)): T;
  set(next: T | ((previous: T) => T)): T;
  update(updater: (previous: T) => T): T;
}

interface ReactiveSource {
  observers: Set<ReactiveObserver>;
}

interface ReactiveObserver {
  deps: Set<ReactiveSource>;
  markDirty(): void;
}

interface ComputedOptions<T> {
  equals?: Equality<T>;
  name?: string;
}

interface SignalOptions<T> {
  equals?: Equality<T>;
  name?: string;
}

interface EffectHandle {
  (): void;
  dispose(): void;
}

interface TemplateResult {
  readonly isTemplateResult: true;
  readonly strings: readonly string[];
  readonly values: readonly unknown[];
}

interface RepeatResult {
  readonly isRepeatResult: true;
  readonly values: readonly unknown[];
}

interface UnsafeHTML {
  readonly isUnsafeHTML: true;
  readonly value: string;
}

type HTMLSanitizer = (value: string) => string;

interface UnsafeHTMLOptions {
  sanitize?: HTMLSanitizer;
  config?: ItyConfig | null;
}

interface ItyConfig {
  sanitizeHTML?: HTMLSanitizer | null;
  onWarning?: ((warning: RuntimeWarning) => void) | null;
}

interface RenderOptions {
  reactive?: boolean;
  transition?: boolean;
  config?: ItyConfig | null;
  mode?: "replace" | "morph";
  scope?: ItyScope | null;
  warnOnMismatch?: boolean;
}

interface RuntimeWarning {
  code: string;
  message: string;
  detail?: unknown;
}

interface RuntimeEventBase {
  type: string;
  timestamp: number;
}

interface RuntimeEvent extends RuntimeEventBase {
  name?: string;
  detail?: unknown;
}

type RuntimeObserver = (event: RuntimeEvent) => void;

type ScopeKey = string | symbol;

interface ScopeOptions {
  parent?: ItyScope | null;
  name?: string;
}

interface ItyScope {
  readonly parent: ItyScope | null;
  readonly name: string | null;
  provide<T>(key: ScopeKey, value: T): Signal<T>;
  set<T>(key: ScopeKey, value: T): T;
  get<T>(key: ScopeKey, fallback?: T): T;
  signal<T>(key: ScopeKey, fallback?: T): ReadonlySignal<T>;
  has(key: ScopeKey): boolean;
  delete(key: ScopeKey): void;
}

type StoreKey = string | symbol;

interface StoreApi<T extends Record<StoreKey, any>> {
  $patch(patch: Partial<T> | ((current: T) => Partial<T> | void)): void;
  $snapshot(): T;
  $subscribe(callback: (value: T) => void, options?: { immediate?: boolean }): Cleanup;
}

type Store<T extends Record<StoreKey, any>> = T & StoreApi<T>;

type AsyncStatus = "idle" | "loading" | "success" | "error";

interface ResourceContext<T> {
  signal: AbortSignal;
  previous: T | undefined;
  refreshId: number;
}

interface ResourceOptions<T, E = unknown> {
  initialValue?: T;
  immediate?: boolean;
  keepPrevious?: boolean;
  onSuccess?: (value: T) => void;
  onError?: (error: E) => void;
  name?: string;
}

interface Resource<T, E = unknown> {
  readonly data: Signal<T | undefined>;
  readonly error: Signal<E | null>;
  readonly loading: ReadonlySignal<boolean>;
  readonly status: ReadonlySignal<AsyncStatus>;
  readonly promise: Promise<T | undefined> | null;
  refresh(): Promise<T | undefined>;
  mutate(value: T | undefined): void;
  abort(reason?: unknown): void;
}

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

interface FormController<TResult, E = unknown> {
  readonly action: Action<[FormData, Event], TResult, E>;
  readonly data: Signal<TResult | undefined>;
  readonly error: Signal<E | null>;
  readonly pending: ReadonlySignal<boolean>;
  readonly status: ReadonlySignal<AsyncStatus>;
  onSubmit(event: Event): Promise<TResult>;
  handleSubmit(event: Event): void;
  reset(): void;
}

interface FormOptions<TResult, E = unknown> extends ActionOptions<TResult, E> {
  resetOnSuccess?: boolean;
}

type FormErrorMap<TValues extends Record<string, any>> = Partial<Record<Extract<keyof TValues, string>, string>>;

interface FormBindOptions<T> {
  type?: "text" | "textarea" | "select" | "select-multiple" | "checkbox" | "radio" | "number";
  event?: string;
  name?: string;
  value?: unknown;
  parse?: (value: unknown, event: Event) => T;
  format?: (value: T) => unknown;
}

interface FormStateOptions<TValues extends Record<string, any>> {
  validators?: Partial<{ [K in keyof TValues]: (value: TValues[K], values: TValues) => string | null | undefined }>;
  validate?: (values: TValues) => FormErrorMap<TValues> | void;
}

interface FormField<T> {
  readonly value: Signal<T>;
  readonly error: ReadonlySignal<string | null>;
  readonly touched: ReadonlySignal<boolean>;
  readonly dirty: ReadonlySignal<boolean>;
  bind(options?: FormBindOptions<T>): Record<string, unknown>;
  set(next: T | ((previous: T) => T)): T;
  reset(): void;
}

interface FormStateSubmitOptions<TResult, E = unknown> extends ActionOptions<TResult, E> {
  resetOnSuccess?: boolean;
}

interface FormStateController<TValues extends Record<string, any>, TResult, E = unknown> {
  readonly state: FormState<TValues>;
  readonly action: Action<[TValues, Event], TResult, E>;
  readonly data: Signal<TResult | undefined>;
  readonly error: Signal<E | null>;
  readonly pending: ReadonlySignal<boolean>;
  readonly status: ReadonlySignal<AsyncStatus>;
  onSubmit(event: Event): Promise<TResult | undefined>;
  handleSubmit(event: Event): void;
  reset(): void;
}

interface FormState<TValues extends Record<string, any>> {
  readonly values: Store<TValues>;
  readonly initialValues: ReadonlySignal<TValues>;
  readonly errors: Store<FormErrorMap<TValues>>;
  readonly touched: Store<Partial<Record<Extract<keyof TValues, string>, boolean>>>;
  readonly dirty: ReadonlySignal<boolean>;
  readonly valid: ReadonlySignal<boolean>;
  field<K extends keyof TValues>(name: K): FormField<TValues[K]>;
  bind<K extends keyof TValues>(name: K, options?: FormBindOptions<TValues[K]>): Record<string, unknown>;
  set(next: Partial<TValues> | ((current: TValues) => Partial<TValues> | void)): void;
  reset(next?: Partial<TValues> | TValues): void;
  validate(names?: readonly (keyof TValues)[]): boolean;
  markTouched(names?: readonly (keyof TValues)[]): void;
  submit<TResult, E = unknown>(
    handler: (values: TValues, event: Event) => Promise<TResult> | TResult,
    options?: FormStateSubmitOptions<TResult, E>
  ): FormStateController<TValues, TResult, E>;
}

interface RenderToStringOptions {
  config?: ItyConfig | null;
}

interface RegisteredFormBinding<T> {
  domName: string;
  type: NonNullable<FormBindOptions<T>["type"]> | "text";
  value?: unknown;
  parse?: (value: unknown, event: Event) => T;
}

const defaultEquals = Object.is;
let activeObserver: ReactiveObserver | null = null;
let batchDepth = 0;
const pendingEffects = new Set<ReactiveEffect>();
let configuredSanitizeHTML: HTMLSanitizer | undefined;
let configuredWarningHandler: ((warning: RuntimeWarning) => void) | undefined;
const activeConfigStack: Array<ItyConfig | null> = [];
const runtimeObservers = new Set<RuntimeObserver>();
const renderScopeByTarget = new WeakMap<object, ItyScope>();
let scopeId = 0;
let runtimeDispatchDepth = 0;

function emitRuntimeEvent(event: RuntimeEvent): void {
  if (runtimeDispatchDepth > 0 || runtimeObservers.size === 0) return;
  runtimeDispatchDepth += 1;
  try {
    for (const observer of Array.from(runtimeObservers)) {
      observer(event);
    }
  } finally {
    runtimeDispatchDepth -= 1;
  }
}

function observeRuntime(observer: RuntimeObserver): Cleanup {
  runtimeObservers.add(observer);
  return () => {
    runtimeObservers.delete(observer);
  };
}

function warnRuntime(code: string, message: string, detail?: unknown): void {
  const warning: RuntimeWarning = { code, message, detail };
  const handler = currentConfig()?.onWarning || configuredWarningHandler;
  handler?.(warning);
  emitRuntimeEvent({
    type: "warning",
    timestamp: Date.now(),
    name: code,
    detail: warning
  });
}

class ScopeNode implements ItyScope {
  readonly parent: ItyScope | null;
  readonly name: string | null;
  private entries = new Map<ScopeKey, Signal<unknown>>();
  private readonly structure: Signal<number>;

  constructor(options: ScopeOptions = {}) {
    this.parent = options.parent || null;
    this.name = options.name || `scope:${++scopeId}`;
    this.structure = signal(0, { name: `${this.name ?? "scope"}.structure` });
  }

  private bumpStructure(): void {
    this.structure.update((value) => value + 1);
  }

  private readSignalValue<T>(key: ScopeKey, fallback?: T): T {
    this.structure();
    if (this.entries.has(key)) return (this.entries.get(key)! as Signal<T>)();
    if (this.parent instanceof ScopeNode) return this.parent.readSignalValue(key, fallback as T);
    if (this.parent) return this.parent.signal(key, fallback as T)();
    return fallback as T;
  }

  provide<T>(key: ScopeKey, value: T): Signal<T> {
    const existing = this.entries.get(key) as Signal<T> | undefined;
    if (existing) {
      existing.set(value);
      return existing;
    }
    const entry = signal(value, { name: `${this.name ?? "scope"}.${String(key)}` });
    this.entries.set(key, entry as Signal<unknown>);
    this.bumpStructure();
    emitRuntimeEvent({
      type: "scope:provide",
      timestamp: Date.now(),
      name: this.name || undefined,
      detail: { key: String(key), value }
    });
    return entry;
  }

  set<T>(key: ScopeKey, value: T): T {
    this.provide(key, value);
    return value;
  }

  get<T>(key: ScopeKey, fallback?: T): T {
    if (this.entries.has(key)) return (this.entries.get(key)! as Signal<T>)();
    if (this.parent) return this.parent.get(key, fallback as T);
    return fallback as T;
  }

  signal<T>(key: ScopeKey, fallback?: T): ReadonlySignal<T> {
    return computed(() => {
      return this.readSignalValue(key, fallback);
    });
  }

  has(key: ScopeKey): boolean {
    return this.entries.has(key) || Boolean(this.parent?.has(key));
  }

  delete(key: ScopeKey): void {
    if (!this.entries.has(key)) return;
    this.entries.delete(key);
    this.bumpStructure();
    emitRuntimeEvent({
      type: "scope:delete",
      timestamp: Date.now(),
      name: this.name || undefined,
      detail: { key: String(key) }
    });
  }
}

function createScope(options: ScopeOptions = {}): ItyScope {
  return new ScopeNode(options);
}

function getWindow(): (Window & typeof globalThis) | undefined {
  return typeof window !== "undefined" ? window : undefined;
}

function getDocument(): Document | undefined {
  const win = getWindow();
  return win?.document ?? (typeof document !== "undefined" ? document : undefined);
}

function hasOwn(target: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(target, key);
}

function isPlainObject(value: unknown): value is Record<string, any> {
  if (!value || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function cloneValue<T>(value: T): T {
  const cloneFn = (globalThis as any).structuredClone;
  if (typeof cloneFn === "function") return cloneFn(value);
  if (Array.isArray(value)) return value.map((item) => cloneValue(item)) as T;
  if (isPlainObject(value)) {
    const out: Record<string, any> = {};
    for (const key of Reflect.ownKeys(value)) {
      out[key as any] = cloneValue((value as any)[key]);
    }
    return out as T;
  }
  return value;
}

function deepEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) return false;
    for (let i = 0; i < left.length; i += 1) {
      if (!deepEqual(left[i], right[i])) return false;
    }
    return true;
  }
  if (isPlainObject(left) && isPlainObject(right)) {
    const leftKeys = Reflect.ownKeys(left);
    const rightKeys = Reflect.ownKeys(right);
    if (leftKeys.length !== rightKeys.length) return false;
    for (const key of leftKeys) {
      if (!rightKeys.includes(key)) return false;
      if (!deepEqual((left as any)[key], (right as any)[key])) return false;
    }
    return true;
  }
  return false;
}

function currentConfig(): ItyConfig | null {
  return activeConfigStack.length ? activeConfigStack[activeConfigStack.length - 1] : null;
}

function withConfig<T>(config: ItyConfig | null | undefined, callback: () => T): T {
  activeConfigStack.push(config || null);
  try {
    return callback();
  } finally {
    activeConfigStack.pop();
  }
}

function resolveSanitizeHTML(options: UnsafeHTMLOptions = {}): HTMLSanitizer | undefined {
  if (options.sanitize) return options.sanitize;
  const scoped = options.config ?? currentConfig();
  if (scoped && hasOwn(scoped, "sanitizeHTML")) {
    return scoped.sanitizeHTML || undefined;
  }
  return configuredSanitizeHTML;
}

function trackDependency(source: ReactiveSource): void {
  if (!activeObserver) return;
  source.observers.add(activeObserver);
  activeObserver.deps.add(source);
}

function cleanupDependencies(observer: ReactiveObserver): void {
  for (const dep of observer.deps) {
    dep.observers.delete(observer);
  }
  observer.deps.clear();
}

function notifyObservers(source: ReactiveSource): void {
  for (const observer of Array.from(source.observers)) {
    observer.markDirty();
  }
}

function flushEffects(): void {
  if (batchDepth > 0) return;
  while (pendingEffects.size) {
    const effects = Array.from(pendingEffects);
    pendingEffects.clear();
    for (const effect of effects) {
      effect.run();
    }
  }
}

function queueEffect(effect: ReactiveEffect): void {
  pendingEffects.add(effect);
  flushEffects();
}

class SignalNode<T> implements ReactiveSource {
  observers = new Set<ReactiveObserver>();
  private subscribers = new Set<Subscriber<T>>();
  private value: T;
  private equals: Equality<T>;
  private name: string | undefined;

  constructor(value: T, options: SignalOptions<T> = {}) {
    this.value = value;
    this.equals = options.equals || defaultEquals;
    this.name = options.name;
  }

  read(track = true): T {
    if (track) trackDependency(this);
    return this.value;
  }

  write(next: T | ((previous: T) => T)): T {
    const previous = this.value;
    const resolved = typeof next === "function"
      ? (next as (previous: T) => T)(previous)
      : next;
    if (this.equals(previous, resolved)) return previous;
    this.value = resolved;
    emitRuntimeEvent({
      type: "signal:set",
      timestamp: Date.now(),
      name: this.name,
      detail: { previous, value: resolved }
    });
    notifyObservers(this);
    for (const subscriber of Array.from(this.subscribers)) {
      subscriber(resolved, previous);
    }
    flushEffects();
    return resolved;
  }

  subscribe(callback: Subscriber<T>, options: { immediate?: boolean } = {}): Cleanup {
    this.subscribers.add(callback);
    if (options.immediate) callback(this.value, this.value);
    return () => {
      this.subscribers.delete(callback);
    };
  }
}

class ComputedNode<T> implements ReactiveSource, ReactiveObserver {
  observers = new Set<ReactiveObserver>();
  deps = new Set<ReactiveSource>();
  private subscribers = new Set<Subscriber<T>>();
  private dirty = true;
  private initialized = false;
  private value!: T;
  private equals: Equality<T>;
  private name: string | undefined;

  constructor(private readonly getter: () => T, options: ComputedOptions<T> = {}) {
    this.equals = options.equals || defaultEquals;
    this.name = (options as any).name;
  }

  read(track = true): T {
    if (track) trackDependency(this);
    if (this.dirty) this.evaluate();
    return this.value;
  }

  markDirty(): void {
    if (this.dirty) return;
    const previous = this.value;
    this.dirty = true;
    notifyObservers(this);
    if (this.subscribers.size) {
      const next = this.read(false);
      if (!this.equals(previous, next)) {
        for (const subscriber of Array.from(this.subscribers)) {
          subscriber(next, previous);
        }
      }
    }
  }

  subscribe(callback: Subscriber<T>, options: { immediate?: boolean } = {}): Cleanup {
    this.subscribers.add(callback);
    if (options.immediate) {
      const current = this.read(false);
      callback(current, current);
    }
    return () => {
      this.subscribers.delete(callback);
    };
  }

  private evaluate(): void {
    cleanupDependencies(this);
    const previousObserver = activeObserver;
    activeObserver = this;
    try {
      this.value = this.getter();
      this.dirty = false;
      this.initialized = true;
      emitRuntimeEvent({
        type: "computed:evaluate",
        timestamp: Date.now(),
        name: this.name
      });
    } finally {
      activeObserver = previousObserver;
    }
  }
}

class ReactiveEffect implements ReactiveObserver {
  deps = new Set<ReactiveSource>();
  private disposed = false;
  private cleanup?: Cleanup;

  constructor(private readonly callback: (onCleanup: (cleanup: Cleanup) => void) => void) {
    this.run();
  }

  markDirty(): void {
    if (!this.disposed) queueEffect(this);
  }

  run(): void {
    if (this.disposed) return;
    cleanupDependencies(this);
    if (this.cleanup) {
      const cleanup = this.cleanup;
      this.cleanup = undefined;
      cleanup();
    }
    const previousObserver = activeObserver;
    activeObserver = this;
    try {
      this.callback((cleanup) => {
        this.cleanup = cleanup;
      });
    } finally {
      activeObserver = previousObserver;
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    cleanupDependencies(this);
    if (this.cleanup) {
      const cleanup = this.cleanup;
      this.cleanup = undefined;
      cleanup();
    }
    pendingEffects.delete(this);
  }
}

function signal<T>(initialValue: T, options: SignalOptions<T> = {}): Signal<T> {
  const node = new SignalNode(initialValue, options);
  const readWrite = function (next?: T | ((previous: T) => T)): T {
    if (arguments.length === 0) return node.read(true);
    return node.write(next as T | ((previous: T) => T));
  } as Signal<T>;
  readWrite.get = () => node.read(true);
  readWrite.peek = () => node.read(false);
  readWrite.set = (next) => node.write(next);
  readWrite.update = (updater) => node.write(updater);
  readWrite.subscribe = (callback, subscribeOptions) => node.subscribe(callback, subscribeOptions);
  Object.defineProperty(readWrite, "isSignal", { value: true });
  return readWrite;
}

function computed<T>(getter: () => T, options: ComputedOptions<T> = {}): ReadonlySignal<T> {
  const node = new ComputedNode(getter, options);
  const read = function (): T {
    return node.read(true);
  } as ReadonlySignal<T>;
  read.get = () => node.read(true);
  read.peek = () => node.read(false);
  read.subscribe = (callback, subscribeOptions) => node.subscribe(callback, subscribeOptions);
  Object.defineProperty(read, "isSignal", { value: true });
  return read;
}

function effect(callback: (onCleanup: (cleanup: Cleanup) => void) => void): EffectHandle {
  const runner = new ReactiveEffect(callback);
  const dispose = (() => runner.dispose()) as EffectHandle;
  dispose.dispose = dispose;
  return dispose;
}

function batch<T>(callback: () => T): T {
  batchDepth += 1;
  try {
    return callback();
  } finally {
    batchDepth -= 1;
    flushEffects();
  }
}

function untrack<T>(callback: () => T): T {
  const previousObserver = activeObserver;
  activeObserver = null;
  try {
    return callback();
  } finally {
    activeObserver = previousObserver;
  }
}

function isSignal<T = unknown>(value: unknown): value is ReadonlySignal<T> {
  return typeof value === "function" && (value as any).isSignal === true;
}

function resolveSignal<T>(value: MaybeSignal<T>): T {
  return isSignal<T>(value) ? value() : value;
}

function configure(options: ItyConfig = {}): void {
  configuredSanitizeHTML = options.sanitizeHTML || undefined;
  configuredWarningHandler = options.onWarning || undefined;
}

function createConfig(options: ItyConfig = {}): ItyConfig {
  const config: ItyConfig = {};
  if (hasOwn(options, "sanitizeHTML")) config.sanitizeHTML = options.sanitizeHTML ?? null;
  if (hasOwn(options, "onWarning")) config.onWarning = options.onWarning ?? null;
  return config;
}

function store<T extends Record<StoreKey, any>>(initialValue: T): Store<T> {
  const keys = new Set<StoreKey>(Reflect.ownKeys(initialValue));
  const signals = new Map<StoreKey, Signal<any>>();
  const structure = signal(0);

  const ensureSignal = (key: StoreKey): Signal<any> => {
    if (!signals.has(key)) {
      signals.set(key, signal((initialValue as any)[key]));
    }
    return signals.get(key)!;
  };

  const bumpStructure = (): void => {
    structure.update((version) => version + 1);
  };

  const setKey = (key: StoreKey, value: any): void => {
    const hadKey = keys.has(key);
    if (!hadKey) keys.add(key);
    ensureSignal(key).set(value);
    if (!hadKey) bumpStructure();
  };

  const snapshot = (): T => {
    structure();
    const out: any = {};
    for (const key of keys) {
      out[key] = ensureSignal(key)();
    }
    return out as T;
  };

  const api: StoreApi<T> = {
    $patch(patch) {
      const current = snapshot();
      const next = typeof patch === "function" ? patch(current) : patch;
      if (!next) return;
      batch(() => {
        for (const key of Reflect.ownKeys(next)) {
          setKey(key, (next as any)[key]);
        }
      });
    },
    $snapshot: snapshot,
    $subscribe(callback, options = {}) {
      let first = true;
      return effect(() => {
        const value = snapshot();
        if (first && !options.immediate) {
          first = false;
          return;
        }
        first = false;
        callback(value);
      });
    }
  };

  return new Proxy(api as Store<T>, {
    get(target, key, receiver) {
      if (key in target) return Reflect.get(target, key, receiver);
      return ensureSignal(key)();
    },
    set(_target, key, value) {
      batch(() => {
        setKey(key, value);
      });
      return true;
    },
    deleteProperty(_target, key) {
      if (!keys.has(key)) return true;
      keys.delete(key);
      batch(() => {
        ensureSignal(key).set(undefined);
        bumpStructure();
      });
      return true;
    },
    ownKeys(target) {
      structure();
      return Array.from(new Set([...Reflect.ownKeys(target), ...keys]));
    },
    getOwnPropertyDescriptor(target, key) {
      structure();
      if (Object.prototype.hasOwnProperty.call(target, key)) {
        return { ...Reflect.getOwnPropertyDescriptor(target, key)!, enumerable: false };
      }
      if (!keys.has(key)) return undefined;
      return { enumerable: true, configurable: true };
    },
    has(target, key) {
      structure();
      return key in target || keys.has(key);
    }
  });
}

function resource<T, E = unknown>(
  loader: (context: ResourceContext<T>) => Promise<T> | T,
  options: ResourceOptions<T, E> = {}
): Resource<T, E> {
  const data = signal<T | undefined>(options.initialValue);
  const error = signal<E | null>(null);
  const pending = signal(false);
  const statusValue = signal<AsyncStatus>(options.initialValue === undefined ? "idle" : "success");
  const loading = computed(() => pending());
  const status = computed(() => statusValue());
  const keepPrevious = options.keepPrevious !== false;
  let controller: AbortController | null = null;
  let refreshId = 0;
  let currentPromise: Promise<T | undefined> | null = null;

  const api: Resource<T, E> = {
    data,
    error,
    loading,
    status,
    get promise() {
      return currentPromise;
    },
    refresh() {
      refreshId += 1;
      const id = refreshId;
      if (controller) controller.abort();
      controller = new AbortController();
      const signal = controller.signal;
      const previous = data.peek();
      pending.set(true);
      statusValue.set("loading");
      error.set(null);
      emitRuntimeEvent({
        type: "resource:refresh",
        timestamp: Date.now(),
        name: options.name,
        detail: { refreshId: id }
      });
      if (!keepPrevious) data.set(undefined);

      currentPromise = Promise.resolve()
        .then(() => loader({ signal, previous, refreshId: id }))
        .then((value) => {
          if (id !== refreshId || signal.aborted) return data.peek();
          data.set(value);
          error.set(null);
          statusValue.set("success");
          emitRuntimeEvent({
            type: "resource:success",
            timestamp: Date.now(),
            name: options.name,
            detail: { refreshId: id, value }
          });
          options.onSuccess?.(value);
          return value;
        })
        .catch((err) => {
          if (id !== refreshId) return data.peek();
          error.set(err as E);
          statusValue.set("error");
          emitRuntimeEvent({
            type: "resource:error",
            timestamp: Date.now(),
            name: options.name,
            detail: { refreshId: id, error: err }
          });
          options.onError?.(err as E);
          return data.peek();
        })
        .finally(() => {
          if (id === refreshId) {
            pending.set(false);
            controller = null;
          }
        });

      return currentPromise;
    },
    mutate(value) {
      refreshId += 1;
      if (controller) controller.abort();
      controller = null;
      currentPromise = null;
      data.set(value);
      error.set(null);
      pending.set(false);
      statusValue.set(value === undefined ? "idle" : "success");
      emitRuntimeEvent({
        type: "resource:mutate",
        timestamp: Date.now(),
        name: options.name,
        detail: { value }
      });
    },
    abort(reason?: unknown) {
      if (!controller) return;
      refreshId += 1;
      controller.abort(reason);
      controller = null;
      currentPromise = null;
      pending.set(false);
      statusValue.set(data.peek() === undefined ? "idle" : "success");
      emitRuntimeEvent({
        type: "resource:abort",
        timestamp: Date.now(),
        name: options.name,
        detail: { reason }
      });
    }
  };

  if (options.immediate !== false) {
    api.refresh();
  }

  return api;
}

function action<TArgs extends unknown[], TResult, E = unknown>(
  handler: (...args: TArgs) => Promise<TResult> | TResult,
  options: ActionOptions<TResult, E> = {}
): Action<TArgs, TResult, E> {
  const data = signal<TResult | undefined>(undefined);
  const error = signal<E | null>(null);
  const count = signal(0);
  const statusValue = signal<AsyncStatus>("idle");
  const pending = computed(() => count() > 0);
  const pendingCount = computed(() => count());
  const status = computed(() => statusValue());
  let generation = 0;

  const submit = (...args: TArgs): Promise<TResult> => {
    const runGeneration = generation;
    count.update((value) => value + 1);
    statusValue.set("loading");
    error.set(null);
    emitRuntimeEvent({
      type: "action:start",
      timestamp: Date.now(),
      name: options.name,
      detail: { args }
    });

    return Promise.resolve()
      .then(() => handler(...args))
      .then((value) => {
        if (runGeneration === generation) {
          data.set(value);
          error.set(null);
          emitRuntimeEvent({
            type: "action:success",
            timestamp: Date.now(),
            name: options.name,
            detail: { args, value }
          });
          options.onSuccess?.(value);
          if (count.peek() <= 1) statusValue.set("success");
        }
        return value;
      })
      .catch((err) => {
        if (runGeneration === generation) {
          error.set(err as E);
          emitRuntimeEvent({
            type: "action:error",
            timestamp: Date.now(),
            name: options.name,
            detail: { args, error: err }
          });
          options.onError?.(err as E);
          if (count.peek() <= 1) statusValue.set("error");
        }
        throw err;
      })
      .finally(() => {
        if (runGeneration !== generation) return;
        count.update((value) => Math.max(0, value - 1));
        if (count.peek() > 0) statusValue.set("loading");
      });
  };

  const callable = ((...args: TArgs) => submit(...args)) as Action<TArgs, TResult, E>;
  const mutableCallable = callable as Action<TArgs, TResult, E> & {
    submit: (...args: TArgs) => Promise<TResult>;
    run: (...args: TArgs) => void;
    with: (...args: TArgs) => (...eventArgs: unknown[]) => void;
    from: <TEvent = Event>(mapper: (event: TEvent) => TArgs) => (event: TEvent) => void;
    data: Signal<TResult | undefined>;
    error: Signal<E | null>;
    pending: ReadonlySignal<boolean>;
    pendingCount: ReadonlySignal<number>;
    status: ReadonlySignal<AsyncStatus>;
  };
  mutableCallable.submit = submit;
  mutableCallable.run = (...args: TArgs) => {
    submit(...args).catch(() => undefined);
  };
  mutableCallable.with = (...args: TArgs) => {
    return () => {
      mutableCallable.run(...args);
    };
  };
  mutableCallable.from = <TEvent = Event>(mapper: (event: TEvent) => TArgs) => {
    return (event: TEvent) => {
      mutableCallable.run(...mapper(event));
    };
  };
  mutableCallable.data = data;
  mutableCallable.error = error;
  mutableCallable.pending = pending;
  mutableCallable.pendingCount = pendingCount;
  mutableCallable.status = status;
  callable.reset = () => {
    generation += 1;
    data.set(undefined);
    error.set(null);
    count.set(0);
    statusValue.set("idle");
    emitRuntimeEvent({
      type: "action:reset",
      timestamp: Date.now(),
      name: options.name
    });
  };
  return callable;
}

function getFormElementCtor(node: Element | null): typeof HTMLFormElement | undefined {
  const ownerWindow = node?.ownerDocument?.defaultView as (Window & typeof globalThis) | null | undefined;
  return ownerWindow?.HTMLFormElement
    || getWindow()?.HTMLFormElement
    || (typeof HTMLFormElement !== "undefined" ? HTMLFormElement : undefined);
}

function isFormElement(node: Element | null | undefined, fallbackNode?: Element | null): node is HTMLFormElement {
  const FormElement = node ? getFormElementCtor(node) : getFormElementCtor(fallbackNode || null);
  return Boolean(node && FormElement && node instanceof FormElement);
}

function findFormElement(event: Event): HTMLFormElement {
  const target = (event.currentTarget || event.target) as Element | null;
  if (!getFormElementCtor(target)) throw new Error("Ity.form requires HTMLFormElement support");
  if (isFormElement(target, target)) return target;
  const closest = target?.closest?.("form");
  if (isFormElement(closest, target)) return closest;
  throw new Error("Ity.form onSubmit requires a form event target");
}

function createFormDataForElement(formElement: HTMLFormElement): FormData {
  const ownerWindow = formElement.ownerDocument?.defaultView as (Window & typeof globalThis) | null | undefined;
  const FormDataCtor = ownerWindow?.FormData
    || getWindow()?.FormData
    || (typeof FormData !== "undefined" ? FormData : undefined);
  if (!FormDataCtor) throw new Error("Ity.form requires FormData support");
  return new FormDataCtor(formElement);
}

function form<TResult, E = unknown>(
  handler: (data: FormData, event: Event) => Promise<TResult> | TResult,
  options: FormOptions<TResult, E> = {}
): FormController<TResult, E> {
  const submitAction = action<[FormData, Event], TResult, E>(handler, options);

  const onSubmit = async (event: Event): Promise<TResult> => {
    event.preventDefault();
    const formElement = findFormElement(event);
    const result = await submitAction(createFormDataForElement(formElement), event);
    if (options.resetOnSuccess) formElement.reset();
    return result;
  };

  return {
    action: submitAction,
    data: submitAction.data,
    error: submitAction.error,
    pending: submitAction.pending,
    status: submitAction.status,
    onSubmit,
    handleSubmit(event: Event): void {
      onSubmit(event).catch(() => undefined);
    },
    reset() {
      submitAction.reset();
    }
  };
}

function replaceStoreSnapshot<T extends Record<string, any>>(target: Store<T>, nextValue: Partial<T>): void {
  const current = target.$snapshot() as Record<string, any>;
  batch(() => {
    for (const key of Reflect.ownKeys(current)) {
      if (!hasOwn(nextValue as object, key)) delete (target as any)[key];
    }
    for (const key of Reflect.ownKeys(nextValue)) {
      (target as any)[key] = (nextValue as any)[key];
    }
  });
}

function formState<TValues extends Record<string, any>>(
  initialValue: TValues,
  options: FormStateOptions<TValues> = {}
): FormState<TValues> {
  const values = store(cloneValue(initialValue));
  const initialValues = signal(cloneValue(initialValue));
  const errors = store({} as FormErrorMap<TValues>);
  const touched = store({} as Partial<Record<Extract<keyof TValues, string>, boolean>>);
  const registeredBindings = new Map<Extract<keyof TValues, string>, Map<string, RegisteredFormBinding<any>>>();

  const allFieldNames = (): Array<Extract<keyof TValues, string>> => {
    const names = new Set<string>();
    Reflect.ownKeys(initialValues.peek()).forEach((key) => names.add(String(key)));
    Reflect.ownKeys(values.$snapshot()).forEach((key) => names.add(String(key)));
    return Array.from(names) as Array<Extract<keyof TValues, string>>;
  };

  const computeErrors = (snapshot: TValues): FormErrorMap<TValues> => {
    const out: FormErrorMap<TValues> = {};
    const validators = options.validators || {};
    for (const key of allFieldNames()) {
      const validator = (validators as any)[key] as ((value: TValues[keyof TValues], values: TValues) => string | null | undefined) | undefined;
      if (!validator) continue;
      const message = validator((snapshot as any)[key], snapshot);
      if (message) out[key] = message;
    }
    const formErrors = options.validate?.(snapshot);
    if (formErrors) {
      for (const key of Reflect.ownKeys(formErrors)) {
        const message = (formErrors as any)[key];
        if (message) (out as any)[key] = message;
      }
    }
    return out;
  };

  const syncErrors = (): boolean => {
    const nextErrors = computeErrors(values.$snapshot());
    replaceStoreSnapshot(errors as any, nextErrors);
    return Reflect.ownKeys(nextErrors).length === 0;
  };

  const markTouched = (names?: readonly (keyof TValues)[]): void => {
    const keys = names?.length
      ? names.map((name) => String(name))
      : allFieldNames();
    batch(() => {
      for (const key of keys) {
        (touched as any)[key] = true;
      }
    });
  };

  const maybeValidateTouched = (): void => {
    const touchedSnapshot = touched.$snapshot();
    if (Reflect.ownKeys(touchedSnapshot).some((key) => Boolean((touchedSnapshot as any)[key]))) {
      syncErrors();
    }
  };

  const set = (next: Partial<TValues> | ((current: TValues) => Partial<TValues> | void)): void => {
    values.$patch((current) => {
      const patch = typeof next === "function" ? next(current) : next;
      return patch || {};
    });
    maybeValidateTouched();
  };

  const reset = (next?: Partial<TValues> | TValues): void => {
    const base = cloneValue(next
      ? { ...initialValues.peek(), ...(next as any) }
      : initialValues.peek());
    initialValues.set(cloneValue(base));
    replaceStoreSnapshot(values as any, base);
    replaceStoreSnapshot(errors as any, {});
    replaceStoreSnapshot(touched as any, {});
  };

  const createFieldSignal = <K extends keyof TValues>(name: K): Signal<TValues[K]> => {
    const signalLike = function (next?: TValues[K] | ((previous: TValues[K]) => TValues[K])): TValues[K] {
      if (arguments.length === 0) return (values as any)[name];
      const previous = (values as any)[name];
      const resolved = typeof next === "function"
        ? (next as (previous: TValues[K]) => TValues[K])(previous)
        : next;
      (values as any)[name] = resolved;
      maybeValidateTouched();
      return resolved as TValues[K];
    } as Signal<TValues[K]>;
    signalLike.get = () => (values as any)[name];
    signalLike.peek = () => untrack(() => (values as any)[name]);
    signalLike.set = (next) => signalLike(next);
    signalLike.update = (updater) => signalLike(updater);
    signalLike.subscribe = (callback, subscribeOptions = {}) => {
      let first = true;
      let previous = signalLike.peek();
      return effect(() => {
        const current = (values as any)[name];
        if (first) {
          first = false;
          previous = current;
          if (subscribeOptions.immediate) callback(current, current);
          return;
        }
        if (!Object.is(previous, current)) {
          const prev = previous;
          previous = current;
          callback(current, prev);
        }
      });
    };
    Object.defineProperty(signalLike, "isSignal", { value: true });
    return signalLike;
  };

  const registerBinding = <K extends keyof TValues>(
    name: K,
    domName: string,
    type: RegisteredFormBinding<TValues[K]>["type"],
    bindOptions: FormBindOptions<TValues[K]>
  ): void => {
    const fieldName = String(name) as Extract<keyof TValues, string>;
    const fieldBindings = registeredBindings.get(fieldName) || new Map<string, RegisteredFormBinding<TValues[K]>>();
    const signature = `${domName}|${type}|${String(bindOptions.value)}`;
    fieldBindings.set(signature, {
      domName,
      type,
      value: bindOptions.value,
      parse: bindOptions.parse
    });
    registeredBindings.set(fieldName, fieldBindings as Map<string, RegisteredFormBinding<any>>);
  };

  const syncFromForm = (event: Event): void => {
    const NO_FORM_VALUE = Symbol("ity.formState.noValue");
    let formElement: HTMLFormElement;
    try {
      formElement = findFormElement(event);
    } catch (_error) {
      return;
    }
    const formData = createFormDataForElement(formElement);
    const controls = Array.from((formElement as any).elements || []) as Array<{ name?: string; value?: string; checked?: boolean }>;
    const patch: Partial<TValues> = {};

    const resolveControlValue = <K extends keyof TValues>(
      name: K,
      bindings: RegisteredFormBinding<TValues[K]>[]
    ): TValues[K] | typeof NO_FORM_VALUE => {
      const primary = bindings[0];
      if (!primary) return NO_FORM_VALUE;
      const domName = primary.domName;
      const namedControls = controls.filter((control) => control && control.name === domName);
      if (primary.parse && namedControls.length) {
        const parseTarget = primary.type === "radio"
          ? namedControls.find((control) => Boolean(control.checked)) || namedControls[0]
          : namedControls[0];
        return primary.parse(parseTarget, event);
      }
      if (primary.type === "checkbox") {
        const currentValue = (values as any)[name];
        if (Array.isArray(currentValue) || bindings.some((binding) => binding.value !== undefined) || namedControls.length > 1) {
          const selected: unknown[] = [];
          for (const control of namedControls) {
            if (!control.checked) continue;
            const matched = bindings.find((binding) => String(binding.value ?? control.value ?? "") === String(control.value ?? ""));
            selected.push(matched?.value ?? control.value ?? "");
          }
          return selected as TValues[K];
        }
        return formData.has(domName) as TValues[K];
      }
      if (primary.type === "radio") {
        return (formData.get(domName) ?? (values as any)[name]) as TValues[K];
      }
      if (primary.type === "select-multiple") {
        const select = namedControls[0] as HTMLSelectElement | undefined;
        if (select?.selectedOptions) {
          return Array.from(select.selectedOptions).map((option) => option.value) as TValues[K];
        }
        return formData.getAll(domName) as TValues[K];
      }
      if (primary.type === "number") {
        const raw = formData.get(domName);
        return (raw === null || raw === "" ? undefined : Number(raw)) as TValues[K];
      }
      const raw = formData.get(domName);
      return (raw === null ? "" : raw) as TValues[K];
    };

    for (const fieldName of allFieldNames()) {
      const bindings = Array.from(registeredBindings.get(fieldName)?.values() || []) as RegisteredFormBinding<TValues[Extract<keyof TValues, string>]>[];
      const nextValue = resolveControlValue(fieldName, bindings as RegisteredFormBinding<TValues[typeof fieldName]>[]);
      if (nextValue !== NO_FORM_VALUE) {
        (patch as any)[fieldName] = nextValue;
      }
    }

    if (Reflect.ownKeys(patch).length) {
      values.$patch(() => patch);
    }
  };

  const bind = <K extends keyof TValues>(name: K, bindOptions: FormBindOptions<TValues[K]> = {}): Record<string, unknown> => {
    const field = api.field(name);
    const type = bindOptions.type || "text";
    const eventName = bindOptions.event
      || (type === "checkbox" || type === "radio" || type === "select" || type === "select-multiple" ? "change" : "input");
    const domName = bindOptions.name || String(name);
    registerBinding(name, domName, type, bindOptions);
    const formattedValue = bindOptions.format ? bindOptions.format(field.value()) : field.value();
    const parseValue = (event: Event): TValues[K] => {
      if (bindOptions.parse) {
        return bindOptions.parse((event.currentTarget || event.target) as unknown, event);
      }
      const target = (event.currentTarget || event.target) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
      if (!target) return field.value();
      if (type === "checkbox") {
        if (Array.isArray(field.value())) {
          const optionValue = bindOptions.value ?? target.value;
          const current = field.value() as unknown[];
          return ((target as HTMLInputElement).checked
            ? Array.from(new Set([...current, optionValue]))
            : current.filter((item) => !Object.is(item, optionValue))) as TValues[K];
        }
        return Boolean((target as HTMLInputElement).checked) as TValues[K];
      }
      if (type === "radio") {
        if (!(target as HTMLInputElement).checked) return field.value();
        return (bindOptions.value ?? (target as HTMLInputElement).value) as TValues[K];
      }
      if (type === "select-multiple") {
        return Array.from((target as HTMLSelectElement).selectedOptions).map((option) => option.value) as TValues[K];
      }
      if (type === "number") {
        const raw = target.value;
        return (raw === "" ? (undefined as any) : Number(raw)) as TValues[K];
      }
      return target.value as TValues[K];
    };

    const binding: Record<string, unknown> = {
      name: domName,
      [`@${eventName}`]: (event: Event) => {
        field.set(parseValue(event));
      },
      "@blur": () => {
        markTouched([name]);
        syncErrors();
      }
    };

    if (type === "checkbox") {
      if (Array.isArray(field.value())) {
        const optionValue = bindOptions.value;
        binding.value = optionValue === undefined ? "" : String(optionValue);
        binding[".checked"] = computed(() => (field.value() as unknown[]).some((item) => Object.is(item, optionValue)));
      } else {
        binding[".checked"] = computed(() => Boolean(field.value()));
        binding.checked = Boolean(field.value());
      }
      return binding;
    }

    if (type === "radio") {
      const optionValue = bindOptions.value;
      binding.value = optionValue === undefined ? "" : String(optionValue);
      binding[".checked"] = computed(() => Object.is(field.value(), optionValue));
      return binding;
    }

    if (type === "select-multiple") {
      binding[".value"] = formattedValue as any;
      return binding;
    }

    const stringValue = formattedValue === undefined || formattedValue === null ? "" : String(formattedValue);
    binding[".value"] = stringValue;
    binding.value = stringValue;
    return binding;
  };

  const api: FormState<TValues> = {
    values,
    initialValues,
    errors,
    touched,
    dirty: computed(() => !deepEqual(values.$snapshot(), initialValues())),
    valid: computed(() => Reflect.ownKeys(errors.$snapshot()).length === 0),
    field<K extends keyof TValues>(name: K): FormField<TValues[K]> {
      const valueSignal = createFieldSignal(name);
      return {
        value: valueSignal,
        error: computed(() => (errors as any)[name] || null),
        touched: computed(() => Boolean((touched as any)[name])),
        dirty: computed(() => !deepEqual((values as any)[name], (initialValues() as any)[name])),
        bind(optionsForField?: FormBindOptions<TValues[K]>): Record<string, unknown> {
          return bind(name, optionsForField);
        },
        set(next) {
          return valueSignal.set(next);
        },
        reset() {
          valueSignal.set((initialValues.peek() as any)[name]);
          delete (errors as any)[name];
          delete (touched as any)[name];
        }
      };
    },
    bind,
    set,
    reset,
    validate(): boolean {
      return syncErrors();
    },
    markTouched,
    submit<TResult, E = unknown>(
      handler: (snapshot: TValues, event: Event) => Promise<TResult> | TResult,
      submitOptions: FormStateSubmitOptions<TResult, E> = {}
    ): FormStateController<TValues, TResult, E> {
      const submitAction = action<[TValues, Event], TResult, E>(handler, submitOptions);
      const onSubmit = async (event: Event): Promise<TResult | undefined> => {
        event.preventDefault();
        syncFromForm(event);
        markTouched();
        if (!syncErrors()) return undefined;
        const result = await submitAction(cloneValue(values.$snapshot()), event);
        if (submitOptions.resetOnSuccess) api.reset();
        return result;
      };

      return {
        state: api,
        action: submitAction,
        data: submitAction.data,
        error: submitAction.error,
        pending: submitAction.pending,
        status: submitAction.status,
        onSubmit,
        handleSubmit(event: Event): void {
          onSubmit(event).catch(() => undefined);
        },
        reset(): void {
          submitAction.reset();
          api.reset();
        }
      };
    }
  };

  return api;
}

function html(strings: TemplateStringsArray | readonly string[], ...values: unknown[]): TemplateResult {
  return {
    isTemplateResult: true,
    strings: Array.from(strings),
    values
  };
}

function unsafeHTML(value: string, options: UnsafeHTMLOptions = {}): UnsafeHTML {
  const sanitizer = resolveSanitizeHTML(options);
  return {
    isUnsafeHTML: true,
    value: sanitizer ? sanitizer(String(value)) : String(value)
  };
}

function isTemplateResult(value: unknown): value is TemplateResult {
  return !!value && typeof value === "object" && (value as TemplateResult).isTemplateResult === true;
}

function isUnsafeHTML(value: unknown): value is UnsafeHTML {
  return !!value && typeof value === "object" && (value as UnsafeHTML).isUnsafeHTML === true;
}

function isNodeLike(value: unknown): value is Node {
  return !!value && typeof value === "object" && typeof (value as Node).nodeType === "number";
}

function documentOrThrow(): Document {
  const doc = getDocument();
  if (!doc) throw new Error("Ity DOM rendering requires a document");
  return doc;
}

function normalizeValue(value: unknown): unknown {
  return isSignal(value) ? value() : value;
}

function isRepeatResult(value: unknown): value is RepeatResult {
  return !!value && typeof value === "object" && (value as RepeatResult).isRepeatResult === true;
}

function repeat<T>(
  items: readonly T[] | ReadonlySignal<readonly T[]> | (() => readonly T[]),
  key: (item: T, index: number) => string | number,
  renderItem: (item: T, index: number) => unknown
): RepeatResult {
  const resolvedItems = typeof items === "function"
    ? (items as (() => readonly T[]))()
    : resolveSignal(items as readonly T[] | ReadonlySignal<readonly T[]>);
  const values = Array.from(resolvedItems || []).map((item, index) => ({
    __ityRepeatKey: String(key(item, index)),
    __ityRepeatValue: renderItem(item, index)
  }));
  const keys = new Set<string>();
  for (const entry of values) {
    if (keys.has(entry.__ityRepeatKey)) {
      warnRuntime("repeat-duplicate-key", `Ity.repeat encountered a duplicate key "${entry.__ityRepeatKey}".`, {
        key: entry.__ityRepeatKey
      });
    }
    keys.add(entry.__ityRepeatKey);
  }
  return {
    isRepeatResult: true,
    values
  };
}

function valueToFragment(value: unknown, doc: Document = documentOrThrow()): DocumentFragment {
  const fragment = doc.createDocumentFragment();
  appendValue(fragment, normalizeValue(value), doc);
  return fragment;
}

function applyRepeatKey(node: Node, key: string): void {
  if (node.nodeType === 1) {
    (node as any).__ityKey = key;
  }
}

function appendRepeatValue(parent: Node, entry: { __ityRepeatKey: string; __ityRepeatValue: unknown }, doc: Document): void {
  const fragment = valueToFragment(entry.__ityRepeatValue, doc);
  const nodes = Array.from(fragment.childNodes).filter((node) => {
    return node.nodeType !== 3 || Boolean(node.textContent && node.textContent.trim());
  });
  if (nodes.length === 0) return;
  if (nodes.length > 1) {
    throw new Error("Ity.repeat items must render exactly one root node.");
  }
  const node = nodes[0];
  if (fragment.firstChild !== node) {
    fragment.textContent = "";
    fragment.appendChild(node);
  }
  if (node.nodeType !== 1) {
    throw new Error("Ity.repeat items must render an element root node.");
  }
  applyRepeatKey(node, entry.__ityRepeatKey);
  parent.appendChild(fragment);
}

function appendValue(parent: Node, value: unknown, doc: Document): void {
  value = normalizeValue(value);
  if (value === null || value === undefined || value === false) return;
  if (Array.isArray(value)) {
    for (const item of value) appendValue(parent, item, doc);
    return;
  }
  if (isRepeatResult(value)) {
    for (const entry of value.values as Array<{ __ityRepeatKey: string; __ityRepeatValue: unknown }>) {
      appendRepeatValue(parent, entry, doc);
    }
    return;
  }
  if (isTemplateResult(value)) {
    parent.appendChild(materializeTemplate(value, doc));
    return;
  }
  if (isUnsafeHTML(value)) {
    const template = doc.createElement("template");
    template.innerHTML = value.value;
    parent.appendChild(template.content.cloneNode(true));
    return;
  }
  if (isNodeLike(value)) {
    parent.appendChild(value);
    return;
  }
  parent.appendChild(doc.createTextNode(String(value)));
}

interface Binding {
  index: number;
  kind: "node" | "event" | "attr" | "prop" | "bool";
  name?: string;
}

interface EventBindingRecord {
  listener: EventListener;
  options?: boolean | AddEventListenerOptions;
}

interface ManagedBindingMeta {
  events: Map<string, EventBindingRecord[]>;
  props: Map<string, unknown>;
}

interface FocusSelectionState {
  start: number;
  end: number;
  direction?: "forward" | "backward" | "none" | null;
}

interface FocusRestoreState {
  path: number[];
  tagName: string;
  id: string | null;
  name: string | null;
  type: string | null;
  placeholder: string | null;
  selection: FocusSelectionState | null;
}

function bindingFromName(rawName: string): Pick<Binding, "kind" | "name"> {
  const first = rawName[0];
  const kind = first === "@" ? "event" : first === "." ? "prop" : first === "?" ? "bool" : "attr";
  const name = kind === "attr" ? rawName : rawName.slice(1);
  return { kind, name };
}

function readManagedBindingMeta(element: HTMLElement): ManagedBindingMeta | null {
  return ((element as any).__ityBindings as ManagedBindingMeta | undefined) || null;
}

function setManagedBindingMeta(element: HTMLElement, meta: ManagedBindingMeta): void {
  (element as any).__ityBindings = meta;
}

function ensureManagedBindingMeta(element: HTMLElement): ManagedBindingMeta {
  const existing = readManagedBindingMeta(element);
  if (existing) return existing;
  const meta: ManagedBindingMeta = {
    events: new Map(),
    props: new Map()
  };
  setManagedBindingMeta(element, meta);
  return meta;
}

function setElementKey(element: HTMLElement, key: string | null): void {
  if (key === null || key === undefined) {
    delete (element as any).__ityKey;
    element.removeAttribute("data-ity-key");
    return;
  }
  (element as any).__ityKey = key;
  element.setAttribute("data-ity-key", key);
}

function getNodeKey(node: Node | null | undefined): string | null {
  if (!node || node.nodeType !== 1) return null;
  const element = node as HTMLElement;
  const stored = (element as any).__ityKey;
  if (typeof stored === "string" && stored) return stored;
  const attr = element.getAttribute("data-ity-key");
  return attr || null;
}

function applyEventBinding(element: HTMLElement, name: string, value: unknown): void {
  const records: EventBindingRecord[] = [];
  if (typeof value === "function") {
    const record = { listener: value as EventListener };
    element.addEventListener(name, record.listener);
    records.push(record);
  } else if (Array.isArray(value) && typeof value[0] === "function") {
    const record = { listener: value[0] as EventListener, options: value[1] as boolean | AddEventListenerOptions | undefined };
    element.addEventListener(name, record.listener, record.options);
    records.push(record);
  }
  ensureManagedBindingMeta(element).events.set(name, records);
}

function applyPropertyBinding(element: HTMLElement, name: string, value: unknown): void {
  if (name === "value" && Array.isArray(value) && element.tagName === "SELECT" && (element as HTMLSelectElement).multiple) {
    const selectedValues = new Set(value.map((entry) => String(entry)));
    Array.from((element as HTMLSelectElement).options).forEach((option) => {
      option.selected = selectedValues.has(option.value);
    });
  } else {
    (element as any)[name] = value;
  }
  ensureManagedBindingMeta(element).props.set(name, value);
}

function materializeTemplate(result: TemplateResult, doc: Document = documentOrThrow()): DocumentFragment {
  const bindings: Binding[] = [];
  let source = "";

  for (let i = 0; i < result.values.length; i += 1) {
    const part = result.strings[i] ?? "";
    const attrMatch = part.match(/([@.?]?[\w:-]+)\s*=\s*$/);
    if (attrMatch) {
      const rawName = attrMatch[1];
      const before = part.slice(0, part.length - attrMatch[0].length);
      const marker = `data-ity-bind-${i}`;
      const { kind, name } = bindingFromName(rawName);
      bindings.push({ index: i, kind, name });
      source += `${before}${marker}=""`;
    } else {
      bindings.push({ index: i, kind: "node" });
      source += `${part}<!--ity:${i}-->`;
    }
  }
  source += result.strings[result.strings.length - 1] ?? "";

  const template = doc.createElement("template");
  template.innerHTML = source;
  const fragment = template.content.cloneNode(true) as DocumentFragment;
  applyBindings(fragment, bindings, result.values, doc);
  return fragment;
}

function applyBindings(root: DocumentFragment, bindings: Binding[], values: readonly unknown[], doc: Document): void {
  const comments = new Map<number, Comment[]>();
  const walker = doc.createTreeWalker(root, 128);
  let current = walker.nextNode();
  while (current) {
    const comment = current as Comment;
    const match = comment.data.match(/^ity:(\d+)$/);
    if (match) {
      const index = Number(match[1]);
      const list = comments.get(index) || [];
      list.push(comment);
      comments.set(index, list);
    }
    current = walker.nextNode();
  }

  for (const binding of bindings) {
    const value = normalizeValue(values[binding.index]);
    if (binding.kind === "node") {
      const markers = comments.get(binding.index) || [];
      for (const marker of markers) {
        marker.replaceWith(valueToFragment(value, doc));
      }
      continue;
    }

    const attrName = `data-ity-bind-${binding.index}`;
    const elements = Array.from(root.querySelectorAll(`[${attrName}]`)) as HTMLElement[];
    for (const element of elements) {
      element.removeAttribute(attrName);
      applyElementBinding(element, binding, value);
    }
  }
}

function applyElementBinding(element: HTMLElement, binding: Binding, value: unknown): void {
  const name = binding.name || "";
  if (binding.kind === "attr" && name === "bind" && isPlainObject(value)) {
    for (const key of Reflect.ownKeys(value)) {
      const entryValue = normalizeValue((value as any)[key]);
      const entry = bindingFromName(String(key));
      applyElementBinding(element, { index: binding.index, ...entry }, entryValue);
    }
    return;
  }

  if (binding.kind === "event") {
    applyEventBinding(element, name, value);
    return;
  }

  if (binding.kind === "prop") {
    applyPropertyBinding(element, name, value);
    return;
  }

  if (binding.kind === "bool") {
    element.toggleAttribute(name, Boolean(value));
    return;
  }

  if (value === false || value === null || value === undefined) {
    if (name === "key") setElementKey(element, null);
    element.removeAttribute(name);
    return;
  }

  if (name === "key") {
    setElementKey(element, String(value));
    return;
  }

  if (name === "class" && Array.isArray(value)) {
    element.setAttribute("class", value.filter(Boolean).join(" "));
    return;
  }

  if (name === "class" && typeof value === "object") {
    const classes = Object.keys(value as Record<string, unknown>).filter((key) => Boolean((value as any)[key]));
    element.setAttribute("class", classes.join(" "));
    return;
  }

  if (name === "style" && typeof value === "object" && value !== null) {
    Object.assign((element as HTMLElement).style, value);
    return;
  }

  element.setAttribute(name, value === true ? "" : String(value));
}

function getDeepActiveElement(doc: Document | undefined): HTMLElement | null {
  if (!doc) return null;
  let active = doc.activeElement as HTMLElement | null;
  while (active && (active as any).shadowRoot?.activeElement) {
    active = (active as any).shadowRoot.activeElement as HTMLElement | null;
  }
  return active;
}

function nodeContains(root: Node, node: Node): boolean {
  return root === node || typeof (root as any).contains === "function" && (root as any).contains(node);
}

function captureNodePath(root: Node, node: Node): number[] | null {
  const path: number[] = [];
  let current: Node | null = node;
  while (current && current !== root) {
    const parent: Node | null = current.parentNode;
    if (!parent) return null;
    path.unshift(Array.prototype.indexOf.call(parent.childNodes, current));
    current = parent;
  }
  return current === root ? path : null;
}

function resolveNodePath(root: Node, path: readonly number[]): Node | null {
  let current: Node | null = root;
  for (const index of path) {
    if (!current?.childNodes || index < 0 || index >= current.childNodes.length) return null;
    current = current.childNodes[index];
  }
  return current;
}

function captureSelectionState(element: HTMLElement): FocusSelectionState | null {
  const target = element as any;
  if (typeof target.selectionStart !== "number" || typeof target.selectionEnd !== "number") return null;
  return {
    start: target.selectionStart,
    end: target.selectionEnd,
    direction: target.selectionDirection
  };
}

function getElementName(element: HTMLElement): string | null {
  return typeof (element as any).name === "string"
    ? ((element as any).name || null)
    : element.getAttribute("name");
}

function getElementType(element: HTMLElement): string | null {
  return typeof (element as any).type === "string"
    ? ((element as any).type || null)
    : element.getAttribute("type");
}

function getElementPlaceholder(element: HTMLElement): string | null {
  return typeof (element as any).placeholder === "string"
    ? ((element as any).placeholder || null)
    : element.getAttribute("placeholder");
}

function captureFocusState(target: Element | DocumentFragment): FocusRestoreState | null {
  const doc = target.ownerDocument || getDocument();
  const active = getDeepActiveElement(doc);
  if (!active || !nodeContains(target, active)) return null;
  const path = captureNodePath(target, active);
  if (!path) return null;
  return {
    path,
    tagName: active.tagName,
    id: active.id || null,
    name: getElementName(active),
    type: getElementType(active),
    placeholder: getElementPlaceholder(active),
    selection: captureSelectionState(active)
  };
}

function matchesFocusState(element: HTMLElement, state: FocusRestoreState): boolean {
  if (element.tagName !== state.tagName) return false;
  if (state.id && element.id !== state.id) return false;
  if (state.name && getElementName(element) !== state.name) return false;
  if (state.type && getElementType(element) !== state.type) return false;
  return true;
}

function findFocusCandidate(target: Element | DocumentFragment, state: FocusRestoreState): HTMLElement | null {
  if (state.id) {
    const byId = target.ownerDocument?.getElementById(state.id) as HTMLElement | null;
    if (byId && nodeContains(target, byId) && matchesFocusState(byId, state)) return byId;
  }

  if (state.name && typeof (target as ParentNode).querySelectorAll === "function") {
    const matches = Array.from((target as ParentNode).querySelectorAll(state.tagName.toLowerCase()))
      .filter((entry): entry is HTMLElement => entry instanceof (target.ownerDocument?.defaultView?.HTMLElement || HTMLElement))
      .filter((entry) => getElementName(entry) === state.name)
      .filter((entry) => matchesFocusState(entry, state));
    if (matches.length === 1) return matches[0];
  }

  const byPath = resolveNodePath(target, state.path);
  if (byPath instanceof (target.ownerDocument?.defaultView?.HTMLElement || HTMLElement) && byPath.tagName === state.tagName) {
    return byPath;
  }

  return null;
}

function restoreSelectionState(element: HTMLElement, selection: FocusSelectionState | null): void {
  if (!selection) return;
  const target = element as any;
  if (typeof target.setSelectionRange !== "function" || typeof target.value !== "string") return;
  const length = target.value.length;
  const start = Math.max(0, Math.min(selection.start, length));
  const end = Math.max(start, Math.min(selection.end, length));
  try {
    target.setSelectionRange(start, end, selection.direction || undefined);
  } catch (_error) {
    target.setSelectionRange(start, end);
  }
}

function restoreFocusState(target: Element | DocumentFragment, state: FocusRestoreState | null): void {
  if (!state) return;
  const candidate = findFocusCandidate(target, state);
  if (!candidate || typeof candidate.focus !== "function") return;
  const apply = () => {
    if (!candidate.isConnected) return;
    try {
      candidate.focus({ preventScroll: true } as FocusOptions);
    } catch (_error) {
      candidate.focus();
    }
    restoreSelectionState(candidate, state.selection);
  };
  apply();
  const doc = target.ownerDocument || getDocument();
  if (doc?.activeElement !== candidate) {
    if (typeof queueMicrotask === "function") {
      queueMicrotask(apply);
    } else {
      Promise.resolve().then(apply).catch(() => undefined);
    }
  }
}

function cleanupManagedBindings(element: HTMLElement): void {
  const meta = readManagedBindingMeta(element);
  if (!meta) return;
  for (const [eventName, records] of meta.events) {
    for (const record of records) {
      element.removeEventListener(eventName, record.listener, record.options);
    }
  }
  meta.events.clear();
  meta.props.clear();
  delete (element as any).__ityBindings;
}

function cleanupManagedSubtree(node: Node): void {
  if (node.nodeType === 1) {
    cleanupManagedBindings(node as HTMLElement);
    const walker = (node.ownerDocument || getDocument())?.createTreeWalker(node, 1);
    let current = walker?.nextNode() || null;
    while (current) {
      cleanupManagedBindings(current as HTMLElement);
      current = walker!.nextNode();
    }
  }
}

function syncManagedBindings(current: HTMLElement, next: HTMLElement): void {
  const currentMeta = readManagedBindingMeta(current);
  if (currentMeta) {
    for (const [eventName, records] of currentMeta.events) {
      for (const record of records) {
        current.removeEventListener(eventName, record.listener, record.options);
      }
    }
  }

  const nextMeta = readManagedBindingMeta(next);
  const synced: ManagedBindingMeta = {
    events: new Map(),
    props: new Map()
  };

  const previousPropNames = new Set<string>(currentMeta ? Array.from(currentMeta.props.keys()) : []);
  if (nextMeta) {
    for (const [eventName, records] of nextMeta.events) {
      const applied = records.map((record) => ({ ...record }));
      for (const record of applied) {
        current.addEventListener(eventName, record.listener, record.options);
      }
      synced.events.set(eventName, applied);
    }
    for (const [propName, propValue] of nextMeta.props) {
      applyPropertyBinding(current, propName, propValue);
      synced.props.set(propName, propValue);
      previousPropNames.delete(propName);
    }
  }

  for (const propName of previousPropNames) {
    try {
      (current as any)[propName] = undefined;
    } catch (_error) {
      // Ignore non-writable host properties.
    }
  }

  setManagedBindingMeta(current, synced);
  setElementKey(current, getNodeKey(next));
}

function syncAttributes(current: HTMLElement, next: HTMLElement): void {
  const currentAttrs = new Map<string, string>();
  Array.from(current.attributes).forEach((attr) => currentAttrs.set(attr.name, attr.value));
  const nextAttrs = new Map<string, string>();
  Array.from(next.attributes).forEach((attr) => nextAttrs.set(attr.name, attr.value));

  for (const name of Array.from(currentAttrs.keys())) {
    if (!nextAttrs.has(name)) current.removeAttribute(name);
  }
  for (const [name, value] of nextAttrs) {
    if (current.getAttribute(name) !== value) {
      current.setAttribute(name, value);
    }
  }
}

function canMorphNode(current: Node, next: Node): boolean {
  if (current.nodeType !== next.nodeType) return false;
  if (current.nodeType === 1) {
    const currentElement = current as HTMLElement;
    const nextElement = next as HTMLElement;
    const currentKey = getNodeKey(currentElement);
    const nextKey = getNodeKey(nextElement);
    if (currentKey !== nextKey) return false;
    return currentElement.tagName === nextElement.tagName;
  }
  return true;
}

function findCompatibleUnkeyedNode(oldNodes: Node[], used: Set<Node>, next: Node, fromIndex: number): { node: Node | null; nextIndex: number } {
  for (let i = fromIndex; i < oldNodes.length; i += 1) {
    const candidate = oldNodes[i];
    if (used.has(candidate) || getNodeKey(candidate) !== null) continue;
    if (canMorphNode(candidate, next)) {
      return { node: candidate, nextIndex: i + 1 };
    }
  }
  for (let i = 0; i < fromIndex; i += 1) {
    const candidate = oldNodes[i];
    if (used.has(candidate) || getNodeKey(candidate) !== null) continue;
    if (canMorphNode(candidate, next)) {
      return { node: candidate, nextIndex: fromIndex };
    }
  }
  return { node: null, nextIndex: fromIndex };
}

function createKeyMap(nodes: readonly Node[]): Map<string, Node> {
  const map = new Map<string, Node>();
  for (const node of nodes) {
    const key = getNodeKey(node);
    if (!key) continue;
    if (map.has(key)) {
      warnRuntime("duplicate-key", `Ity encountered duplicate DOM keys for "${key}" during reconciliation.`, { key });
      continue;
    }
    map.set(key, node);
  }
  return map;
}

function morphNode(current: Node, next: Node): void {
  if (!canMorphNode(current, next)) {
    cleanupManagedSubtree(current);
    if (current.parentNode) current.parentNode.replaceChild(next, current);
    return;
  }
  if (current.nodeType === 3 || current.nodeType === 8) {
    if ((current as CharacterData).data !== (next as CharacterData).data) {
      (current as CharacterData).data = (next as CharacterData).data;
    }
    return;
  }
  const currentElement = current as HTMLElement;
  const nextElement = next as HTMLElement;
  syncAttributes(currentElement, nextElement);
  syncManagedBindings(currentElement, nextElement);
  morphChildNodes(currentElement, nextElement);
}

function morphChildNodes(currentParent: Element | DocumentFragment, nextParent: Element | DocumentFragment): void {
  const oldNodes = Array.from(currentParent.childNodes);
  const newNodes = Array.from(nextParent.childNodes);
  const used = new Set<Node>();
  const keyed = createKeyMap(oldNodes);
  let searchIndex = 0;
  let referenceNode = currentParent.firstChild;

  for (const next of newNodes) {
    const key = getNodeKey(next);
    let matched: Node | null = null;
    if (key !== null) {
      matched = keyed.get(key) || null;
    } else {
      const result = findCompatibleUnkeyedNode(oldNodes, used, next, searchIndex);
      matched = result.node;
      searchIndex = result.nextIndex;
    }

    if (matched && used.has(matched)) {
      matched = null;
    }

    if (matched) {
      used.add(matched);
      morphNode(matched, next);
      if (matched !== referenceNode) currentParent.insertBefore(matched, referenceNode);
      referenceNode = matched.nextSibling;
    } else {
      currentParent.insertBefore(next, referenceNode);
      referenceNode = next.nextSibling;
    }
  }

  for (const oldNode of oldNodes) {
    if (!used.has(oldNode)) {
      cleanupManagedSubtree(oldNode);
      oldNode.remove();
    }
  }
}

function resolveTarget(target: string | Element | DocumentFragment | SelectorObject): Element | DocumentFragment {
  if (typeof target === "string") {
    const found = documentOrThrow().querySelector(target);
    if (!found) throw new Error(`Render target not found: ${target}`);
    return found;
  }
  if ((target as SelectorObject)?.isSelectorObject) {
    const first = (target as SelectorObject).first()[0];
    if (!first) throw new Error("Cannot render into an empty SelectorObject");
    return first;
  }
  return target as Element | DocumentFragment;
}

function replaceChildren(target: Element | DocumentFragment, fragment: DocumentFragment, options: RenderOptions = {}): void {
  const focusState = captureFocusState(target);
  if (options.mode === "replace") {
    const maybeTarget = target as any;
    if (typeof maybeTarget.replaceChildren === "function") {
      maybeTarget.replaceChildren(fragment);
      restoreFocusState(target, focusState);
      return;
    }
    while (target.firstChild) {
      cleanupManagedSubtree(target.firstChild);
      target.removeChild(target.firstChild);
    }
    target.appendChild(fragment);
    restoreFocusState(target, focusState);
    return;
  }
  morphChildNodes(target, fragment);
  restoreFocusState(target, focusState);
}

function withViewTransition(update: () => void, enabled: boolean | undefined): void {
  const doc = getDocument() as any;
  if (enabled && doc && typeof doc.startViewTransition === "function") {
    doc.startViewTransition(update);
  } else {
    update();
  }
}

function render(
  view: TemplateValue | (() => TemplateValue),
  target: string | Element | DocumentFragment | SelectorObject,
  options: RenderOptions = {}
): Cleanup {
  const mount = resolveTarget(target);
  const scope = options.scope || renderScopeByTarget.get(mount as object) || new ScopeNode({ parent: null, name: "render" });
  renderScopeByTarget.set(mount as object, scope);
  const update = () => {
    withConfig(options.config, () => {
      const value = typeof view === "function" && !isSignal(view)
        ? (view as () => TemplateValue)()
        : normalizeValue(view);
      withViewTransition(() => replaceChildren(mount, valueToFragment(value), {
        ...options,
        mode: options.mode || "morph",
        scope
      }), options.transition);
    });
  };

  if (options.reactive === false) {
    update();
    return () => undefined;
  }

  return effect(update);
}

function hydrate(
  view: TemplateValue | (() => TemplateValue),
  target: string | Element | DocumentFragment | SelectorObject,
  options: RenderOptions = {}
): Cleanup {
  return render(view, target, {
    ...options,
    mode: "morph",
    warnOnMismatch: options.warnOnMismatch !== false
  });
}

function renderToString(view: TemplateValue | (() => TemplateValue), options: RenderToStringOptions = {}): string {
  return withConfig(options.config, () => {
    const value = typeof view === "function" && !isSignal(view)
      ? (view as () => TemplateValue)()
      : normalizeValue(view);
    return valueToString(value);
  });
}

function valueToString(value: unknown): string {
  value = normalizeValue(value);
  if (value === null || value === undefined || value === false) return "";
  if (Array.isArray(value)) return value.map(valueToString).join("");
  if (isRepeatResult(value)) {
    return (value.values as Array<{ __ityRepeatKey: string; __ityRepeatValue: unknown }>)
      .map((entry) => valueToStringWithKey(entry.__ityRepeatValue, entry.__ityRepeatKey))
      .join("");
  }
  if (isTemplateResult(value)) return templateToString(value);
  if (isUnsafeHTML(value)) return value.value;
  if (isNodeLike(value)) {
    const node = value as any;
    if (typeof node.outerHTML === "string") return node.outerHTML;
    return escapeHTML(node.textContent || "");
  }
  return escapeHTML(String(value));
}

function valueToStringWithKey(value: unknown, key: string): string {
  const rendered = valueToString(value);
  if (!rendered) return "";
  const leadingWhitespace = rendered.match(/^\s*/)?.[0] || "";
  const trimmed = rendered.slice(leadingWhitespace.length);
  if (!trimmed.startsWith("<")) {
    throw new Error("Ity.repeat items must render an element root node.");
  }
  if (!/^<([A-Za-z][^\s/>]*)(\s|>)/.test(trimmed)) {
    throw new Error("Ity.repeat items must render an element root node.");
  }
  return `${leadingWhitespace}${trimmed.replace(/^<([A-Za-z][^\s/>]*)(\s|>)/, `<$1 data-ity-key="${escapeAttribute(key)}"$2`)}`;
}

function templateToString(result: TemplateResult): string {
  let source = "";
  for (let i = 0; i < result.values.length; i += 1) {
    const part = result.strings[i] ?? "";
    const attrMatch = part.match(/([@.?]?[\w:-]+)\s*=\s*$/);
    const value = normalizeValue(result.values[i]);
    if (attrMatch) {
      const rawName = attrMatch[1];
      const before = part.slice(0, part.length - attrMatch[0].length);
      const { kind, name } = bindingFromName(rawName);
      if (kind === "attr" && name === "bind" && isPlainObject(value)) {
        const serialized: string[] = [];
        for (const key of Reflect.ownKeys(value)) {
          const entryValue = normalizeValue((value as any)[key]);
          const entry = bindingFromName(String(key));
          const entryName = entry.name || "";
          if (entry.kind === "event" || entryValue === false || entryValue === null || entryValue === undefined) continue;
          if (entry.kind === "bool") {
            if (entryValue) serialized.push(entryName);
            continue;
          }
          if (entry.kind === "prop") {
            if (entryName === "value") {
              serialized.push(`value="${escapeAttribute(String(entryValue))}"`);
            } else if ((entryName === "checked" || entryName === "selected") && entryValue) {
              serialized.push(entryName);
            }
            continue;
          }
          if (entry.kind === "attr" && entryName === "key") {
            serialized.push(`data-ity-key="${escapeAttribute(String(entryValue))}"`);
            continue;
          }
          serialized.push(`${entryName}="${escapeAttribute(stringifyAttribute(entryName, entryValue))}"`);
        }
        source += serialized.length ? `${before}${serialized.join(" ")}` : before;
        continue;
      }
      if (kind === "event" || kind === "prop" || value === false || value === null || value === undefined) {
        source += before;
      } else if (kind === "bool") {
        source += value ? `${before}${name}` : before;
      } else if (kind === "attr" && name === "key") {
        source += `${before}data-ity-key="${escapeAttribute(String(value))}"`;
      } else {
        source += `${before}${name || ""}="${escapeAttribute(stringifyAttribute(name || "", value))}"`;
      }
    } else {
      source += part + valueToString(value);
    }
  }
  source += result.strings[result.strings.length - 1] ?? "";
  return source;
}

function stringifyAttribute(name: string, value: unknown): string {
  if (name === "class" && Array.isArray(value)) return value.filter(Boolean).join(" ");
  if (name === "class" && typeof value === "object" && value !== null) {
    return Object.keys(value as Record<string, unknown>).filter((key) => Boolean((value as any)[key])).join(" ");
  }
  if (name === "style" && typeof value === "object" && value !== null) {
    return Object.keys(value as Record<string, unknown>)
      .map((key) => `${key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}:${(value as any)[key]}`)
      .join(";");
  }
  return value === true ? "" : String(value);
}

function escapeHTML(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttribute(value: string): string {
  return escapeHTML(value)
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function findNearestScope(node: Node | null): ItyScope | null {
  let current: Node | null = node;
  while (current) {
    const scoped = renderScopeByTarget.get(current as object);
    if (scoped) return scoped;
    const root = (current as any).getRootNode?.();
    if (root && root !== current && renderScopeByTarget.has(root as object)) {
      return renderScopeByTarget.get(root as object)!;
    }
    current = (current as any).parentNode || (current as any).host || null;
  }
  return null;
}

interface ComponentContext {
  host: HTMLElement;
  root: HTMLElement | ShadowRoot;
  scope: ItyScope;
  attr(name: string): ReadonlySignal<string | null>;
  prop<T = unknown>(name: string): ReadonlySignal<T>;
  provide<T>(key: ScopeKey, value: T): Signal<T>;
  inject<T>(key: ScopeKey, fallback?: T): ReadonlySignal<T>;
  emit<T = unknown>(name: string, detail?: T, options?: CustomEventInit<T>): boolean;
  effect(callback: (onCleanup: (cleanup: Cleanup) => void) => void): EffectHandle;
  onConnected(callback: () => void): void;
  onDisconnected(callback: () => void): void;
}

type ComponentRender = TemplateValue | (() => TemplateValue);
type ComponentSetup = (ctx: ComponentContext) => ComponentRender | void;

interface ComponentOptions {
  attrs?: string[];
  observedAttributes?: string[];
  props?: string[];
  shadow?: boolean | ShadowRootMode | ShadowRootInit;
  styles?: string;
  config?: ItyConfig | null;
  setup?: ComponentSetup;
}

function component(
  name: string,
  setupOrOptions: ComponentSetup | ComponentOptions,
  maybeOptions: Omit<ComponentOptions, "setup"> = {}
): CustomElementConstructor {
  const win = getWindow();
  if (!win?.customElements || !win.HTMLElement) {
    throw new Error("Ity.component requires Custom Elements support");
  }

  if (win.customElements.get(name)) {
    return win.customElements.get(name)!;
  }

  const definition: ComponentOptions = typeof setupOrOptions === "function"
    ? { ...maybeOptions, setup: setupOrOptions }
    : setupOrOptions;
  const attrs = definition.observedAttributes || definition.attrs || [];
  const props = definition.props || [];

  class ItyElement extends win.HTMLElement {
    static get observedAttributes(): string[] {
      return attrs;
    }

    private attrSignals = new Map<string, Signal<string | null>>();
    private propSignals = new Map<string, Signal<unknown>>();
    private connectedCallbacks: Cleanup[] = [];
    private disconnectedCallbacks: Cleanup[] = [];
    private effectRecords: Array<{
      callback: (onCleanup: (cleanup: Cleanup) => void) => void;
      handle?: EffectHandle;
      disposed: boolean;
    }> = [];
    private renderCleanup?: Cleanup;
    private mount?: HTMLElement | ShadowRoot;
    private renderTarget?: HTMLElement | ShadowRoot;
    private renderOutput?: ComponentRender;
    private scopeNode?: ItyScope;
    private initialized = false;
    private connected = false;

    connectedCallback(): void {
      this.ensureMount();
      for (const prop of props) this.upgradeProperty(prop);
      if (!this.initialized) {
        this.initialized = true;
        const ctx = this.createContext();
        const output = definition.setup?.(ctx);
        if (output !== undefined) {
          this.renderOutput = output as ComponentRender;
        }
      }
      this.connected = true;
      this.startRender();
      this.startEffects();
      for (const callback of this.connectedCallbacks) callback();
    }

    disconnectedCallback(): void {
      this.connected = false;
      if (this.renderCleanup) {
        this.renderCleanup();
        this.renderCleanup = undefined;
      }
      for (const record of this.effectRecords) {
        record.handle?.dispose();
        record.handle = undefined;
      }
      for (const callback of this.disconnectedCallbacks) callback();
    }

    attributeChangedCallback(name: string, _oldValue: string | null, newValue: string | null): void {
      this.ensureAttrSignal(name).set(newValue);
    }

    private ensureMount(): void {
      if (this.mount && this.renderTarget) return;
      const parentScope = findNearestScope(this.parentNode || this);
      this.scopeNode ||= new ScopeNode({ parent: parentScope, name: `component:${name}` });
      const shadow = definition.shadow;
      if (shadow === false) {
        this.mount = this;
      } else {
        const init: ShadowRootInit = typeof shadow === "object"
          ? shadow
          : { mode: shadow === "closed" ? "closed" : "open" };
        this.mount = this.shadowRoot || this.attachShadow(init);
      }

      if (definition.styles) {
        const doc = this.ownerDocument;
        const style = doc.createElement("style");
        style.textContent = definition.styles;
        const container = doc.createElement("span");
        container.setAttribute("data-ity-component-root", "");
        this.mount.appendChild(style);
        this.mount.appendChild(container);
        this.renderTarget = container;
      } else {
        this.renderTarget = this.mount;
      }
      renderScopeByTarget.set(this as unknown as object, this.scopeNode);
      renderScopeByTarget.set(this.mount as unknown as object, this.scopeNode);
      renderScopeByTarget.set(this.renderTarget as unknown as object, this.scopeNode);
    }

    private startRender(): void {
      if (this.renderCleanup || this.renderOutput === undefined) return;
      this.renderCleanup = render(this.renderOutput, this.renderTarget!, {
        transition: false,
        config: definition.config,
        scope: this.scopeNode
      });
    }

    private startEffects(): void {
      for (const record of this.effectRecords) {
        if (!record.disposed && !record.handle) {
          record.handle = effect(record.callback);
        }
      }
    }

    private ensureAttrSignal(name: string): Signal<string | null> {
      if (!this.attrSignals.has(name)) {
        this.attrSignals.set(name, signal(this.getAttribute(name)));
      }
      return this.attrSignals.get(name)!;
    }

    private ensurePropSignal<T = unknown>(name: string): Signal<T> {
      if (!this.propSignals.has(name)) {
        this.propSignals.set(name, signal(undefined as unknown) as Signal<unknown>);
      }
      return this.propSignals.get(name)! as Signal<T>;
    }

    private upgradeProperty(name: string): void {
      if (!hasOwn(this, name)) return;
      const value = (this as any)[name];
      delete (this as any)[name];
      (this as any)[name] = value;
    }

    private createContext(): ComponentContext {
      return {
        host: this,
        root: this.mount!,
        scope: this.scopeNode!,
        attr: (name) => this.ensureAttrSignal(name),
        prop: <T = unknown>(name: string) => this.ensurePropSignal<T>(name),
        provide: <T>(key: ScopeKey, value: T) => this.scopeNode!.provide(key, value),
        inject: <T>(key: ScopeKey, fallback?: T) => this.scopeNode!.signal(key, fallback),
        emit: (name, detail, options = {}) => this.dispatchEvent(new CustomEvent(name, {
          bubbles: true,
          composed: true,
          ...options,
          detail
        })),
        effect: (callback) => {
          const record = { callback, disposed: false, handle: undefined as EffectHandle | undefined };
          this.effectRecords.push(record);
          if (this.connected) record.handle = effect(callback);
          const dispose = (() => {
            record.disposed = true;
            record.handle?.dispose();
            record.handle = undefined;
          }) as EffectHandle;
          dispose.dispose = dispose;
          return dispose;
        },
        onConnected: (callback) => {
          this.connectedCallbacks.push(callback);
        },
        onDisconnected: (callback) => {
          this.disconnectedCallbacks.push(callback);
        }
      };
    }
  }

  for (const prop of props) {
    Object.defineProperty(ItyElement.prototype, prop, {
      configurable: true,
      enumerable: true,
      get(this: any) {
        return this.ensurePropSignal(prop).peek();
      },
      set(this: any, value: unknown) {
        this.ensurePropSignal(prop).set(typeof value === "function" ? (() => value) as any : value);
      }
    });
  }

  win.customElements.define(name, ItyElement);
  return ItyElement;
}

interface EventRecord {
  callback: (data?: unknown) => void;
  ctx: any;
}

class Evented {
  private _events: Record<string, EventRecord[]> = {};

  on(evtName: string, callback: (data?: unknown) => void, context: any = this): void {
    (this._events[evtName] ||= []).push({ callback, ctx: context });
  }

  off(evtName?: string, callback?: (data?: unknown) => void, context?: any): void {
    if (!evtName) {
      this._events = {};
      return;
    }
    const events = this._events[evtName];
    if (!events) return;
    if (!callback) {
      delete this._events[evtName];
      return;
    }
    for (let i = events.length - 1; i >= 0; i -= 1) {
      const event = events[i];
      if (event.callback === callback && (context === undefined || event.ctx === context)) {
        events.splice(i, 1);
      }
    }
    if (events.length === 0) delete this._events[evtName];
  }

  trigger(evtName: string, data?: unknown): void {
    const events = this._events[evtName];
    if (!events) return;
    for (const event of events.slice()) {
      event.callback.call(event.ctx, data);
    }
  }
}

const regexps = {
  nospaces: /^\S*$/
} as const;

class SelectorObject {
  [index: number]: HTMLElement;
  public readonly isSelectorObject = true;
  private nodes: HTMLElement[] = [];

  constructor(nodeList: ArrayLike<HTMLElement> = []) {
    this.nodes = Array.from(nodeList as HTMLElement[]);
    this.reindex();
  }

  get length(): number {
    return this.nodes.length;
  }

  [Symbol.iterator](): Iterator<HTMLElement> {
    return this.nodes[Symbol.iterator]();
  }

  toArray(): HTMLElement[] {
    return this.nodes.slice();
  }

  find(selector: string): SelectorObject {
    const nodeList: HTMLElement[] = [];
    for (const node of this.nodes) {
      const list = node.querySelectorAll(selector);
      for (const thisNode of Array.from(list)) {
        const elm = thisNode as HTMLElement;
        if (nodeList.indexOf(elm) < 0) nodeList.push(elm);
      }
    }
    return new SelectorObject(nodeList);
  }

  filter(selector: string): SelectorObject {
    return new SelectorObject(this.nodes.filter((node) => node.matches(selector)));
  }

  first(): SelectorObject {
    return new SelectorObject(this.nodes[0] ? [this.nodes[0]] : []);
  }

  last(): SelectorObject {
    return new SelectorObject(this.nodes.length ? [this.nodes[this.nodes.length - 1]] : []);
  }

  parent(): SelectorObject {
    const nodeList: HTMLElement[] = [];
    for (const node of this.nodes) {
      const parent = node.parentElement;
      if (parent && nodeList.indexOf(parent) < 0) nodeList.push(parent);
    }
    return new SelectorObject(nodeList);
  }

  children(selector?: string): SelectorObject {
    const nodeList: HTMLElement[] = [];
    for (const node of this.nodes) {
      for (const child of Array.from(node.children) as HTMLElement[]) {
        if (nodeList.indexOf(child) < 0 && (!selector || child.matches(selector))) {
          nodeList.push(child);
        }
      }
    }
    return new SelectorObject(nodeList);
  }

  remove(): SelectorObject {
    for (const node of this.nodes) node.remove();
    return new SelectorObject([]);
  }

  addClass(...classes: string[]): this {
    for (const node of this.nodes) node.classList.add(...classes);
    return this;
  }

  removeClass(value: string): this {
    if (value && regexps.nospaces.test(value)) {
      for (const node of this.nodes) node.classList.remove(value);
    }
    return this;
  }

  toggleClass(value: string): this {
    if (value && regexps.nospaces.test(value)) {
      for (const node of this.nodes) node.classList.toggle(value);
    }
    return this;
  }

  hasClass(value: string): boolean {
    return Boolean(value && regexps.nospaces.test(value) && this.nodes.some((node) => node.classList.contains(value)));
  }

  attr(name: string, value?: string | number | boolean | null): string | null | this {
    if (arguments.length === 1) return this.nodes[0]?.getAttribute(name) ?? null;
    for (const node of this.nodes) {
      if (value === null || value === false || value === undefined) node.removeAttribute(name);
      else node.setAttribute(name, value === true ? "" : String(value));
    }
    return this;
  }

  text(value?: string | number | boolean): string | this {
    if (arguments.length === 0) return this.nodes.map((node) => node.textContent || "").join("");
    for (const node of this.nodes) node.textContent = String(value);
    return this;
  }

  on(eventName: string, listener: EventListener, options?: AddEventListenerOptions): this {
    for (const node of this.nodes) node.addEventListener(eventName, listener, options);
    return this;
  }

  off(eventName: string, listener: EventListener, options?: EventListenerOptions): this {
    for (const node of this.nodes) node.removeEventListener(eventName, listener, options);
    return this;
  }

  before(content: string | SelectorObject | HTMLElement | TemplateResult): this {
    return this._html(content, "beforebegin");
  }

  after(content: string | SelectorObject | HTMLElement | TemplateResult): this {
    return this._html(content, "afterend");
  }

  append(content: string | SelectorObject | HTMLElement | TemplateResult): this {
    return this._html(content, "beforeend");
  }

  prepend(content: string | SelectorObject | HTMLElement | TemplateResult): this {
    return this._html(content, "afterbegin");
  }

  html(content?: string | SelectorObject | HTMLElement | TemplateResult): this | string {
    if (arguments.length === 0) return this.nodes[0]?.innerHTML ?? "";
    return this._html(content!, "replace");
  }

  empty(): this {
    for (const node of this.nodes) node.textContent = "";
    return this;
  }

  private _html(content: string | SelectorObject | HTMLElement | TemplateResult, position: InsertPosition | "replace"): this {
    const doc = getDocument();
    for (const node of this.nodes) {
      if ((content as SelectorObject)?.isSelectorObject) {
        const htmls = Array.from(content as SelectorObject).map((selNode) => selNode.outerHTML).join("");
        if (position === "replace") node.innerHTML = htmls;
        else node.insertAdjacentHTML(position as InsertPosition, htmls);
      } else if (isTemplateResult(content) && doc) {
        const fragment = materializeTemplate(content, doc);
        if (position === "replace") replaceChildren(node, fragment);
        else node.insertAdjacentElement(position as InsertPosition, fragmentToElement(fragment, doc));
      } else if (isNodeLike(content)) {
        const cloned = content.cloneNode(true) as HTMLElement;
        if (position === "replace") replaceChildren(node, valueToFragment(cloned, doc || node.ownerDocument));
        else node.insertAdjacentElement(position as InsertPosition, cloned);
      } else {
        const htmlContent = String(content);
        if (position === "replace") node.innerHTML = htmlContent;
        else node.insertAdjacentHTML(position as InsertPosition, htmlContent);
      }
    }
    return this;
  }

  private reindex(): void {
    for (const key of Object.keys(this)) {
      if (/^\d+$/.test(key)) delete (this as any)[key];
    }
    this.nodes.forEach((node, index) => {
      (this as any)[index] = node;
    });
  }
}

function fragmentToElement(fragment: DocumentFragment, doc: Document): HTMLElement {
  const span = doc.createElement("span");
  span.appendChild(fragment);
  return span;
}

function onDOMReady(fn: (...args: any[]) => void, args: unknown[] = [], context: any = Ity): void {
  const doc = getDocument();
  const func = () => fn.apply(context, args);
  if (!doc || doc.readyState !== "loading") func();
  else doc.addEventListener("DOMContentLoaded", func, { once: true });
}

interface AjaxOptions {
  url?: string;
  type?: string;
  data?: unknown;
  success?: (resp: any) => void;
  error?: (status?: number, error?: unknown) => void;
}

class Model<T extends Record<string, unknown> = Record<string, unknown>> extends Evented {
  public id!: string;
  public data!: T;
  public url!: string;
  public readonly state: Signal<T>;

  constructor(opts: Partial<Model<T>> = {}) {
    super();
    Object.assign(this, opts);
    this.id ||= `m${Math.floor(Math.random() * 100000) + 1}`;
    this.data ||= {} as T;
    this.url ||= "";
    this.state = signal(this.data);
    this._init(opts);
  }

  onDOMReady = onDOMReady;

  protected _init(opts?: Partial<Model<T>>): void {
    this.initialize(opts);
  }

  protected _ajax(opts: AjaxOptions = {}): void {
    const request = new XMLHttpRequest();
    const method = opts.type || "GET";
    const url = opts.url || this.url;
    const success = opts.success || function (this: Model<T>, resp: any) {
      this.data = resp;
      this.state.set(resp);
    };
    const error = opts.error || function () { };
    request.open(method, url, true);
    request.onload = () => {
      if (request.status >= 200 && request.status < 400) {
        try {
          const response = request.responseText ? JSON.parse(request.responseText) : null;
          success.call(this, response);
        } catch (err) {
          error.call(this, request.status, err);
        }
      } else {
        error.call(this, request.status);
      }
    };
    request.onerror = () => error.call(this);
    request.send(opts.data === undefined ? undefined : JSON.stringify(opts.data));
  }

  initialize(options?: Partial<Model<T>>): void { }

  get(attr?: keyof T): any {
    const current = this.data;
    if (!attr) return current;
    return current ? (current as any)[attr as string] : undefined;
  }

  set(attr: keyof T | Partial<T>, value?: any): void {
    const current = this.state.peek() || {} as T;
    const next = typeof attr === "string"
      ? { ...(current as any), [attr]: value } as T
      : attr as T;
    this.data = next;
    this.state.set(next);
    this.trigger("change", this.data);
  }

  unSet(attr: keyof T): void {
    const current = this.state.peek();
    if (!current || !Object.prototype.hasOwnProperty.call(current, attr)) return;
    const next = { ...(current as any) };
    delete next[attr as string];
    this.data = next as T;
    this.state.set(this.data);
    this.trigger("change", this.data);
  }

  clear(): void {
    this.data = {} as T;
    this.state.set(this.data);
    this.trigger("change", this.data);
  }

  subscribe(callback: Subscriber<T>, options?: { immediate?: boolean }): Cleanup {
    return this.state.subscribe(callback, options);
  }

  sync(opts?: AjaxOptions): void {
    this._ajax(opts);
  }

  toJSON(): T {
    return this.get();
  }
}

interface ViewEvents {
  [selector: string]: Record<string, string>;
}

interface ViewOptions {
  el?: string | SelectorObject | NodeList | HTMLElement;
  app?: Application;
  name?: string;
  events?: ViewEvents;
  [key: string]: any;
}

class View extends Evented {
  public id!: string;
  public el!: SelectorObject;
  public app?: Application;
  public name?: string;
  public events!: ViewEvents;
  private renderCleanup?: Cleanup;
  private delegatedListeners: Cleanup[] = [];

  constructor(opts: ViewOptions = {}) {
    super();
    Object.assign(this, opts);
    this.id ||= `v${Math.floor(Math.random() * 100000) + 1}`;
    if (this.app) this.app.addView(this);
    this.events ||= {};
    onDOMReady(this._init, [opts], this);
  }

  private _setElement(elSelector: ViewOptions["el"]): void {
    const win = getWindow();
    if ((elSelector as SelectorObject)?.isSelectorObject) {
      this.el = elSelector as SelectorObject;
    } else if (win?.NodeList && elSelector instanceof win.NodeList) {
      this.el = new SelectorObject(elSelector as any);
    } else if (typeof elSelector === "string") {
      this.el = new SelectorObject(documentOrThrow().querySelectorAll(elSelector) as any);
    } else if (win?.HTMLElement && elSelector instanceof win.HTMLElement) {
      this.el = new SelectorObject([elSelector]);
    } else {
      throw new Error("el selector must be of type String, NodeList, HTMLElement or Ity.SelectorObject");
    }
  }

  private _bindDOMEvents(evtObj: ViewEvents): void {
    if (!this.el || !this.el.isSelectorObject) return;
    const captureEvents = ["focus", "blur"];
    for (const selector in evtObj) {
      for (const evt in evtObj[selector]) {
        const callback = (this as any)[evtObj[selector][evt]];
        if (typeof callback !== "function") {
          throw new Error(`View event handler not found: ${evtObj[selector][evt]}`);
        }
        const capture = captureEvents.includes(evt);
        this._delegateEvent(selector, evt, callback, capture);
      }
    }
  }

  private _delegateEvent(selector: string, evtName: string, callback: (e: Event) => void, capture = false): void {
    for (const root of this.el) {
      const listener = (event: Event) => {
        let node: HTMLElement | null = event.target as HTMLElement;
        while (node) {
          if ((node as any).matches && (node as any).matches(selector)) {
            (event as any).delegateTarget = node;
            callback.call(this, event);
            break;
          }
          if (node === root) break;
          node = node.parentElement;
        }
      };
      root.addEventListener(evtName, listener, capture);
      this.delegatedListeners.push(() => root.removeEventListener(evtName, listener, capture));
    }
  }

  private _init(opts: ViewOptions): void {
    if (this.el) this._setElement(this.el as any);
    if (opts.el && !this.el) this._setElement(opts.el);
    this._bindDOMEvents(this.events);
    this.initialize(opts);
  }

  initialize(opts?: ViewOptions): void { }

  getName(): string | undefined {
    return this.name;
  }

  get(attr: keyof this): any {
    return (this as any)[attr];
  }

  set(attr: keyof this, value: any): void {
    (this as any)[attr] = value;
  }

  renderWith(view: TemplateValue | (() => TemplateValue), options?: RenderOptions): Cleanup {
    if (this.renderCleanup) this.renderCleanup();
    this.renderCleanup = render(view, this.el, options);
    return this.renderCleanup;
  }

  remove(): void {
    if (this.renderCleanup) this.renderCleanup();
    for (const cleanup of this.delegatedListeners.splice(0)) cleanup();
    this.el.remove();
    if (this.app) this.app.removeView(this.id);
  }

  select(selector: string, ctx: HTMLElement | HTMLDocument | SelectorObject = this.el): SelectorObject {
    const win = getWindow();
    if ((win?.HTMLElement && ctx instanceof win.HTMLElement) || (win?.HTMLDocument && ctx instanceof win.HTMLDocument)) {
      return new SelectorObject(ctx.querySelectorAll(selector) as any);
    }
    if ((ctx as any).isSelectorObject) return (ctx as SelectorObject).find(selector);
    throw new Error("Context passed to .select() must be an HTMLElement or an Ity.SelectorObject");
  }
}

class Application {
  public views: View[] = [];

  getView(id: string): View | undefined {
    return this.views.find((view) => view.id === id);
  }

  addView(view: View): void {
    if (view instanceof View && !this.views.includes(view)) this.views.push(view);
  }

  removeView(id: string): void {
    this.views = this.views.filter((view) => view.id !== id);
  }

  trigger(evtName: string, data?: unknown): void {
    for (const view of this.views.slice()) view.trigger(evtName, data);
  }
}

class Collection<M extends Model = Model> {
  public models: M[] = [];
  public url!: string;
  public readonly state: Signal<M[]>;
  private ModelClass: new () => M;

  constructor(models: M[] = [], ModelClass: new () => M = Model as any) {
    this.ModelClass = ModelClass;
    this.url = "";
    this.state = signal(this.models);
    models.forEach((model) => this.add(model));
  }

  get(id: string): M | undefined {
    return this.models.find((model) => model.id === id);
  }

  add(model: M): void {
    if (!(model instanceof Model)) return;
    this.models = [...this.models, model];
    this.state.set(this.models);
  }

  remove(id: string | M): void {
    const model = typeof id === "string" ? this.get(id) : id;
    if (!model) return;
    this.models = this.models.filter((item) => item !== model);
    this.state.set(this.models);
  }

  at(index: number): M | undefined {
    return this.models[index];
  }

  get length(): number {
    return this.models.length;
  }

  clear(): void {
    this.models = [];
    this.state.set(this.models);
  }

  find(predicate: (m: M) => boolean): M | undefined {
    return this.models.find(predicate);
  }

  filter(predicate: (m: M) => boolean): M[] {
    return this.models.filter(predicate);
  }

  map<T>(mapper: (m: M, index: number) => T): T[] {
    return this.models.map(mapper);
  }

  toJSON(): any[] {
    return this.models.map((model) => model.get());
  }

  subscribe(callback: Subscriber<M[]>, options?: { immediate?: boolean }): Cleanup {
    return this.state.subscribe(callback, options);
  }

  protected _ajax(opts: AjaxOptions = {}): void {
    const request = new XMLHttpRequest();
    const method = opts.type || "GET";
    const url = opts.url || this.url;
    const success = opts.success || function () { };
    const error = opts.error || function () { };
    request.open(method, url, true);
    request.onload = () => {
      if (request.status >= 200 && request.status < 400) {
        try {
          success.call(this, request.responseText ? JSON.parse(request.responseText) : null);
        } catch (err) {
          error.call(this, request.status, err);
        }
      } else {
        error.call(this, request.status);
      }
    };
    request.onerror = () => error.call(this);
    request.send(opts.data === undefined ? undefined : JSON.stringify(opts.data));
  }

  fetch(opts: AjaxOptions & { modelClass?: new () => M } = {}): void {
    const userSuccess = opts.success;
    opts.success = function (this: Collection<M>, resp: any[]) {
      const ctor = (opts.modelClass || this.ModelClass) as new () => M;
      this.clear();
      for (const data of resp || []) {
        const model = new ctor();
        (model as any).set(data);
        this.add(model);
      }
      if (userSuccess) userSuccess.call(this, resp);
    };
    this._ajax(opts);
  }

  trigger(evtName: string, data?: unknown): void {
    for (const model of this.models.slice()) model.trigger(evtName, data);
  }
}

interface RouteContext {
  path: string;
  url: URL;
  params: Record<string, string>;
  query: Record<string, string>;
  hash: Record<string, string>;
}

interface RouteResourceContext<T> extends ResourceContext<T>, RouteContext {
  router: Router;
  scope: ItyScope;
}

interface RouteActionContext extends RouteContext {
  router: Router;
  scope: ItyScope;
}

type RouteHandler = (params: Record<string, string>, context: RouteContext) => void | Cleanup;

interface RouteRecord {
  pattern: string;
  handler: RouteHandler;
  exec(url: URL): Record<string, string> | null;
}

interface RouterOptions {
  base?: string;
  autoStart?: boolean;
  linkSelector?: string;
  transition?: boolean;
  notFound?: RouteHandler;
  scope?: ItyScope | null;
  name?: string;
}

class Router {
  private routes: RouteRecord[] = [];
  private started = false;
  private readonly listener = () => this.check();
  private readonly clickListener = (event: Event) => this.handleLinkClick(event);
  private readonly navigationListener = (event: any) => this.handleNavigationEvent(event);
  private routeCleanup?: Cleanup;
  private activeRoute?: RouteRecord;
  public readonly current: Signal<RouteContext | null> = signal<RouteContext | null>(null);
  public notFound?: RouteHandler;
  public base: string;
  public linkSelector: string;
  public transition: boolean;
  public scope: ItyScope;
  public name: string;

  constructor(options: RouterOptions = {}) {
    this.base = options.base || "/";
    this.linkSelector = options.linkSelector || "a[href]";
    this.transition = Boolean(options.transition);
    this.notFound = options.notFound;
    this.name = options.name || "router";
    this.scope = options.scope || new ScopeNode({ name: `${this.name}:scope` });
    if (options.autoStart !== false) this.start();
  }

  add(pattern: string, handler: RouteHandler): this {
    this.routes.push(createRouteRecord(pattern, handler));
    emitRuntimeEvent({
      type: "router:add",
      timestamp: Date.now(),
      name: this.name,
      detail: { pattern }
    });
    return this;
  }

  addRoute(pattern: string, handler: RouteHandler): void {
    this.add(pattern, handler);
  }

  removeRoute(pattern: string): this {
    if (this.activeRoute?.pattern === pattern) {
      this.disposeRoute();
      this.activeRoute = undefined;
      this.current.set(null);
    }
    this.routes = this.routes.filter((route) => route.pattern !== pattern);
    return this;
  }

  navigate(path: string, options: { replace?: boolean; transition?: boolean } = {}): void {
    const win = getWindow();
    if (!win) return;
    const update = () => {
      const method = options.replace ? "replaceState" : "pushState";
      win.history[method](null, "", withBasePath(path, this.base));
      emitRuntimeEvent({
        type: "router:navigate",
        timestamp: Date.now(),
        name: this.name,
        detail: { path, replace: Boolean(options.replace) }
      });
      this.check();
    };
    withViewTransition(update, options.transition ?? this.transition);
  }

  href(path: string): string {
    return withBasePath(path, this.base);
  }

  link(path: string, attrs: Record<string, unknown> = {}): Record<string, unknown> {
    const previousClick = attrs["@click"] as ((event: Event) => void) | undefined;
    const href = this.href(path);
    return {
      ...attrs,
      href,
      "@click": (event: Event) => {
        previousClick?.(event);
        const currentTarget = event.currentTarget as HTMLAnchorElement | null;
        const anchor = currentTarget && typeof (currentTarget as any).matches === "function" && currentTarget.matches(this.linkSelector)
          ? currentTarget
          : null;
        const url = this.resolveNavigationURL(event, anchor, href);
        if (!url) return;
        event.preventDefault();
        this.navigate(`${url.pathname}${url.search}${url.hash}`);
      }
    };
  }

  start(): void {
    const win = getWindow();
    const doc = getDocument();
    if (!win || this.started) {
      if (win) this.check();
      return;
    }
    win.addEventListener("popstate", this.listener);
    doc?.addEventListener("click", this.clickListener);
    (win as any).navigation?.addEventListener?.("navigate", this.navigationListener);
    this.started = true;
    emitRuntimeEvent({ type: "router:start", timestamp: Date.now(), name: this.name });
    this.check();
  }

  stop(): void {
    const win = getWindow();
    const doc = getDocument();
    if (win && this.started) {
      win.removeEventListener("popstate", this.listener);
      doc?.removeEventListener("click", this.clickListener);
      (win as any).navigation?.removeEventListener?.("navigate", this.navigationListener);
    }
    this.started = false;
    this.disposeRoute();
    emitRuntimeEvent({ type: "router:stop", timestamp: Date.now(), name: this.name });
  }

  resource<T, E = unknown>(
    pattern: string | null,
    loader: (context: RouteResourceContext<T>) => Promise<T> | T,
    options: ResourceOptions<T, E> = {}
  ): Resource<T, E> {
    const matcher = pattern ? createRouteRecord(pattern, () => undefined) : null;
    const routeResource = resource<T, E>(({ signal, previous, refreshId }) => {
      const context = this.current.peek();
      if (!context) return previous as T | undefined as T;
      if (matcher) {
        const params = matcher.exec(context.url);
        if (!params) return previous as T | undefined as T;
        return loader({
          ...context,
          params: { ...context.params, ...params },
          signal,
          previous,
          refreshId,
          router: this,
          scope: this.scope
        });
      }
      return loader({
        ...context,
        signal,
        previous,
        refreshId,
        router: this,
        scope: this.scope
      });
    }, {
      ...options,
      immediate: false,
      name: options.name || `${this.name}.resource`
    });

    effect(() => {
      const context = this.current();
      if (!context) {
        routeResource.abort();
        routeResource.mutate(undefined);
        return;
      }
      if (matcher && !matcher.exec(context.url)) {
        routeResource.abort();
        routeResource.mutate(undefined);
        return;
      }
      routeResource.refresh();
    });

    return routeResource;
  }

  action<TArgs extends unknown[], TResult, E = unknown>(
    handler: (context: RouteActionContext | null, ...args: TArgs) => Promise<TResult> | TResult,
    options: ActionOptions<TResult, E> = {}
  ): Action<TArgs, TResult, E> {
    return action<TArgs, TResult, E>((...args) => {
      const context = this.current.peek();
      return handler(context ? { ...context, router: this, scope: this.scope } : null, ...args);
    }, {
      ...options,
      name: options.name || `${this.name}.action`
    });
  }

  check(): RouteContext | null {
    const win = getWindow();
    if (!win) return null;
    const url = new URL(win.location.href);
    const routePath = stripBasePath(url.pathname, this.base);
    if (routePath === null) {
      this.disposeRoute();
      this.activeRoute = undefined;
      this.current.set(null);
      return null;
    }
    const routeUrl = new URL(url.href);
    routeUrl.pathname = routePath || "/";
    for (const route of this.routes) {
      const routeParams = route.exec(routeUrl);
      if (!routeParams) continue;
      const query = searchParamsToObject(url.search);
      const hash = searchParamsToObject(url.hash);
      const params = { ...routeParams, ...query, ...hash };
      const context: RouteContext = {
        path: routePath || "/",
        url,
        params,
        query,
        hash
      };
      this.disposeRoute();
      this.activeRoute = route;
      this.current.set(context);
      emitRuntimeEvent({
        type: "router:match",
        timestamp: Date.now(),
        name: this.name,
        detail: { pattern: route.pattern, path: context.path, params: context.params }
      });
      const cleanup = route.handler(params, context);
      if (typeof cleanup === "function") this.routeCleanup = cleanup;
      return context;
    }
    this.disposeRoute();
    this.activeRoute = undefined;
    this.current.set(null);
    const cleanup = this.notFound?.({}, {
      path: routePath || "/",
      url,
      params: {},
      query: searchParamsToObject(url.search),
      hash: searchParamsToObject(url.hash)
    });
    emitRuntimeEvent({
      type: "router:not-found",
      timestamp: Date.now(),
      name: this.name,
      detail: { path: routePath || "/" }
    });
    if (typeof cleanup === "function") this.routeCleanup = cleanup;
    return null;
  }

  private handleLinkClick(event: Event): void {
    const anchor = this.findAnchor(event);
    const url = this.resolveNavigationURL(event, anchor);
    if (!url) return;
    event.preventDefault();
    this.navigate(`${url.pathname}${url.search}${url.hash}`);
  }

  private handleNavigationEvent(event: any): void {
    const win = getWindow();
    if (!win || !event?.canIntercept || !event.destination?.url || typeof event.intercept !== "function") return;
    const url = new URL(event.destination.url, win.location.href);
    if (url.origin !== win.location.origin) return;
    if (stripBasePath(url.pathname, this.base) === null) return;
    event.intercept({
      handler: () => {
        this.check();
      }
    });
  }

  private disposeRoute(): void {
    if (!this.routeCleanup) return;
    const cleanup = this.routeCleanup;
    this.routeCleanup = undefined;
    cleanup();
  }

  private resolveNavigationURL(event: Event, anchor: HTMLAnchorElement | null, fallbackHref?: string): URL | null {
    const mouseEvent = event as MouseEvent;
    if (event.defaultPrevented) return null;
    if (typeof mouseEvent.button === "number" && mouseEvent.button !== 0) return null;
    if (mouseEvent.metaKey || mouseEvent.ctrlKey || mouseEvent.shiftKey || mouseEvent.altKey) return null;
    if (anchor && ((anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download"))) return null;
    const win = getWindow();
    if (!win) return null;
    const href = anchor?.getAttribute("href") ?? fallbackHref;
    if (!href || /^(mailto|tel):/i.test(href)) return null;
    const url = new URL(anchor?.href || href, win.location.href);
    if (url.origin !== win.location.origin) return null;
    if (stripBasePath(url.pathname, this.base) === null) return null;
    return url;
  }

  private findAnchor(event: Event): HTMLAnchorElement | null {
    const win = getWindow();
    const fromPath = typeof (event as any).composedPath === "function"
      ? ((event as any).composedPath() as EventTarget[])
      : [];
    for (const entry of fromPath) {
      if (!entry || !(entry as any).matches) continue;
      const element = entry as HTMLElement;
      if (element.matches(this.linkSelector)) return element as HTMLAnchorElement;
    }
    const target = event.target as HTMLElement | null;
    return target?.closest?.(this.linkSelector) as HTMLAnchorElement | null;
  }
}

function createRouteRecord(pattern: string, handler: RouteHandler): RouteRecord {
  const win = getWindow();
  const URLPatternCtor = (win as any)?.URLPattern || (globalThis as any).URLPattern;
  if (typeof URLPatternCtor === "function") {
    try {
      const nativePattern = new URLPatternCtor({ pathname: pattern });
      return {
        pattern,
        handler,
        exec(url) {
          const match = nativePattern.exec(url.href);
          return match ? decodeParams(match.pathname.groups || {}) : null;
        }
      };
    } catch (_err) {
      // Fall through to the regex matcher for non-URLPattern syntax.
    }
  }

  const { re, keys } = compilePathPattern(pattern);
  return {
    pattern,
    handler,
    exec(url) {
      const match = re.exec(normalizePath(url.pathname));
      if (!match) return null;
      const params: Record<string, string> = {};
      keys.forEach((key, index) => {
        params[key] = decodeURIComponent(match[index + 1] || "");
      });
      return params;
    }
  };
}

function normalizeBase(base: string): string {
  const normalized = normalizePath(base || "/");
  return normalized === "" ? "" : normalized;
}

function withBasePath(path: string, base: string): string {
  const normalizedBase = normalizeBase(base);
  const parsed = new URL(path || "/", "http://ity.local");
  let pathname = normalizePath(parsed.pathname) || "/";
  if (normalizedBase && pathname !== normalizedBase && !pathname.startsWith(`${normalizedBase}/`)) {
    pathname = `${normalizedBase}${pathname === "/" ? "" : pathname}`;
  }
  return `${pathname}${parsed.search}${parsed.hash}`;
}

function stripBasePath(pathname: string, base: string): string | null {
  const normalizedBase = normalizeBase(base);
  const normalizedPath = normalizePath(pathname) || "/";
  if (!normalizedBase) return normalizedPath;
  if (normalizedPath === normalizedBase) return "/";
  if (normalizedPath.startsWith(`${normalizedBase}/`)) {
    return normalizePath(normalizedPath.slice(normalizedBase.length)) || "/";
  }
  return null;
}

function compilePathPattern(pattern: string): { re: RegExp; keys: string[] } {
  const keys: string[] = [];
  const normalized = normalizePath(pattern);
  if (normalized === "") return { re: /^\/?$/, keys };
  const segments = normalized.split("/").filter(Boolean);
  const source = segments.map((segment) => {
    if (segment === "*") {
      keys.push("wildcard");
      return "(.*)";
    }
    if (segment.startsWith(":")) {
      keys.push(segment.slice(1));
      return "([^/]+)";
    }
    return escapeRegExp(segment);
  }).join("/");
  return { re: new RegExp(`^/${source}/?$`), keys };
}

function normalizePath(path: string): string {
  const normalized = path.replace(/[?#].*$/, "").replace(/\/+$/, "");
  return normalized === "" ? "" : normalized.startsWith("/") ? normalized : `/${normalized}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function searchParamsToObject(value: string): Record<string, string> {
  const out: Record<string, string> = {};
  const clean = value.replace(/^[?#]/, "");
  if (!clean) return out;
  const params = new URLSearchParams(clean);
  params.forEach((paramValue, key) => {
    out[key] = paramValue;
  });
  return out;
}

function decodeParams(value: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of Object.keys(value)) {
    out[key] = decodeURIComponent(value[key]);
  }
  return out;
}

const defaultRouter = signal<Router | null>(null);

function route(pattern: string, handler: RouteHandler): Router {
  let router = defaultRouter.peek();
  if (!router) {
    router = new Router({ autoStart: false });
    defaultRouter.set(router);
  }
  router.add(pattern, handler);
  router.start();
  return router;
}

const Ity = {
  version: "3.0.0",
  createConfig,
  configure,
  createScope,
  observeRuntime,
  signal,
  computed,
  effect,
  batch,
  untrack,
  isSignal,
  resolveSignal,
  store,
  resource,
  action,
  form,
  formState,
  html,
  repeat,
  unsafeHTML,
  render,
  hydrate,
  renderToString,
  component,
  route,
  Router,
  SelectorObject,
  onDOMReady,
  Model,
  View,
  Application,
  Collection
};

function createAmdExport(): typeof Ity {
  const win = getWindow();
  if (win) (win as any).Ity = Ity;
  return Ity;
}

/* c8 ignore next 3 */
if (typeof define === "function" && (define as any).amd) {
  (define as any)(createAmdExport);
} else if (typeof module === "object" && typeof module.exports !== "undefined") {
  module.exports = Ity;
}

const win = getWindow();
if (win) {
  (win as any).Ity = Ity;
}

export {
  Application,
  Collection,
  Model,
  Router,
  SelectorObject,
  View,
  batch,
  component,
  configure,
  createConfig,
  createScope,
  computed,
  effect,
  action,
  form,
  formState,
  hydrate,
  html,
  isSignal,
  observeRuntime,
  onDOMReady,
  repeat,
  render,
  renderToString,
  resource,
  resolveSignal,
  route,
  signal,
  store,
  unsafeHTML,
  untrack
};
export type {
  Action,
  ActionOptions,
  AsyncStatus,
  Cleanup,
  ComponentContext,
  ComponentOptions,
  EffectHandle,
  FormBindOptions,
  FormController,
  FormField,
  FormOptions,
  FormState,
  FormStateController,
  FormStateOptions,
  FormStateSubmitOptions,
  HTMLSanitizer,
  ItyConfig,
  ReadonlySignal,
  RenderOptions,
  RenderToStringOptions,
  Resource,
  ResourceContext,
  ResourceOptions,
  RouteActionContext,
  RouteContext,
  RouteHandler,
  RouteResourceContext,
  RepeatResult,
  Signal,
  ScopeKey,
  ScopeOptions,
  Store,
  TemplateResult,
  RuntimeEvent,
  RuntimeObserver,
  RuntimeWarning,
  ItyScope,
  UnsafeHTMLOptions
};
export default Ity;
