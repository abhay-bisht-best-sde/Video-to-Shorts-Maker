"use client";

import { motion } from "framer-motion";
import { Spinner } from "./spinner";
import { cn } from "@/app/helpers/utils";

interface LoadingProps {
  message?: string;
  fullScreen?: boolean;
  className?: string;
}

const containerVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

const spinnerVariants = {
  initial: { scale: 0.8, opacity: 0 },
  animate: { 
    scale: 1, 
    opacity: 1,
    transition: {
      type: "spring" as const,
      stiffness: 200,
      damping: 15,
    },
  },
};

const textVariants = {
  initial: { y: 10, opacity: 0 },
  animate: { 
    y: 0, 
    opacity: 1,
    transition: {
      delay: 0.2,
      duration: 0.3,
    },
  },
};

export function Loading({ message = "Loading...", fullScreen = false, className }: LoadingProps) {
  return (
    <motion.div
      variants={containerVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className={cn(
        "flex items-center justify-center",
        fullScreen ? "min-h-screen" : "py-12",
        className
      )}
    >
      <div className="flex flex-col items-center gap-4">
        <motion.div variants={spinnerVariants}>
          <Spinner className="size-8 text-primary" />
        </motion.div>
        <motion.p
          variants={textVariants}
          className="text-sm text-muted-foreground font-medium"
        >
          {message}
        </motion.p>
      </div>
    </motion.div>
  );
}
