import { motion, AnimatePresence } from "framer-motion";
import { useEffect } from "react";

interface LoadingProps {
  show?: boolean;
  fullScreen?: boolean;
  description?: string;
}

const spinner = (
  <motion.div
    className="relative w-12 h-12 shrink-0"
    animate={{ rotate: 360 }}
    transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
  >
    <div className="absolute inset-0 rounded-full border-[3px] border-muted" />
    <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-foreground" />
  </motion.div>
);

export default function Loading({
  show = true,
  fullScreen = false,
  description = "Carregando...",
}: LoadingProps) {
  useEffect(() => {
    if (!fullScreen) return;
    document.body.style.overflow = show ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [fullScreen, show]);

  return (
    <AnimatePresence>
      {show &&
        (fullScreen ? (
          <motion.div
            key="fullscreen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 backdrop-blur-xl"
          >
            <motion.div
              className="absolute w-125 h-125 rounded-full bg-primary/5 blur-3xl"
              animate={{ scale: [1, 1.06, 1], opacity: [0.3, 0.55, 0.3] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            />

            <motion.div
              initial={{ opacity: 0, y: 8, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -8, filter: "blur(8px)" }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="relative flex flex-col items-center gap-8"
            >
              {spinner}

              {description && (
                <motion.p
                  className="text-sm text-muted-foreground"
                  animate={{ opacity: [0.3, 0.75, 0.3] }}
                  transition={{ duration: 3, repeat: Infinity }}
                >
                  {description}
                </motion.p>
              )}
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            key="inline"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.25 }}
            className="flex items-center justify-center"
          >
            {spinner}
          </motion.div>
        ))}
    </AnimatePresence>
  );
}
