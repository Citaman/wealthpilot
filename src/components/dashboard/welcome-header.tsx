"use client";

import { format } from "date-fns";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface WelcomeHeaderProps {
  userName?: string;
  lastUpdated?: Date;
}

export function WelcomeHeader({ userName = "there", lastUpdated }: WelcomeHeaderProps) {
  const hour = new Date().getHours();
  
  let greeting = "Good evening";
  let emoji = "🌙";
  
  if (hour >= 5 && hour < 12) {
    greeting = "Good morning";
    emoji = "☀️";
  } else if (hour >= 12 && hour < 18) {
    greeting = "Good afternoon";
    emoji = "🌤️";
  }

  return (
    <div className="flex items-start justify-between">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          {greeting}, {userName} {emoji}
        </h1>
        <p className="text-muted-foreground mt-1">
          Here&apos;s your financial overview for {format(new Date(), "MMMM yyyy")}
        </p>
        {lastUpdated && (
          <p className="text-xs text-muted-foreground mt-1">
            Last updated: {format(lastUpdated, "MMM d, h:mm a")}
          </p>
        )}
      </div>
      <Button variant="ghost" size="icon" asChild>
        <Link href="/settings">
          <Settings className="h-5 w-5" />
        </Link>
      </Button>
    </div>
  );
}
