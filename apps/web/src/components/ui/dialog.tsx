import * as React from "react";
import ReactDOM from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { XIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Global z-index stack — one slot per open dialog
// ---------------------------------------------------------------------------
const _openDialogs = new Map<number, number>();
const _escHandlers  = new Map<number, () => void>();
let _idCounter = 0;

function allocateDepth(id: number): number {
  if (_openDialogs.has(id)) return _openDialogs.get(id)!;
  const next =
    _openDialogs.size > 0 ? Math.max(..._openDialogs.values()) + 1 : 1;
  _openDialogs.set(id, next);
  return next;
}

function releaseDepth(id: number) {
  _openDialogs.delete(id);
  _escHandlers.delete(id);
}

// Único listener global de ESC — fecha apenas o modal do topo
function _handleGlobalEsc(e: KeyboardEvent) {
  if (e.key !== "Escape" || _escHandlers.size === 0) return;
  let topId = -1, topDepth = -1;
  for (const [id, depth] of _openDialogs) {
    if (_escHandlers.has(id) && depth > topDepth) {
      topDepth = depth;
      topId = id;
    }
  }
  if (topId !== -1) {
    e.stopImmediatePropagation();
    _escHandlers.get(topId)?.();
  }
}
document.addEventListener("keydown", _handleGlobalEsc, true);

// ---------------------------------------------------------------------------
// DialogContext — shares open state and close handler with children
// ---------------------------------------------------------------------------
interface DialogCtx {
  id: number;
  open: boolean;
  onClose: () => void;
  depth: number;
}

const DialogContext = React.createContext<DialogCtx>({
  id: 0,
  open: false,
  onClose: () => {},
  depth: 1,
});

// ---------------------------------------------------------------------------
// Dialog root
// ---------------------------------------------------------------------------
interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

function Dialog({ open, onOpenChange, children }: DialogProps) {
  const idRef = React.useRef<number>(++_idCounter);

  // Compute depth synchronously during render (before first paint)
  let depth = 0;
  if (open) {
    depth = allocateDepth(idRef.current);
  } else {
    releaseDepth(idRef.current);
  }

  // Cleanup on unmount
  React.useEffect(() => {
    const id = idRef.current;
    return () => releaseDepth(id);
  }, []);

  return (
    <DialogContext.Provider
      value={{ id: idRef.current, open, onClose: () => onOpenChange(false), depth }}
    >
      {children}
    </DialogContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// DialogTrigger
// ---------------------------------------------------------------------------
interface DialogTriggerProps {
  children: React.ReactElement;
  asChild?: boolean;
}

function DialogTrigger({ children }: DialogTriggerProps) {
  const { onClose, open } = React.useContext(DialogContext);
  void onClose; // trigger just toggles via parent; kept for composability
  void open;
  return children;
}

// ---------------------------------------------------------------------------
// DialogContent — portal + overlay + popup
// ---------------------------------------------------------------------------
interface DialogContentProps {
  children: React.ReactNode;
  className?: string;
  overlayClassName?: string;
  showCloseButton?: boolean;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
}

const FOCUSABLE = [
  'input:not([disabled]):not([type="hidden"])',
  "textarea:not([disabled])",
  "select:not([disabled])",
  "button:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

function DialogContent({
  children,
  className,
  overlayClassName,
  showCloseButton = true,
  onClick,
}: DialogContentProps) {
  const { id, open, onClose, depth } = React.useContext(DialogContext);
  const popupRef = React.useRef<HTMLDivElement>(null);

  const overlayZ = 40 + depth * 20 - 1;
  const popupZ = 40 + depth * 20;

  // Registra/remove este modal no mapa global de ESC
  React.useEffect(() => {
    if (open) {
      _escHandlers.set(id, onClose);
    } else {
      _escHandlers.delete(id);
    }
    return () => { _escHandlers.delete(id); };
  }, [id, open, onClose]);

  // Body scroll lock
  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Auto-focus first visible input on open (skips hidden/file inputs)
  React.useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => {
      const popup = popupRef.current;
      if (!popup) return;
      const candidates = popup.querySelectorAll<HTMLElement>(
        'input:not([disabled]):not([type="hidden"]):not([type="file"]), textarea:not([disabled])',
      );
      const first = Array.from(candidates).find((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
      (first ?? popup.querySelector<HTMLElement>(FOCUSABLE))?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [open]);

  return ReactDOM.createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Overlay */}
          <motion.div
            key="overlay"
            style={{ zIndex: overlayZ }}
            className={cn("fixed inset-0 bg-black/60", overlayClassName)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            aria-hidden
          />

          {/* Popup */}
          <motion.div
            key="popup"
            ref={popupRef}
            role="dialog"
            aria-modal
            style={{ zIndex: popupZ }}
            className={cn(
              "fixed top-1/2 left-1/2 flex w-full max-w-[calc(100%-2rem)] flex-col rounded-xl bg-background text-foreground shadow-lg outline-none sm:max-w-lg",
              className,
            )}
            initial={{ opacity: 0, scale: 0.95, x: "-50%", y: "-48%" }}
            animate={{ opacity: 1, scale: 1, x: "-50%", y: "-50%" }}
            exit={{ opacity: 0, scale: 0.95, x: "-50%", y: "-48%" }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            onClick={onClick}
            onKeyDown={(e) => e.stopPropagation()}
            onSubmit={(e) => e.stopPropagation()}
          >
            {children}
            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                className="absolute cursor-pointer top-3 right-3 inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <XIcon className="size-4" />
                <span className="sr-only">Fechar</span>
              </button>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

// ---------------------------------------------------------------------------
// DialogHeader
// ---------------------------------------------------------------------------
function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col gap-1.5 border-b px-6 py-4", className)}
      {...props}
    />
  );
}

// ---------------------------------------------------------------------------
// DialogBody
// ---------------------------------------------------------------------------
function DialogBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-col max-h-[80dvh] overflow-auto gap-4 px-6 py-4",
        className,
      )}
      {...props}
    />
  );
}

// ---------------------------------------------------------------------------
// DialogFooter
// ---------------------------------------------------------------------------
interface DialogFooterProps extends React.ComponentProps<"div"> {
  showCloseButton?: boolean;
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: DialogFooterProps) {
  const { onClose } = React.useContext(DialogContext);

  return (
    <div
      className={cn(
        "flex flex-col-reverse gap-2 border-t rounded-b-xl bg-muted/50 px-6 py-4 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <Button variant="outline" onClick={onClose}>
          Fechar
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DialogTitle
// ---------------------------------------------------------------------------
function DialogTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      className={cn(
        "text-lg font-semibold leading-none tracking-tight",
        className,
      )}
      {...props}
    />
  );
}

// ---------------------------------------------------------------------------
// DialogDescription
// ---------------------------------------------------------------------------
function DialogDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p className={cn("text-sm text-muted-foreground", className)} {...props} />
  );
}

// ---------------------------------------------------------------------------
// DialogClose — composable close button
// Supports `render` prop (like base-ui) to inject close behavior into any element.
// ---------------------------------------------------------------------------
interface DialogCloseProps extends React.ComponentProps<"button"> {
  render?: React.ReactElement;
}

function DialogClose({ children, render, ...props }: DialogCloseProps) {
  const { onClose } = React.useContext(DialogContext);

  if (render) {
    const renderProps = render.props as Record<string, unknown>;
    return React.cloneElement(render, {
      ...renderProps,
      onClick: (e: React.MouseEvent) => {
        onClose();
        (renderProps.onClick as React.MouseEventHandler | undefined)?.(e);
      },
      children: children ?? renderProps.children,
    } as object);
  }

  return (
    <button type="button" onClick={onClose} {...props}>
      {children}
    </button>
  );
}

export {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
};
