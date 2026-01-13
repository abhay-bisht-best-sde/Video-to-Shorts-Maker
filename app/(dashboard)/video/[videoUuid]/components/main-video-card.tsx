"use client";

import { motion } from "framer-motion";
import { Play } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/ui/card";

interface MainVideoCardProps {
  videoUrl: string;
}

export function MainVideoCard({ videoUrl }: MainVideoCardProps) {
  return (
      <Card className="border-2 shadow-lg hover:shadow-xl transition-shadow duration-300 p-0!">
        <CardHeader className="bg-linear-to-r from-primary/5 to-primary/10 border-b pt-8!">
          <CardTitle className="flex items-center gap-2">
            <Play className="size-5 text-primary" />
            Main Video
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 pb-10!">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <video src={videoUrl} controls className="w-full rounded-lg shadow-md">
              Your browser does not support the video tag.
            </video>
          </motion.div>
        </CardContent>
      </Card>
  );
}
