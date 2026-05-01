import "./glitch.css";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  type Variants,
} from "framer-motion";

const PARTICLES = Array.from({ length: 30 }, (_, i) => ({
  id: i,
  size: Math.random() * 3 + 1,
  x: Math.random() * 100,
  delay: Math.random() * 8,
  duration: Math.random() * 10 + 12,
  opacity: Math.random() * 0.3 + 0.08,
}));

const SHAPES = [
  { size: 110, x: 7, y: 15, rx: 55 },
  { size: 55, x: 87, y: 10, rx: 12 },
  { size: 150, x: 80, y: 62, rx: 75 },
  { size: 42, x: 10, y: 75, rx: 8 },
  { size: 75, x: 52, y: 87, rx: 37 },
  { size: 62, x: 93, y: 40, rx: 16 },
  { size: 90, x: 35, y: 5, rx: 45 },
  { size: 48, x: 68, y: 82, rx: 10 },
];

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.25 } },
};

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 32 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export default function NotFoundPage() {
  const navigate = useNavigate();

  const rawX = useMotionValue(0.5);
  const rawY = useMotionValue(0.5);
  const smoothX = useSpring(rawX, { damping: 28, stiffness: 75 });
  const smoothY = useSpring(rawY, { damping: 28, stiffness: 75 });

  useEffect(() => {
    const move = (e: MouseEvent) => {
      rawX.set(e.clientX / window.innerWidth);
      rawY.set(e.clientY / window.innerHeight);
    };
    window.addEventListener("mousemove", move);
    return () => window.removeEventListener("mousemove", move);
  }, [rawX, rawY]);

  const deepX = useTransform(smoothX, [0, 1], [-60, 60]);
  const deepY = useTransform(smoothY, [0, 1], [-50, 50]);
  const midX = useTransform(smoothX, [0, 1], [-28, 28]);
  const midY = useTransform(smoothY, [0, 1], [-22, 22]);
  const nearX = useTransform(smoothX, [0, 1], [-12, 12]);
  const nearY = useTransform(smoothY, [0, 1], [-9, 9]);

  return (
    <div className="dot-grid min-h-screen w-full flex items-center justify-center bg-background overflow-hidden relative px-6 py-16">
      {/* Scan lines estáticas */}
      <div
        className="scan-line fixed inset-0 pointer-events-none z-0"
        aria-hidden
      />

      {/* Linha de varredura */}
      <div className="sweep-line" aria-hidden />

      {/* Partículas */}
      {PARTICLES.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full bg-primary pointer-events-none z-0"
          style={{ width: p.size, height: p.size, left: `${p.x}%`, opacity: 0 }}
          animate={{ y: [120, -120], opacity: [0, p.opacity, p.opacity, 0] }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      ))}

      {/* Formas geométricas — camada profunda */}
      <motion.div
        className="pointer-events-none fixed inset-0 overflow-hidden z-0"
        style={{ x: deepX, y: deepY }}
        aria-hidden
      >
        {SHAPES.map((s, i) => (
          <div
            key={i}
            className="absolute border border-primary/[0.07]"
            style={{
              width: s.size,
              height: s.size,
              left: `${s.x}%`,
              top: `${s.y}%`,
              borderRadius: s.rx,
            }}
          />
        ))}
      </motion.div>

      {/* Orbs de glow — camada média */}
      <div
        className="pointer-events-none fixed inset-0 overflow-hidden z-0"
        aria-hidden
      >
        <motion.div
          className="absolute top-[-25%] left-[20%] w-175 h-175 rounded-full blur-[130px]"
          style={{ background: "hsl(var(--primary) / 0.13)", x: midX, y: midY }}
          animate={{ scale: [1, 1.22, 1], opacity: [0.55, 0.9, 0.55] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-[-20%] right-[-8%] w-137.5 h-137.5 rounded-full blur-[110px]"
          style={{ background: "hsl(215 90% 62% / 0.1)", x: midX, y: midY }}
          animate={{ scale: [1, 1.28, 1], opacity: [0.35, 0.65, 0.35] }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 3,
          }}
        />
        <motion.div
          className="absolute top-[40%] left-[-10%] w-96 h-96 rounded-full blur-[100px]"
          style={{ background: "hsl(280 70% 55% / 0.06)", x: deepX, y: deepY }}
          animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0.6, 0.3] }}
          transition={{
            duration: 12,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 6,
          }}
        />
      </div>

      {/* Conteúdo principal */}
      <motion.div
        className="relative z-10 flex flex-col items-center text-center w-full max-w-2xl"
        variants={container}
        initial="hidden"
        animate="show"
      >
        {/* Badge */}
        <motion.div variants={fadeUp} className="mb-8">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/25 bg-primary/5 text-primary text-xs font-semibold tracking-widest uppercase backdrop-blur-sm">
            <span className="blink size-1.5 rounded-full bg-primary inline-block" />
            Erro 404
          </span>
        </motion.div>

        {/* 404 — parallax + glow + glitch */}
        <motion.div
          variants={fadeUp}
          className="relative select-none mb-0"
          style={{ x: nearX, y: nearY }}
        >
          <div className="glitch-wrapper">
            <motion.span
              data-text="404"
              className="glitch-text text-[9rem] sm:text-[12rem] md:text-[16rem] font-black leading-none tracking-tighter text-transparent bg-clip-text bg-linear-to-b from-foreground via-foreground/65 to-foreground/8"
              whileHover={{
                scale: 1.03,
                transition: { type: "spring", stiffness: 280, damping: 18 },
              }}
              style={{
                filter:
                  "drop-shadow(0 0 18px hsl(var(--primary) / 0.45)) drop-shadow(0 0 55px hsl(var(--primary) / 0.22)) drop-shadow(0 0 100px hsl(var(--primary) / 0.1))",
              }}
            >
              404
            </motion.span>
          </div>

          {/* Reflexo */}
          <div
            aria-hidden
            className="absolute bottom-0 left-0 right-0 h-2/5 bg-linear-to-t from-background to-transparent pointer-events-none"
          />
        </motion.div>

        {/* Separador animado */}
        <motion.div
          variants={fadeUp}
          className="flex items-center gap-3 w-full max-w-xs mb-8"
        >
          <motion.div
            className="flex-1 h-px bg-linear-to-r from-transparent to-border"
            initial={{ scaleX: 0, originX: 1 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.8, delay: 0.7 }}
          />
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="size-1.5 rounded-full bg-primary/50"
                animate={{ opacity: [0.2, 1, 0.2], scale: [0.7, 1.3, 0.7] }}
                transition={{
                  duration: 1.8,
                  repeat: Infinity,
                  delay: i * 0.35,
                }}
              />
            ))}
          </div>
          <motion.div
            className="flex-1 h-px bg-linear-to-l from-transparent to-border"
            initial={{ scaleX: 0, originX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.8, delay: 0.7 }}
          />
        </motion.div>

        {/* Título */}
        <motion.h1
          variants={fadeUp}
          className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight mb-4"
        >
          Página não encontrada
        </motion.h1>

        {/* Descrição */}
        <motion.p
          variants={fadeUp}
          className="text-muted-foreground text-sm sm:text-base leading-relaxed mb-10 max-w-sm"
        >
          A página que você procura não existe, foi movida ou o endereço foi
          digitado incorretamente.
        </motion.p>

        {/* Botões */}
        <motion.div
          variants={fadeUp}
          className="flex flex-col sm:flex-row gap-3"
        >
          <Button
            variant="outline"
            size="lg"
            className="gap-2 min-w-40 hover:border-primary/40 hover:bg-primary/5 transition-all duration-300"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="size-4" />
            Voltar
          </Button>
          <Button
            size="lg"
            className="gap-2 min-w-40 shadow-lg shadow-primary/25 hover:shadow-primary/45 transition-shadow duration-300"
            onClick={() => navigate("/")}
          >
            <Home className="size-4" />
            Ir para o início
          </Button>
        </motion.div>

        {/* Rodapé */}
        <motion.p
          variants={fadeUp}
          className="mt-16 text-[11px] text-muted-foreground/20 tracking-[0.3em] uppercase"
        >
          useAcolhe · 404
        </motion.p>
      </motion.div>
    </div>
  );
}
