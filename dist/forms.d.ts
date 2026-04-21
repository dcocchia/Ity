type Cleanup = () => void;
type Subscriber<T> = (value: T, previous: T) => void;
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
interface FormBindOptions<T> {
    type?: "text" | "textarea" | "select" | "select-multiple" | "checkbox" | "radio" | "number";
    event?: string;
    name?: string;
    value?: unknown;
    parse?: (value: unknown, event: Event) => T;
    format?: (value: T) => unknown;
}

type FormErrors = Record<string, string>;
type FormTouched = Record<string, boolean>;
interface FormKitOptions<TValues extends Record<string, any>> {
    validators?: Record<string, (value: any, values: TValues) => string | null | undefined | Promise<string | null | undefined>>;
    validate?: (values: TValues) => FormErrors | void | Promise<FormErrors | void>;
}
interface FormKitField<T> {
    readonly value: Signal<T>;
    readonly error: ReadonlySignal<string | null>;
    readonly touched: ReadonlySignal<boolean>;
    readonly dirty: ReadonlySignal<boolean>;
    readonly validating: ReadonlySignal<boolean>;
    bind(options?: FormBindOptions<T>): Record<string, unknown>;
    set(next: T | ((previous: T) => T)): T;
    reset(): void;
    validate(): Promise<boolean>;
}
interface FormKitArray<T> {
    readonly items: ReadonlySignal<T[]>;
    readonly keys: ReadonlySignal<string[]>;
    push(value: T): void;
    insert(index: number, value: T): void;
    remove(index: number): void;
    move(from: number, to: number): void;
    replace(next: T[]): void;
}
interface FormKitSubmitOptions<TResult, E = unknown> extends ActionOptions<TResult, E> {
    resetOnSuccess?: boolean;
}
interface FormKitSubmitController<TValues extends Record<string, any>, TResult, E = unknown> {
    readonly action: Action<[TValues, Event], TResult, E>;
    readonly data: Signal<TResult | undefined>;
    readonly error: Signal<E | null>;
    readonly pending: ReadonlySignal<boolean>;
    readonly status: ReadonlySignal<AsyncStatus>;
    onSubmit(event: Event): Promise<TResult | undefined>;
    handleSubmit(event: Event): void;
    reset(): void;
}
interface FormKit<TValues extends Record<string, any>> {
    readonly values: Signal<TValues>;
    readonly initialValues: ReadonlySignal<TValues>;
    readonly errors: ReadonlySignal<FormErrors>;
    readonly touched: ReadonlySignal<FormTouched>;
    readonly validating: ReadonlySignal<boolean>;
    readonly dirty: ReadonlySignal<boolean>;
    readonly valid: ReadonlySignal<boolean>;
    field<T = unknown>(path: string): FormKitField<T>;
    bind<T = unknown>(path: string, options?: FormBindOptions<T>): Record<string, unknown>;
    array<T = unknown>(path: string): FormKitArray<T>;
    set(path: string, next: unknown | ((previous: unknown) => unknown)): void;
    patch(next: Partial<TValues> | ((current: TValues) => Partial<TValues> | void)): void;
    reset(next?: Partial<TValues> | TValues): void;
    sync(source?: Event | Element | null): void;
    validate(paths?: readonly string[]): Promise<boolean>;
    markTouched(paths?: readonly string[]): void;
    submit<TResult, E = unknown>(handler: (values: TValues, event: Event) => Promise<TResult> | TResult, options?: FormKitSubmitOptions<TResult, E>): FormKitSubmitController<TValues, TResult, E>;
}
declare function createFormKit<TValues extends Record<string, any>>(initialValue: TValues, options?: FormKitOptions<TValues>): FormKit<TValues>;

export { createFormKit };
export type { FormKit, FormKitArray, FormKitField, FormKitOptions, FormKitSubmitController, FormKitSubmitOptions };
