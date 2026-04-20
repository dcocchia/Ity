type Cleanup = () => void;
type Equality<T> = (prev: T, next: T) => boolean;
type Subscriber<T> = (value: T, previous: T) => void;
type MaybeSignal<T> = T | ReadonlySignal<T>;
type TemplateValue = TemplateResult | UnsafeHTML | Node | string | number | boolean | null | undefined | TemplateValue[] | ReadonlySignal<any>;
interface ReadonlySignal<T> {
    (): T;
    get(): T;
    peek(): T;
    subscribe(callback: Subscriber<T>, options?: {
        immediate?: boolean;
    }): Cleanup;
    readonly isSignal: true;
}
interface Signal<T> extends ReadonlySignal<T> {
    (next: T | ((previous: T) => T)): T;
    set(next: T | ((previous: T) => T)): T;
    update(updater: (previous: T) => T): T;
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
    $subscribe(callback: (value: T) => void, options?: {
        immediate?: boolean;
    }): Cleanup;
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
declare function signal<T>(initialValue: T, options?: SignalOptions<T>): Signal<T>;
declare function computed<T>(getter: () => T, options?: ComputedOptions<T>): ReadonlySignal<T>;
declare function effect(callback: (onCleanup: (cleanup: Cleanup) => void) => void): EffectHandle;
declare function batch<T>(callback: () => T): T;
declare function untrack<T>(callback: () => T): T;
declare function isSignal<T = unknown>(value: unknown): value is ReadonlySignal<T>;
declare function resolveSignal<T>(value: MaybeSignal<T>): T;
declare function configure(options?: ItyConfig): void;
declare function store<T extends Record<StoreKey, any>>(initialValue: T): Store<T>;
declare function resource<T, E = unknown>(loader: (context: ResourceContext<T>) => Promise<T> | T, options?: ResourceOptions<T, E>): Resource<T, E>;
declare function action<TArgs extends unknown[], TResult, E = unknown>(handler: (...args: TArgs) => Promise<TResult> | TResult, options?: ActionOptions<TResult, E>): Action<TArgs, TResult, E>;
declare function form<TResult, E = unknown>(handler: (data: FormData, event: Event) => Promise<TResult> | TResult, options?: FormOptions<TResult, E>): FormController<TResult, E>;
declare function html(strings: TemplateStringsArray | readonly string[], ...values: unknown[]): TemplateResult;
declare function unsafeHTML(value: string, options?: UnsafeHTMLOptions): UnsafeHTML;
declare function render(view: TemplateValue | (() => TemplateValue), target: string | Element | DocumentFragment | SelectorObject, options?: RenderOptions): Cleanup;
declare function renderToString(view: TemplateValue | (() => TemplateValue)): string;
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
declare function component(name: string, setupOrOptions: ComponentSetup | ComponentOptions, maybeOptions?: Omit<ComponentOptions, "setup">): CustomElementConstructor;
declare class Evented {
    private _events;
    on(evtName: string, callback: (data?: unknown) => void, context?: any): void;
    off(evtName?: string, callback?: (data?: unknown) => void, context?: any): void;
    trigger(evtName: string, data?: unknown): void;
}
declare class SelectorObject {
    [index: number]: HTMLElement;
    readonly isSelectorObject = true;
    private nodes;
    constructor(nodeList?: ArrayLike<HTMLElement>);
    get length(): number;
    [Symbol.iterator](): Iterator<HTMLElement>;
    toArray(): HTMLElement[];
    find(selector: string): SelectorObject;
    filter(selector: string): SelectorObject;
    first(): SelectorObject;
    last(): SelectorObject;
    parent(): SelectorObject;
    children(selector?: string): SelectorObject;
    remove(): SelectorObject;
    addClass(...classes: string[]): this;
    removeClass(value: string): this;
    toggleClass(value: string): this;
    hasClass(value: string): boolean;
    attr(name: string, value?: string | number | boolean | null): string | null | this;
    text(value?: string | number | boolean): string | this;
    on(eventName: string, listener: EventListener, options?: AddEventListenerOptions): this;
    off(eventName: string, listener: EventListener, options?: EventListenerOptions): this;
    before(content: string | SelectorObject | HTMLElement | TemplateResult): this;
    after(content: string | SelectorObject | HTMLElement | TemplateResult): this;
    append(content: string | SelectorObject | HTMLElement | TemplateResult): this;
    prepend(content: string | SelectorObject | HTMLElement | TemplateResult): this;
    html(content?: string | SelectorObject | HTMLElement | TemplateResult): this | string;
    empty(): this;
    private _html;
    private reindex;
}
declare function onDOMReady(fn: (...args: any[]) => void, args?: unknown[], context?: any): void;
interface AjaxOptions {
    url?: string;
    type?: string;
    data?: unknown;
    success?: (resp: any) => void;
    error?: (status?: number, error?: unknown) => void;
}
declare class Model<T extends Record<string, unknown> = Record<string, unknown>> extends Evented {
    id: string;
    data: T;
    url: string;
    readonly state: Signal<T>;
    constructor(opts?: Partial<Model<T>>);
    onDOMReady: typeof onDOMReady;
    protected _init(opts?: Partial<Model<T>>): void;
    protected _ajax(opts?: AjaxOptions): void;
    initialize(options?: Partial<Model<T>>): void;
    get(attr?: keyof T): any;
    set(attr: keyof T | Partial<T>, value?: any): void;
    unSet(attr: keyof T): void;
    clear(): void;
    subscribe(callback: Subscriber<T>, options?: {
        immediate?: boolean;
    }): Cleanup;
    sync(opts?: AjaxOptions): void;
    toJSON(): T;
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
declare class View extends Evented {
    id: string;
    el: SelectorObject;
    app?: Application;
    name?: string;
    events: ViewEvents;
    private renderCleanup?;
    private delegatedListeners;
    constructor(opts?: ViewOptions);
    private _setElement;
    private _bindDOMEvents;
    private _delegateEvent;
    private _init;
    initialize(opts?: ViewOptions): void;
    getName(): string | undefined;
    get(attr: keyof this): any;
    set(attr: keyof this, value: any): void;
    renderWith(view: TemplateValue | (() => TemplateValue), options?: RenderOptions): Cleanup;
    remove(): void;
    select(selector: string, ctx?: HTMLElement | HTMLDocument | SelectorObject): SelectorObject;
}
declare class Application {
    views: View[];
    getView(id: string): View | undefined;
    addView(view: View): void;
    removeView(id: string): void;
    trigger(evtName: string, data?: unknown): void;
}
declare class Collection<M extends Model = Model> {
    models: M[];
    url: string;
    readonly state: Signal<M[]>;
    private ModelClass;
    constructor(models?: M[], ModelClass?: new () => M);
    get(id: string): M | undefined;
    add(model: M): void;
    remove(id: string | M): void;
    at(index: number): M | undefined;
    get length(): number;
    clear(): void;
    find(predicate: (m: M) => boolean): M | undefined;
    filter(predicate: (m: M) => boolean): M[];
    map<T>(mapper: (m: M, index: number) => T): T[];
    toJSON(): any[];
    subscribe(callback: Subscriber<M[]>, options?: {
        immediate?: boolean;
    }): Cleanup;
    protected _ajax(opts?: AjaxOptions): void;
    fetch(opts?: AjaxOptions & {
        modelClass?: new () => M;
    }): void;
    trigger(evtName: string, data?: unknown): void;
}
interface RouteContext {
    path: string;
    url: URL;
    params: Record<string, string>;
    query: Record<string, string>;
    hash: Record<string, string>;
}
type RouteHandler = (params: Record<string, string>, context: RouteContext) => void | Cleanup;
interface RouterOptions {
    base?: string;
    autoStart?: boolean;
    linkSelector?: string;
    transition?: boolean;
    notFound?: RouteHandler;
}
declare class Router {
    private routes;
    private started;
    private readonly listener;
    private readonly clickListener;
    private readonly navigationListener;
    private routeCleanup?;
    private activeRoute?;
    readonly current: Signal<RouteContext | null>;
    notFound?: RouteHandler;
    base: string;
    linkSelector: string;
    transition: boolean;
    constructor(options?: RouterOptions);
    add(pattern: string, handler: RouteHandler): this;
    addRoute(pattern: string, handler: RouteHandler): void;
    removeRoute(pattern: string): this;
    navigate(path: string, options?: {
        replace?: boolean;
        transition?: boolean;
    }): void;
    start(): void;
    stop(): void;
    check(): RouteContext | null;
    private handleLinkClick;
    private handleNavigationEvent;
    private disposeRoute;
}
declare function route(pattern: string, handler: RouteHandler): Router;
declare const Ity: {
    version: string;
    configure: typeof configure;
    signal: typeof signal;
    computed: typeof computed;
    effect: typeof effect;
    batch: typeof batch;
    untrack: typeof untrack;
    isSignal: typeof isSignal;
    resolveSignal: typeof resolveSignal;
    store: typeof store;
    resource: typeof resource;
    action: typeof action;
    form: typeof form;
    html: typeof html;
    unsafeHTML: typeof unsafeHTML;
    render: typeof render;
    renderToString: typeof renderToString;
    component: typeof component;
    route: typeof route;
    Router: typeof Router;
    SelectorObject: typeof SelectorObject;
    onDOMReady: typeof onDOMReady;
    Model: typeof Model;
    View: typeof View;
    Application: typeof Application;
    Collection: typeof Collection;
};
export { Application, Collection, Model, Router, SelectorObject, View, batch, component, configure, computed, effect, action, form, html, isSignal, onDOMReady, render, renderToString, resource, resolveSignal, route, signal, store, unsafeHTML, untrack };
export type { Action, ActionOptions, AsyncStatus, ComponentContext, ComponentOptions, EffectHandle, FormController, FormOptions, HTMLSanitizer, ItyConfig, ReadonlySignal, RenderOptions, Resource, ResourceContext, ResourceOptions, RouteContext, RouteHandler, Signal, Store, TemplateResult, UnsafeHTMLOptions };
export default Ity;
