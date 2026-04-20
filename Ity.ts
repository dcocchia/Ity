// Ity.ts 2.1.0
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

interface UnsafeHTML {
  readonly isUnsafeHTML: true;
  readonly value: string;
}

type HTMLSanitizer = (value: string) => string;

interface UnsafeHTMLOptions {
  sanitize?: HTMLSanitizer;
}

interface ItyConfig {
  sanitizeHTML?: HTMLSanitizer | null;
}

interface RenderOptions {
  reactive?: boolean;
  transition?: boolean;
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
}

interface Action<TArgs extends unknown[], TResult, E = unknown> {
  (...args: TArgs): Promise<TResult>;
  submit(...args: TArgs): Promise<TResult>;
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
  reset(): void;
}

interface FormOptions<TResult, E = unknown> extends ActionOptions<TResult, E> {
  resetOnSuccess?: boolean;
}

const defaultEquals = Object.is;
let activeObserver: ReactiveObserver | null = null;
let batchDepth = 0;
const pendingEffects = new Set<ReactiveEffect>();
let configuredSanitizeHTML: HTMLSanitizer | undefined;

function getWindow(): (Window & typeof globalThis) | undefined {
  return typeof window !== "undefined" ? window : undefined;
}

function getDocument(): Document | undefined {
  const win = getWindow();
  return win?.document ?? (typeof document !== "undefined" ? document : undefined);
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

  constructor(value: T, options: SignalOptions<T> = {}) {
    this.value = value;
    this.equals = options.equals || defaultEquals;
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

  constructor(private readonly getter: () => T, options: ComputedOptions<T> = {}) {
    this.equals = options.equals || defaultEquals;
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
      if (!keepPrevious) data.set(undefined);

      currentPromise = Promise.resolve()
        .then(() => loader({ signal, previous, refreshId: id }))
        .then((value) => {
          if (id !== refreshId || signal.aborted) return data.peek();
          data.set(value);
          error.set(null);
          statusValue.set("success");
          options.onSuccess?.(value);
          return value;
        })
        .catch((err) => {
          if (id !== refreshId) return data.peek();
          error.set(err as E);
          statusValue.set("error");
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
    },
    abort(reason?: unknown) {
      if (!controller) return;
      refreshId += 1;
      controller.abort(reason);
      controller = null;
      currentPromise = null;
      pending.set(false);
      statusValue.set(data.peek() === undefined ? "idle" : "success");
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

    return Promise.resolve()
      .then(() => handler(...args))
      .then((value) => {
        if (runGeneration === generation) {
          data.set(value);
          error.set(null);
          options.onSuccess?.(value);
          if (count.peek() <= 1) statusValue.set("success");
        }
        return value;
      })
      .catch((err) => {
        if (runGeneration === generation) {
          error.set(err as E);
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
    data: Signal<TResult | undefined>;
    error: Signal<E | null>;
    pending: ReadonlySignal<boolean>;
    pendingCount: ReadonlySignal<number>;
    status: ReadonlySignal<AsyncStatus>;
  };
  mutableCallable.submit = submit;
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
  };
  return callable;
}

function form<TResult, E = unknown>(
  handler: (data: FormData, event: Event) => Promise<TResult> | TResult,
  options: FormOptions<TResult, E> = {}
): FormController<TResult, E> {
  const submitAction = action<[FormData, Event], TResult, E>(handler, options);

  const findForm = (event: Event): HTMLFormElement => {
    const target = (event.currentTarget || event.target) as Element | null;
    const getFormElementCtor = (node: Element | null): typeof HTMLFormElement | undefined => {
      const ownerWindow = node?.ownerDocument?.defaultView as (Window & typeof globalThis) | null | undefined;
      return ownerWindow?.HTMLFormElement
        || getWindow()?.HTMLFormElement
        || (typeof HTMLFormElement !== "undefined" ? HTMLFormElement : undefined);
    };
    const isFormElement = (node: Element | null | undefined): node is HTMLFormElement => {
      const FormElement = node ? getFormElementCtor(node) : getFormElementCtor(target);
      return Boolean(node && FormElement && node instanceof FormElement);
    };
    if (!getFormElementCtor(target)) throw new Error("Ity.form requires HTMLFormElement support");
    if (isFormElement(target)) return target;
    const closest = target?.closest?.("form");
    if (isFormElement(closest)) return closest;
    throw new Error("Ity.form onSubmit requires a form event target");
  };

  const createFormData = (formElement: HTMLFormElement): FormData => {
    const ownerWindow = formElement.ownerDocument?.defaultView as (Window & typeof globalThis) | null | undefined;
    const FormDataCtor = ownerWindow?.FormData
      || getWindow()?.FormData
      || (typeof FormData !== "undefined" ? FormData : undefined);
    if (!FormDataCtor) throw new Error("Ity.form requires FormData support");
    return new FormDataCtor(formElement);
  };

  return {
    action: submitAction,
    data: submitAction.data,
    error: submitAction.error,
    pending: submitAction.pending,
    status: submitAction.status,
    async onSubmit(event: Event): Promise<TResult> {
      event.preventDefault();
      const formElement = findForm(event);
      const result = await submitAction(createFormData(formElement), event);
      if (options.resetOnSuccess) formElement.reset();
      return result;
    },
    reset() {
      submitAction.reset();
    }
  };
}

function html(strings: TemplateStringsArray | readonly string[], ...values: unknown[]): TemplateResult {
  return {
    isTemplateResult: true,
    strings: Array.from(strings),
    values
  };
}

function unsafeHTML(value: string, options: UnsafeHTMLOptions = {}): UnsafeHTML {
  const sanitizer = options.sanitize || configuredSanitizeHTML;
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

function valueToFragment(value: unknown, doc: Document = documentOrThrow()): DocumentFragment {
  const fragment = doc.createDocumentFragment();
  appendValue(fragment, normalizeValue(value), doc);
  return fragment;
}

function appendValue(parent: Node, value: unknown, doc: Document): void {
  value = normalizeValue(value);
  if (value === null || value === undefined || value === false) return;
  if (Array.isArray(value)) {
    for (const item of value) appendValue(parent, item, doc);
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
      const first = rawName[0];
      const kind = first === "@" ? "event" : first === "." ? "prop" : first === "?" ? "bool" : "attr";
      const name = kind === "attr" ? rawName : rawName.slice(1);
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
  if (binding.kind === "event") {
    if (typeof value === "function") {
      element.addEventListener(name, value as EventListener);
    } else if (Array.isArray(value) && typeof value[0] === "function") {
      element.addEventListener(name, value[0] as EventListener, value[1] as AddEventListenerOptions);
    }
    return;
  }

  if (binding.kind === "prop") {
    (element as any)[name] = value;
    return;
  }

  if (binding.kind === "bool") {
    element.toggleAttribute(name, Boolean(value));
    return;
  }

  if (value === false || value === null || value === undefined) {
    element.removeAttribute(name);
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

function replaceChildren(target: Element | DocumentFragment, fragment: DocumentFragment): void {
  const maybeTarget = target as any;
  if (typeof maybeTarget.replaceChildren === "function") {
    maybeTarget.replaceChildren(fragment);
    return;
  }
  while (target.firstChild) target.removeChild(target.firstChild);
  target.appendChild(fragment);
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
  const update = () => {
    const value = typeof view === "function" && !isSignal(view)
      ? (view as () => TemplateValue)()
      : normalizeValue(view);
    withViewTransition(() => replaceChildren(mount, valueToFragment(value)), options.transition);
  };

  if (options.reactive === false) {
    update();
    return () => undefined;
  }

  return effect(update);
}

function renderToString(view: TemplateValue | (() => TemplateValue)): string {
  const value = typeof view === "function" && !isSignal(view)
    ? (view as () => TemplateValue)()
    : normalizeValue(view);
  return valueToString(value);
}

function valueToString(value: unknown): string {
  value = normalizeValue(value);
  if (value === null || value === undefined || value === false) return "";
  if (Array.isArray(value)) return value.map(valueToString).join("");
  if (isTemplateResult(value)) return templateToString(value);
  if (isUnsafeHTML(value)) return value.value;
  if (isNodeLike(value)) {
    const node = value as any;
    if (typeof node.outerHTML === "string") return node.outerHTML;
    return escapeHTML(node.textContent || "");
  }
  return escapeHTML(String(value));
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
      const first = rawName[0];
      const kind = first === "@" ? "event" : first === "." ? "prop" : first === "?" ? "bool" : "attr";
      const name = kind === "attr" ? rawName : rawName.slice(1);
      if (kind === "event" || kind === "prop" || value === false || value === null || value === undefined) {
        source += before;
      } else if (kind === "bool") {
        source += value ? `${before}${name}` : before;
      } else {
        source += `${before}${name}="${escapeAttribute(stringifyAttribute(name, value))}"`;
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

interface ComponentContext {
  host: HTMLElement;
  root: HTMLElement | ShadowRoot;
  attr(name: string): ReadonlySignal<string | null>;
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
  shadow?: boolean | ShadowRootMode | ShadowRootInit;
  styles?: string;
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

  class ItyElement extends win.HTMLElement {
    static get observedAttributes(): string[] {
      return attrs;
    }

    private attrSignals = new Map<string, Signal<string | null>>();
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
    private initialized = false;
    private connected = false;

    connectedCallback(): void {
      this.ensureMount();
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
    }

    private startRender(): void {
      if (this.renderCleanup || this.renderOutput === undefined) return;
      this.renderCleanup = render(this.renderOutput, this.renderTarget!, { transition: false });
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

    private createContext(): ComponentContext {
      return {
        host: this,
        root: this.mount!,
        attr: (name) => this.ensureAttrSignal(name),
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

  constructor(options: RouterOptions = {}) {
    this.base = options.base || "/";
    this.linkSelector = options.linkSelector || "a[data-ity-link]";
    this.transition = Boolean(options.transition);
    this.notFound = options.notFound;
    if (options.autoStart !== false) this.start();
  }

  add(pattern: string, handler: RouteHandler): this {
    this.routes.push(createRouteRecord(pattern, handler));
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
      this.check();
    };
    withViewTransition(update, options.transition ?? this.transition);
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
    if (typeof cleanup === "function") this.routeCleanup = cleanup;
    return null;
  }

  private handleLinkClick(event: Event): void {
    const target = event.target as HTMLElement | null;
    const anchor = target?.closest?.(this.linkSelector) as HTMLAnchorElement | null;
    if (!anchor || anchor.target || anchor.hasAttribute("download")) return;
    const win = getWindow();
    if (!win) return;
    const url = new URL(anchor.href, win.location.href);
    if (url.origin !== win.location.origin) return;
    if (stripBasePath(url.pathname, this.base) === null) return;
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
  version: "2.1.0",
  configure,
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
  html,
  unsafeHTML,
  render,
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
  computed,
  effect,
  action,
  form,
  html,
  isSignal,
  onDOMReady,
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
  ComponentContext,
  ComponentOptions,
  EffectHandle,
  FormController,
  FormOptions,
  HTMLSanitizer,
  ItyConfig,
  ReadonlySignal,
  RenderOptions,
  Resource,
  ResourceContext,
  ResourceOptions,
  RouteContext,
  RouteHandler,
  Signal,
  Store,
  TemplateResult,
  UnsafeHTMLOptions
};
export default Ity;
