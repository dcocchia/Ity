import { type ForwardRefExoticComponent, type HTMLAttributes, type RefAttributes } from "react";
export interface ReactWrapperOptions {
    displayName?: string;
    events?: Record<string, string>;
}
export declare function wrapCustomElement<TElement extends HTMLElement = HTMLElement>(tagName: string, options?: ReactWrapperOptions): ForwardRefExoticComponent<HTMLAttributes<TElement> & Record<string, any> & RefAttributes<TElement>>;
