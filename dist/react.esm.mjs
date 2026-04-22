import { forwardRef, useRef, useLayoutEffect, createElement } from 'react';

function isPrimitive(value) {
    return value == null || typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}
function mergeRefs(...refs) {
    return (value) => {
        for (const ref of refs) {
            if (!ref)
                continue;
            if (typeof ref === "function") {
                ref(value);
            }
            else {
                ref.current = value;
            }
        }
    };
}
function wrapCustomElement(tagName, options = {}) {
    const Wrapped = forwardRef((props, forwardedRef) => {
        const localRef = useRef(null);
        const previousPropertyNames = useRef(new Set());
        const previousBooleanAttributes = useRef(new Set());
        const { children, style, className, dangerouslySetInnerHTML, ...rest } = props;
        const elementProps = {};
        const attributeProps = {};
        const booleanAttributes = {};
        const eventProps = new Map();
        Object.keys(rest).forEach((key) => {
            var _a;
            const value = rest[key];
            const explicitEvent = (_a = options.events) === null || _a === void 0 ? void 0 : _a[key];
            if (explicitEvent && typeof value === "function") {
                eventProps.set(explicitEvent, value);
                return;
            }
            if (/^on[A-Z]/.test(key) && typeof value === "function") {
                eventProps.set(key.slice(2).toLowerCase(), value);
                return;
            }
            if (typeof value === "boolean") {
                const attributeName = key === "className" ? "class" : key;
                if (/^(aria-|data-)/.test(attributeName)) {
                    attributeProps[attributeName] = value;
                }
                else {
                    elementProps[key] = value;
                    booleanAttributes[attributeName] = value;
                }
                return;
            }
            if (isPrimitive(value)) {
                attributeProps[key === "className" ? "class" : key] = value;
            }
            else {
                elementProps[key] = value;
            }
        });
        useLayoutEffect(() => {
            const element = localRef.current;
            if (!element)
                return undefined;
            const nextPropertyNames = new Set(Object.keys(elementProps));
            for (const key of Array.from(previousPropertyNames.current)) {
                if (nextPropertyNames.has(key))
                    continue;
                try {
                    element[key] = undefined;
                }
                catch (_error) {
                    // Ignore non-writable host properties.
                }
            }
            Object.keys(elementProps).forEach((key) => {
                element[key] = elementProps[key];
            });
            previousPropertyNames.current = nextPropertyNames;
            const nextBooleanAttributes = new Set(Object.keys(booleanAttributes));
            for (const attributeName of Array.from(previousBooleanAttributes.current)) {
                if (!nextBooleanAttributes.has(attributeName)) {
                    element.removeAttribute(attributeName);
                }
            }
            Object.keys(booleanAttributes).forEach((attributeName) => {
                element.toggleAttribute(attributeName, booleanAttributes[attributeName]);
            });
            previousBooleanAttributes.current = nextBooleanAttributes;
            const cleanups = [];
            for (const [eventName, listener] of eventProps) {
                element.addEventListener(eventName, listener);
                cleanups.push(() => element.removeEventListener(eventName, listener));
            }
            return () => {
                cleanups.forEach((cleanup) => cleanup());
            };
        });
        return createElement(tagName, {
            ...attributeProps,
            className,
            style,
            dangerouslySetInnerHTML,
            ref: mergeRefs(localRef, forwardedRef)
        }, children);
    });
    Wrapped.displayName = options.displayName || `Ity(${tagName})`;
    return Wrapped;
}

export { wrapCustomElement };
//# sourceMappingURL=react.esm.mjs.map
