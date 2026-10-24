"use client";

import { useEffect, useState } from "react";
import {
  useChangePassword,
  useCurrentUser,
  useUpdateProfile,
} from "@/hooks/useApi";
import { errorMessage, toast } from "@/lib/toast";

export function useProfileSettings() {
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSaved, setNameSaved] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [notifications, setNotifications] = useState(true);

  const { data: currentUser } = useCurrentUser();
  const updateProfileMutation = useUpdateProfile();
  const changePasswordMutation = useChangePassword();

  // Seed the name field once the account loads, and whenever it changes
  // server-side, without stomping on in-progress edits.
  useEffect(() => {
    setName(currentUser?.name ?? "");
  }, [currentUser?.id, currentUser?.name]);

  const handleSaveName = async () => {
    setNameError(null);
    setNameSaved(false);
    const trimmed = name.trim();
    try {
      await toast.promise(
        updateProfileMutation.mutateAsync(trimmed ? trimmed : null),
        {
          loading: { title: "Salvando nome…" },
          success: trimmed
            ? `Nome atualizado para ${trimmed}.`
            : "Nome removido — usamos seu email agora.",
          error: (e) => errorMessage(e),
        },
      );
      setNameSaved(true);
    } catch (e) {
      setNameError(errorMessage(e));
    }
  };

  const handleChangePassword = async () => {
    setPasswordError(null);
    setPasswordSaved(false);
    if (newPassword.length < 8) {
      setPasswordError("A nova senha precisa de ao menos 8 caracteres.");
      toast.add({
        title: "Senha muito curta",
        description: "Use ao menos 8 caracteres.",
        type: "warning",
      });
      return;
    }
    try {
      await toast.promise(
        changePasswordMutation.mutateAsync({ currentPassword, newPassword }),
        {
          loading: { title: "Atualizando senha…" },
          success: "Senha atualizada. Você continua conectado.",
          error: (e) => errorMessage(e),
        },
      );
      setCurrentPassword("");
      setNewPassword("");
      setPasswordSaved(true);
    } catch (e) {
      setPasswordError(errorMessage(e));
    }
  };

  return {
    name,
    setName,
    nameError,
    nameSaved,
    setNameSaved,
    currentPassword,
    setCurrentPassword,
    newPassword,
    setNewPassword,
    passwordError,
    passwordSaved,
    setPasswordSaved,
    notifications,
    setNotifications,
    currentUser,
    updateProfilePending: updateProfileMutation.isPending,
    changePasswordPending: changePasswordMutation.isPending,
    handleSaveName,
    handleChangePassword,
  };
}

export type ProfileSettings = ReturnType<typeof useProfileSettings>;
