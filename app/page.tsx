"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ComponentType } from "react";
import {
  ArrowRight,
  Leaf,
  Recycle,
  Users,
  Coins,
  MapPin,
  DollarSign,
  CircleAlert,
  MessageCircle,
} from "lucide-react";
import { Poppins } from "next/font/google";
import Link from "next/link";
import {
  getRecentReports,
  getAllRewards,
  getWasteCollectionTasks,
} from "@/utils/db/action";
import { PulsatingButton } from "@/components/PulsatingButton";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

const poppins = Poppins({
  weight: ["400", "600"],
  subsets: ["latin"],
  display: "swap",
});

const ChatSection = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Chat Icon Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-5 right-5 z-50 bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-lg"
      >
        <MessageCircle className="w-6 h-6" />
      </button>

      {/* Animated Chat Popup */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="chat-popup"
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            className="fixed bottom-24 right-5 w-[90%] sm:w-[500px] h-[500px] bg-white shadow-xl rounded-xl z-40 overflow-hidden"
          >
            <div className="h-full w-full flex flex-col">
              <div className="p-4 border-b text-center font-semibold text-xl">
                Chat with our AI Assistant
              </div>
              <iframe
                id="chatbot-widget-window-iframe"
                src="https://app.gpt-trainer.com/widget/0f5e1a94b0254e39bcebe8fa94807d29"
                width="100%"
                height="100%"
                frameBorder={0}
                allow="clipboard-read; clipboard-write"
                className="flex-1"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

const GLOBE_CONFIG = {
  width: 600,
  height: 600,
  onRender: () => {},
  devicePixelRatio: 1,
  phi: 0,
  theta: 0.3,
  dark: 0,
  diffuse: 0.4,
  mapSamples: 4000,
  mapBrightness: 1.1,
  baseColor: [1, 1, 1] as [number, number, number],
  markerColor: [251 / 255, 100 / 255, 21 / 255] as [number, number, number],
  glowColor: [1, 1, 1] as [number, number, number],
  markers: [
    { location: [14.5995, 120.9842], size: 0.03 },
    { location: [19.076, 72.8777], size: 0.1 },
    { location: [23.8103, 90.4125], size: 0.05 },
    { location: [30.0444, 31.2357], size: 0.07 },
    { location: [39.9042, 116.4074], size: 0.08 },
    { location: [-23.5505, -46.6333], size: 0.1 },
    { location: [19.4326, -99.1332], size: 0.1 },
    { location: [40.7128, -74.006], size: 0.1 },
    { location: [34.6937, 135.5022], size: 0.05 },
    { location: [41.0082, 28.9784], size: 0.06 },
  ] as { location: [number, number]; size: number }[],
};

type GlobeProps = {
  className?: string;
  config?: typeof GLOBE_CONFIG;
};

function Globe({ className, config = GLOBE_CONFIG }: GlobeProps) {
  const phi = useRef(0);
  const width = useRef(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const globeRef = useRef<{ toggle: (shouldRender: boolean) => void; destroy: () => void } | null>(null);
  const globeRunning = useRef(false);
  const pointerInteracting = useRef<number | null>(null);
  const pointerInteractionMovement = useRef(0);
  const rotation = useRef(0);

  const updatePointerInteraction = (value: number | null) => {
    pointerInteracting.current = value;
    if (canvasRef.current) {
      canvasRef.current.style.cursor = value ? "grabbing" : "grab";
    }
  };

  const updateMovement = (clientX: number) => {
    if (pointerInteracting.current !== null) {
      const delta = clientX - pointerInteracting.current;
      pointerInteractionMovement.current = delta;
      rotation.current = delta / 200;
    }
  };

  const onRender = useCallback((state: Record<string, number>) => {
      if (!pointerInteracting.current) phi.current += 0.0025;
      state.phi = phi.current + rotation.current;
      state.width = width.current;
      state.height = width.current;
    }, []);

  const onResize = () => {
    if (canvasRef.current) {
      width.current = canvasRef.current.offsetWidth;
    }
  };

  useEffect(() => {
    window.addEventListener("resize", onResize);
    onResize();

    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return () => window.removeEventListener("resize", onResize);

    let cancelled = false;
    let reducedMotion = false;
    let startTimer: number | undefined;

    const startGlobe = async () => {
      if (cancelled || globeRef.current) return;

      const { default: createGlobe } = await import("cobe");
      if (cancelled || !canvas) return;

      const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      reducedMotion = mediaQuery.matches;
      const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
      const lowPowerDevice = deviceMemory !== undefined && deviceMemory <= 4;
      const smallScreen = window.matchMedia("(max-width: 768px)").matches;
      const globe = createGlobe(canvas, {
        ...config,
        mapSamples: lowPowerDevice || smallScreen ? 2400 : config.mapSamples,
        width: width.current,
        height: width.current,
        onRender,
      });
      globeRef.current = globe;
      globeRunning.current = true;
      canvas.style.opacity = "1";

      if (reducedMotion) {
        requestAnimationFrame(() => {
          if (!cancelled && globeRunning.current) {
            globe.toggle(false);
            globeRunning.current = false;
          }
        });
      }
    };

    const stopGlobe = () => {
      if (globeRef.current && globeRunning.current) {
        globeRef.current.toggle(false);
        globeRunning.current = false;
      }
    };

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && document.visibilityState === "visible") {
        startTimer = window.setTimeout(startGlobe, 250);
      } else {
        if (startTimer) window.clearTimeout(startTimer);
        stopGlobe();
      }
    }, { threshold: 0.1 });
    observer.observe(container);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        stopGlobe();
      } else if (globeRef.current && !globeRunning.current && !reducedMotion) {
        globeRef.current.toggle(true);
        globeRunning.current = true;
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      if (startTimer) window.clearTimeout(startTimer);
      observer.disconnect();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("resize", onResize);
      globeRef.current?.destroy();
      globeRef.current = null;
    };
  }, [config, onRender]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 1 }}
      ref={containerRef}
      className={`absolute inset-0 mx-auto aspect-[1/1] mt-[45vh] lg:mt-[35vh] w-full max-w-[700px] ${className}`}
    >
      <canvas
        className="size-full opacity-0 transition-opacity duration-500 [contain:layout_paint_size]"
        ref={canvasRef}
        onPointerDown={(e) =>
          updatePointerInteraction(
            e.clientX - pointerInteractionMovement.current
          )
        }
        onPointerUp={() => updatePointerInteraction(null)}
        onPointerOut={() => updatePointerInteraction(null)}
        onMouseMove={(e) => updateMovement(e.clientX)}
        onTouchMove={(e) =>
          e.touches[0] && updateMovement(e.touches[0].clientX)
        }
      />
    </motion.div>
  );
}

function AnimatedGlobe() {
  return <Globe />;
}

export default function Home() {
  const prefersReducedMotion = useReducedMotion();
  const [loggedIn, setLoggedIn] = useState(false);
  const [impactData, setImpactData] = useState({
    wasteCollected: 0,
    reportsSubmitted: 0,
    tokensEarned: 0,
    co2Offset: 0,
  });

  useEffect(() => {
    async function fetchImpactData() {
      try {
        const [reports, rewards, tasks] = await Promise.all([
          getRecentReports(100),
          getAllRewards(),
          getWasteCollectionTasks(100),
        ]);

        const wasteCollected = tasks.reduce((total, task) => {
          const match = task.amount?.match(/(\d+(\.\d+)?)/);
          const amount = match ? parseFloat(match[0]) : 0;
          return total + amount;
        }, 0);

        const reportsSubmitted = reports.length;
        const tokensEarned = rewards.reduce(
          (total, reward) => total + (reward.cost || 0),
          0
        );
        const co2Offset = wasteCollected * 0.5;

        setImpactData({
          wasteCollected: Math.round(wasteCollected * 10) / 10,
          reportsSubmitted,
          tokensEarned,
          co2Offset: Math.round(co2Offset * 10) / 10,
        });
      } catch (error) {
        console.error("Error fetching impact data:", error);
        setImpactData({
          wasteCollected: 0,
          reportsSubmitted: 0,
          tokensEarned: 0,
          co2Offset: 0,
        });
      }
    }

    fetchImpactData();
  }, []);

  return (
    <div className={`container mx-auto py-16 ${poppins.className}`}>
      <AnimatedGlobe />
      <section className="mb-20 min-h-[100vh] gap-4 flex flex-col items-center">
        <motion.h1
          className="text-6xl font-extrabold"
          initial={prefersReducedMotion ? false : { y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={prefersReducedMotion ? { duration: 0 } : { delay: 0.3, duration: 0.8 }}
        >
          Wastify
        </motion.h1>
        <motion.p
          className="text-3xl font-semibold text-center"
          initial={prefersReducedMotion ? false : { y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={prefersReducedMotion ? { duration: 0 } : { delay: 0.5, duration: 0.8 }}
        >
          Transforming <span className="text-green-500">Waste Management</span>{" "}
          into a Rewarding Experience
        </motion.p>

        {/* Buttons */}
        <motion.div
          className="absolute bottom-12 flex gap-8 justify-center w-full px-6 sm:px-0"
          initial={prefersReducedMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={prefersReducedMotion ? { duration: 0 } : { delay: 1, duration: 0.8 }}
        >
          <Link href="/report">
            <PulsatingButton className="shadow-2xl bg-white border-2 border-green-300 hover:bg-green-100 transition-all duration-200">
              <span className="flex items-center gap-2 text-sm font-medium text-green-500 lg:text-lg">
                <CircleAlert className="w-5 h-5" /> Report Waste
                <ArrowRight className="w-5 h-5" />
              </span>
            </PulsatingButton>
          </Link>
          <Link href="/collect">
            <button className="flex items-center justify-center gap-2 text-sm font-medium text-green-500 lg:text-lg border-2 border-green-300 px-4 py-2 rounded-md bg-white hover:bg-green-100 transition-all duration-200">
              <DollarSign className="w-5 h-5" /> Collect Waste
              <ArrowRight className="w-5 h-5" />
            </button>
          </Link>
        </motion.div>

        {/* Chatbot */}
        {/* <motion.a
          initial={{ scale: 1 }}
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
          href="https://app.gpt-trainer.com/widget/1828a22e993f4369859c4bbcaf244279"
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-5 right-5 bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg hover:bg-blue-700 transition"
        >
          Chat with us
        </motion.a> */}


      </section>

      <section className="grid md:grid-cols-3 gap-10 mb-20">
        <FeatureCard
          icon={Leaf}
          title="Eco-Friendly"
          description="Contribute to a cleaner environment by reporting and collecting waste."
        />
        <FeatureCard
          icon={Coins}
          title="Earn Rewards"
          description="Get tokens for your contributions to waste management efforts."
        />
        <FeatureCard
          icon={Users}
          title="Community-Driven"
          description="Be part of a growing community committed to sustainable practices."
        />
      </section>
    </div>
  );
}

function ImpactCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      whileInView={{ scale: 1, opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      className="p-8 rounded-2xl bg-gray-50 border border-gray-200 shadow-lg transition-all hover:shadow-xl hover:scale-105"
    >
      <Icon className="h-12 w-12 text-green-500 mb-4 transform transition-all hover:scale-110" />
      <p className="text-4xl font-bold mb-2 text-gray-800">{value}</p>
      <p className="text-sm text-gray-600">{title}</p>
    </motion.div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div
      className="bg-white p-8 rounded-2xl shadow-lg flex flex-col items-center text-center transition-[transform,box-shadow] duration-200 hover:shadow-xl hover:scale-105 motion-reduce:transform-none"
    >
      <div className="bg-green-100 p-4 rounded-full mb-6 transition-all hover:bg-green-200">
        <Icon className="h-10 w-10 text-green-600 transform transition-all hover:scale-110" />
      </div>
      <h3 className="text-2xl font-semibold mb-4 text-gray-800">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  );
}
