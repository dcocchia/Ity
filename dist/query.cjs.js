'use strict';

var Ity = require('./ity.cjs.js');

function isFiniteStaleTime(staleTime) {
    return Number.isFinite(staleTime) && staleTime >= 0;
}
function stableStringify(value) {
    if (value === undefined)
        return "undefined";
    if (typeof value === "number") {
        if (Number.isNaN(value))
            return "number:NaN";
        if (value === Infinity)
            return "number:Infinity";
        if (value === -Infinity)
            return "number:-Infinity";
        if (Object.is(value, -0))
            return "number:-0";
    }
    if (typeof value === "bigint")
        return `bigint:${value.toString()}`;
    if (typeof value === "symbol")
        return `symbol:${String(value.description || value.toString())}`;
    if (typeof value === "function")
        return `function:${value.name || "anonymous"}`;
    if (Array.isArray(value))
        return `[${value.map(stableStringify).join(",")}]`;
    if (value && typeof value === "object") {
        const entries = Object.keys(value)
            .sort()
            .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`);
        return `{${entries.join(",")}}`;
    }
    return JSON.stringify(value);
}
function serializeKey(key) {
    return typeof key === "string" ? key : stableStringify(key);
}
class QueryClientImpl {
    constructor(options = {}) {
        var _a;
        this.entries = new Map();
        this.gcTime = (_a = options.gcTime) !== null && _a !== void 0 ? _a : 5 * 60 * 1000;
    }
    query(key, loader, options = {}) {
        const resolveKey = () => {
            if (typeof key === "function")
                return key();
            if (typeof key === "string" || Array.isArray(key))
                return key;
            return key();
        };
        const currentKey = Ity.signal(resolveKey(), { name: `${options.name || "query"}.key` });
        const currentEntry = Ity.signal(this.ensureEntry(currentKey.peek(), options), { name: `${options.name || "query"}.entry` });
        const staleState = Ity.signal(true, { name: `${options.name || "query"}.stale` });
        let disposed = false;
        let entryCleanup = null;
        const attachEntry = (nextKey) => {
            const nextEntry = this.ensureEntry(nextKey, options);
            const previousEntry = currentEntry.peek();
            if (previousEntry === nextEntry)
                return;
            if (entryCleanup)
                entryCleanup();
            this.releaseEntry(previousEntry);
            this.retainEntry(nextEntry);
            entryCleanup = () => this.releaseEntry(nextEntry);
            currentEntry.set(nextEntry);
        };
        this.retainEntry(currentEntry.peek());
        entryCleanup = () => this.releaseEntry(currentEntry.peek());
        const stopKeyTracking = Ity.effect(() => {
            var _a;
            const nextKey = resolveKey();
            currentKey.set(nextKey);
            attachEntry(nextKey);
            const entry = currentEntry();
            const staleTime = (_a = options.staleTime) !== null && _a !== void 0 ? _a : 0;
            const shouldRefresh = entry.status() === "idle"
                || entry.invalidatedAt() >= entry.updatedAt() && entry.invalidatedAt() !== 0
                || (staleTime >= 0 && entry.updatedAt() > 0 && Date.now() - entry.updatedAt() > staleTime);
            if (options.immediate !== false && shouldRefresh) {
                this.fetchEntry(entry, loader, options);
            }
        });
        const stopStaleTracking = Ity.effect((onCleanup) => {
            var _a;
            const entry = currentEntry();
            const staleTime = (_a = options.staleTime) !== null && _a !== void 0 ? _a : 0;
            const updatedAt = entry.updatedAt();
            const invalidatedAt = entry.invalidatedAt();
            if (updatedAt === 0) {
                staleState.set(true);
                return;
            }
            if (invalidatedAt >= updatedAt && invalidatedAt !== 0) {
                staleState.set(true);
                return;
            }
            if (!isFiniteStaleTime(staleTime)) {
                staleState.set(false);
                return;
            }
            staleState.set(false);
            const expiresIn = Math.max(0, updatedAt + staleTime - Date.now()) + 1;
            const timer = setTimeout(() => {
                staleState.set(true);
            }, expiresIn);
            onCleanup(() => clearTimeout(timer));
        });
        const dispose = () => {
            if (disposed)
                return;
            disposed = true;
            stopKeyTracking();
            stopStaleTracking();
            if (entryCleanup)
                entryCleanup();
            entryCleanup = null;
        };
        return {
            key: Ity.computed(() => currentKey()),
            data: Ity.computed(() => currentEntry().data()),
            error: Ity.computed(() => currentEntry().error()),
            loading: Ity.computed(() => currentEntry().pending()),
            status: Ity.computed(() => currentEntry().status()),
            stale: Ity.computed(() => staleState()),
            updatedAt: Ity.computed(() => currentEntry().updatedAt()),
            promise: Ity.computed(() => currentEntry().promise()),
            refresh: () => this.fetchEntry(currentEntry.peek(), loader, options),
            invalidate: async () => {
                const entry = currentEntry.peek();
                entry.invalidatedAt.set(Date.now());
                return this.fetchEntry(entry, loader, options);
            },
            mutate: (next) => {
                const entry = currentEntry.peek();
                const resolved = typeof next === "function"
                    ? next(entry.data.peek())
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
    async prefetch(key, loader, options = {}) {
        const entry = this.ensureEntry(key, options);
        const result = await this.fetchEntry(entry, loader, options);
        this.scheduleGc(entry);
        return result;
    }
    async invalidate(key) {
        const matcher = typeof key === "function"
            ? key
            : key === undefined
                ? (() => true)
                : ((candidate) => serializeKey(candidate) === serializeKey(key));
        for (const entry of Array.from(this.entries.values())) {
            if (!matcher(entry.rawKey))
                continue;
            entry.invalidatedAt.set(Date.now());
        }
    }
    getData(key) {
        var _a;
        return (_a = this.entries.get(serializeKey(key))) === null || _a === void 0 ? void 0 : _a.data.peek();
    }
    setData(key, next) {
        const entry = this.ensureEntry(key, {});
        const resolved = typeof next === "function"
            ? next(entry.data.peek())
            : next;
        entry.data.set(resolved);
        entry.error.set(null);
        entry.pending.set(false);
        entry.promise.set(null);
        entry.status.set(resolved === undefined ? "idle" : "success");
        entry.updatedAt.set(Date.now());
        this.scheduleGc(entry);
    }
    getStatus(key) {
        var _a;
        return ((_a = this.entries.get(serializeKey(key))) === null || _a === void 0 ? void 0 : _a.status.peek()) || "missing";
    }
    mutation(handler, options = {}) {
        return Ity.action(async (...args) => {
            var _a;
            const rollback = (_a = options.optimistic) === null || _a === void 0 ? void 0 : _a.call(options, this, ...args);
            try {
                const result = await handler(...args);
                const invalidations = typeof options.invalidate === "function"
                    ? options.invalidate(result, args)
                    : options.invalidate;
                for (const key of invalidations || []) {
                    await this.invalidate(key);
                }
                return result;
            }
            catch (error) {
                rollback === null || rollback === void 0 ? void 0 : rollback();
                throw error;
            }
        }, options);
    }
    ensureEntry(key, options) {
        const keyString = serializeKey(key);
        if (this.entries.has(keyString)) {
            const entry = this.entries.get(keyString);
            entry.rawKey = key;
            return entry;
        }
        const entry = {
            rawKey: key,
            keyString,
            data: Ity.signal(options.initialData, { name: `${options.name || "query"}.data` }),
            error: Ity.signal(null, { name: `${options.name || "query"}.error` }),
            pending: Ity.signal(false, { name: `${options.name || "query"}.pending` }),
            status: Ity.signal(options.initialData === undefined ? "idle" : "success", { name: `${options.name || "query"}.status` }),
            updatedAt: Ity.signal(options.initialData === undefined ? 0 : Date.now(), { name: `${options.name || "query"}.updatedAt` }),
            invalidatedAt: Ity.signal(0, { name: `${options.name || "query"}.invalidatedAt` }),
            promise: Ity.signal(null, { name: `${options.name || "query"}.promise` }),
            refreshId: 0,
            controller: null,
            refs: 0,
            gcTimer: null
        };
        this.entries.set(keyString, entry);
        return entry;
    }
    retainEntry(entry) {
        entry.refs += 1;
        if (entry.gcTimer) {
            clearTimeout(entry.gcTimer);
            entry.gcTimer = null;
        }
    }
    releaseEntry(entry) {
        entry.refs = Math.max(0, entry.refs - 1);
        if (entry.refs > 0)
            return;
        this.scheduleGc(entry);
    }
    cancelEntry(entry) {
        var _a;
        entry.refreshId += 1;
        (_a = entry.controller) === null || _a === void 0 ? void 0 : _a.abort();
        entry.controller = null;
        entry.pending.set(false);
        entry.promise.set(null);
    }
    scheduleGc(entry) {
        if (entry.refs > 0)
            return;
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
            if (entry.refs > 0)
                return;
            this.cancelEntry(entry);
            this.entries.delete(entry.keyString);
        }, gcTime);
    }
    fetchEntry(entry, loader, options) {
        var _a;
        if (entry.promise.peek())
            return entry.promise.peek();
        entry.refreshId += 1;
        const refreshId = entry.refreshId;
        (_a = entry.controller) === null || _a === void 0 ? void 0 : _a.abort();
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
            signal: entry.controller.signal,
            previous,
            client: this,
            refreshId
        }))
            .then((value) => {
            var _a;
            if (refreshId !== entry.refreshId)
                return entry.data.peek();
            entry.data.set(value);
            entry.error.set(null);
            entry.status.set("success");
            entry.updatedAt.set(Date.now());
            entry.invalidatedAt.set(0);
            (_a = options.onSuccess) === null || _a === void 0 ? void 0 : _a.call(options, value);
            return value;
        })
            .catch((error) => {
            var _a;
            if (refreshId !== entry.refreshId)
                return entry.data.peek();
            entry.error.set(error);
            entry.status.set("error");
            (_a = options.onError) === null || _a === void 0 ? void 0 : _a.call(options, error);
            return entry.data.peek();
        })
            .finally(() => {
            if (refreshId !== entry.refreshId)
                return;
            entry.pending.set(false);
            entry.promise.set(null);
            entry.controller = null;
            this.scheduleGc(entry);
        });
        entry.promise.set(promise);
        return promise;
    }
}
function createQueryClient(options = {}) {
    return new QueryClientImpl(options);
}
function query(client, key, loader, options = {}) {
    return client.query(key, loader, options);
}
function mutation(client, handler, options = {}) {
    return client.mutation(handler, options);
}

exports.createQueryClient = createQueryClient;
exports.mutation = mutation;
exports.query = query;
//# sourceMappingURL=query.cjs.js.map
