"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Save, RotateCcw, User } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { authApi } from "@/lib/api/authApi";

export interface AppSettings {
  general: {
    appName: string;
    timezone: string;
    dateFormat: string;
    timeFormat: string;
  };
  display: {
    theme: string;
    itemsPerPage: number;
    showNotifications: boolean;
    compactMode: boolean;
  };
  exam: {
    defaultMaxScore: number;
    autoSave: boolean;
    showStudentNames: boolean;
    allowBatchUpload: boolean;
    defaultQuestionCount: number;
  };
  ai: {
    geminiApiKey: string;
    enableAutoScoring: boolean;
    confidenceThreshold: number;
    maxRetries: number;
  };
  notifications: {
    emailEnabled: boolean;
    emailAddress: string;
    notifyOnBatchComplete: boolean;
    notifyOnErrors: boolean;
  };
  advanced: {
    enableOpenCV: boolean;
    enablePdfPoppler: boolean;
    debugMode: boolean;
    logLevel: string;
  };
}

const roleLabels: Record<string, string> = {
  super_admin: "Süper Admin",
  department_head: "Bölüm Başkanı",
  teacher: "Öğretmen",
};

export interface SettingsViewProps {
  settings: AppSettings;
  hasChanges: boolean;
  isSaving: boolean;
  activeTab: string;
  setActiveTab: (v: string) => void;
  loadSettings: () => void;
  saveSettings: () => void;
  resetSettings: () => void;
  updateSetting: (section: keyof AppSettings, field: string, value: unknown) => void;
  applyTheme: (theme: string) => void;
  profile: any;
  profileSaving: boolean;
  setProfileSaving: (v: boolean) => void;
  loadProfile: () => void;
}

export function SettingsView(props: SettingsViewProps) {
  const {
    settings,
    hasChanges,
    isSaving,
    activeTab,
    setActiveTab,
    loadSettings,
    saveSettings,
    resetSettings,
    updateSetting,
    applyTheme,
    profile,
    profileSaving,
    setProfileSaving,
    loadProfile,
  } = props;

  const profileNameRef = useRef<HTMLInputElement>(null);
  const profileEmailRef = useRef<HTMLInputElement>(null);
  const profilePasswordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile && profileNameRef.current && profileEmailRef.current && profilePasswordRef.current) {
      profileNameRef.current.value = (profile as any).name ?? "";
      profileEmailRef.current.value = (profile as any).email ?? "";
      profilePasswordRef.current.value = "";
    }
  }, [profile]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy dark:text-slate-100">Ayarlar</h1>
          <p className="text-muted-foreground">
            Uygulama ayarlarını yönetin ve özelleştirin
          </p>
        </div>
        <div className="flex gap-2">
          {hasChanges && (
            <Button variant="outline" onClick={loadSettings}>
              İptal
            </Button>
          )}
          <Button
            onClick={saveSettings}
            disabled={!hasChanges || isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin text-foreground" />
                Kaydediliyor...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4 text-foreground" />
                Kaydet
              </>
            )}
          </Button>
          <Button variant="outline" onClick={resetSettings} disabled={isSaving}>
            <RotateCcw className="mr-2 h-4 w-4 text-foreground" />
            Sıfırla
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="profil">Profil</TabsTrigger>
          <TabsTrigger value="general">Genel</TabsTrigger>
          <TabsTrigger value="display">Görünüm</TabsTrigger>
          <TabsTrigger value="notifications">Bildirimler</TabsTrigger>
        </TabsList>

        <TabsContent value="profil">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Hesap Bilgileri
              </CardTitle>
              <CardDescription>Profilinizi ve bölüm/program bilgilerinizi görüntüleyin, ad soyad ve şifre güncelleyin</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {profile && (
                <>
                  <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">Rol</p>
                    <p className="font-semibold">{roleLabels[profile.role as string] || profile.role}</p>
                    {profile.departmentId && (
                      <>
                        <p className="text-sm font-medium text-muted-foreground mt-3">Bölüm</p>
                        <p className="font-semibold">
                          {typeof profile.departmentId === "object" && profile.departmentId !== null
                            ? (profile.departmentId as { name?: string }).name || "—"
                            : "—"}
                        </p>
                        {((profile.departmentId as { programs?: { name?: string; code?: string }[] })?.programs?.length ?? 0) > 0 && (
                          <>
                            <p className="text-sm font-medium text-muted-foreground mt-3">Program (bölüm)</p>
                            <p className="font-semibold">
                              {((profile.departmentId as { programs?: { name?: string; code?: string }[] }).programs ?? [])
                                .map((p) => (p?.name || p?.code || "").trim())
                                .filter(Boolean)
                                .join(", ") || "—"}
                            </p>
                          </>
                        )}
                      </>
                    )}
                    {profile.assignedCourseIds && Array.isArray(profile.assignedCourseIds) && profile.assignedCourseIds.length > 0 && (
                      <>
                        <p className="text-sm font-medium text-muted-foreground mt-3">Atanmış dersler</p>
                        <p className="font-semibold">
                          {(profile.assignedCourseIds as { name?: string; code?: string }[])
                            .map((c: any) => {
                              const part = typeof c === "object" && c ? [c.code, c.name].filter(Boolean).join(" ").trim() : String(c ?? "");
                              return (part.trim() || "—");
                            })
                            .filter(Boolean)
                            .join(", ") || "—"}
                        </p>
                        {(profile.assignedCourseIds as { program?: { name?: string; code?: string } }[]).some(
                          (c: any) => c && typeof c === "object" && c.program
                        ) && (
                          <>
                            <p className="text-sm font-medium text-muted-foreground mt-3">Program</p>
                            <p className="font-semibold">
                              {[
                                ...new Set(
                                  (profile.assignedCourseIds as { program?: { name?: string; code?: string } }[])
                                    .map((c: any) =>
                                      c?.program && typeof c.program === "object"
                                        ? (c.program.name || c.program.code || "").trim()
                                        : ""
                                    )
                                    .filter(Boolean)
                                ),
                              ].join(", ") || "—"}
                            </p>
                          </>
                        )}
                      </>
                    )}
                  </div>
                  <Separator />
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="profile-name">Ad Soyad</Label>
                      <Input
                        id="profile-name"
                        ref={profileNameRef}
                        defaultValue={(profile as any)?.name ?? ""}
                        placeholder="Adınız Soyadınız"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="profile-email">E-posta</Label>
                      <Input
                        id="profile-email"
                        ref={profileEmailRef}
                        type="email"
                        defaultValue={(profile as any)?.email ?? ""}
                        placeholder="ornek@universite.edu.tr"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="profile-password">Yeni şifre (boş bırakırsanız değişmez)</Label>
                      <Input
                        id="profile-password"
                        ref={profilePasswordRef}
                        type="password"
                        defaultValue=""
                        placeholder="••••••••"
                      />
                    </div>
                    <Button
                      disabled={profileSaving}
                      onClick={async () => {
                        const name = profileNameRef.current?.value?.trim() ?? "";
                        const email = profileEmailRef.current?.value?.trim() ?? "";
                        const password = profilePasswordRef.current?.value ?? "";
                        setProfileSaving(true);
                        try {
                          await authApi.updateProfile({
                            name: name || undefined,
                            email: email || undefined,
                            password: password || undefined,
                          });
                          toast.success("Profil güncellendi");
                          if (profilePasswordRef.current) profilePasswordRef.current.value = "";
                          await loadProfile();
                        } catch (err: any) {
                          toast.error(err?.response?.data?.message || "Güncellenemedi");
                        } finally {
                          setProfileSaving(false);
                        }
                      }}
                    >
                      {profileSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Profili Kaydet
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>Genel Ayarlar</CardTitle>
              <CardDescription>Uygulama genel ayarları</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Zaman Dilimi</Label>
                <Input
                  value={settings.general.timezone}
                  onChange={(e) => updateSetting("general", "timezone", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Tarih Formatı</Label>
                <select
                  value={settings.general.dateFormat}
                  onChange={(e) => updateSetting("general", "dateFormat", e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Saat Formatı</Label>
                <select
                  value={settings.general.timeFormat}
                  onChange={(e) => updateSetting("general", "timeFormat", e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="24h">24 Saat</option>
                  <option value="12h">12 Saat (AM/PM)</option>
                </select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="display">
          <Card>
            <CardHeader>
              <CardTitle>Görünüm Ayarları</CardTitle>
              <CardDescription>Kullanıcı arayüzü tercihleri</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Tema</Label>
                <select
                  value={settings.display.theme}
                  onChange={(e) => {
                    updateSetting("display", "theme", e.target.value);
                    applyTheme(e.target.value);
                  }}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="light">Açık</option>
                  <option value="dark">Koyu</option>
                  <option value="auto">Otomatik</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Sayfa Başına Öğe</Label>
                <Input
                  type="number"
                  value={settings.display.itemsPerPage}
                  onChange={(e) => updateSetting("display", "itemsPerPage", parseInt(e.target.value))}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Bildirimleri Göster</Label>
                  <p className="text-sm text-muted-foreground">
                    Sistem bildirimlerini göster
                  </p>
                </div>
                <Switch
                  checked={settings.display.showNotifications}
                  onCheckedChange={(checked: boolean) => updateSetting("display", "showNotifications", checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Kompakt Mod</Label>
                  <p className="text-sm text-muted-foreground">
                    Daha az boşluk, daha fazla içerik
                  </p>
                </div>
                <Switch
                  checked={settings.display.compactMode}
                  onCheckedChange={(checked: boolean) => updateSetting("display", "compactMode", checked)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Bildirim Ayarları</CardTitle>
              <CardDescription>E-posta ve sistem bildirimleri</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Toplu İşlem Tamamlandığında Bildir</Label>
                </div>
                <Switch
                  checked={settings.notifications.notifyOnBatchComplete}
                  onCheckedChange={(checked: boolean) => updateSetting("notifications", "notifyOnBatchComplete", checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Hata Oluştuğunda Bildir</Label>
                </div>
                <Switch
                  checked={settings.notifications.notifyOnErrors}
                  onCheckedChange={(checked: boolean) => updateSetting("notifications", "notifyOnErrors", checked)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
