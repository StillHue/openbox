"use client";

import { Database, Moon, Palette, Sun } from "@phosphor-icons/react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export type AppearanceTheme = "light" | "dark";

type AppearanceTabProps = {
  theme: AppearanceTheme;
  onThemeChange: (value: AppearanceTheme) => void;
};

export function AppearanceTab({ theme, onThemeChange }: AppearanceTabProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Theme</CardTitle>
          <CardDescription>Choose your preferred color scheme</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button
              variant={theme === "light" ? "default" : "outline"}
              size="sm"
              onClick={() => onThemeChange("light")}
              className="flex-1 flex items-center gap-2"
            >
              <Sun className="w-4 h-4" />
              Light
            </Button>
            <Button
              variant={theme === "dark" ? "default" : "outline"}
              size="sm"
              onClick={() => onThemeChange("dark")}
              className="flex-1 flex items-center gap-2"
            >
              <Moon className="w-4 h-4" />
              Dark
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Display</CardTitle>
          <CardDescription>
            Customize how content is displayed
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Palette className="w-5 h-5 text-muted-foreground" />
              <div>
                <Label>Animate UI</Label>
                <p className="text-xs text-muted-foreground">
                  Enable smooth animations
                </p>
              </div>
            </div>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Database className="w-5 h-5 text-muted-foreground" />
              <div>
                <Label>Show IDs</Label>
                <p className="text-xs text-muted-foreground">
                  Display resource IDs in tables
                </p>
              </div>
            </div>
            <Switch />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
