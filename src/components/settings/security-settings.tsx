"use client";

import { Shield, Lock, Unlock, Clock, AlertTriangle, Fingerprint } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSecurity } from "@/contexts";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export function SecuritySettings() {
  const { hasPin, setPin, clearPin, autoLockTimeout, setAutoLockTimeout } = useSecurity();
  const { toast } = useToast();
  const [newPin, setNewNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [isSettingUp, setIsSettingUp] = useState(false);

  const handleSetPin = async () => {
    if (newPin.length < 4) {
      toast({
        variant: "destructive",
        title: "Invalid PIN",
        description: "PIN must be at least 4 digits.",
      });
      return;
    }
    if (newPin !== confirmPin) {
      toast({
        variant: "destructive",
        title: "PIN Mismatch",
        description: "The PINs you entered do not match.",
      });
      return;
    }

    await setPin(newPin);
    setIsSettingUp(false);
    setNewNewPin("");
    setConfirmPin("");
    toast({
      variant: "success",
      title: "PIN Set",
      description: "Your app is now protected by a PIN.",
    });
  };

  const handleClearPin = () => {
    clearPin();
    toast({
      title: "PIN Removed",
      description: "App lock has been disabled.",
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security & App Lock
          </CardTitle>
          <CardDescription>
            Protect your financial data with an additional layer of security.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* PIN Status */}
          <div className="flex items-center justify-between p-4 rounded-xl border bg-muted/30">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-full flex items-center justify-center ${hasPin ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                {hasPin ? <Lock className="h-5 w-5" /> : <Unlock className="h-5 w-5" />}
              </div>
              <div>
                <p className="font-medium">App PIN Lock</p>
                <p className="text-xs text-muted-foreground">
                  {hasPin ? "Your app is protected" : "Setup a PIN to lock your app"}
                </p>
              </div>
            </div>
            {hasPin ? (
              <Button variant="outline" size="sm" onClick={handleClearPin} className="text-red-600 hover:text-red-700">
                Disable Lock
              </Button>
            ) : (
              !isSettingUp && (
                <Button size="sm" onClick={() => setIsSettingUp(true)}>
                  Enable PIN
                </Button>
              )
            )}
          </div>

          {/* Setup Form */}
          {isSettingUp && (
            <div className="space-y-4 p-4 rounded-xl border border-primary/20 bg-primary/5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="new-pin">Enter PIN (4-6 digits)</Label>
                  <Input
                    id="new-pin"
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={newPin}
                    onChange={(e) => setNewNewPin(e.target.value.replace(/\D/g, ""))}
                    placeholder="••••"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-pin">Confirm PIN</Label>
                  <Input
                    id="confirm-pin"
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
                    placeholder="••••"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setIsSettingUp(false)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSetPin} disabled={newPin.length < 4}>
                  Save PIN
                </Button>
              </div>
            </div>
          )}

          {/* Auto-Lock Settings */}
          {hasPin && (
            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <Label>Auto-lock on inactivity</Label>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Automatically lock the app after a period of no activity.
                  </p>
                </div>
                <Select
                  value={String(autoLockTimeout)}
                  onValueChange={(v) => setAutoLockTimeout(parseInt(v, 10))}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">After 1 minute</SelectItem>
                    <SelectItem value="5">After 5 minutes</SelectItem>
                    <SelectItem value="15">After 15 minutes</SelectItem>
                    <SelectItem value="30">After 30 minutes</SelectItem>
                    <SelectItem value="0">Never</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Warning */}
          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 flex gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
            <div className="text-xs text-amber-800 dark:text-amber-400">
              <p className="font-semibold mb-1">Important: No Password Recovery</p>
              <p>
                WealthPilot is local-first. If you forget your PIN, you will need to reset the app 
                and all data will be cleared unless you have a backup file.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Fingerprint className="h-4 w-4" />
            Biometric Unlock
          </CardTitle>
          <CardDescription>
            Use Touch ID or Face ID to unlock WealthPilot (Experimental).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground italic">
            Biometric authentication is coming in a future update (v0.15.0+).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
