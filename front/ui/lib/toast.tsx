"use client";

/**
 * Toast facade.
 *
 * The store underneath (`hooks/use-toast.ts`) is shadcn's Radix reducer and
 * speaks `variant`. This module is the API the rest of the app uses, shaped
 * like Base UI's toast: `toast.add`, `toast.close`, `toast.update`,
 * `toast.promise`, with a `type` instead of a `variant`.
 *
 * Kept separate from the store on purpose — one file owns state, this owns the
 * vocabulary.
 */

import type { ReactNode } from "react";
import {
  ToastAction,
  type ToastProps,
} from "@/components/ui/toast";
import { toast as storeToast } from "@/hooks/use-toast";

/** Status hint. Drives the visual variant; `info`/`loading` render neutral. */
export type ToastType = "success" | "info" | "warning" | "error" | "loading";

export interface ToastActionProps {
  children: ReactNode;
  onClick?: () => void;
}

export interface ToastInput {
  title?: ReactNode;
  description?: ReactNode;
  type?: ToastType;
  /** Rendered as a button on the toast. */
  actionProps?: ToastActionProps;
  /** Radix auto-dismiss delay in ms; omit for the component default. */
  duration?: number;
}

/** `type` -> shadcn variant. Error keeps `destructive` for colour contrast. */
function variantFor(type: ToastType | undefined) {
  switch (type) {
    case "success":
      return "success" as const;
    case "warning":
      return "warning" as const;
    case "error":
      return "destructive" as const;
    default:
      return "default" as const;
  }
}

function buildAction(actionProps: ToastActionProps | undefined) {
  if (!actionProps) return undefined;
  return (
    <ToastAction altText="Ação" onClick={actionProps.onClick}>
      {actionProps.children}
    </ToastAction>
  );
}

export interface ToastHandle {
  id: string;
  close: () => void;
  update: (input: Partial<ToastInput>) => void;
}

/**
 * Live handles by id, so `toast.close(id)` / `toast.update(id, …)` can reach a
 * toast created earlier — e.g. from a callback that no longer has the handle.
 * Entries are dropped when the toast is closed.
 */
const handles = new Map<string, ReturnType<typeof storeToast>>();

export const toast = {
  add(input: ToastInput): ToastHandle {
    const { type, actionProps, duration, ...rest } = input;
    const handle = storeToast({
      ...rest,
      variant: variantFor(type),
      action: buildAction(actionProps),
      ...(duration != null ? { duration } : {}),
    } as ToastProps);

    handles.set(handle.id, handle);

    const update = (next: Partial<ToastInput>) => {
      handle.update({
        ...(next.title != null ? { title: next.title } : {}),
        ...(next.description != null ? { description: next.description } : {}),
        ...(next.type != null ? { variant: variantFor(next.type) } : {}),
        ...(next.actionProps != null ? { action: buildAction(next.actionProps) } : {}),
        ...(next.duration != null ? { duration: next.duration } : {}),
      } as Partial<ToastProps>);
    };

    const close = () => {
      handle.dismiss();
      handles.delete(handle.id);
    };

    return { id: handle.id, close, update };
  },

  close(id: string): void {
    const handle = handles.get(id);
    if (!handle) return;
    handle.dismiss();
    handles.delete(id);
  },

  update(id: string, input: Partial<ToastInput>): void {
    const handle = handles.get(id);
    if (!handle) return;
    handle.update({
      ...(input.title != null ? { title: input.title } : {}),
      ...(input.description != null ? { description: input.description } : {}),
      ...(input.type != null ? { variant: variantFor(input.type) } : {}),
      ...(input.actionProps != null ? { action: buildAction(input.actionProps) } : {}),
    } as Partial<ToastProps>);
  },

  /**
   * Drive one toast through loading -> success | error as `work` settles.
   *
   * `success`/`error` may be a string or a function of the resolved value (or
   * the thrown error) for messages that depend on the result.
   */
  promise<T>(
    work: Promise<T>,
    options: {
      loading: ToastInput;
      success: string | ((value: T) => string);
      error: string | ((error: unknown) => string);
      type?: ToastType;
      onSuccess?: (value: T) => void;
      onError?: (error: unknown) => void;
    },
  ): Promise<T> {
    const handle = toast.add({ ...options.loading, type: "loading" });

    return work.then(
      (value) => {
        const description =
          typeof options.success === "function" ? options.success(value) : options.success;
        handle.update({ description, type: options.type ?? "success" });
        options.onSuccess?.(value);
        return value;
      },
      (error: unknown) => {
        const description =
          typeof options.error === "function" ? options.error(error) : options.error;
        handle.update({ description, type: "error" });
        options.onError?.(error);
        throw error;
      },
    );
  },
};

/** Extracts a human-readable message from anything thrown. */
export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Algo deu errado";
}