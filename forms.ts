import {
  action,
  computed,
  effect,
  signal,
  type Action,
  type ActionOptions,
  type AsyncStatus,
  type FormBindOptions,
  type ReadonlySignal,
  type Signal
} from "./Ity";

type Cleanup = () => void;
type FormErrors = Record<string, string>;
type FormTouched = Record<string, boolean>;

export interface FormKitOptions<TValues extends Record<string, any>> {
  validators?: Record<string, (value: any, values: TValues) => string | null | undefined | Promise<string | null | undefined>>;
  validate?: (values: TValues) => FormErrors | void | Promise<FormErrors | void>;
}

export interface FormKitField<T> {
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

export interface FormKitArray<T> {
  readonly items: ReadonlySignal<T[]>;
  readonly keys: ReadonlySignal<string[]>;
  push(value: T): void;
  insert(index: number, value: T): void;
  remove(index: number): void;
  move(from: number, to: number): void;
  replace(next: T[]): void;
}

export interface FormKitSubmitOptions<TResult, E = unknown> extends ActionOptions<TResult, E> {
  resetOnSuccess?: boolean;
}

export interface FormKitSubmitController<TValues extends Record<string, any>, TResult, E = unknown> {
  readonly action: Action<[TValues, Event], TResult, E>;
  readonly data: Signal<TResult | undefined>;
  readonly error: Signal<E | null>;
  readonly pending: ReadonlySignal<boolean>;
  readonly status: ReadonlySignal<AsyncStatus>;
  onSubmit(event: Event): Promise<TResult | undefined>;
  handleSubmit(event: Event): void;
  reset(): void;
}

export interface FormKit<TValues extends Record<string, any>> {
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
  submit<TResult, E = unknown>(
    handler: (values: TValues, event: Event) => Promise<TResult> | TResult,
    options?: FormKitSubmitOptions<TResult, E>
  ): FormKitSubmitController<TValues, TResult, E>;
}

interface RegisteredBinding {
  domName: string;
  type: NonNullable<FormBindOptions<any>["type"]> | "text";
  value?: unknown;
  parse?: (value: unknown, event: Event) => unknown;
}

const parsedPathCache = new Map<string, Array<string | number>>();

function cloneValue<T>(value: T): T {
  const cloneFn = (globalThis as any).structuredClone;
  if (typeof cloneFn === "function") return cloneFn(value);
  return JSON.parse(JSON.stringify(value));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function deepEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) return false;
    for (let index = 0; index < left.length; index += 1) {
      if (!deepEqual(left[index], right[index])) return false;
    }
    return true;
  }
  if (isPlainObject(left) && isPlainObject(right)) {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    if (leftKeys.length !== rightKeys.length) return false;
    for (const key of leftKeys) {
      if (!Object.prototype.hasOwnProperty.call(right, key)) return false;
      if (!deepEqual(left[key], right[key])) return false;
    }
    return true;
  }
  return false;
}

function parsePath(path: string): Array<string | number> {
  const cached = parsedPathCache.get(path);
  if (cached) return cached;
  const parts = (path.match(/[^.[\]]+/g) || []).map((part) => /^\d+$/.test(part) ? Number(part) : part);
  if (parsedPathCache.size >= 512) parsedPathCache.clear();
  parsedPathCache.set(path, parts);
  return parts;
}

function getIn(value: unknown, path: string): unknown {
  return parsePath(path).reduce((current: any, segment) => current == null ? undefined : current[segment], value as any);
}

function setIn<T>(value: T, path: string, next: unknown): T {
  const parts = parsePath(path);
  if (!parts.length) return next as T;
  const createContainer = (lookahead: string | number): Record<string, unknown> | unknown[] => {
    return typeof lookahead === "number" ? [] : {};
  };
  const cloneContainer = (current: unknown, lookahead: string | number): Record<string, unknown> | unknown[] => {
    if (Array.isArray(current)) return current.slice();
    if (isPlainObject(current)) return { ...current };
    return createContainer(lookahead);
  };

  const firstLookahead = parts.length > 1 ? parts[1] : parts[0];
  const sourceRoot = value as unknown;
  const root = cloneContainer(sourceRoot, firstLookahead) as Record<string, unknown> | unknown[];
  let currentTarget: any = root;
  let currentSource: any = sourceRoot;

  for (let index = 0; index < parts.length; index += 1) {
    const segment = parts[index];
    const last = index === parts.length - 1;
    if (last) {
      currentTarget[segment as any] = next;
      break;
    }

    const lookahead = parts[index + 1];
    const sourceValue = currentSource == null ? undefined : currentSource[segment as any];
    const nextTarget = cloneContainer(sourceValue, lookahead);
    currentTarget[segment as any] = nextTarget;
    currentTarget = nextTarget;
    currentSource = sourceValue;
  }

  return root as T;
}

function listFieldPaths(value: unknown, prefix = ""): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => listFieldPaths(item, prefix ? `${prefix}.${index}` : String(index)));
  }
  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>).flatMap((key) => {
      const nextPrefix = prefix ? `${prefix}.${key}` : key;
      return listFieldPaths((value as Record<string, unknown>)[key], nextPrefix);
    });
  }
  return prefix ? [prefix] : [];
}

function createArrayKey(): string {
  return `fk-${Math.random().toString(36).slice(2, 10)}`;
}

function getFormElementCtor(node: Element | null): typeof HTMLFormElement | undefined {
  const ownerWindow = node?.ownerDocument?.defaultView as (Window & typeof globalThis) | null | undefined;
  return ownerWindow?.HTMLFormElement
    || (typeof window !== "undefined" ? window.HTMLFormElement : undefined)
    || (typeof HTMLFormElement !== "undefined" ? HTMLFormElement : undefined);
}

function isFormElement(node: Element | null | undefined, fallbackNode?: Element | null): node is HTMLFormElement {
  const FormElement = node ? getFormElementCtor(node) : getFormElementCtor(fallbackNode || null);
  return Boolean(node && FormElement && node instanceof FormElement);
}

function findFormElement(source?: Event | Element | null): HTMLFormElement {
  const target = source && typeof source === "object" && ("currentTarget" in source || "target" in source)
    ? ((source as Event).currentTarget || (source as Event).target) as Element | null
    : (source as Element | null | undefined) || null;
  if (!getFormElementCtor(target)) throw new Error("Ity.forms requires HTMLFormElement support");
  if (isFormElement(target, target)) return target;
  const closest = target?.closest?.("form");
  if (isFormElement(closest, target)) return closest;
  throw new Error("Form submit requires a form event target");
}

function readControlValue(control: { value?: string } | undefined): string {
  return control?.value == null ? "" : String(control.value);
}

function clampIndex(index: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, index));
}

function createDerivedSignal<T>(reader: () => T): ReadonlySignal<T> {
  const read = function (): T {
    return reader();
  } as ReadonlySignal<T>;
  read.get = () => reader();
  read.peek = () => reader();
  read.subscribe = (callback, options = {}) => {
    let first = true;
    let previous = read.peek();
    return effect(() => {
      const current = reader();
      if (first) {
        first = false;
        previous = current;
        if (options.immediate) callback(current, current);
        return;
      }
      if (!Object.is(previous, current)) {
        const prev = previous;
        previous = current;
        callback(current, prev);
      }
    });
  };
  Object.defineProperty(read, "isSignal", { value: true });
  return read;
}

export function createFormKit<TValues extends Record<string, any>>(
  initialValue: TValues,
  options: FormKitOptions<TValues> = {}
): FormKit<TValues> {
  const values = signal(cloneValue(initialValue), { name: "formkit.values" });
  const initialValues = signal(cloneValue(initialValue), { name: "formkit.initial" });
  const errors = signal<FormErrors>({}, { name: "formkit.errors" });
  const touched = signal<FormTouched>({}, { name: "formkit.touched" });
  const validatingState = signal<Record<string, boolean>>({}, { name: "formkit.validating" });
  const registeredBindings = new Map<string, Map<string, RegisteredBinding>>();
  const arrayKeys = new Map<string, Signal<string[]>>();
  const fieldCache = new Map<string, FormKitField<any>>();
  let validationGeneration = 0;

  const allKnownPaths = (): string[] => {
    const paths = new Set<string>([
      ...Object.keys(options.validators || {}),
      ...Object.keys(touched.peek()),
      ...Array.from(registeredBindings.keys()),
      ...listFieldPaths(values.peek())
    ]);
    return Array.from(paths).filter(Boolean);
  };

  const markTouched = (paths?: readonly string[]): void => {
    const next = { ...touched.peek() };
    for (const path of paths?.length ? paths : allKnownPaths()) {
      next[path] = true;
    }
    touched.set(next);
  };

  const setValue = (path: string, next: unknown | ((previous: unknown) => unknown)): void => {
    const previous = getIn(values.peek(), path);
    const resolved = typeof next === "function" ? (next as (previous: unknown) => unknown)(previous) : next;
    values.set(setIn(values.peek(), path, resolved));
  };

  const syncArrayKeys = (path: string): string[] => {
    const current = Array.isArray(getIn(values.peek(), path)) ? getIn(values.peek(), path) as unknown[] : [];
    const keySignal = arrayKeys.get(path) || signal<string[]>([], { name: `${path}.keys` });
    const nextKeys = keySignal.peek().slice(0, current.length);
    while (nextKeys.length < current.length) nextKeys.push(createArrayKey());
    keySignal.set(nextKeys);
    arrayKeys.set(path, keySignal);
    return nextKeys;
  };

  const validate = async (paths?: readonly string[]): Promise<boolean> => {
    const generation = ++validationGeneration;
    const snapshot = cloneValue(values.peek());
    const nextErrors = { ...errors.peek() };
    const nextValidating = { ...validatingState.peek() };
    const selectedPaths = paths?.length ? Array.from(new Set(paths)) : allKnownPaths();

    await Promise.all(selectedPaths.map(async (path) => {
      delete nextErrors[path];
      const validator = options.validators?.[path];
      if (!validator) return;
      const value = getIn(snapshot, path);
      const result = validator(value, snapshot);
      if (result && typeof (result as Promise<unknown>).then === "function") {
        nextValidating[path] = true;
        validatingState.set({ ...nextValidating });
        const resolved = await result;
        if (generation !== validationGeneration) return;
        if (resolved) nextErrors[path] = resolved;
        delete nextValidating[path];
        validatingState.set({ ...nextValidating });
        return;
      }
      if (result) nextErrors[path] = result as string;
    }));

    const formErrors = await options.validate?.(snapshot);
    if (generation !== validationGeneration) return false;
    for (const path of selectedPaths) {
      if (!nextErrors[path]) delete nextErrors[path];
    }
    if (formErrors) {
      Object.assign(nextErrors, formErrors);
    }
    errors.set(nextErrors);
    validatingState.set({ ...nextValidating });
    return Object.keys(nextErrors).length === 0;
  };

  const bind = <T = unknown>(path: string, bindOptions: FormBindOptions<T> = {}): Record<string, unknown> => {
    const field = api.field<T>(path);
    const type = bindOptions.type || "text";
    const eventName = bindOptions.event
      || (type === "checkbox" || type === "radio" || type === "select" || type === "select-multiple" ? "change" : "input");
    const domName = bindOptions.name || path;
    const bindings = registeredBindings.get(path) || new Map<string, RegisteredBinding>();
    bindings.set(`${domName}|${type}|${String(bindOptions.value)}`, {
      domName,
      type,
      value: bindOptions.value,
      parse: bindOptions.parse as any
    });
    registeredBindings.set(path, bindings);

    const value = bindOptions.format ? bindOptions.format(field.value()) : field.value();
    const binding: Record<string, unknown> = {
      name: domName,
      [`@${eventName}`]: (event: Event) => {
        const target = (event.currentTarget || event.target) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
        if (bindOptions.parse) {
          field.set(bindOptions.parse(target, event));
        } else if (type === "checkbox") {
          if (Array.isArray(field.value())) {
            const optionValue = bindOptions.value ?? target.value;
            const current = field.value() as unknown[];
            field.set(((target as HTMLInputElement).checked
              ? Array.from(new Set([...current, optionValue]))
              : current.filter((item) => !Object.is(item, optionValue))) as any);
          } else {
            field.set(Boolean((target as HTMLInputElement).checked) as any);
          }
        } else if (type === "radio") {
          if ((target as HTMLInputElement).checked) field.set((bindOptions.value ?? target.value) as any);
        } else if (type === "select-multiple") {
          field.set(Array.from((target as HTMLSelectElement).selectedOptions).map((option) => option.value) as any);
        } else if (type === "number") {
          field.set((target.value === "" ? undefined : Number(target.value)) as any);
        } else {
          field.set(target.value as any);
        }
      },
      "@blur": () => {
        markTouched([path]);
        validate([path]).catch(() => undefined);
      }
    };

    if (type === "checkbox") {
      if (Array.isArray(field.value())) {
        const optionValue = bindOptions.value;
        binding.value = optionValue === undefined ? "" : String(optionValue);
        binding[".checked"] = createDerivedSignal(() => (field.value() as unknown[]).some((item) => Object.is(item, optionValue)));
      } else {
        binding[".checked"] = createDerivedSignal(() => Boolean(field.value()));
      }
      return binding;
    }
    if (type === "radio") {
      const optionValue = bindOptions.value;
      binding.value = optionValue === undefined ? "" : String(optionValue);
      binding[".checked"] = createDerivedSignal(() => Object.is(field.value(), optionValue));
      return binding;
    }
    if (type === "select-multiple") {
      binding[".value"] = value as any;
      return binding;
    }
    const stringValue = value === undefined || value === null ? "" : String(value);
    binding[".value"] = stringValue;
    binding.value = stringValue;
    return binding;
  };

  const syncFromForm = (source?: Event | Element | null): void => {
    let formElement: HTMLFormElement;
    try {
      formElement = findFormElement(source);
    } catch (_error) {
      return;
    }
    const controls = Array.from((formElement as any).elements || []) as Array<{
      name?: string;
      value?: string;
      checked?: boolean;
      selectedOptions?: ArrayLike<{ value: string }>;
    }>;
    let nextValues = values.peek();

    for (const [path, bindings] of registeredBindings) {
      const registered = Array.from(bindings.values());
      const primary = registered[0];
      if (!primary) continue;
      const domName = primary.domName;
      const namedControls = controls.filter((control) => control && control.name === domName);
      let nextValue: unknown;
      if (primary.parse && namedControls.length) {
        nextValue = primary.parse(namedControls[0], source as Event);
      } else if (primary.type === "checkbox") {
        const current = getIn(nextValues, path);
        if (Array.isArray(current) || registered.some((entry) => entry.value !== undefined) || namedControls.length > 1) {
          nextValue = namedControls
            .filter((control) => control.checked)
            .map((control) => registered.find((entry) => String(entry.value ?? readControlValue(control)) === readControlValue(control))?.value ?? readControlValue(control));
        } else {
          nextValue = Boolean(namedControls[0]?.checked);
        }
      } else if (primary.type === "radio") {
        const checkedControl = namedControls.find((control) => control.checked);
        nextValue = checkedControl
          ? registered.find((entry) => String(entry.value ?? readControlValue(checkedControl)) === readControlValue(checkedControl))?.value ?? readControlValue(checkedControl)
          : getIn(nextValues, path);
      } else if (primary.type === "select-multiple") {
        const select = namedControls[0] as HTMLSelectElement | undefined;
        nextValue = select?.selectedOptions
          ? Array.from(select.selectedOptions).map((option) => option.value)
          : [];
      } else if (primary.type === "number") {
        const raw = readControlValue(namedControls[0]);
        nextValue = raw === "" ? undefined : Number(raw);
      } else {
        nextValue = readControlValue(namedControls[0]);
      }
      nextValues = setIn(nextValues, path, nextValue);
    }

    values.set(nextValues);
  };

  const api: FormKit<TValues> = {
    values,
    initialValues: computed(() => initialValues()),
    errors: computed(() => errors()),
    touched: computed(() => touched()),
    validating: computed(() => Object.keys(validatingState()).length > 0),
    dirty: computed(() => !deepEqual(values(), initialValues())),
    valid: computed(() => Object.keys(errors()).length === 0 && Object.keys(validatingState()).length === 0),
    field<T = unknown>(path: string): FormKitField<T> {
      if (fieldCache.has(path)) return fieldCache.get(path)! as FormKitField<T>;
      const valueSignal = function (next?: T | ((previous: T) => T)): T {
        if (arguments.length === 0) return getIn(values(), path) as T;
        const previous = getIn(values.peek(), path) as T;
        const resolved = typeof next === "function" ? (next as (previous: T) => T)(previous) : next;
        values.set(setIn(values.peek(), path, resolved));
        return resolved as T;
      } as Signal<T>;
      valueSignal.get = () => getIn(values(), path) as T;
      valueSignal.peek = () => getIn(values.peek(), path) as T;
      valueSignal.set = (next) => valueSignal(next);
      valueSignal.update = (updater) => valueSignal(updater);
      valueSignal.subscribe = (callback, optionsForSubscribe = {}) => {
        let first = true;
        let previous = valueSignal.peek();
        return effect(() => {
          const current = valueSignal();
          if (first) {
            first = false;
            if (optionsForSubscribe.immediate) callback(current, current);
            previous = current;
            return;
          }
          callback(current, previous);
          previous = current;
        });
      };
      Object.defineProperty(valueSignal, "isSignal", { value: true });

      const field: FormKitField<T> = {
        value: valueSignal,
        error: computed(() => errors()[path] || null),
        touched: computed(() => Boolean(touched()[path])),
        dirty: computed(() => !deepEqual(getIn(values(), path), getIn(initialValues(), path))),
        validating: computed(() => Boolean(validatingState()[path])),
        bind(optionsForField?: FormBindOptions<T>) {
          return bind<T>(path, optionsForField);
        },
        set(next) {
          return valueSignal.set(next);
        },
        reset() {
          values.set(setIn(values.peek(), path, getIn(initialValues.peek(), path)));
          const nextErrors = { ...errors.peek() };
          delete nextErrors[path];
          errors.set(nextErrors);
          const nextTouched = { ...touched.peek() };
          delete nextTouched[path];
          touched.set(nextTouched);
        },
        async validate() {
          return validate([path]);
        }
      };
      fieldCache.set(path, field as FormKitField<any>);
      return field;
    },
    bind,
    array<T = unknown>(path: string): FormKitArray<T> {
      return {
        items: computed(() => (getIn(values(), path) as T[]) || []),
        keys: computed(() => {
          values();
          return syncArrayKeys(path);
        }),
        push(value: T) {
          const current = ((getIn(values.peek(), path) as T[]) || []).slice();
          current.push(value);
          values.set(setIn(values.peek(), path, current));
          syncArrayKeys(path);
        },
        insert(index: number, value: T) {
          const current = ((getIn(values.peek(), path) as T[]) || []).slice();
          const safeIndex = clampIndex(index, 0, current.length);
          current.splice(safeIndex, 0, value);
          values.set(setIn(values.peek(), path, current));
          const keys = syncArrayKeys(path);
          const inserted = keys.pop() || createArrayKey();
          keys.splice(safeIndex, 0, inserted);
          arrayKeys.get(path)!.set(keys);
        },
        remove(index: number) {
          const current = ((getIn(values.peek(), path) as T[]) || []).slice();
          if (index < 0 || index >= current.length) return;
          current.splice(index, 1);
          values.set(setIn(values.peek(), path, current));
          const keys = syncArrayKeys(path);
          keys.splice(index, 1);
          arrayKeys.get(path)!.set(keys);
        },
        move(from: number, to: number) {
          const current = ((getIn(values.peek(), path) as T[]) || []).slice();
          if (from < 0 || from >= current.length) return;
          const [item] = current.splice(from, 1);
          const safeTo = clampIndex(to, 0, current.length);
          current.splice(safeTo, 0, item);
          values.set(setIn(values.peek(), path, current));
          const keys = syncArrayKeys(path);
          const [key] = keys.splice(from, 1);
          keys.splice(safeTo, 0, key);
          arrayKeys.get(path)!.set(keys);
        },
        replace(next: T[]) {
          values.set(setIn(values.peek(), path, next.slice()));
          const keySignal = arrayKeys.get(path) || signal<string[]>([], { name: `${path}.keys` });
          keySignal.set(next.map(() => createArrayKey()));
          arrayKeys.set(path, keySignal);
        }
      };
    },
    set(path: string, next: unknown | ((previous: unknown) => unknown)) {
      setValue(path, next);
    },
    patch(next) {
      const patch = typeof next === "function" ? next(values.peek()) : next;
      if (!patch) return;
      values.set({ ...values.peek(), ...patch });
    },
    reset(next?: Partial<TValues> | TValues) {
      const base = cloneValue(next ? { ...initialValues.peek(), ...(next as any) } : initialValues.peek());
      initialValues.set(cloneValue(base));
      values.set(base);
      errors.set({});
      touched.set({});
      validatingState.set({});
    },
    sync(source?: Event | Element | null) {
      syncFromForm(source);
    },
    validate,
    markTouched,
    submit<TResult, E = unknown>(
      handler: (snapshot: TValues, event: Event) => Promise<TResult> | TResult,
      submitOptions: FormKitSubmitOptions<TResult, E> = {}
    ): FormKitSubmitController<TValues, TResult, E> {
      const submitAction = action<[TValues, Event], TResult, E>(handler, submitOptions);
      const onSubmit = async (event: Event): Promise<TResult | undefined> => {
        event.preventDefault();
        api.sync(event);
        markTouched();
        if (!await validate()) return undefined;
        const result = await submitAction(cloneValue(values.peek()), event);
        if (submitOptions.resetOnSuccess) api.reset();
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
          api.reset();
        }
      };
    }
  };

  return api;
}
