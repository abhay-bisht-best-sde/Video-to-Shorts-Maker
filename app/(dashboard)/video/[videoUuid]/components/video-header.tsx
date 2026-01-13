"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/app/ui/button";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/app/ui/breadcrumb";
import { itemVariants } from "./variants";

interface VideoHeaderProps {
  videoName: string;
  onBack: () => void;
}

export function VideoHeader({ videoName, onBack }: VideoHeaderProps) {
  return (
    <>
      <motion.div variants={itemVariants}>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/">Videos</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{videoName}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </motion.div>
      <motion.div variants={itemVariants}>
        <Button
          variant="outline"
          onClick={onBack}
          className="flex items-center gap-2 hover:bg-accent transition-colors"
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>
      </motion.div>
    </>
  );
}
