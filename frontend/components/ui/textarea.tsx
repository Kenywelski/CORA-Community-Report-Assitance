import * as React from "react";

import { cn } from "@/lib/utils";

const MAX_AUTO_RESIZE_HEIGHT = 320;

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  autoResize?: boolean;
};

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ autoResize = true, className, onInput, value, defaultValue, ...props }, forwardedRef) => {
    const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

    const setTextareaRef = React.useCallback(
      (element: HTMLTextAreaElement | null) => {
        textareaRef.current = element;
        if (typeof forwardedRef === "function") {
          forwardedRef(element);
        } else if (forwardedRef) {
          forwardedRef.current = element;
        }
      },
      [forwardedRef],
    );

    const resizeTextarea = React.useCallback(() => {
      const element = textareaRef.current;
      if (!autoResize || !element) return;

      element.style.height = "auto";
      const styles = window.getComputedStyle(element);
      const borderHeight =
        Number.parseFloat(styles.borderTopWidth) +
        Number.parseFloat(styles.borderBottomWidth);
      const contentHeight = element.scrollHeight + borderHeight;
      element.style.height = `${Math.min(contentHeight, MAX_AUTO_RESIZE_HEIGHT)}px`;
      element.style.overflowY =
        contentHeight > MAX_AUTO_RESIZE_HEIGHT ? "auto" : "hidden";
    }, [autoResize]);

    React.useLayoutEffect(() => {
      resizeTextarea();
    }, [resizeTextarea, value, defaultValue]);

    const handleInput = (event: React.FormEvent<HTMLTextAreaElement>) => {
      resizeTextarea();
      onInput?.(event);
    };

    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          autoResize && "resize-none",
          className,
        )}
        ref={setTextareaRef}
        onInput={handleInput}
        value={value}
        defaultValue={defaultValue}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
