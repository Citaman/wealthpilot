"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { runStressTest, clearStressTestTransactions } from "@/lib/stress-test";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Zap, Trash } from "lucide-react";
import { useAccounts } from "@/hooks/use-data";
import { recalculateAllBalances } from "@/lib/balance";

export function StressTestControl() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { accounts } = useAccounts();

  const handleInject = async () => {
    if (!accounts || accounts.length === 0) {
      toast({
        variant: "destructive",
        title: "No Account Found",
        description: "Please create an account first.",
      });
      return;
    }

    setIsLoading(true);
    try {
      const startTime = performance.now();
      const count = await runStressTest(10000, accounts[0].id!);
      const endTime = performance.now();
      const duration = ((endTime - startTime) / 1000).toFixed(2);

      await recalculateAllBalances();

      toast({
        variant: "success",
        title: "Stress Test Complete",
        description: `Injected ${count} transactions in ${duration}s. Check performance!`,
      });
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Stress Test Failed",
        description: "Something went wrong during injection.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = async () => {
    setIsLoading(true);
    try {
      const count = await clearStressTestTransactions();
      await recalculateAllBalances();
      
      toast({
        title: "Cleanup Complete",
        description: `Removed ${count} stress test transactions.`,
      });
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Cleanup Failed",
        description: "Could not remove transactions.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
          <Zap className="h-5 w-5" />
          Developer Zone: Stress Testing
        </CardTitle>
        <CardDescription>
          Inject 10,000 transactions to test rendering performance and data handling at scale.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex gap-4">
        <Button 
          onClick={handleInject} 
          disabled={isLoading}
          variant="secondary"
          className="bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-200 dark:bg-amber-900/40 dark:hover:bg-amber-900/60 dark:text-amber-100 dark:border-amber-800"
        >
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
          Inject 10k Tx
        </Button>
        <Button 
          onClick={handleClear} 
          disabled={isLoading}
          variant="outline"
          className="border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-950/40"
        >
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash className="mr-2 h-4 w-4" />}
          Clear Stress Data
        </Button>
      </CardContent>
    </Card>
  );
}
