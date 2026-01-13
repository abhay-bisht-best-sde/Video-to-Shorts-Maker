"use client";

import { motion } from "framer-motion";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia } from "./empty";
import { cn } from "@/app/helpers/utils";
import { ReactNode } from "react";

interface AnimatedEmptyProps {
  title?: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

const containerVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: {
      duration: 0.4,
    },
  },
};

const iconVariants = {
  initial: { scale: 0, rotate: -180 },
  animate: { 
    scale: 1, 
    rotate: 0,
    transition: {
      type: "spring" as const,
      stiffness: 200,
      damping: 15,
      delay: 0.1,
    },
  },
};

const contentVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: {
      delay: 0.2,
      duration: 0.3,
    },
  },
};

export function AnimatedEmpty({ 
  title = "No data found", 
  description, 
  icon, 
  action,
  className 
}: AnimatedEmptyProps) {
  return (
    <motion.div
      variants={containerVariants}
      initial="initial"
      animate="animate"
      className={cn("w-full", className)}
    >
      <Empty>
        {icon && (
          <motion.div variants={iconVariants}>
            <EmptyMedia variant="icon">
              {icon}
            </EmptyMedia>
          </motion.div>
        )}
        <motion.div variants={contentVariants}>
          <EmptyHeader>
            <EmptyTitle>{title}</EmptyTitle>
            {description && (
              <EmptyDescription>{description}</EmptyDescription>
            )}
          </EmptyHeader>
          {action && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-4"
            >
              {action}
            </motion.div>
          )}
        </motion.div>
      </Empty>
    </motion.div>
  );
}
