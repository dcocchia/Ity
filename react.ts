import {
  createElement,
  forwardRef,
  useLayoutEffect,
  useRef,
  type ForwardRefExoticComponent,
  type HTMLAttributes,
  type MutableRefObject,
  type Ref,
  type RefAttributes
} from "react";

export interface ReactWrapperOptions {
  displayName?: string;
  events?: Record<string, string>;
}

function isPrimitive(value: unknown): boolean {
  return value == null || typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

function mergeRefs<T>(...refs: Array<Ref<T> | undefined>): (value: T | null) => void {
  return (value) => {
    for (const ref of refs) {
      if (!ref) continue;
      if (typeof ref === "function") {
        ref(value);
      } else {
        (ref as MutableRefObject<T | null>).current = value;
      }
    }
  };
}

export function wrapCustomElement<TElement extends HTMLElement = HTMLElement>(
  tagName: string,
  options: ReactWrapperOptions = {}
): ForwardRefExoticComponent<HTMLAttributes<TElement> & Record<string, any> & RefAttributes<TElement>> {
  const Wrapped = forwardRef<TElement, HTMLAttributes<TElement> & Record<string, any>>((props, forwardedRef) => {
    const localRef = useRef<TElement | null>(null);
    const previousPropertyNames = useRef<Set<string>>(new Set());
    const previousBooleanAttributes = useRef<Set<string>>(new Set());
    const {
      children,
      style,
      className,
      dangerouslySetInnerHTML,
      ...rest
    } = props;

    const elementProps: Record<string, unknown> = {};
    const attributeProps: Record<string, unknown> = {};
    const booleanAttributes: Record<string, boolean> = {};
    const eventProps = new Map<string, EventListener>();

    Object.keys(rest).forEach((key) => {
      const value = (rest as Record<string, unknown>)[key];
      const explicitEvent = options.events?.[key];
      if (explicitEvent && typeof value === "function") {
        eventProps.set(explicitEvent, value as EventListener);
        return;
      }
      if (/^on[A-Z]/.test(key) && typeof value === "function") {
        eventProps.set(key.slice(2).toLowerCase(), value as EventListener);
        return;
      }
      if (typeof value === "boolean") {
        const attributeName = key === "className" ? "class" : key;
        if (/^(aria-|data-)/.test(attributeName)) {
          attributeProps[attributeName] = value;
        } else {
          elementProps[key] = value;
          booleanAttributes[attributeName] = value;
        }
        return;
      }
      if (isPrimitive(value)) {
        attributeProps[key === "className" ? "class" : key] = value;
      } else {
        elementProps[key] = value;
      }
    });

    useLayoutEffect(() => {
      const element = localRef.current;
      if (!element) return undefined;
      const nextPropertyNames = new Set(Object.keys(elementProps));
      for (const key of Array.from(previousPropertyNames.current)) {
        if (nextPropertyNames.has(key)) continue;
        try {
          (element as any)[key] = undefined;
        } catch (_error) {
          // Ignore non-writable host properties.
        }
      }
      Object.keys(elementProps).forEach((key) => {
        (element as any)[key] = elementProps[key];
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
      const cleanups: Array<() => void> = [];
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
