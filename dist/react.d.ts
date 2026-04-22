import { ForwardRefExoticComponent, HTMLAttributes, RefAttributes } from 'react';

interface ReactWrapperOptions {
    displayName?: string;
    events?: Record<string, string>;
}
declare function wrapCustomElement<TElement extends HTMLElement = HTMLElement>(tagName: string, options?: ReactWrapperOptions): ForwardRefExoticComponent<HTMLAttributes<TElement> & Record<string, any> & RefAttributes<TElement>>;

export { wrapCustomElement };
export type { ReactWrapperOptions };
