import {
  Eye,
  EyeOff,
  ChevronDownIcon,
  PlusIcon,
  CheckIcon,
  Loader2Icon,
} from "lucide-react";
import {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
  useId,
} from "react";
import { createPortal } from "react-dom";
import type { ChangeEvent, KeyboardEvent } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";
import { applyMask, type MaskType } from "@/utils/formatedInput";

// ─── Select types ──────────────────────────────────────────────────────────────

type RawOption = string | { value: string; label: string };

interface NormalOption {
  value: string;
  label: string;
}

function normalize(o: RawOption): NormalOption {
  return typeof o === "string" ? { value: o, label: o } : o;
}

export interface SelectConfig {
  options: RawOption[];
  /** Current form value — pass watch("field") here */
  value: string;
  /** Called when the user commits a selection — pass (v) => setValue("field", v) */
  onChange: (value: string) => void;
  /**
   * When present, the "+ Criar" button appears for unmatched text.
   * onRequest is called with the typed value so the parent can open a
   * creation modal/sheet. After creation, call onChange with the new value.
   */
  creatable?: {
    onRequest: (typedValue: string) => void;
  };
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  title: string;
  required?: boolean;
  mask?: MaskType;
  inputSubmit?: boolean;
  className?: {
    classNameInput?: string;
    classNameLabel?: string;
    classNameContainer?: string;
  };
  type?: "password" | "textarea";
  inputConfig?: React.InputHTMLAttributes<HTMLInputElement> &
    React.TextareaHTMLAttributes<HTMLTextAreaElement>;
  register: UseFormRegisterReturn;
  error?: string;
  select?: SelectConfig;
  loading?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Input({
  title,
  className,
  inputConfig,
  required,
  type,
  mask,
  inputSubmit,
  register,
  error,
  select,
  loading,
}: Props) {
  const [showPassword, setShowPassword] = useState(false);
  const inputId = useId();

  // ── select state ────────────────────────────────────────────────────────────
  const [dropOpen, setDropOpen] = useState(false);
  const [dropIndex, setDropIndex] = useState(-1);
  const [filterText, setFilterText] = useState("");
  const [dropPos, setDropPos] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  const lastCommitted = useRef(select?.value ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  const opts = useMemo(
    () => (select ? select.options.map(normalize) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(select?.options)],
  );

  // find label for a value
  const labelFor = useCallback(
    (val: string) => opts.find((o) => o.value === val)?.label ?? val,
    [opts],
  );

  // sync external value changes (e.g. form reset)
  const selectValue = select?.value;
  useEffect(() => {
    if (selectValue !== undefined) {
      lastCommitted.current = selectValue;
      if (!dropOpen) setFilterText(labelFor(selectValue));
    }
  }, [selectValue, dropOpen, labelFor]);

  const filtered = opts.filter((o) =>
    o.label.toLowerCase().includes(filterText.toLowerCase()),
  );
  const exactMatch = opts.some(
    (o) => o.label.toLowerCase() === filterText.trim().toLowerCase(),
  );
  const showCreate =
    select?.creatable != null && filterText.trim().length > 0 && !exactMatch;
  const totalDrop = filtered.length + (showCreate ? 1 : 0);

  const openDrop = useCallback(() => {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    setDropPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    setFilterText(labelFor(lastCommitted.current));
    setDropOpen(true);
    setDropIndex(-1);
  }, [labelFor]);

  const closeDrop = useCallback(
    (commit: boolean, opt?: NormalOption) => {
      if (commit && opt) {
        lastCommitted.current = opt.value;
        select?.onChange(opt.value);
        setFilterText(opt.label);
      } else {
        setFilterText(labelFor(lastCommitted.current));
      }
      setDropOpen(false);
      setDropIndex(-1);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [select?.onChange, labelFor],
  );

  const pickOption = useCallback(
    (opt: NormalOption) => closeDrop(true, opt),
    [closeDrop],
  );

  // close on outside click
  useEffect(() => {
    if (!dropOpen) return;
    const handler = (e: MouseEvent) => {
      if (inputRef.current?.contains(e.target as Node)) return;
      closeDrop(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dropOpen, closeDrop]);

  // merge RHF ref with our ref
  const mergedRef = useCallback(
    (node: HTMLInputElement | null) => {
      (inputRef as React.RefObject<HTMLInputElement | null>).current = node;
      const { ref } = register;
      if (typeof ref === "function") ref(node);
      else if (ref)
        (ref as React.RefObject<HTMLInputElement | null>).current = node;
    },
    [register],
  );

  // ── handlers ────────────────────────────────────────────────────────────────

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (select) {
      setFilterText(e.target.value);
      setDropIndex(-1);
      if (!dropOpen) {
        const rect = inputRef.current?.getBoundingClientRect();
        if (rect)
          setDropPos({
            top: rect.bottom + 4,
            left: rect.left,
            width: rect.width,
          });
        setDropOpen(true);
      }
      return;
    }
    if (mask) e.target.value = applyMask(e.target.value, mask);
    register.onChange(e);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    inputConfig?.onKeyDown?.(e as React.KeyboardEvent<HTMLInputElement & HTMLTextAreaElement>);
    if (select) {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          if (!dropOpen) {
            openDrop();
            return;
          }
          setDropIndex((i) => Math.min(i + 1, totalDrop - 1));
          return;

        case "ArrowUp":
          e.preventDefault();
          setDropIndex((i) => Math.max(i - 1, -1));
          return;

        case "Enter": {
          e.preventDefault();
          e.stopPropagation();
          if (!dropOpen) {
            openDrop();
            return;
          }
          if (dropIndex >= 0 && dropIndex < filtered.length) {
            pickOption(filtered[dropIndex]);
          } else if (showCreate && dropIndex === filtered.length) {
            closeDrop(false);
            select!.creatable!.onRequest(filterText.trim());
          } else if (filtered.length === 1) {
            pickOption(filtered[0]);
          } else if (showCreate) {
            closeDrop(false);
            select!.creatable!.onRequest(filterText.trim());
          } else {
            closeDrop(false);
          }
          return;
        }

        case "Escape":
          closeDrop(false);
          return;

        case "Tab":
          if (dropOpen) {
            if (dropIndex >= 0 && dropIndex < filtered.length) {
              pickOption(filtered[dropIndex]);
            } else if (filtered.length === 1) {
              pickOption(filtered[0]);
            } else {
              closeDrop(false);
            }
          }
          return; // let Tab propagate to move focus
      }
      return;
    }

    // original inputSubmit behaviour
    if (!inputSubmit) return;
    if ((e.key === "Enter" || e.key === "Tab") && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.closest("form")?.requestSubmit();
    }
  };

  // ── dropdown portal ─────────────────────────────────────────────────────────

  const dropdown =
    select && dropOpen && dropPos
      ? createPortal(
          <div
            style={{
              position: "fixed",
              top: dropPos.top,
              left: dropPos.left,
              width: dropPos.width,
              zIndex: 9999,
            }}
            className="bg-popover border border-border rounded-lg shadow-lg overflow-hidden"
          >
            {filtered.length === 0 && !showCreate && (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                Nenhuma opção
              </div>
            )}
            {filtered.map((opt, i) => (
              <button
                key={opt.value}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  pickOption(opt);
                }}
                className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between transition-colors hover:bg-muted ${
                  i === dropIndex ? "bg-muted" : ""
                } ${
                  (select?.value ?? lastCommitted.current) === opt.value
                    ? "text-primary font-medium"
                    : ""
                }`}
              >
                {opt.label}
                {(select?.value ?? lastCommitted.current) === opt.value && (
                  <CheckIcon size={13} />
                )}
              </button>
            ))}
            {showCreate && (
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  closeDrop(false);
                  select!.creatable!.onRequest(filterText.trim());
                }}
                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 text-primary border-t border-border transition-colors hover:bg-muted ${
                  dropIndex === filtered.length ? "bg-muted" : ""
                }`}
              >
                <PlusIcon size={13} />
                Criar &ldquo;{filterText.trim()}&rdquo;
              </button>
            )}
          </div>,
          document.body,
        )
      : null;

  // ── render ──────────────────────────────────────────────────────────────────

  const containerCls = `w-full flex flex-col-reverse ${className?.classNameContainer ?? ""}`;

  return (
    <div className={containerCls}>
      {error && <span className="text-red-500 text-xs">{error}</span>}

      {/* ── select input ── */}
      {select ? (
        <div className="relative">
          <input
            id={inputId}
            name={register.name}
            ref={mergedRef}
            value={filterText}
            placeholder=" "
            autoComplete="off"
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onClick={openDrop}
            className={`peer w-full border border-border rounded-lg p-3 pr-9 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary ${className?.classNameInput ?? ""}`}
          />
          {loading ? (
            <Loader2Icon
              size={14}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground animate-spin pointer-events-none"
            />
          ) : (
            <ChevronDownIcon
              size={14}
              className={`absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none transition-transform duration-150 ${
                dropOpen ? "rotate-180" : ""
              }`}
            />
          )}
          {dropdown}
        </div>
      ) : type === "textarea" ? (
        <textarea
          {...register}
          {...inputConfig}
          rows={3}
          placeholder=" "
          className={`peer w-full border border-border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary ${className?.classNameInput ?? ""}`}
        />
      ) : (
        <div className="relative">
          <input
            {...register}
            {...inputConfig}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            type={
              type === "password"
                ? showPassword
                  ? "text"
                  : "password"
                : "text"
            }
            id={inputId}
            placeholder=" "
            className={`peer w-full border border-border rounded-lg p-3 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary ${className?.classNameInput ?? ""} ${type === "password" || loading ? "pr-10" : ""}`}
          />
          {loading ? (
            <Loader2Icon
              size={16}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground animate-spin pointer-events-none"
            />
          ) : type === "password" ? (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 cursor-pointer top-1/2 -translate-y-1/2 text-gray-400"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          ) : null}
        </div>
      )}

      <label
        htmlFor={inputId}
        className={`gap-1 flex text-muted-foreground w-fit rounded-sm text-sm transition-all peer-focus:text-primary ${className?.classNameLabel ?? ""}`}
      >
        {required && <span className="text-primary">*</span>}
        {title}
      </label>
    </div>
  );
}
