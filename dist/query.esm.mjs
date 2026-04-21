import { signal, effect, computed, action } from './ity.esm.mjs';

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
        const currentKey = signal(resolveKey(), { name: `${options.name || "query"}.key` });
        const currentEntry = signal(this.ensureEntry(currentKey.peek(), options), { name: `${options.name || "query"}.entry` });
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
        const stopKeyTracking = effect(() => {
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
        const dispose = () => {
            if (disposed)
                return;
            disposed = true;
            stopKeyTracking();
            if (entryCleanup)
                entryCleanup();
            entryCleanup = null;
        };
        return {
            key: computed(() => currentKey()),
            data: computed(() => currentEntry().data()),
            error: computed(() => currentEntry().error()),
            loading: computed(() => currentEntry().pending()),
            status: computed(() => currentEntry().status()),
            stale: computed(() => {
                var _a;
                const entry = currentEntry();
                const staleTime = (_a = options.staleTime) !== null && _a !== void 0 ? _a : 0;
                if (entry.invalidatedAt() >= entry.updatedAt() && entry.invalidatedAt() !== 0)
                    return true;
                if (entry.updatedAt() === 0)
                    return true;
                return Date.now() - entry.updatedAt() > staleTime;
            }),
            updatedAt: computed(() => currentEntry().updatedAt()),
            promise: computed(() => currentEntry().promise()),
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
        return action(async (...args) => {
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
            data: signal(options.initialData, { name: `${options.name || "query"}.data` }),
            error: signal(null, { name: `${options.name || "query"}.error` }),
            pending: signal(false, { name: `${options.name || "query"}.pending` }),
            status: signal(options.initialData === undefined ? "idle" : "success", { name: `${options.name || "query"}.status` }),
            updatedAt: signal(options.initialData === undefined ? 0 : Date.now(), { name: `${options.name || "query"}.updatedAt` }),
            invalidatedAt: signal(0, { name: `${options.name || "query"}.invalidatedAt` }),
            promise: signal(null, { name: `${options.name || "query"}.promise` }),
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

export { createQueryClient, mutation, query };
//# sourceMappingURL=query.esm.mjs.map
