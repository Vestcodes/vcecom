"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  width?: number;
  height?: number;
  showText?: boolean;
}

export function Logo({
  className,
  width = 120,
  height = 32,
  showText = true,
}: LogoProps) {
  // Use logo.png for both icon and full logo (light version for dark mode)
  const logoSrc = "/logo.png";
  const logoWidth = showText ? width : width || 32;
  const logoHeight = showText ? height : height || 32;

  return (
    <div className={cn("flex items-center", className)}>
      <Image
        src={logoSrc}
        alt="Vestcodes"
        width={logoWidth}
        height={logoHeight}
        className="h-auto"
        priority
      />
    </div>
  );
}
