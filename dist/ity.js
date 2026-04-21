var Ity = (function (exports) {
  'use strict';

  const defaultEquals = Object.is;
  let activeObserver = null;
  let batchDepth = 0;
  const pendingEffects = new Set();
  let configuredSanitizeHTML;
  const activeConfigStack = [];
  function getWindow() {
      return typeof window !== "undefined" ? window : undefined;
  }
  function getDocument() {
      var _a;
      const win = getWindow();
      return (_a = win === null || win === void 0 ? void 0 : win.document) !== null && _a !== void 0 ? _a : (typeof document !== "undefined" ? document : undefined);
  }
  function hasOwn(target, key) {
      return Object.prototype.hasOwnProperty.call(target, key);
  }
  function isPlainObject(value) {
      if (!value || typeof value !== "object")
          return false;
      const proto = Object.getPrototypeOf(value);
      return proto === Object.prototype || proto === null;
  }
  function cloneValue(value) {
      const cloneFn = globalThis.structuredClone;
      if (typeof cloneFn === "function")
          return cloneFn(value);
      if (Array.isArray(value))
          return value.map((item) => cloneValue(item));
      if (isPlainObject(value)) {
          const out = {};
          for (const key of Reflect.ownKeys(value)) {
              out[key] = cloneValue(value[key]);
          }
          return out;
      }
      return value;
  }
  function deepEqual(left, right) {
      if (Object.is(left, right))
          return true;
      if (Array.isArray(left) && Array.isArray(right)) {
          if (left.length !== right.length)
              return false;
          for (let i = 0; i < left.length; i += 1) {
              if (!deepEqual(left[i], right[i]))
                  return false;
          }
          return true;
      }
      if (isPlainObject(left) && isPlainObject(right)) {
          const leftKeys = Reflect.ownKeys(left);
          const rightKeys = Reflect.ownKeys(right);
          if (leftKeys.length !== rightKeys.length)
              return false;
          for (const key of leftKeys) {
              if (!rightKeys.includes(key))
                  return false;
              if (!deepEqual(left[key], right[key]))
                  return false;
          }
          return true;
      }
      return false;
  }
  function currentConfig() {
      return activeConfigStack.length ? activeConfigStack[activeConfigStack.length - 1] : null;
  }
  function withConfig(config, callback) {
      activeConfigStack.push(config || null);
      try {
          return callback();
      }
      finally {
          activeConfigStack.pop();
      }
  }
  function resolveSanitizeHTML(options = {}) {
      var _a;
      if (options.sanitize)
          return options.sanitize;
      const scoped = (_a = options.config) !== null && _a !== void 0 ? _a : currentConfig();
      if (scoped && hasOwn(scoped, "sanitizeHTML")) {
          return scoped.sanitizeHTML || undefined;
      }
      return configuredSanitizeHTML;
  }
  function trackDependency(source) {
      if (!activeObserver)
          return;
      source.observers.add(activeObserver);
      activeObserver.deps.add(source);
  }
  function cleanupDependencies(observer) {
      for (const dep of observer.deps) {
          dep.observers.delete(observer);
      }
      observer.deps.clear();
  }
  function notifyObservers(source) {
      for (const observer of Array.from(source.observers)) {
          observer.markDirty();
      }
  }
  function flushEffects() {
      if (batchDepth > 0)
          return;
      while (pendingEffects.size) {
          const effects = Array.from(pendingEffects);
          pendingEffects.clear();
          for (const effect of effects) {
              effect.run();
          }
      }
  }
  function queueEffect(effect) {
      pendingEffects.add(effect);
      flushEffects();
  }
  class SignalNode {
      constructor(value, options = {}) {
          this.observers = new Set();
          this.subscribers = new Set();
          this.value = value;
          this.equals = options.equals || defaultEquals;
      }
      read(track = true) {
          if (track)
              trackDependency(this);
          return this.value;
      }
      write(next) {
          const previous = this.value;
          const resolved = typeof next === "function"
              ? next(previous)
              : next;
          if (this.equals(previous, resolved))
              return previous;
          this.value = resolved;
          notifyObservers(this);
          for (const subscriber of Array.from(this.subscribers)) {
              subscriber(resolved, previous);
          }
          flushEffects();
          return resolved;
      }
      subscribe(callback, options = {}) {
          this.subscribers.add(callback);
          if (options.immediate)
              callback(this.value, this.value);
          return () => {
              this.subscribers.delete(callback);
          };
      }
  }
  class ComputedNode {
      constructor(getter, options = {}) {
          this.getter = getter;
          this.observers = new Set();
          this.deps = new Set();
          this.subscribers = new Set();
          this.dirty = true;
          this.initialized = false;
          this.equals = options.equals || defaultEquals;
      }
      read(track = true) {
          if (track)
              trackDependency(this);
          if (this.dirty)
              this.evaluate();
          return this.value;
      }
      markDirty() {
          if (this.dirty)
              return;
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
      subscribe(callback, options = {}) {
          this.subscribers.add(callback);
          if (options.immediate) {
              const current = this.read(false);
              callback(current, current);
          }
          return () => {
              this.subscribers.delete(callback);
          };
      }
      evaluate() {
          cleanupDependencies(this);
          const previousObserver = activeObserver;
          activeObserver = this;
          try {
              this.value = this.getter();
              this.dirty = false;
              this.initialized = true;
          }
          finally {
              activeObserver = previousObserver;
          }
      }
  }
  class ReactiveEffect {
      constructor(callback) {
          this.callback = callback;
          this.deps = new Set();
          this.disposed = false;
          this.run();
      }
      markDirty() {
          if (!this.disposed)
              queueEffect(this);
      }
      run() {
          if (this.disposed)
              return;
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
          }
          finally {
              activeObserver = previousObserver;
          }
      }
      dispose() {
          if (this.disposed)
              return;
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
  function signal(initialValue, options = {}) {
      const node = new SignalNode(initialValue, options);
      const readWrite = function (next) {
          if (arguments.length === 0)
              return node.read(true);
          return node.write(next);
      };
      readWrite.get = () => node.read(true);
      readWrite.peek = () => node.read(false);
      readWrite.set = (next) => node.write(next);
      readWrite.update = (updater) => node.write(updater);
      readWrite.subscribe = (callback, subscribeOptions) => node.subscribe(callback, subscribeOptions);
      Object.defineProperty(readWrite, "isSignal", { value: true });
      return readWrite;
  }
  function computed(getter, options = {}) {
      const node = new ComputedNode(getter, options);
      const read = function () {
          return node.read(true);
      };
      read.get = () => node.read(true);
      read.peek = () => node.read(false);
      read.subscribe = (callback, subscribeOptions) => node.subscribe(callback, subscribeOptions);
      Object.defineProperty(read, "isSignal", { value: true });
      return read;
  }
  function effect(callback) {
      const runner = new ReactiveEffect(callback);
      const dispose = (() => runner.dispose());
      dispose.dispose = dispose;
      return dispose;
  }
  function batch(callback) {
      batchDepth += 1;
      try {
          return callback();
      }
      finally {
          batchDepth -= 1;
          flushEffects();
      }
  }
  function untrack(callback) {
      const previousObserver = activeObserver;
      activeObserver = null;
      try {
          return callback();
      }
      finally {
          activeObserver = previousObserver;
      }
  }
  function isSignal(value) {
      return typeof value === "function" && value.isSignal === true;
  }
  function resolveSignal(value) {
      return isSignal(value) ? value() : value;
  }
  function configure(options = {}) {
      configuredSanitizeHTML = options.sanitizeHTML || undefined;
  }
  function createConfig(options = {}) {
      var _a;
      const config = {};
      if (hasOwn(options, "sanitizeHTML"))
          config.sanitizeHTML = (_a = options.sanitizeHTML) !== null && _a !== void 0 ? _a : null;
      return config;
  }
  function store(initialValue) {
      const keys = new Set(Reflect.ownKeys(initialValue));
      const signals = new Map();
      const structure = signal(0);
      const ensureSignal = (key) => {
          if (!signals.has(key)) {
              signals.set(key, signal(initialValue[key]));
          }
          return signals.get(key);
      };
      const bumpStructure = () => {
          structure.update((version) => version + 1);
      };
      const setKey = (key, value) => {
          const hadKey = keys.has(key);
          if (!hadKey)
              keys.add(key);
          ensureSignal(key).set(value);
          if (!hadKey)
              bumpStructure();
      };
      const snapshot = () => {
          structure();
          const out = {};
          for (const key of keys) {
              out[key] = ensureSignal(key)();
          }
          return out;
      };
      const api = {
          $patch(patch) {
              const current = snapshot();
              const next = typeof patch === "function" ? patch(current) : patch;
              if (!next)
                  return;
              batch(() => {
                  for (const key of Reflect.ownKeys(next)) {
                      setKey(key, next[key]);
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
      return new Proxy(api, {
          get(target, key, receiver) {
              if (key in target)
                  return Reflect.get(target, key, receiver);
              return ensureSignal(key)();
          },
          set(_target, key, value) {
              batch(() => {
                  setKey(key, value);
              });
              return true;
          },
          deleteProperty(_target, key) {
              if (!keys.has(key))
                  return true;
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
                  return { ...Reflect.getOwnPropertyDescriptor(target, key), enumerable: false };
              }
              if (!keys.has(key))
                  return undefined;
              return { enumerable: true, configurable: true };
          },
          has(target, key) {
              structure();
              return key in target || keys.has(key);
          }
      });
  }
  function resource(loader, options = {}) {
      const data = signal(options.initialValue);
      const error = signal(null);
      const pending = signal(false);
      const statusValue = signal(options.initialValue === undefined ? "idle" : "success");
      const loading = computed(() => pending());
      const status = computed(() => statusValue());
      const keepPrevious = options.keepPrevious !== false;
      let controller = null;
      let refreshId = 0;
      let currentPromise = null;
      const api = {
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
              if (controller)
                  controller.abort();
              controller = new AbortController();
              const signal = controller.signal;
              const previous = data.peek();
              pending.set(true);
              statusValue.set("loading");
              error.set(null);
              if (!keepPrevious)
                  data.set(undefined);
              currentPromise = Promise.resolve()
                  .then(() => loader({ signal, previous, refreshId: id }))
                  .then((value) => {
                  var _a;
                  if (id !== refreshId || signal.aborted)
                      return data.peek();
                  data.set(value);
                  error.set(null);
                  statusValue.set("success");
                  (_a = options.onSuccess) === null || _a === void 0 ? void 0 : _a.call(options, value);
                  return value;
              })
                  .catch((err) => {
                  var _a;
                  if (id !== refreshId)
                      return data.peek();
                  error.set(err);
                  statusValue.set("error");
                  (_a = options.onError) === null || _a === void 0 ? void 0 : _a.call(options, err);
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
              if (controller)
                  controller.abort();
              controller = null;
              currentPromise = null;
              data.set(value);
              error.set(null);
              pending.set(false);
              statusValue.set(value === undefined ? "idle" : "success");
          },
          abort(reason) {
              if (!controller)
                  return;
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
  function action(handler, options = {}) {
      const data = signal(undefined);
      const error = signal(null);
      const count = signal(0);
      const statusValue = signal("idle");
      const pending = computed(() => count() > 0);
      const pendingCount = computed(() => count());
      const status = computed(() => statusValue());
      let generation = 0;
      const submit = (...args) => {
          const runGeneration = generation;
          count.update((value) => value + 1);
          statusValue.set("loading");
          error.set(null);
          return Promise.resolve()
              .then(() => handler(...args))
              .then((value) => {
              var _a;
              if (runGeneration === generation) {
                  data.set(value);
                  error.set(null);
                  (_a = options.onSuccess) === null || _a === void 0 ? void 0 : _a.call(options, value);
                  if (count.peek() <= 1)
                      statusValue.set("success");
              }
              return value;
          })
              .catch((err) => {
              var _a;
              if (runGeneration === generation) {
                  error.set(err);
                  (_a = options.onError) === null || _a === void 0 ? void 0 : _a.call(options, err);
                  if (count.peek() <= 1)
                      statusValue.set("error");
              }
              throw err;
          })
              .finally(() => {
              if (runGeneration !== generation)
                  return;
              count.update((value) => Math.max(0, value - 1));
              if (count.peek() > 0)
                  statusValue.set("loading");
          });
      };
      const callable = ((...args) => submit(...args));
      const mutableCallable = callable;
      mutableCallable.submit = submit;
      mutableCallable.run = (...args) => {
          submit(...args).catch(() => undefined);
      };
      mutableCallable.with = (...args) => {
          return () => {
              mutableCallable.run(...args);
          };
      };
      mutableCallable.from = (mapper) => {
          return (event) => {
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
      };
      return callable;
  }
  function getFormElementCtor(node) {
      var _a, _b;
      const ownerWindow = (_a = node === null || node === void 0 ? void 0 : node.ownerDocument) === null || _a === void 0 ? void 0 : _a.defaultView;
      return (ownerWindow === null || ownerWindow === void 0 ? void 0 : ownerWindow.HTMLFormElement)
          || ((_b = getWindow()) === null || _b === void 0 ? void 0 : _b.HTMLFormElement)
          || (typeof HTMLFormElement !== "undefined" ? HTMLFormElement : undefined);
  }
  function isFormElement(node, fallbackNode) {
      const FormElement = node ? getFormElementCtor(node) : getFormElementCtor(fallbackNode || null);
      return Boolean(node && FormElement && node instanceof FormElement);
  }
  function findFormElement(event) {
      var _a;
      const target = (event.currentTarget || event.target);
      if (!getFormElementCtor(target))
          throw new Error("Ity.form requires HTMLFormElement support");
      if (isFormElement(target, target))
          return target;
      const closest = (_a = target === null || target === void 0 ? void 0 : target.closest) === null || _a === void 0 ? void 0 : _a.call(target, "form");
      if (isFormElement(closest, target))
          return closest;
      throw new Error("Ity.form onSubmit requires a form event target");
  }
  function createFormDataForElement(formElement) {
      var _a, _b;
      const ownerWindow = (_a = formElement.ownerDocument) === null || _a === void 0 ? void 0 : _a.defaultView;
      const FormDataCtor = (ownerWindow === null || ownerWindow === void 0 ? void 0 : ownerWindow.FormData)
          || ((_b = getWindow()) === null || _b === void 0 ? void 0 : _b.FormData)
          || (typeof FormData !== "undefined" ? FormData : undefined);
      if (!FormDataCtor)
          throw new Error("Ity.form requires FormData support");
      return new FormDataCtor(formElement);
  }
  function form(handler, options = {}) {
      const submitAction = action(handler, options);
      const onSubmit = async (event) => {
          event.preventDefault();
          const formElement = findFormElement(event);
          const result = await submitAction(createFormDataForElement(formElement), event);
          if (options.resetOnSuccess)
              formElement.reset();
          return result;
      };
      return {
          action: submitAction,
          data: submitAction.data,
          error: submitAction.error,
          pending: submitAction.pending,
          status: submitAction.status,
          onSubmit,
          handleSubmit(event) {
              onSubmit(event).catch(() => undefined);
          },
          reset() {
              submitAction.reset();
          }
      };
  }
  function replaceStoreSnapshot(target, nextValue) {
      const current = target.$snapshot();
      batch(() => {
          for (const key of Reflect.ownKeys(current)) {
              if (!hasOwn(nextValue, key))
                  delete target[key];
          }
          for (const key of Reflect.ownKeys(nextValue)) {
              target[key] = nextValue[key];
          }
      });
  }
  function formState(initialValue, options = {}) {
      const values = store(cloneValue(initialValue));
      const initialValues = signal(cloneValue(initialValue));
      const errors = store({});
      const touched = store({});
      const registeredBindings = new Map();
      const allFieldNames = () => {
          const names = new Set();
          Reflect.ownKeys(initialValues.peek()).forEach((key) => names.add(String(key)));
          Reflect.ownKeys(values.$snapshot()).forEach((key) => names.add(String(key)));
          return Array.from(names);
      };
      const computeErrors = (snapshot) => {
          var _a;
          const out = {};
          const validators = options.validators || {};
          for (const key of allFieldNames()) {
              const validator = validators[key];
              if (!validator)
                  continue;
              const message = validator(snapshot[key], snapshot);
              if (message)
                  out[key] = message;
          }
          const formErrors = (_a = options.validate) === null || _a === void 0 ? void 0 : _a.call(options, snapshot);
          if (formErrors) {
              for (const key of Reflect.ownKeys(formErrors)) {
                  const message = formErrors[key];
                  if (message)
                      out[key] = message;
              }
          }
          return out;
      };
      const syncErrors = () => {
          const nextErrors = computeErrors(values.$snapshot());
          replaceStoreSnapshot(errors, nextErrors);
          return Reflect.ownKeys(nextErrors).length === 0;
      };
      const markTouched = (names) => {
          const keys = (names === null || names === void 0 ? void 0 : names.length)
              ? names.map((name) => String(name))
              : allFieldNames();
          batch(() => {
              for (const key of keys) {
                  touched[key] = true;
              }
          });
      };
      const maybeValidateTouched = () => {
          const touchedSnapshot = touched.$snapshot();
          if (Reflect.ownKeys(touchedSnapshot).some((key) => Boolean(touchedSnapshot[key]))) {
              syncErrors();
          }
      };
      const set = (next) => {
          values.$patch((current) => {
              const patch = typeof next === "function" ? next(current) : next;
              return patch || {};
          });
          maybeValidateTouched();
      };
      const reset = (next) => {
          const base = cloneValue(next
              ? { ...initialValues.peek(), ...next }
              : initialValues.peek());
          initialValues.set(cloneValue(base));
          replaceStoreSnapshot(values, base);
          replaceStoreSnapshot(errors, {});
          replaceStoreSnapshot(touched, {});
      };
      const createFieldSignal = (name) => {
          const signalLike = function (next) {
              if (arguments.length === 0)
                  return values[name];
              const previous = values[name];
              const resolved = typeof next === "function"
                  ? next(previous)
                  : next;
              values[name] = resolved;
              maybeValidateTouched();
              return resolved;
          };
          signalLike.get = () => values[name];
          signalLike.peek = () => untrack(() => values[name]);
          signalLike.set = (next) => signalLike(next);
          signalLike.update = (updater) => signalLike(updater);
          signalLike.subscribe = (callback, subscribeOptions = {}) => {
              let first = true;
              let previous = signalLike.peek();
              return effect(() => {
                  const current = values[name];
                  if (first) {
                      first = false;
                      previous = current;
                      if (subscribeOptions.immediate)
                          callback(current, current);
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
      const registerBinding = (name, domName, type, bindOptions) => {
          const fieldName = String(name);
          const fieldBindings = registeredBindings.get(fieldName) || new Map();
          const signature = `${domName}|${type}|${String(bindOptions.value)}`;
          fieldBindings.set(signature, {
              domName,
              type,
              value: bindOptions.value,
              parse: bindOptions.parse
          });
          registeredBindings.set(fieldName, fieldBindings);
      };
      const syncFromForm = (event) => {
          var _a;
          const NO_FORM_VALUE = Symbol("ity.formState.noValue");
          let formElement;
          try {
              formElement = findFormElement(event);
          }
          catch (_error) {
              return;
          }
          const formData = createFormDataForElement(formElement);
          const controls = Array.from(formElement.elements || []);
          const patch = {};
          const resolveControlValue = (name, bindings) => {
              var _a, _b, _c;
              const primary = bindings[0];
              if (!primary)
                  return NO_FORM_VALUE;
              const domName = primary.domName;
              const namedControls = controls.filter((control) => control && control.name === domName);
              if (primary.parse && namedControls.length) {
                  const parseTarget = primary.type === "radio"
                      ? namedControls.find((control) => Boolean(control.checked)) || namedControls[0]
                      : namedControls[0];
                  return primary.parse(parseTarget, event);
              }
              if (primary.type === "checkbox") {
                  const currentValue = values[name];
                  if (Array.isArray(currentValue) || bindings.some((binding) => binding.value !== undefined) || namedControls.length > 1) {
                      const selected = [];
                      for (const control of namedControls) {
                          if (!control.checked)
                              continue;
                          const matched = bindings.find((binding) => { var _a, _b, _c; return String((_b = (_a = binding.value) !== null && _a !== void 0 ? _a : control.value) !== null && _b !== void 0 ? _b : "") === String((_c = control.value) !== null && _c !== void 0 ? _c : ""); });
                          selected.push((_b = (_a = matched === null || matched === void 0 ? void 0 : matched.value) !== null && _a !== void 0 ? _a : control.value) !== null && _b !== void 0 ? _b : "");
                      }
                      return selected;
                  }
                  return formData.has(domName);
              }
              if (primary.type === "radio") {
                  return ((_c = formData.get(domName)) !== null && _c !== void 0 ? _c : values[name]);
              }
              if (primary.type === "select-multiple") {
                  const select = namedControls[0];
                  if (select === null || select === void 0 ? void 0 : select.selectedOptions) {
                      return Array.from(select.selectedOptions).map((option) => option.value);
                  }
                  return formData.getAll(domName);
              }
              if (primary.type === "number") {
                  const raw = formData.get(domName);
                  return (raw === null || raw === "" ? undefined : Number(raw));
              }
              const raw = formData.get(domName);
              return (raw === null ? "" : raw);
          };
          for (const fieldName of allFieldNames()) {
              const bindings = Array.from(((_a = registeredBindings.get(fieldName)) === null || _a === void 0 ? void 0 : _a.values()) || []);
              const nextValue = resolveControlValue(fieldName, bindings);
              if (nextValue !== NO_FORM_VALUE) {
                  patch[fieldName] = nextValue;
              }
          }
          if (Reflect.ownKeys(patch).length) {
              values.$patch(() => patch);
          }
      };
      const bind = (name, bindOptions = {}) => {
          const field = api.field(name);
          const type = bindOptions.type || "text";
          const eventName = bindOptions.event
              || (type === "checkbox" || type === "radio" || type === "select" || type === "select-multiple" ? "change" : "input");
          const domName = bindOptions.name || String(name);
          registerBinding(name, domName, type, bindOptions);
          const formattedValue = bindOptions.format ? bindOptions.format(field.value()) : field.value();
          const parseValue = (event) => {
              var _a, _b;
              if (bindOptions.parse) {
                  return bindOptions.parse((event.currentTarget || event.target), event);
              }
              const target = (event.currentTarget || event.target);
              if (!target)
                  return field.value();
              if (type === "checkbox") {
                  if (Array.isArray(field.value())) {
                      const optionValue = (_a = bindOptions.value) !== null && _a !== void 0 ? _a : target.value;
                      const current = field.value();
                      return (target.checked
                          ? Array.from(new Set([...current, optionValue]))
                          : current.filter((item) => !Object.is(item, optionValue)));
                  }
                  return Boolean(target.checked);
              }
              if (type === "radio") {
                  if (!target.checked)
                      return field.value();
                  return ((_b = bindOptions.value) !== null && _b !== void 0 ? _b : target.value);
              }
              if (type === "select-multiple") {
                  return Array.from(target.selectedOptions).map((option) => option.value);
              }
              if (type === "number") {
                  const raw = target.value;
                  return (raw === "" ? undefined : Number(raw));
              }
              return target.value;
          };
          const binding = {
              name: domName,
              [`@${eventName}`]: (event) => {
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
                  binding[".checked"] = computed(() => field.value().some((item) => Object.is(item, optionValue)));
              }
              else {
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
              binding[".value"] = formattedValue;
              return binding;
          }
          const stringValue = formattedValue === undefined || formattedValue === null ? "" : String(formattedValue);
          binding[".value"] = stringValue;
          binding.value = stringValue;
          return binding;
      };
      const api = {
          values,
          initialValues,
          errors,
          touched,
          dirty: computed(() => !deepEqual(values.$snapshot(), initialValues())),
          valid: computed(() => Reflect.ownKeys(errors.$snapshot()).length === 0),
          field(name) {
              const valueSignal = createFieldSignal(name);
              return {
                  value: valueSignal,
                  error: computed(() => errors[name] || null),
                  touched: computed(() => Boolean(touched[name])),
                  dirty: computed(() => !deepEqual(values[name], initialValues()[name])),
                  bind(optionsForField) {
                      return bind(name, optionsForField);
                  },
                  set(next) {
                      return valueSignal.set(next);
                  },
                  reset() {
                      valueSignal.set(initialValues.peek()[name]);
                      delete errors[name];
                      delete touched[name];
                  }
              };
          },
          bind,
          set,
          reset,
          validate() {
              return syncErrors();
          },
          markTouched,
          submit(handler, submitOptions = {}) {
              const submitAction = action(handler, submitOptions);
              const onSubmit = async (event) => {
                  event.preventDefault();
                  syncFromForm(event);
                  markTouched();
                  if (!syncErrors())
                      return undefined;
                  const result = await submitAction(cloneValue(values.$snapshot()), event);
                  if (submitOptions.resetOnSuccess)
                      api.reset();
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
                  handleSubmit(event) {
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
  function html(strings, ...values) {
      return {
          isTemplateResult: true,
          strings: Array.from(strings),
          values
      };
  }
  function unsafeHTML(value, options = {}) {
      const sanitizer = resolveSanitizeHTML(options);
      return {
          isUnsafeHTML: true,
          value: sanitizer ? sanitizer(String(value)) : String(value)
      };
  }
  function isTemplateResult(value) {
      return !!value && typeof value === "object" && value.isTemplateResult === true;
  }
  function isUnsafeHTML(value) {
      return !!value && typeof value === "object" && value.isUnsafeHTML === true;
  }
  function isNodeLike(value) {
      return !!value && typeof value === "object" && typeof value.nodeType === "number";
  }
  function documentOrThrow() {
      const doc = getDocument();
      if (!doc)
          throw new Error("Ity DOM rendering requires a document");
      return doc;
  }
  function normalizeValue(value) {
      return isSignal(value) ? value() : value;
  }
  function valueToFragment(value, doc = documentOrThrow()) {
      const fragment = doc.createDocumentFragment();
      appendValue(fragment, normalizeValue(value), doc);
      return fragment;
  }
  function appendValue(parent, value, doc) {
      value = normalizeValue(value);
      if (value === null || value === undefined || value === false)
          return;
      if (Array.isArray(value)) {
          for (const item of value)
              appendValue(parent, item, doc);
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
  function bindingFromName(rawName) {
      const first = rawName[0];
      const kind = first === "@" ? "event" : first === "." ? "prop" : first === "?" ? "bool" : "attr";
      const name = kind === "attr" ? rawName : rawName.slice(1);
      return { kind, name };
  }
  function materializeTemplate(result, doc = documentOrThrow()) {
      var _a, _b;
      const bindings = [];
      let source = "";
      for (let i = 0; i < result.values.length; i += 1) {
          const part = (_a = result.strings[i]) !== null && _a !== void 0 ? _a : "";
          const attrMatch = part.match(/([@.?]?[\w:-]+)\s*=\s*$/);
          if (attrMatch) {
              const rawName = attrMatch[1];
              const before = part.slice(0, part.length - attrMatch[0].length);
              const marker = `data-ity-bind-${i}`;
              const { kind, name } = bindingFromName(rawName);
              bindings.push({ index: i, kind, name });
              source += `${before}${marker}=""`;
          }
          else {
              bindings.push({ index: i, kind: "node" });
              source += `${part}<!--ity:${i}-->`;
          }
      }
      source += (_b = result.strings[result.strings.length - 1]) !== null && _b !== void 0 ? _b : "";
      const template = doc.createElement("template");
      template.innerHTML = source;
      const fragment = template.content.cloneNode(true);
      applyBindings(fragment, bindings, result.values, doc);
      return fragment;
  }
  function applyBindings(root, bindings, values, doc) {
      const comments = new Map();
      const walker = doc.createTreeWalker(root, 128);
      let current = walker.nextNode();
      while (current) {
          const comment = current;
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
          const elements = Array.from(root.querySelectorAll(`[${attrName}]`));
          for (const element of elements) {
              element.removeAttribute(attrName);
              applyElementBinding(element, binding, value);
          }
      }
  }
  function applyElementBinding(element, binding, value) {
      const name = binding.name || "";
      if (binding.kind === "attr" && name === "bind" && isPlainObject(value)) {
          for (const key of Reflect.ownKeys(value)) {
              const entryValue = normalizeValue(value[key]);
              const entry = bindingFromName(String(key));
              applyElementBinding(element, { index: binding.index, ...entry }, entryValue);
          }
          return;
      }
      if (binding.kind === "event") {
          if (typeof value === "function") {
              element.addEventListener(name, value);
          }
          else if (Array.isArray(value) && typeof value[0] === "function") {
              element.addEventListener(name, value[0], value[1]);
          }
          return;
      }
      if (binding.kind === "prop") {
          if (name === "value" && Array.isArray(value) && element.tagName === "SELECT" && element.multiple) {
              const selectedValues = new Set(value.map((entry) => String(entry)));
              Array.from(element.options).forEach((option) => {
                  option.selected = selectedValues.has(option.value);
              });
              return;
          }
          element[name] = value;
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
          const classes = Object.keys(value).filter((key) => Boolean(value[key]));
          element.setAttribute("class", classes.join(" "));
          return;
      }
      if (name === "style" && typeof value === "object" && value !== null) {
          Object.assign(element.style, value);
          return;
      }
      element.setAttribute(name, value === true ? "" : String(value));
  }
  function getDeepActiveElement(doc) {
      var _a;
      if (!doc)
          return null;
      let active = doc.activeElement;
      while (active && ((_a = active.shadowRoot) === null || _a === void 0 ? void 0 : _a.activeElement)) {
          active = active.shadowRoot.activeElement;
      }
      return active;
  }
  function nodeContains(root, node) {
      return root === node || typeof root.contains === "function" && root.contains(node);
  }
  function captureNodePath(root, node) {
      const path = [];
      let current = node;
      while (current && current !== root) {
          const parent = current.parentNode;
          if (!parent)
              return null;
          path.unshift(Array.prototype.indexOf.call(parent.childNodes, current));
          current = parent;
      }
      return current === root ? path : null;
  }
  function resolveNodePath(root, path) {
      let current = root;
      for (const index of path) {
          if (!(current === null || current === void 0 ? void 0 : current.childNodes) || index < 0 || index >= current.childNodes.length)
              return null;
          current = current.childNodes[index];
      }
      return current;
  }
  function captureSelectionState(element) {
      const target = element;
      if (typeof target.selectionStart !== "number" || typeof target.selectionEnd !== "number")
          return null;
      return {
          start: target.selectionStart,
          end: target.selectionEnd,
          direction: target.selectionDirection
      };
  }
  function getElementName(element) {
      return typeof element.name === "string"
          ? (element.name || null)
          : element.getAttribute("name");
  }
  function getElementType(element) {
      return typeof element.type === "string"
          ? (element.type || null)
          : element.getAttribute("type");
  }
  function getElementPlaceholder(element) {
      return typeof element.placeholder === "string"
          ? (element.placeholder || null)
          : element.getAttribute("placeholder");
  }
  function captureFocusState(target) {
      const doc = target.ownerDocument || getDocument();
      const active = getDeepActiveElement(doc);
      if (!active || !nodeContains(target, active))
          return null;
      const path = captureNodePath(target, active);
      if (!path)
          return null;
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
  function matchesFocusState(element, state) {
      if (element.tagName !== state.tagName)
          return false;
      if (state.id && element.id !== state.id)
          return false;
      if (state.name && getElementName(element) !== state.name)
          return false;
      if (state.type && getElementType(element) !== state.type)
          return false;
      return true;
  }
  function findFocusCandidate(target, state) {
      var _a, _b, _c;
      if (state.id) {
          const byId = (_a = target.ownerDocument) === null || _a === void 0 ? void 0 : _a.getElementById(state.id);
          if (byId && nodeContains(target, byId) && matchesFocusState(byId, state))
              return byId;
      }
      if (state.name && typeof target.querySelectorAll === "function") {
          const matches = Array.from(target.querySelectorAll(state.tagName.toLowerCase()))
              .filter((entry) => { var _a, _b; return entry instanceof (((_b = (_a = target.ownerDocument) === null || _a === void 0 ? void 0 : _a.defaultView) === null || _b === void 0 ? void 0 : _b.HTMLElement) || HTMLElement); })
              .filter((entry) => getElementName(entry) === state.name)
              .filter((entry) => matchesFocusState(entry, state));
          if (matches.length === 1)
              return matches[0];
      }
      const byPath = resolveNodePath(target, state.path);
      if (byPath instanceof (((_c = (_b = target.ownerDocument) === null || _b === void 0 ? void 0 : _b.defaultView) === null || _c === void 0 ? void 0 : _c.HTMLElement) || HTMLElement) && byPath.tagName === state.tagName) {
          return byPath;
      }
      return null;
  }
  function restoreSelectionState(element, selection) {
      if (!selection)
          return;
      const target = element;
      if (typeof target.setSelectionRange !== "function" || typeof target.value !== "string")
          return;
      const length = target.value.length;
      const start = Math.max(0, Math.min(selection.start, length));
      const end = Math.max(start, Math.min(selection.end, length));
      try {
          target.setSelectionRange(start, end, selection.direction || undefined);
      }
      catch (_error) {
          target.setSelectionRange(start, end);
      }
  }
  function restoreFocusState(target, state) {
      if (!state)
          return;
      const candidate = findFocusCandidate(target, state);
      if (!candidate || typeof candidate.focus !== "function")
          return;
      const apply = () => {
          if (!candidate.isConnected)
              return;
          try {
              candidate.focus({ preventScroll: true });
          }
          catch (_error) {
              candidate.focus();
          }
          restoreSelectionState(candidate, state.selection);
      };
      apply();
      const doc = target.ownerDocument || getDocument();
      if ((doc === null || doc === void 0 ? void 0 : doc.activeElement) !== candidate) {
          if (typeof queueMicrotask === "function") {
              queueMicrotask(apply);
          }
          else {
              Promise.resolve().then(apply).catch(() => undefined);
          }
      }
  }
  function resolveTarget(target) {
      if (typeof target === "string") {
          const found = documentOrThrow().querySelector(target);
          if (!found)
              throw new Error(`Render target not found: ${target}`);
          return found;
      }
      if (target === null || target === void 0 ? void 0 : target.isSelectorObject) {
          const first = target.first()[0];
          if (!first)
              throw new Error("Cannot render into an empty SelectorObject");
          return first;
      }
      return target;
  }
  function replaceChildren(target, fragment) {
      const focusState = captureFocusState(target);
      const maybeTarget = target;
      if (typeof maybeTarget.replaceChildren === "function") {
          maybeTarget.replaceChildren(fragment);
          restoreFocusState(target, focusState);
          return;
      }
      while (target.firstChild)
          target.removeChild(target.firstChild);
      target.appendChild(fragment);
      restoreFocusState(target, focusState);
  }
  function withViewTransition(update, enabled) {
      const doc = getDocument();
      if (enabled && doc && typeof doc.startViewTransition === "function") {
          doc.startViewTransition(update);
      }
      else {
          update();
      }
  }
  function render(view, target, options = {}) {
      const mount = resolveTarget(target);
      const update = () => {
          withConfig(options.config, () => {
              const value = typeof view === "function" && !isSignal(view)
                  ? view()
                  : normalizeValue(view);
              withViewTransition(() => replaceChildren(mount, valueToFragment(value)), options.transition);
          });
      };
      if (options.reactive === false) {
          update();
          return () => undefined;
      }
      return effect(update);
  }
  function renderToString(view, options = {}) {
      return withConfig(options.config, () => {
          const value = typeof view === "function" && !isSignal(view)
              ? view()
              : normalizeValue(view);
          return valueToString(value);
      });
  }
  function valueToString(value) {
      value = normalizeValue(value);
      if (value === null || value === undefined || value === false)
          return "";
      if (Array.isArray(value))
          return value.map(valueToString).join("");
      if (isTemplateResult(value))
          return templateToString(value);
      if (isUnsafeHTML(value))
          return value.value;
      if (isNodeLike(value)) {
          const node = value;
          if (typeof node.outerHTML === "string")
              return node.outerHTML;
          return escapeHTML(node.textContent || "");
      }
      return escapeHTML(String(value));
  }
  function templateToString(result) {
      var _a, _b;
      let source = "";
      for (let i = 0; i < result.values.length; i += 1) {
          const part = (_a = result.strings[i]) !== null && _a !== void 0 ? _a : "";
          const attrMatch = part.match(/([@.?]?[\w:-]+)\s*=\s*$/);
          const value = normalizeValue(result.values[i]);
          if (attrMatch) {
              const rawName = attrMatch[1];
              const before = part.slice(0, part.length - attrMatch[0].length);
              const { kind, name } = bindingFromName(rawName);
              if (kind === "attr" && name === "bind" && isPlainObject(value)) {
                  const serialized = [];
                  for (const key of Reflect.ownKeys(value)) {
                      const entryValue = normalizeValue(value[key]);
                      const entry = bindingFromName(String(key));
                      const entryName = entry.name || "";
                      if (entry.kind === "event" || entryValue === false || entryValue === null || entryValue === undefined)
                          continue;
                      if (entry.kind === "bool") {
                          if (entryValue)
                              serialized.push(entryName);
                          continue;
                      }
                      if (entry.kind === "prop") {
                          if (entryName === "value") {
                              serialized.push(`value="${escapeAttribute(String(entryValue))}"`);
                          }
                          else if ((entryName === "checked" || entryName === "selected") && entryValue) {
                              serialized.push(entryName);
                          }
                          continue;
                      }
                      serialized.push(`${entryName}="${escapeAttribute(stringifyAttribute(entryName, entryValue))}"`);
                  }
                  source += serialized.length ? `${before}${serialized.join(" ")}` : before;
                  continue;
              }
              if (kind === "event" || kind === "prop" || value === false || value === null || value === undefined) {
                  source += before;
              }
              else if (kind === "bool") {
                  source += value ? `${before}${name}` : before;
              }
              else {
                  source += `${before}${name || ""}="${escapeAttribute(stringifyAttribute(name || "", value))}"`;
              }
          }
          else {
              source += part + valueToString(value);
          }
      }
      source += (_b = result.strings[result.strings.length - 1]) !== null && _b !== void 0 ? _b : "";
      return source;
  }
  function stringifyAttribute(name, value) {
      if (name === "class" && Array.isArray(value))
          return value.filter(Boolean).join(" ");
      if (name === "class" && typeof value === "object" && value !== null) {
          return Object.keys(value).filter((key) => Boolean(value[key])).join(" ");
      }
      if (name === "style" && typeof value === "object" && value !== null) {
          return Object.keys(value)
              .map((key) => `${key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}:${value[key]}`)
              .join(";");
      }
      return value === true ? "" : String(value);
  }
  function escapeHTML(value) {
      return value
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
  }
  function escapeAttribute(value) {
      return escapeHTML(value)
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#39;");
  }
  function component(name, setupOrOptions, maybeOptions = {}) {
      const win = getWindow();
      if (!(win === null || win === void 0 ? void 0 : win.customElements) || !win.HTMLElement) {
          throw new Error("Ity.component requires Custom Elements support");
      }
      if (win.customElements.get(name)) {
          return win.customElements.get(name);
      }
      const definition = typeof setupOrOptions === "function"
          ? { ...maybeOptions, setup: setupOrOptions }
          : setupOrOptions;
      const attrs = definition.observedAttributes || definition.attrs || [];
      const props = definition.props || [];
      class ItyElement extends win.HTMLElement {
          constructor() {
              super(...arguments);
              this.attrSignals = new Map();
              this.propSignals = new Map();
              this.connectedCallbacks = [];
              this.disconnectedCallbacks = [];
              this.effectRecords = [];
              this.initialized = false;
              this.connected = false;
          }
          static get observedAttributes() {
              return attrs;
          }
          connectedCallback() {
              var _a;
              this.ensureMount();
              for (const prop of props)
                  this.upgradeProperty(prop);
              if (!this.initialized) {
                  this.initialized = true;
                  const ctx = this.createContext();
                  const output = (_a = definition.setup) === null || _a === void 0 ? void 0 : _a.call(definition, ctx);
                  if (output !== undefined) {
                      this.renderOutput = output;
                  }
              }
              this.connected = true;
              this.startRender();
              this.startEffects();
              for (const callback of this.connectedCallbacks)
                  callback();
          }
          disconnectedCallback() {
              var _a;
              this.connected = false;
              if (this.renderCleanup) {
                  this.renderCleanup();
                  this.renderCleanup = undefined;
              }
              for (const record of this.effectRecords) {
                  (_a = record.handle) === null || _a === void 0 ? void 0 : _a.dispose();
                  record.handle = undefined;
              }
              for (const callback of this.disconnectedCallbacks)
                  callback();
          }
          attributeChangedCallback(name, _oldValue, newValue) {
              this.ensureAttrSignal(name).set(newValue);
          }
          ensureMount() {
              if (this.mount && this.renderTarget)
                  return;
              const shadow = definition.shadow;
              if (shadow === false) {
                  this.mount = this;
              }
              else {
                  const init = typeof shadow === "object"
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
              }
              else {
                  this.renderTarget = this.mount;
              }
          }
          startRender() {
              if (this.renderCleanup || this.renderOutput === undefined)
                  return;
              this.renderCleanup = render(this.renderOutput, this.renderTarget, {
                  transition: false,
                  config: definition.config
              });
          }
          startEffects() {
              for (const record of this.effectRecords) {
                  if (!record.disposed && !record.handle) {
                      record.handle = effect(record.callback);
                  }
              }
          }
          ensureAttrSignal(name) {
              if (!this.attrSignals.has(name)) {
                  this.attrSignals.set(name, signal(this.getAttribute(name)));
              }
              return this.attrSignals.get(name);
          }
          ensurePropSignal(name) {
              if (!this.propSignals.has(name)) {
                  this.propSignals.set(name, signal(undefined));
              }
              return this.propSignals.get(name);
          }
          upgradeProperty(name) {
              if (!hasOwn(this, name))
                  return;
              const value = this[name];
              delete this[name];
              this[name] = value;
          }
          createContext() {
              return {
                  host: this,
                  root: this.mount,
                  attr: (name) => this.ensureAttrSignal(name),
                  prop: (name) => this.ensurePropSignal(name),
                  emit: (name, detail, options = {}) => this.dispatchEvent(new CustomEvent(name, {
                      bubbles: true,
                      composed: true,
                      ...options,
                      detail
                  })),
                  effect: (callback) => {
                      const record = { callback, disposed: false, handle: undefined };
                      this.effectRecords.push(record);
                      if (this.connected)
                          record.handle = effect(callback);
                      const dispose = (() => {
                          var _a;
                          record.disposed = true;
                          (_a = record.handle) === null || _a === void 0 ? void 0 : _a.dispose();
                          record.handle = undefined;
                      });
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
              get() {
                  return this.ensurePropSignal(prop).peek();
              },
              set(value) {
                  this.ensurePropSignal(prop).set(typeof value === "function" ? (() => value) : value);
              }
          });
      }
      win.customElements.define(name, ItyElement);
      return ItyElement;
  }
  class Evented {
      constructor() {
          this._events = {};
      }
      on(evtName, callback, context = this) {
          var _a;
          ((_a = this._events)[evtName] || (_a[evtName] = [])).push({ callback, ctx: context });
      }
      off(evtName, callback, context) {
          if (!evtName) {
              this._events = {};
              return;
          }
          const events = this._events[evtName];
          if (!events)
              return;
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
          if (events.length === 0)
              delete this._events[evtName];
      }
      trigger(evtName, data) {
          const events = this._events[evtName];
          if (!events)
              return;
          for (const event of events.slice()) {
              event.callback.call(event.ctx, data);
          }
      }
  }
  const regexps = {
      nospaces: /^\S*$/
  };
  class SelectorObject {
      constructor(nodeList = []) {
          this.isSelectorObject = true;
          this.nodes = [];
          this.nodes = Array.from(nodeList);
          this.reindex();
      }
      get length() {
          return this.nodes.length;
      }
      [Symbol.iterator]() {
          return this.nodes[Symbol.iterator]();
      }
      toArray() {
          return this.nodes.slice();
      }
      find(selector) {
          const nodeList = [];
          for (const node of this.nodes) {
              const list = node.querySelectorAll(selector);
              for (const thisNode of Array.from(list)) {
                  const elm = thisNode;
                  if (nodeList.indexOf(elm) < 0)
                      nodeList.push(elm);
              }
          }
          return new SelectorObject(nodeList);
      }
      filter(selector) {
          return new SelectorObject(this.nodes.filter((node) => node.matches(selector)));
      }
      first() {
          return new SelectorObject(this.nodes[0] ? [this.nodes[0]] : []);
      }
      last() {
          return new SelectorObject(this.nodes.length ? [this.nodes[this.nodes.length - 1]] : []);
      }
      parent() {
          const nodeList = [];
          for (const node of this.nodes) {
              const parent = node.parentElement;
              if (parent && nodeList.indexOf(parent) < 0)
                  nodeList.push(parent);
          }
          return new SelectorObject(nodeList);
      }
      children(selector) {
          const nodeList = [];
          for (const node of this.nodes) {
              for (const child of Array.from(node.children)) {
                  if (nodeList.indexOf(child) < 0 && (!selector || child.matches(selector))) {
                      nodeList.push(child);
                  }
              }
          }
          return new SelectorObject(nodeList);
      }
      remove() {
          for (const node of this.nodes)
              node.remove();
          return new SelectorObject([]);
      }
      addClass(...classes) {
          for (const node of this.nodes)
              node.classList.add(...classes);
          return this;
      }
      removeClass(value) {
          if (value && regexps.nospaces.test(value)) {
              for (const node of this.nodes)
                  node.classList.remove(value);
          }
          return this;
      }
      toggleClass(value) {
          if (value && regexps.nospaces.test(value)) {
              for (const node of this.nodes)
                  node.classList.toggle(value);
          }
          return this;
      }
      hasClass(value) {
          return Boolean(value && regexps.nospaces.test(value) && this.nodes.some((node) => node.classList.contains(value)));
      }
      attr(name, value) {
          var _a, _b;
          if (arguments.length === 1)
              return (_b = (_a = this.nodes[0]) === null || _a === void 0 ? void 0 : _a.getAttribute(name)) !== null && _b !== void 0 ? _b : null;
          for (const node of this.nodes) {
              if (value === null || value === false || value === undefined)
                  node.removeAttribute(name);
              else
                  node.setAttribute(name, value === true ? "" : String(value));
          }
          return this;
      }
      text(value) {
          if (arguments.length === 0)
              return this.nodes.map((node) => node.textContent || "").join("");
          for (const node of this.nodes)
              node.textContent = String(value);
          return this;
      }
      on(eventName, listener, options) {
          for (const node of this.nodes)
              node.addEventListener(eventName, listener, options);
          return this;
      }
      off(eventName, listener, options) {
          for (const node of this.nodes)
              node.removeEventListener(eventName, listener, options);
          return this;
      }
      before(content) {
          return this._html(content, "beforebegin");
      }
      after(content) {
          return this._html(content, "afterend");
      }
      append(content) {
          return this._html(content, "beforeend");
      }
      prepend(content) {
          return this._html(content, "afterbegin");
      }
      html(content) {
          var _a, _b;
          if (arguments.length === 0)
              return (_b = (_a = this.nodes[0]) === null || _a === void 0 ? void 0 : _a.innerHTML) !== null && _b !== void 0 ? _b : "";
          return this._html(content, "replace");
      }
      empty() {
          for (const node of this.nodes)
              node.textContent = "";
          return this;
      }
      _html(content, position) {
          const doc = getDocument();
          for (const node of this.nodes) {
              if (content === null || content === void 0 ? void 0 : content.isSelectorObject) {
                  const htmls = Array.from(content).map((selNode) => selNode.outerHTML).join("");
                  if (position === "replace")
                      node.innerHTML = htmls;
                  else
                      node.insertAdjacentHTML(position, htmls);
              }
              else if (isTemplateResult(content) && doc) {
                  const fragment = materializeTemplate(content, doc);
                  if (position === "replace")
                      replaceChildren(node, fragment);
                  else
                      node.insertAdjacentElement(position, fragmentToElement(fragment, doc));
              }
              else if (isNodeLike(content)) {
                  const cloned = content.cloneNode(true);
                  if (position === "replace")
                      replaceChildren(node, valueToFragment(cloned, doc || node.ownerDocument));
                  else
                      node.insertAdjacentElement(position, cloned);
              }
              else {
                  const htmlContent = String(content);
                  if (position === "replace")
                      node.innerHTML = htmlContent;
                  else
                      node.insertAdjacentHTML(position, htmlContent);
              }
          }
          return this;
      }
      reindex() {
          for (const key of Object.keys(this)) {
              if (/^\d+$/.test(key))
                  delete this[key];
          }
          this.nodes.forEach((node, index) => {
              this[index] = node;
          });
      }
  }
  function fragmentToElement(fragment, doc) {
      const span = doc.createElement("span");
      span.appendChild(fragment);
      return span;
  }
  function onDOMReady(fn, args = [], context = Ity) {
      const doc = getDocument();
      const func = () => fn.apply(context, args);
      if (!doc || doc.readyState !== "loading")
          func();
      else
          doc.addEventListener("DOMContentLoaded", func, { once: true });
  }
  class Model extends Evented {
      constructor(opts = {}) {
          super();
          this.onDOMReady = onDOMReady;
          Object.assign(this, opts);
          this.id || (this.id = `m${Math.floor(Math.random() * 100000) + 1}`);
          this.data || (this.data = {});
          this.url || (this.url = "");
          this.state = signal(this.data);
          this._init(opts);
      }
      _init(opts) {
          this.initialize(opts);
      }
      _ajax(opts = {}) {
          const request = new XMLHttpRequest();
          const method = opts.type || "GET";
          const url = opts.url || this.url;
          const success = opts.success || function (resp) {
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
                  }
                  catch (err) {
                      error.call(this, request.status, err);
                  }
              }
              else {
                  error.call(this, request.status);
              }
          };
          request.onerror = () => error.call(this);
          request.send(opts.data === undefined ? undefined : JSON.stringify(opts.data));
      }
      initialize(options) { }
      get(attr) {
          const current = this.data;
          if (!attr)
              return current;
          return current ? current[attr] : undefined;
      }
      set(attr, value) {
          const current = this.state.peek() || {};
          const next = typeof attr === "string"
              ? { ...current, [attr]: value }
              : attr;
          this.data = next;
          this.state.set(next);
          this.trigger("change", this.data);
      }
      unSet(attr) {
          const current = this.state.peek();
          if (!current || !Object.prototype.hasOwnProperty.call(current, attr))
              return;
          const next = { ...current };
          delete next[attr];
          this.data = next;
          this.state.set(this.data);
          this.trigger("change", this.data);
      }
      clear() {
          this.data = {};
          this.state.set(this.data);
          this.trigger("change", this.data);
      }
      subscribe(callback, options) {
          return this.state.subscribe(callback, options);
      }
      sync(opts) {
          this._ajax(opts);
      }
      toJSON() {
          return this.get();
      }
  }
  class View extends Evented {
      constructor(opts = {}) {
          super();
          this.delegatedListeners = [];
          Object.assign(this, opts);
          this.id || (this.id = `v${Math.floor(Math.random() * 100000) + 1}`);
          if (this.app)
              this.app.addView(this);
          this.events || (this.events = {});
          onDOMReady(this._init, [opts], this);
      }
      _setElement(elSelector) {
          const win = getWindow();
          if (elSelector === null || elSelector === void 0 ? void 0 : elSelector.isSelectorObject) {
              this.el = elSelector;
          }
          else if ((win === null || win === void 0 ? void 0 : win.NodeList) && elSelector instanceof win.NodeList) {
              this.el = new SelectorObject(elSelector);
          }
          else if (typeof elSelector === "string") {
              this.el = new SelectorObject(documentOrThrow().querySelectorAll(elSelector));
          }
          else if ((win === null || win === void 0 ? void 0 : win.HTMLElement) && elSelector instanceof win.HTMLElement) {
              this.el = new SelectorObject([elSelector]);
          }
          else {
              throw new Error("el selector must be of type String, NodeList, HTMLElement or Ity.SelectorObject");
          }
      }
      _bindDOMEvents(evtObj) {
          if (!this.el || !this.el.isSelectorObject)
              return;
          const captureEvents = ["focus", "blur"];
          for (const selector in evtObj) {
              for (const evt in evtObj[selector]) {
                  const callback = this[evtObj[selector][evt]];
                  if (typeof callback !== "function") {
                      throw new Error(`View event handler not found: ${evtObj[selector][evt]}`);
                  }
                  const capture = captureEvents.includes(evt);
                  this._delegateEvent(selector, evt, callback, capture);
              }
          }
      }
      _delegateEvent(selector, evtName, callback, capture = false) {
          for (const root of this.el) {
              const listener = (event) => {
                  let node = event.target;
                  while (node) {
                      if (node.matches && node.matches(selector)) {
                          event.delegateTarget = node;
                          callback.call(this, event);
                          break;
                      }
                      if (node === root)
                          break;
                      node = node.parentElement;
                  }
              };
              root.addEventListener(evtName, listener, capture);
              this.delegatedListeners.push(() => root.removeEventListener(evtName, listener, capture));
          }
      }
      _init(opts) {
          if (this.el)
              this._setElement(this.el);
          if (opts.el && !this.el)
              this._setElement(opts.el);
          this._bindDOMEvents(this.events);
          this.initialize(opts);
      }
      initialize(opts) { }
      getName() {
          return this.name;
      }
      get(attr) {
          return this[attr];
      }
      set(attr, value) {
          this[attr] = value;
      }
      renderWith(view, options) {
          if (this.renderCleanup)
              this.renderCleanup();
          this.renderCleanup = render(view, this.el, options);
          return this.renderCleanup;
      }
      remove() {
          if (this.renderCleanup)
              this.renderCleanup();
          for (const cleanup of this.delegatedListeners.splice(0))
              cleanup();
          this.el.remove();
          if (this.app)
              this.app.removeView(this.id);
      }
      select(selector, ctx = this.el) {
          const win = getWindow();
          if (((win === null || win === void 0 ? void 0 : win.HTMLElement) && ctx instanceof win.HTMLElement) || ((win === null || win === void 0 ? void 0 : win.HTMLDocument) && ctx instanceof win.HTMLDocument)) {
              return new SelectorObject(ctx.querySelectorAll(selector));
          }
          if (ctx.isSelectorObject)
              return ctx.find(selector);
          throw new Error("Context passed to .select() must be an HTMLElement or an Ity.SelectorObject");
      }
  }
  class Application {
      constructor() {
          this.views = [];
      }
      getView(id) {
          return this.views.find((view) => view.id === id);
      }
      addView(view) {
          if (view instanceof View && !this.views.includes(view))
              this.views.push(view);
      }
      removeView(id) {
          this.views = this.views.filter((view) => view.id !== id);
      }
      trigger(evtName, data) {
          for (const view of this.views.slice())
              view.trigger(evtName, data);
      }
  }
  class Collection {
      constructor(models = [], ModelClass = Model) {
          this.models = [];
          this.ModelClass = ModelClass;
          this.url = "";
          this.state = signal(this.models);
          models.forEach((model) => this.add(model));
      }
      get(id) {
          return this.models.find((model) => model.id === id);
      }
      add(model) {
          if (!(model instanceof Model))
              return;
          this.models = [...this.models, model];
          this.state.set(this.models);
      }
      remove(id) {
          const model = typeof id === "string" ? this.get(id) : id;
          if (!model)
              return;
          this.models = this.models.filter((item) => item !== model);
          this.state.set(this.models);
      }
      at(index) {
          return this.models[index];
      }
      get length() {
          return this.models.length;
      }
      clear() {
          this.models = [];
          this.state.set(this.models);
      }
      find(predicate) {
          return this.models.find(predicate);
      }
      filter(predicate) {
          return this.models.filter(predicate);
      }
      map(mapper) {
          return this.models.map(mapper);
      }
      toJSON() {
          return this.models.map((model) => model.get());
      }
      subscribe(callback, options) {
          return this.state.subscribe(callback, options);
      }
      _ajax(opts = {}) {
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
                  }
                  catch (err) {
                      error.call(this, request.status, err);
                  }
              }
              else {
                  error.call(this, request.status);
              }
          };
          request.onerror = () => error.call(this);
          request.send(opts.data === undefined ? undefined : JSON.stringify(opts.data));
      }
      fetch(opts = {}) {
          const userSuccess = opts.success;
          opts.success = function (resp) {
              const ctor = (opts.modelClass || this.ModelClass);
              this.clear();
              for (const data of resp || []) {
                  const model = new ctor();
                  model.set(data);
                  this.add(model);
              }
              if (userSuccess)
                  userSuccess.call(this, resp);
          };
          this._ajax(opts);
      }
      trigger(evtName, data) {
          for (const model of this.models.slice())
              model.trigger(evtName, data);
      }
  }
  class Router {
      constructor(options = {}) {
          this.routes = [];
          this.started = false;
          this.listener = () => this.check();
          this.clickListener = (event) => this.handleLinkClick(event);
          this.navigationListener = (event) => this.handleNavigationEvent(event);
          this.current = signal(null);
          this.base = options.base || "/";
          this.linkSelector = options.linkSelector || "a[href]";
          this.transition = Boolean(options.transition);
          this.notFound = options.notFound;
          if (options.autoStart !== false)
              this.start();
      }
      add(pattern, handler) {
          this.routes.push(createRouteRecord(pattern, handler));
          return this;
      }
      addRoute(pattern, handler) {
          this.add(pattern, handler);
      }
      removeRoute(pattern) {
          var _a;
          if (((_a = this.activeRoute) === null || _a === void 0 ? void 0 : _a.pattern) === pattern) {
              this.disposeRoute();
              this.activeRoute = undefined;
              this.current.set(null);
          }
          this.routes = this.routes.filter((route) => route.pattern !== pattern);
          return this;
      }
      navigate(path, options = {}) {
          var _a;
          const win = getWindow();
          if (!win)
              return;
          const update = () => {
              const method = options.replace ? "replaceState" : "pushState";
              win.history[method](null, "", withBasePath(path, this.base));
              this.check();
          };
          withViewTransition(update, (_a = options.transition) !== null && _a !== void 0 ? _a : this.transition);
      }
      href(path) {
          return withBasePath(path, this.base);
      }
      link(path, attrs = {}) {
          const previousClick = attrs["@click"];
          const href = this.href(path);
          return {
              ...attrs,
              href,
              "@click": (event) => {
                  previousClick === null || previousClick === void 0 ? void 0 : previousClick(event);
                  const currentTarget = event.currentTarget;
                  const anchor = currentTarget && typeof currentTarget.matches === "function" && currentTarget.matches(this.linkSelector)
                      ? currentTarget
                      : null;
                  const url = this.resolveNavigationURL(event, anchor, href);
                  if (!url)
                      return;
                  event.preventDefault();
                  this.navigate(`${url.pathname}${url.search}${url.hash}`);
              }
          };
      }
      start() {
          var _a, _b;
          const win = getWindow();
          const doc = getDocument();
          if (!win || this.started) {
              if (win)
                  this.check();
              return;
          }
          win.addEventListener("popstate", this.listener);
          doc === null || doc === void 0 ? void 0 : doc.addEventListener("click", this.clickListener);
          (_b = (_a = win.navigation) === null || _a === void 0 ? void 0 : _a.addEventListener) === null || _b === void 0 ? void 0 : _b.call(_a, "navigate", this.navigationListener);
          this.started = true;
          this.check();
      }
      stop() {
          var _a, _b;
          const win = getWindow();
          const doc = getDocument();
          if (win && this.started) {
              win.removeEventListener("popstate", this.listener);
              doc === null || doc === void 0 ? void 0 : doc.removeEventListener("click", this.clickListener);
              (_b = (_a = win.navigation) === null || _a === void 0 ? void 0 : _a.removeEventListener) === null || _b === void 0 ? void 0 : _b.call(_a, "navigate", this.navigationListener);
          }
          this.started = false;
          this.disposeRoute();
      }
      check() {
          var _a;
          const win = getWindow();
          if (!win)
              return null;
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
              if (!routeParams)
                  continue;
              const query = searchParamsToObject(url.search);
              const hash = searchParamsToObject(url.hash);
              const params = { ...routeParams, ...query, ...hash };
              const context = {
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
              if (typeof cleanup === "function")
                  this.routeCleanup = cleanup;
              return context;
          }
          this.disposeRoute();
          this.activeRoute = undefined;
          this.current.set(null);
          const cleanup = (_a = this.notFound) === null || _a === void 0 ? void 0 : _a.call(this, {}, {
              path: routePath || "/",
              url,
              params: {},
              query: searchParamsToObject(url.search),
              hash: searchParamsToObject(url.hash)
          });
          if (typeof cleanup === "function")
              this.routeCleanup = cleanup;
          return null;
      }
      handleLinkClick(event) {
          const anchor = this.findAnchor(event);
          const url = this.resolveNavigationURL(event, anchor);
          if (!url)
              return;
          event.preventDefault();
          this.navigate(`${url.pathname}${url.search}${url.hash}`);
      }
      handleNavigationEvent(event) {
          var _a;
          const win = getWindow();
          if (!win || !(event === null || event === void 0 ? void 0 : event.canIntercept) || !((_a = event.destination) === null || _a === void 0 ? void 0 : _a.url) || typeof event.intercept !== "function")
              return;
          const url = new URL(event.destination.url, win.location.href);
          if (url.origin !== win.location.origin)
              return;
          if (stripBasePath(url.pathname, this.base) === null)
              return;
          event.intercept({
              handler: () => {
                  this.check();
              }
          });
      }
      disposeRoute() {
          if (!this.routeCleanup)
              return;
          const cleanup = this.routeCleanup;
          this.routeCleanup = undefined;
          cleanup();
      }
      resolveNavigationURL(event, anchor, fallbackHref) {
          var _a;
          const mouseEvent = event;
          if (event.defaultPrevented)
              return null;
          if (typeof mouseEvent.button === "number" && mouseEvent.button !== 0)
              return null;
          if (mouseEvent.metaKey || mouseEvent.ctrlKey || mouseEvent.shiftKey || mouseEvent.altKey)
              return null;
          if (anchor && ((anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download")))
              return null;
          const win = getWindow();
          if (!win)
              return null;
          const href = (_a = anchor === null || anchor === void 0 ? void 0 : anchor.getAttribute("href")) !== null && _a !== void 0 ? _a : fallbackHref;
          if (!href || /^(mailto|tel):/i.test(href))
              return null;
          const url = new URL((anchor === null || anchor === void 0 ? void 0 : anchor.href) || href, win.location.href);
          if (url.origin !== win.location.origin)
              return null;
          if (stripBasePath(url.pathname, this.base) === null)
              return null;
          return url;
      }
      findAnchor(event) {
          var _a;
          const fromPath = typeof event.composedPath === "function"
              ? event.composedPath()
              : [];
          for (const entry of fromPath) {
              if (!entry || !entry.matches)
                  continue;
              const element = entry;
              if (element.matches(this.linkSelector))
                  return element;
          }
          const target = event.target;
          return (_a = target === null || target === void 0 ? void 0 : target.closest) === null || _a === void 0 ? void 0 : _a.call(target, this.linkSelector);
      }
  }
  function createRouteRecord(pattern, handler) {
      const win = getWindow();
      const URLPatternCtor = (win === null || win === void 0 ? void 0 : win.URLPattern) || globalThis.URLPattern;
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
          }
          catch (_err) {
              // Fall through to the regex matcher for non-URLPattern syntax.
          }
      }
      const { re, keys } = compilePathPattern(pattern);
      return {
          pattern,
          handler,
          exec(url) {
              const match = re.exec(normalizePath(url.pathname));
              if (!match)
                  return null;
              const params = {};
              keys.forEach((key, index) => {
                  params[key] = decodeURIComponent(match[index + 1] || "");
              });
              return params;
          }
      };
  }
  function normalizeBase(base) {
      const normalized = normalizePath(base || "/");
      return normalized === "" ? "" : normalized;
  }
  function withBasePath(path, base) {
      const normalizedBase = normalizeBase(base);
      const parsed = new URL(path || "/", "http://ity.local");
      let pathname = normalizePath(parsed.pathname) || "/";
      if (normalizedBase && pathname !== normalizedBase && !pathname.startsWith(`${normalizedBase}/`)) {
          pathname = `${normalizedBase}${pathname === "/" ? "" : pathname}`;
      }
      return `${pathname}${parsed.search}${parsed.hash}`;
  }
  function stripBasePath(pathname, base) {
      const normalizedBase = normalizeBase(base);
      const normalizedPath = normalizePath(pathname) || "/";
      if (!normalizedBase)
          return normalizedPath;
      if (normalizedPath === normalizedBase)
          return "/";
      if (normalizedPath.startsWith(`${normalizedBase}/`)) {
          return normalizePath(normalizedPath.slice(normalizedBase.length)) || "/";
      }
      return null;
  }
  function compilePathPattern(pattern) {
      const keys = [];
      const normalized = normalizePath(pattern);
      if (normalized === "")
          return { re: /^\/?$/, keys };
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
  function normalizePath(path) {
      const normalized = path.replace(/[?#].*$/, "").replace(/\/+$/, "");
      return normalized === "" ? "" : normalized.startsWith("/") ? normalized : `/${normalized}`;
  }
  function escapeRegExp(value) {
      return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  function searchParamsToObject(value) {
      const out = {};
      const clean = value.replace(/^[?#]/, "");
      if (!clean)
          return out;
      const params = new URLSearchParams(clean);
      params.forEach((paramValue, key) => {
          out[key] = paramValue;
      });
      return out;
  }
  function decodeParams(value) {
      const out = {};
      for (const key of Object.keys(value)) {
          out[key] = decodeURIComponent(value[key]);
      }
      return out;
  }
  const defaultRouter = signal(null);
  function route(pattern, handler) {
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
      version: "2.2.0",
      createConfig,
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
      formState,
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
  function createAmdExport() {
      const win = getWindow();
      if (win)
          win.Ity = Ity;
      return Ity;
  }
  /* c8 ignore next 3 */
  if (typeof define === "function" && define.amd) {
      define(createAmdExport);
  }
  else if (typeof module === "object" && typeof module.exports !== "undefined") {
      module.exports = Ity;
  }
  const win = getWindow();
  if (win) {
      win.Ity = Ity;
  }

  exports.Application = Application;
  exports.Collection = Collection;
  exports.Model = Model;
  exports.Router = Router;
  exports.SelectorObject = SelectorObject;
  exports.View = View;
  exports.action = action;
  exports.batch = batch;
  exports.component = component;
  exports.computed = computed;
  exports.configure = configure;
  exports.createConfig = createConfig;
  exports.default = Ity;
  exports.effect = effect;
  exports.form = form;
  exports.formState = formState;
  exports.html = html;
  exports.isSignal = isSignal;
  exports.onDOMReady = onDOMReady;
  exports.render = render;
  exports.renderToString = renderToString;
  exports.resolveSignal = resolveSignal;
  exports.resource = resource;
  exports.route = route;
  exports.signal = signal;
  exports.store = store;
  exports.unsafeHTML = unsafeHTML;
  exports.untrack = untrack;

  Object.defineProperty(exports, '__esModule', { value: true });

  return exports;

})({});
//# sourceMappingURL=ity.js.map
