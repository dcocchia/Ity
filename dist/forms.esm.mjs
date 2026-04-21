import { signal, computed, action, effect } from './ity.esm.mjs';

function cloneValue(value) {
    const cloneFn = globalThis.structuredClone;
    if (typeof cloneFn === "function")
        return cloneFn(value);
    return JSON.parse(JSON.stringify(value));
}
function deepEqual(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
}
function parsePath(path) {
    const parts = path.match(/[^.[\]]+/g) || [];
    return parts.map((part) => /^\d+$/.test(part) ? Number(part) : part);
}
function getIn(value, path) {
    return parsePath(path).reduce((current, segment) => current == null ? undefined : current[segment], value);
}
function setIn(value, path, next) {
    const parts = parsePath(path);
    if (!parts.length)
        return next;
    const root = cloneValue(value);
    let current = root;
    parts.forEach((segment, index) => {
        const last = index === parts.length - 1;
        if (last) {
            current[segment] = next;
            return;
        }
        const lookahead = parts[index + 1];
        const existing = current[segment];
        if (existing == null) {
            current[segment] = typeof lookahead === "number" ? [] : {};
        }
        else {
            current[segment] = cloneValue(existing);
        }
        current = current[segment];
    });
    return root;
}
function listFieldPaths(value, prefix = "") {
    if (Array.isArray(value)) {
        return value.flatMap((item, index) => listFieldPaths(item, prefix ? `${prefix}.${index}` : String(index)));
    }
    if (value && typeof value === "object") {
        return Object.keys(value).flatMap((key) => {
            const nextPrefix = prefix ? `${prefix}.${key}` : key;
            return listFieldPaths(value[key], nextPrefix);
        });
    }
    return prefix ? [prefix] : [];
}
function createArrayKey() {
    return `fk-${Math.random().toString(36).slice(2, 10)}`;
}
function getFormElementCtor(node) {
    var _a;
    const ownerWindow = (_a = node === null || node === void 0 ? void 0 : node.ownerDocument) === null || _a === void 0 ? void 0 : _a.defaultView;
    return (ownerWindow === null || ownerWindow === void 0 ? void 0 : ownerWindow.HTMLFormElement)
        || (typeof window !== "undefined" ? window.HTMLFormElement : undefined)
        || (typeof HTMLFormElement !== "undefined" ? HTMLFormElement : undefined);
}
function isFormElement(node, fallbackNode) {
    const FormElement = node ? getFormElementCtor(node) : getFormElementCtor(fallbackNode || null);
    return Boolean(node && FormElement && node instanceof FormElement);
}
function findFormElement(source) {
    var _a;
    const target = source && typeof source === "object" && ("currentTarget" in source || "target" in source)
        ? (source.currentTarget || source.target)
        : source || null;
    if (!getFormElementCtor(target))
        throw new Error("Ity.forms requires HTMLFormElement support");
    if (isFormElement(target, target))
        return target;
    const closest = (_a = target === null || target === void 0 ? void 0 : target.closest) === null || _a === void 0 ? void 0 : _a.call(target, "form");
    if (isFormElement(closest, target))
        return closest;
    throw new Error("Form submit requires a form event target");
}
function readControlValue(control) {
    return (control === null || control === void 0 ? void 0 : control.value) == null ? "" : String(control.value);
}
function clampIndex(index, min, max) {
    return Math.max(min, Math.min(max, index));
}
function createFormKit(initialValue, options = {}) {
    const values = signal(cloneValue(initialValue), { name: "formkit.values" });
    const initialValues = signal(cloneValue(initialValue), { name: "formkit.initial" });
    const errors = signal({}, { name: "formkit.errors" });
    const touched = signal({}, { name: "formkit.touched" });
    const validatingState = signal({}, { name: "formkit.validating" });
    const registeredBindings = new Map();
    const arrayKeys = new Map();
    const fieldCache = new Map();
    let validationGeneration = 0;
    const allKnownPaths = () => {
        const paths = new Set([
            ...Object.keys(options.validators || {}),
            ...Object.keys(touched.peek()),
            ...Array.from(registeredBindings.keys()),
            ...listFieldPaths(values.peek())
        ]);
        return Array.from(paths).filter(Boolean);
    };
    const markTouched = (paths) => {
        const next = { ...touched.peek() };
        for (const path of (paths === null || paths === void 0 ? void 0 : paths.length) ? paths : allKnownPaths()) {
            next[path] = true;
        }
        touched.set(next);
    };
    const setValue = (path, next) => {
        const previous = getIn(values.peek(), path);
        const resolved = typeof next === "function" ? next(previous) : next;
        values.set(setIn(values.peek(), path, resolved));
    };
    const syncArrayKeys = (path) => {
        const current = Array.isArray(getIn(values.peek(), path)) ? getIn(values.peek(), path) : [];
        const keySignal = arrayKeys.get(path) || signal([], { name: `${path}.keys` });
        const nextKeys = keySignal.peek().slice(0, current.length);
        while (nextKeys.length < current.length)
            nextKeys.push(createArrayKey());
        keySignal.set(nextKeys);
        arrayKeys.set(path, keySignal);
        return nextKeys;
    };
    const validate = async (paths) => {
        var _a;
        const generation = ++validationGeneration;
        const snapshot = cloneValue(values.peek());
        const nextErrors = { ...errors.peek() };
        const nextValidating = { ...validatingState.peek() };
        const selectedPaths = (paths === null || paths === void 0 ? void 0 : paths.length) ? Array.from(new Set(paths)) : allKnownPaths();
        await Promise.all(selectedPaths.map(async (path) => {
            var _a;
            delete nextErrors[path];
            const validator = (_a = options.validators) === null || _a === void 0 ? void 0 : _a[path];
            if (!validator)
                return;
            const value = getIn(snapshot, path);
            const result = validator(value, snapshot);
            if (result && typeof result.then === "function") {
                nextValidating[path] = true;
                validatingState.set({ ...nextValidating });
                const resolved = await result;
                if (generation !== validationGeneration)
                    return;
                if (resolved)
                    nextErrors[path] = resolved;
                delete nextValidating[path];
                validatingState.set({ ...nextValidating });
                return;
            }
            if (result)
                nextErrors[path] = result;
        }));
        const formErrors = await ((_a = options.validate) === null || _a === void 0 ? void 0 : _a.call(options, snapshot));
        if (generation !== validationGeneration)
            return false;
        for (const path of selectedPaths) {
            if (!nextErrors[path])
                delete nextErrors[path];
        }
        if (formErrors) {
            Object.assign(nextErrors, formErrors);
        }
        errors.set(nextErrors);
        validatingState.set({ ...nextValidating });
        return Object.keys(nextErrors).length === 0;
    };
    const bind = (path, bindOptions = {}) => {
        const field = api.field(path);
        const type = bindOptions.type || "text";
        const eventName = bindOptions.event
            || (type === "checkbox" || type === "radio" || type === "select" || type === "select-multiple" ? "change" : "input");
        const domName = bindOptions.name || path;
        const bindings = registeredBindings.get(path) || new Map();
        bindings.set(`${domName}|${type}|${String(bindOptions.value)}`, {
            domName,
            type,
            value: bindOptions.value,
            parse: bindOptions.parse
        });
        registeredBindings.set(path, bindings);
        const value = bindOptions.format ? bindOptions.format(field.value()) : field.value();
        const binding = {
            name: domName,
            [`@${eventName}`]: (event) => {
                var _a, _b;
                const target = (event.currentTarget || event.target);
                if (bindOptions.parse) {
                    field.set(bindOptions.parse(target, event));
                }
                else if (type === "checkbox") {
                    if (Array.isArray(field.value())) {
                        const optionValue = (_a = bindOptions.value) !== null && _a !== void 0 ? _a : target.value;
                        const current = field.value();
                        field.set((target.checked
                            ? Array.from(new Set([...current, optionValue]))
                            : current.filter((item) => !Object.is(item, optionValue))));
                    }
                    else {
                        field.set(Boolean(target.checked));
                    }
                }
                else if (type === "radio") {
                    if (target.checked)
                        field.set(((_b = bindOptions.value) !== null && _b !== void 0 ? _b : target.value));
                }
                else if (type === "select-multiple") {
                    field.set(Array.from(target.selectedOptions).map((option) => option.value));
                }
                else if (type === "number") {
                    field.set((target.value === "" ? undefined : Number(target.value)));
                }
                else {
                    field.set(target.value);
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
                binding[".checked"] = computed(() => field.value().some((item) => Object.is(item, optionValue)));
            }
            else {
                binding[".checked"] = computed(() => Boolean(field.value()));
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
            binding[".value"] = value;
            return binding;
        }
        const stringValue = value === undefined || value === null ? "" : String(value);
        binding[".value"] = stringValue;
        binding.value = stringValue;
        return binding;
    };
    const syncFromForm = (source) => {
        var _a, _b, _c;
        let formElement;
        try {
            formElement = findFormElement(source);
        }
        catch (_error) {
            return;
        }
        const controls = Array.from(formElement.elements || []);
        let nextValues = values.peek();
        for (const [path, bindings] of registeredBindings) {
            const registered = Array.from(bindings.values());
            const primary = registered[0];
            if (!primary)
                continue;
            const domName = primary.domName;
            const namedControls = controls.filter((control) => control && control.name === domName);
            let nextValue;
            if (primary.parse && namedControls.length) {
                nextValue = primary.parse(namedControls[0], source);
            }
            else if (primary.type === "checkbox") {
                const current = getIn(nextValues, path);
                if (Array.isArray(current) || registered.some((entry) => entry.value !== undefined) || namedControls.length > 1) {
                    nextValue = namedControls
                        .filter((control) => control.checked)
                        .map((control) => { var _a, _b; return (_b = (_a = registered.find((entry) => { var _a; return String((_a = entry.value) !== null && _a !== void 0 ? _a : readControlValue(control)) === readControlValue(control); })) === null || _a === void 0 ? void 0 : _a.value) !== null && _b !== void 0 ? _b : readControlValue(control); });
                }
                else {
                    nextValue = Boolean((_a = namedControls[0]) === null || _a === void 0 ? void 0 : _a.checked);
                }
            }
            else if (primary.type === "radio") {
                const checkedControl = namedControls.find((control) => control.checked);
                nextValue = checkedControl
                    ? (_c = (_b = registered.find((entry) => { var _a; return String((_a = entry.value) !== null && _a !== void 0 ? _a : readControlValue(checkedControl)) === readControlValue(checkedControl); })) === null || _b === void 0 ? void 0 : _b.value) !== null && _c !== void 0 ? _c : readControlValue(checkedControl)
                    : getIn(nextValues, path);
            }
            else if (primary.type === "select-multiple") {
                const select = namedControls[0];
                nextValue = (select === null || select === void 0 ? void 0 : select.selectedOptions)
                    ? Array.from(select.selectedOptions).map((option) => option.value)
                    : [];
            }
            else if (primary.type === "number") {
                const raw = readControlValue(namedControls[0]);
                nextValue = raw === "" ? undefined : Number(raw);
            }
            else {
                nextValue = readControlValue(namedControls[0]);
            }
            nextValues = setIn(nextValues, path, nextValue);
        }
        values.set(nextValues);
    };
    const api = {
        values,
        initialValues: computed(() => initialValues()),
        errors: computed(() => errors()),
        touched: computed(() => touched()),
        validating: computed(() => Object.keys(validatingState()).length > 0),
        dirty: computed(() => !deepEqual(values(), initialValues())),
        valid: computed(() => Object.keys(errors()).length === 0 && Object.keys(validatingState()).length === 0),
        field(path) {
            if (fieldCache.has(path))
                return fieldCache.get(path);
            const valueSignal = function (next) {
                if (arguments.length === 0)
                    return getIn(values(), path);
                const previous = getIn(values.peek(), path);
                const resolved = typeof next === "function" ? next(previous) : next;
                values.set(setIn(values.peek(), path, resolved));
                return resolved;
            };
            valueSignal.get = () => getIn(values(), path);
            valueSignal.peek = () => getIn(values.peek(), path);
            valueSignal.set = (next) => valueSignal(next);
            valueSignal.update = (updater) => valueSignal(updater);
            valueSignal.subscribe = (callback, optionsForSubscribe = {}) => {
                let first = true;
                let previous = valueSignal.peek();
                return effect(() => {
                    const current = valueSignal();
                    if (first) {
                        first = false;
                        if (optionsForSubscribe.immediate)
                            callback(current, current);
                        previous = current;
                        return;
                    }
                    callback(current, previous);
                    previous = current;
                });
            };
            Object.defineProperty(valueSignal, "isSignal", { value: true });
            const field = {
                value: valueSignal,
                error: computed(() => errors()[path] || null),
                touched: computed(() => Boolean(touched()[path])),
                dirty: computed(() => !deepEqual(getIn(values(), path), getIn(initialValues(), path))),
                validating: computed(() => Boolean(validatingState()[path])),
                bind(optionsForField) {
                    return bind(path, optionsForField);
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
            fieldCache.set(path, field);
            return field;
        },
        bind,
        array(path) {
            return {
                items: computed(() => getIn(values(), path) || []),
                keys: computed(() => {
                    values();
                    return syncArrayKeys(path);
                }),
                push(value) {
                    const current = (getIn(values.peek(), path) || []).slice();
                    current.push(value);
                    values.set(setIn(values.peek(), path, current));
                    syncArrayKeys(path);
                },
                insert(index, value) {
                    const current = (getIn(values.peek(), path) || []).slice();
                    const safeIndex = clampIndex(index, 0, current.length);
                    current.splice(safeIndex, 0, value);
                    values.set(setIn(values.peek(), path, current));
                    const keys = syncArrayKeys(path);
                    const inserted = keys.pop() || createArrayKey();
                    keys.splice(safeIndex, 0, inserted);
                    arrayKeys.get(path).set(keys);
                },
                remove(index) {
                    const current = (getIn(values.peek(), path) || []).slice();
                    if (index < 0 || index >= current.length)
                        return;
                    current.splice(index, 1);
                    values.set(setIn(values.peek(), path, current));
                    const keys = syncArrayKeys(path);
                    keys.splice(index, 1);
                    arrayKeys.get(path).set(keys);
                },
                move(from, to) {
                    const current = (getIn(values.peek(), path) || []).slice();
                    if (from < 0 || from >= current.length)
                        return;
                    const [item] = current.splice(from, 1);
                    const safeTo = clampIndex(to, 0, current.length);
                    current.splice(safeTo, 0, item);
                    values.set(setIn(values.peek(), path, current));
                    const keys = syncArrayKeys(path);
                    const [key] = keys.splice(from, 1);
                    keys.splice(safeTo, 0, key);
                    arrayKeys.get(path).set(keys);
                },
                replace(next) {
                    values.set(setIn(values.peek(), path, next.slice()));
                    const keySignal = arrayKeys.get(path) || signal([], { name: `${path}.keys` });
                    keySignal.set(next.map(() => createArrayKey()));
                    arrayKeys.set(path, keySignal);
                }
            };
        },
        set(path, next) {
            setValue(path, next);
        },
        patch(next) {
            const patch = typeof next === "function" ? next(values.peek()) : next;
            if (!patch)
                return;
            values.set({ ...values.peek(), ...patch });
        },
        reset(next) {
            const base = cloneValue(next ? { ...initialValues.peek(), ...next } : initialValues.peek());
            initialValues.set(cloneValue(base));
            values.set(base);
            errors.set({});
            touched.set({});
            validatingState.set({});
        },
        sync(source) {
            syncFromForm(source);
        },
        validate,
        markTouched,
        submit(handler, submitOptions = {}) {
            const submitAction = action(handler, submitOptions);
            const onSubmit = async (event) => {
                event.preventDefault();
                api.sync(event);
                markTouched();
                if (!await validate())
                    return undefined;
                const result = await submitAction(cloneValue(values.peek()), event);
                if (submitOptions.resetOnSuccess)
                    api.reset();
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
                    api.reset();
                }
            };
        }
    };
    return api;
}

export { createFormKit };
//# sourceMappingURL=forms.esm.mjs.map
