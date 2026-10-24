"use client";

import { Bell, WarningCircle } from "@phosphor-icons/react";
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
import { Input } from "@/components/ui/input";
import type { ProfileSettings } from "../hooks/useProfileSettings";

type GeneralTabProps = {
  profile: ProfileSettings;
}

export function GeneralTab({ profile }: GeneralTabProps) {
  const {
    name,
    setName,
    nameError,
    nameSaved,
    setNameSaved,
    currentPassword,
    setCurrentPassword,
    newPassword,
    setNewPassword,
    setPasswordSaved,
    passwordError,
    passwordSaved,
    notifications,
    setNotifications,
    currentUser,
    updateProfilePending,
    changePasswordPending,
    handleSaveName,
    handleChangePassword,
  } = profile;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>How you appear in OpenBox</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Display name</Label>
            <div className="flex gap-2">
              <Input
                id="name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setNameSaved(false);
                }}
                placeholder={currentUser?.email ?? "Como quer ser chamado"}
              />
              <Button
                onClick={handleSaveName}
                disabled={
                  updateProfilePending || name === (currentUser?.name ?? "")
                }
              >
                Save
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Used for the initials in the header. Leave empty to fall back to
              your email.
            </p>
            {nameError && (
              <div className="flex items-start gap-2 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                <WarningCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span className="break-all">{nameError}</span>
              </div>
            )}
            {nameSaved && (
              <p className="text-xs text-muted-foreground">Saved.</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={currentUser?.email ?? ""}
              disabled
            />
            <p className="text-xs text-muted-foreground">
              This is your sign-in id and cannot be changed here.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Password</CardTitle>
          <CardDescription>
            Change the password you sign in with
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-password">Current password</Label>
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                setPasswordSaved(false);
              }}
              placeholder="At least 8 characters"
            />
          </div>
          <Button
            onClick={handleChangePassword}
            disabled={
              changePasswordPending || !currentPassword || !newPassword
            }
          >
            Update password
          </Button>
          {passwordError && (
            <div className="flex items-start gap-2 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
              <WarningCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span className="break-all">{passwordError}</span>
            </div>
          )}
          {passwordSaved && (
            <p className="text-xs text-muted-foreground">
              Password updated. You stay signed in.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Notifications</CardTitle>
          <CardDescription>
            Choose what notifications to receive
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-muted-foreground" />
              <div>
                <Label>Email notifications</Label>
                <p className="text-xs text-muted-foreground">
                  Receive notifications via email
                </p>
              </div>
            </div>
            <Switch
              checked={notifications}
              onCheckedChange={setNotifications}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
