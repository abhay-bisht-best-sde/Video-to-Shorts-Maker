"use client";

import { motion } from "framer-motion";
import { Video, Sparkles } from "lucide-react";
import { CardHeader, CardTitle } from "@/app/ui/card";

export function VideoManagementHeader() {
  return (
    <CardHeader className="bg-linear-to-r from-primary/5 to-primary/10 border-b shrink-0 pt-7">
      <CardTitle className="flex items-center gap-3 text-2xl">
        <motion.div
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
        >
          <Video className="size-6 text-primary" />
        </motion.div>
        <span>Video Management</span>
        <Sparkles className="size-5 text-primary/60 ml-auto" />
      </CardTitle>
    </CardHeader>
  );
}
