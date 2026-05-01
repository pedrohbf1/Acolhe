/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback } from "react";
import { useForm } from "react-hook-form";
import type { UseFormProps, Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ZodType, input as ZodInput, output as ZodOutput } from "zod";

export function useZodForm<T extends ZodType<Record<string, any>, any>>(
  schema: T,
  options?: Omit<UseFormProps<ZodInput<T>, any, ZodOutput<T>>, "resolver">
) {
  const form = useForm<ZodInput<T>, any, ZodOutput<T>>({
    resolver: zodResolver(schema) as any,
    ...options,
  });

  const onKeyDown = useCallback(
    async (e: React.KeyboardEvent<HTMLFormElement>) => {
      if (e.key !== "Enter" && e.key !== "Tab") return;

      const target = e.target as HTMLElement;
      if (!target.matches("input, textarea")) return;
      // Ignora eventos vindos de portais (modais) fora do form no DOM
      if (!e.currentTarget.contains(target)) return;

      // Para o evento nativo completamente — impede que suba para forms pai mesmo via portal
      e.nativeEvent.stopImmediatePropagation();
      e.stopPropagation();
      e.preventDefault();

      const formEl = e.currentTarget;
      const isBackward = e.shiftKey;

      // Voltando: só move sem validar
      if (isBackward) {
        const focusable = Array.from(
          formEl.querySelectorAll<HTMLElement>(
            "input:not([disabled]):not([tabindex='-1']):not([type='hidden']), textarea:not([disabled]):not([tabindex='-1']), select:not([disabled]):not([tabindex='-1']), button:not([disabled]):not([tabindex='-1'])"
          )
        );
        focusable[focusable.indexOf(target) - 1]?.focus();
        return;
      }

      // Avançando: valida antes de mover (apenas campos com name no schema)
      const fieldName = (target as HTMLInputElement).name as Path<ZodInput<T>>;
      if (fieldName) {
        const isValid = await form.trigger(fieldName);
        if (!isValid) return;
      }

      const focusable = Array.from(
        formEl.querySelectorAll<HTMLElement>(
          "input:not([disabled]):not([tabindex='-1']):not([type='hidden']), textarea:not([disabled]):not([tabindex='-1']), select:not([disabled]):not([tabindex='-1']), button:not([disabled]):not([tabindex='-1'])"
        )
      );

      focusable[focusable.indexOf(target) + 1]?.focus();
    },
    [form]
  );

  const formProps = (onSubmit: (data: ZodOutput<T>) => void) => ({
    onSubmit: form.handleSubmit(onSubmit),
    onKeyDown,
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { handleSubmit: _handleSubmit, ...rest } = form;

  return { ...rest, formProps };
}
