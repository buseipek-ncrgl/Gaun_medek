"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import apiClient from "@/lib/api/apiClient";
import { authApi } from "@/lib/api/authApi";
import { SettingsView, type AppSettings } from "./SettingsView";

export default function DashboardSettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [activeTab, setActiveTab] = useState("profil");
  const [profile, setProfile] = useState<{
    name?: string;
    email?: string;
    role?: string;
    departmentId?: { name?: string; code?: string } | string;
    assignedCourseIds?: { name?: string; code?: string }[] | string[];
  } | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);

  useEffect(() => {
    loadSettings();
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const me = await authApi.getMe();
      if (me) {
        setProfile(me as any);
      }
    } catch {
      setProfile(authApi.getStoredUser() as any);
    }
  };

  useEffect(() => {
    if (settings?.display.theme) {
      applyTheme(settings.display.theme);
    }
  }, [settings?.display.theme]);

  const applyTheme = (theme: string) => {
    if (typeof window === "undefined") return;
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else if (theme === "light") {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
    } else if (theme === "auto") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (prefersDark) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
      localStorage.setItem("theme", "auto");
    }
  };

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.get("/settings");
      setSettings(response.data.data);
      setHasChanges(false);
    } catch (error: any) {
      console.error("Error loading settings:", error);
      if (error.response?.status === 404) {
        const defaultSettings: AppSettings = {
          general: {
            appName: "",
            timezone: "Europe/Istanbul",
            dateFormat: "DD/MM/YYYY",
            timeFormat: "24h",
          },
          display: {
            theme: "light",
            itemsPerPage: 10,
            showNotifications: true,
            compactMode: false,
          },
          exam: {
            defaultMaxScore: 100,
            autoSave: true,
            showStudentNames: true,
            allowBatchUpload: true,
            defaultQuestionCount: 10,
          },
          ai: {
            geminiApiKey: "",
            enableAutoScoring: true,
            confidenceThreshold: 0.7,
            maxRetries: 3,
          },
          notifications: {
            emailEnabled: false,
            emailAddress: "",
            notifyOnBatchComplete: true,
            notifyOnErrors: true,
          },
          advanced: {
            enableOpenCV: false,
            enablePdfPoppler: false,
            debugMode: false,
            logLevel: "info",
          },
        };
        setSettings(defaultSettings);
      } else {
        toast.error("Ayarlar yüklenemedi");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const updateSetting = (section: keyof AppSettings, field: string, value: any) => {
    if (!settings) return;
    setSettings({
      ...settings,
      [section]: {
        ...settings[section],
        [field]: value,
      },
    });
    setHasChanges(true);
  };

  const saveSettings = async () => {
    if (!settings) return;
    try {
      setIsSaving(true);
      await apiClient.put("/settings", settings);
      toast.success("Ayarlar başarıyla kaydedildi");
      setHasChanges(false);
      if (settings.display.theme) {
        applyTheme(settings.display.theme);
      }
    } catch (error: any) {
      console.error("Error saving settings:", error);
      toast.error("Ayarlar kaydedilemedi: " + (error.response?.data?.message || error.message));
    } finally {
      setIsSaving(false);
    }
  };

  const resetSettings = async () => {
    if (!confirm("Tüm ayarlar varsayılan değerlere sıfırlanacak. Emin misiniz?")) {
      return;
    }
    try {
      setIsSaving(true);
      await apiClient.post("/settings/reset");
      toast.success("Ayarlar sıfırlandı");
      await loadSettings();
    } catch (error: any) {
      console.error("Error resetting settings:", error);
      toast.error("Ayarlar sıfırlanamadı");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-foreground" />
      </div>
    );
  }

  if (!settings) {
    return <div>Ayarlar yüklenemedi</div>;
  }

  return (
    <SettingsView
      settings={settings}
      hasChanges={hasChanges}
      isSaving={isSaving}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      loadSettings={loadSettings}
      saveSettings={saveSettings}
      resetSettings={resetSettings}
      updateSetting={updateSetting}
      applyTheme={applyTheme}
      profile={profile}
      profileSaving={profileSaving}
      setProfileSaving={setProfileSaving}
      loadProfile={loadProfile}
    />
  );
}
