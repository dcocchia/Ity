const defaultEquals = Object.is;
let activeObserver = null;
let batchDepth = 0;
const pendingEffects = new Set();
let configuredSanitizeHTML;
function getWindow() {
    return typeof window !== "undefined" ? window : undefined;
}
function getDocument() {
    var _a;
    const win = getWindow();
    return (_a = win === null || win === void 0 ? void 0 : win.document) !== null && _a !== void 0 ? _a : (typeof document !== "undefined" ? document : undefined);
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
function form(handler, options = {}) {
    const submitAction = action(handler, options);
    const findForm = (event) => {
        var _a;
        const target = (event.currentTarget || event.target);
        const getFormElementCtor = (node) => {
            var _a, _b;
            const ownerWindow = (_a = node === null || node === void 0 ? void 0 : node.ownerDocument) === null || _a === void 0 ? void 0 : _a.defaultView;
            return (ownerWindow === null || ownerWindow === void 0 ? void 0 : ownerWindow.HTMLFormElement)
                || ((_b = getWindow()) === null || _b === void 0 ? void 0 : _b.HTMLFormElement)
                || (typeof HTMLFormElement !== "undefined" ? HTMLFormElement : undefined);
        };
        const isFormElement = (node) => {
            const FormElement = node ? getFormElementCtor(node) : getFormElementCtor(target);
            return Boolean(node && FormElement && node instanceof FormElement);
        };
        if (!getFormElementCtor(target))
            throw new Error("Ity.form requires HTMLFormElement support");
        if (isFormElement(target))
            return target;
        const closest = (_a = target === null || target === void 0 ? void 0 : target.closest) === null || _a === void 0 ? void 0 : _a.call(target, "form");
        if (isFormElement(closest))
            return closest;
        throw new Error("Ity.form onSubmit requires a form event target");
    };
    const createFormData = (formElement) => {
        var _a, _b;
        const ownerWindow = (_a = formElement.ownerDocument) === null || _a === void 0 ? void 0 : _a.defaultView;
        const FormDataCtor = (ownerWindow === null || ownerWindow === void 0 ? void 0 : ownerWindow.FormData)
            || ((_b = getWindow()) === null || _b === void 0 ? void 0 : _b.FormData)
            || (typeof FormData !== "undefined" ? FormData : undefined);
        if (!FormDataCtor)
            throw new Error("Ity.form requires FormData support");
        return new FormDataCtor(formElement);
    };
    return {
        action: submitAction,
        data: submitAction.data,
        error: submitAction.error,
        pending: submitAction.pending,
        status: submitAction.status,
        async onSubmit(event) {
            event.preventDefault();
            const formElement = findForm(event);
            const result = await submitAction(createFormData(formElement), event);
            if (options.resetOnSuccess)
                formElement.reset();
            return result;
        },
        reset() {
            submitAction.reset();
        }
    };
}
function html(strings, ...values) {
    return {
        isTemplateResult: true,
        strings: Array.from(strings),
        values
    };
}
function unsafeHTML(value, options = {}) {
    const sanitizer = options.sanitize || configuredSanitizeHTML;
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
            const first = rawName[0];
            const kind = first === "@" ? "event" : first === "." ? "prop" : first === "?" ? "bool" : "attr";
            const name = kind === "attr" ? rawName : rawName.slice(1);
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
    const maybeTarget = target;
    if (typeof maybeTarget.replaceChildren === "function") {
        maybeTarget.replaceChildren(fragment);
        return;
    }
    while (target.firstChild)
        target.removeChild(target.firstChild);
    target.appendChild(fragment);
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
        const value = typeof view === "function" && !isSignal(view)
            ? view()
            : normalizeValue(view);
        withViewTransition(() => replaceChildren(mount, valueToFragment(value)), options.transition);
    };
    if (options.reactive === false) {
        update();
        return () => undefined;
    }
    return effect(update);
}
function renderToString(view) {
    const value = typeof view === "function" && !isSignal(view)
        ? view()
        : normalizeValue(view);
    return valueToString(value);
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
            const first = rawName[0];
            const kind = first === "@" ? "event" : first === "." ? "prop" : first === "?" ? "bool" : "attr";
            const name = kind === "attr" ? rawName : rawName.slice(1);
            if (kind === "event" || kind === "prop" || value === false || value === null || value === undefined) {
                source += before;
            }
            else if (kind === "bool") {
                source += value ? `${before}${name}` : before;
            }
            else {
                source += `${before}${name}="${escapeAttribute(stringifyAttribute(name, value))}"`;
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
    class ItyElement extends win.HTMLElement {
        constructor() {
            super(...arguments);
            this.attrSignals = new Map();
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
            this.renderCleanup = render(this.renderOutput, this.renderTarget, { transition: false });
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
        createContext() {
            return {
                host: this,
                root: this.mount,
                attr: (name) => this.ensureAttrSignal(name),
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
        this.linkSelector = options.linkSelector || "a[data-ity-link]";
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
        var _a;
        const target = event.target;
        const anchor = (_a = target === null || target === void 0 ? void 0 : target.closest) === null || _a === void 0 ? void 0 : _a.call(target, this.linkSelector);
        if (!anchor || anchor.target || anchor.hasAttribute("download"))
            return;
        const win = getWindow();
        if (!win)
            return;
        const url = new URL(anchor.href, win.location.href);
        if (url.origin !== win.location.origin)
            return;
        if (stripBasePath(url.pathname, this.base) === null)
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

export { Application, Collection, Model, Router, SelectorObject, View, action, batch, component, computed, configure, Ity as default, effect, form, html, isSignal, onDOMReady, render, renderToString, resolveSignal, resource, route, signal, store, unsafeHTML, untrack };
//# sourceMappingURL=ity.esm.mjs.map
