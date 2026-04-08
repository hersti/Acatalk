import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Settings, User, GraduationCap, Bell, Shield, ShieldOff, Loader2, Lock, Camera, Trash2, Ghost, BellOff, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import TwoFactorSetup from "@/components/TwoFactorSetup";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import { moderateImage, moderateText, getViolationMessage } from "@/lib/moderation";
import { checkUsernameProfanity, quickContentCheck } from "@/lib/profanity-filter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AcademicMeta } from "@/components/ui/academic-meta";
import { StateBlock } from "@/components/ui/state-blocks";
import { Surface } from "@/components/ui/surface";

interface ProfileData {
  username: string;
  display_name: string;
  bio: string;
  university: string;
  department: string;
  class_year: number | null;
  username_changed_at: string | null;
}

interface SettingsData {
  dm_allowed: string;
  mention_notifications: boolean;
  dm_notifications: boolean;
  reply_notifications: boolean;
  vote_notifications: boolean;
  system_notifications: boolean;
  connection_requests_blocked: boolean;
  ghost_mode: boolean;
  dnd_mode: boolean;
}

export default function SettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState("account");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<ProfileData>({
    username: "", display_name: "", bio: "", university: "", department: "", class_year: null, username_changed_at: null,
  });
  const [originalUsername, setOriginalUsername] = useState("");

  const [settings, setSettings] = useState<SettingsData>({
    dm_allowed: "everyone",
    mention_notifications: true,
    dm_notifications: true,
    reply_notifications: true,
    vote_notifications: true,
    system_notifications: true,
    connection_requests_blocked: false,
    ghost_mode: false,
    dnd_mode: false,
  });

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  interface BlockedUser {
    id: string;
    blocked_id: string;
    created_at: string;
    username: string | null;
    university: string | null;
    department: string | null;
  }

  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loadingBlocked, setLoadingBlocked] = useState(false);
  const [unblocking, setUnblocking] = useState<string | null>(null);
  const [mfaEnabled, setMfaEnabled] = useState(false);

  const checkMfaStatus = useCallback(async () => {
    try {
      const { data } = await supabase.auth.mfa.listFactors();
      setMfaEnabled(!!data?.totp?.find((f) => f.status === "verified"));
    } catch {}
  }, []);

  const fetchAvatar = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("profiles").select("avatar_url").eq("user_id", user.id).single();
    if (data?.avatar_url) setAvatarUrl(data.avatar_url);
  }, [user]);

  const fetchProfile = useCallback(async () => {
    const { data } = await supabase.from("profiles").select("*").eq("user_id", user!.id).single();
    if (data) {
      const d = data as any;
      setProfile({
        username: d.username || "",
        display_name: d.display_name || "",
        bio: d.bio || "",
        university: d.university || "",
        department: d.department || "",
        class_year: d.class_year || null,
        username_changed_at: d.username_changed_at || null,
      });
      setOriginalUsername(d.username || "");
      if (d.avatar_url) setAvatarUrl(d.avatar_url);
    }
  }, [user]);

  const fetchSettings = useCallback(async () => {
    const { data } = await supabase.from("user_settings").select("*").eq("user_id", user!.id).maybeSingle();
    if (data) {
      const d = data as any;
      setSettings({
        dm_allowed: d.dm_allowed || "everyone",
        mention_notifications: d.mention_notifications ?? true,
        dm_notifications: d.dm_notifications ?? true,
        reply_notifications: d.reply_notifications ?? true,
        vote_notifications: d.vote_notifications ?? true,
        system_notifications: d.system_notifications ?? true,
        connection_requests_blocked: d.connection_requests_blocked ?? false,
        ghost_mode: d.ghost_mode ?? false,
        dnd_mode: d.dnd_mode ?? false,
      });
    }
  }, [user]);

  const fetchBlockedUsers = useCallback(async () => {
    if (!user) return;
    setLoadingBlocked(true);
    const { data } = await supabase
      .from("blocked_users")
      .select("id, blocked_id, created_at")
      .eq("blocker_id", user.id)
      .order("created_at", { ascending: false });

    if (data && data.length > 0) {
      const blockedIds = data.map((b) => b.blocked_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, username, university, department")
        .in("user_id", blockedIds);

      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) || []);
      setBlockedUsers(
        data.map((b) => {
          const p = profileMap.get(b.blocked_id);
          return {
            id: b.id,
            blocked_id: b.blocked_id,
            created_at: b.created_at,
            username: p?.username || null,
            university: p?.university || null,
            department: p?.department || null,
          };
        })
      );
    } else {
      setBlockedUsers([]);
    }
    setLoadingBlocked(false);
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [authLoading, navigate, user]);

  useEffect(() => {
    if (user) {
      void fetchProfile();
      void fetchSettings();
      void fetchBlockedUsers();
      void checkMfaStatus();
      void fetchAvatar();
    }
  }, [checkMfaStatus, fetchAvatar, fetchBlockedUsers, fetchProfile, fetchSettings, user]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.type)) {
      toast.error("Sadece JPEG, PNG, WebP veya GIF yükleyebilirsiniz.");
      return;
    }
    // Validate size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Avatar dosya boyutu en fazla 2MB olabilir.");
      return;
    }

    setUploadingAvatar(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const filePath = `avatars/${user.id}/avatar.${ext}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("uploads")
        .upload(filePath, file, { upsert: true, contentType: file.type });

      if (uploadError) {
        toast.error("Yükleme başarısız: " + uploadError.message);
        return;
      }

      const { data: urlData } = supabase.storage.from("uploads").getPublicUrl(filePath);
      const publicUrl = urlData.publicUrl + "?t=" + Date.now();

      // NSFW check
      const modResult = await moderateImage(publicUrl, "avatar", user.id);
      if (!modResult.safe) {
        await supabase.storage.from("uploads").remove([filePath]);
        toast.error("Bu görsel platform kurallarını ihlal ediyor ve yüklenemez.");
        return;
      }

      // Update profile
      const { error: updateError } = await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("user_id", user.id);
      if (updateError) {
        toast.error("Profil güncellenemedi.");
        return;
      }

      setAvatarUrl(publicUrl);
      toast.success("Avatar güncellendi!");
    } catch {
      toast.error("Avatar yüklenirken bir hata oluştu.");
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  };

  const handleRemoveAvatar = async () => {
    if (!user) return;
    setUploadingAvatar(true);
    try {
      // Remove from storage
      const { data: files } = await supabase.storage.from("uploads").list(`avatars/${user.id}`);
      if (files && files.length > 0) {
        await supabase.storage.from("uploads").remove(files.map(f => `avatars/${user.id}/${f.name}`));
      }
      await supabase.from("profiles").update({ avatar_url: null }).eq("user_id", user.id);
      setAvatarUrl(null);
      toast.success("Avatar kaldırıldı.");
    } catch {
      toast.error("Avatar kaldırılamadı.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleUnblock = async (blockId: string) => {
    setUnblocking(blockId);
    const { error } = await supabase.from("blocked_users").delete().eq("id", blockId);
    if (error) {
      toast.error("Engel kaldırılamadı.");
    } else {
      toast.success("Engel kaldırıldı.");
      setBlockedUsers((prev) => prev.filter((b) => b.id !== blockId));
    }
    setUnblocking(null);
  };

  const canChangeUsername = () => {
    if (!profile.username_changed_at) return true;
    const lastChanged = new Date(profile.username_changed_at);
    const daysSince = (Date.now() - lastChanged.getTime()) / (1000 * 60 * 60 * 24);
    return daysSince >= 30;
  };

  const daysUntilUsernameChange = () => {
    if (!profile.username_changed_at) return 0;
    const lastChanged = new Date(profile.username_changed_at);
    const daysSince = (Date.now() - lastChanged.getTime()) / (1000 * 60 * 60 * 24);
    return Math.max(0, Math.ceil(30 - daysSince));
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);

    const usernameChanged = profile.username !== originalUsername;
    if (usernameChanged && !canChangeUsername()) {
      toast.error(`Kullanıcı adını ${daysUntilUsernameChange()} gün sonra değiştirebilirsiniz.`);
      setSaving(false);
      return;
    }

    const updateData: any = {
      display_name: profile.display_name.trim() || null,
      bio: profile.bio.trim() || null,
    };

    // Check display_name for profanity
    if (profile.display_name.trim()) {
      const displayCheck = checkUsernameProfanity(profile.display_name.trim());
      if (!displayCheck.safe) {
        toast.error("Görünen ad uygunsuz içerik barındırıyor. Lütfen farklı bir ad seçin.");
        setSaving(false);
        return;
      }
    }

    // Instant bio check
    if (profile.bio.trim()) {
      const bioQuick = quickContentCheck(profile.bio.trim());
      if (!bioQuick.safe) {
        toast.error(bioQuick.reason || "Hakkımda metni uygunsuz içerik barındırıyor.");
        setSaving(false);
        return;
      }
      const bioMod = await moderateText(profile.bio.trim(), "bio", user.id);
      if (!bioMod.safe) {
        toast.error(getViolationMessage(bioMod.violation_type));
        setSaving(false);
        return;
      }
    }

    // Instant display name check
    if (profile.display_name.trim()) {
      const displayQuick = quickContentCheck(profile.display_name.trim());
      if (!displayQuick.safe) {
        toast.error("Görünen ad uygunsuz içerik barındırıyor.");
        setSaving(false);
        return;
      }
    }

    if (usernameChanged) {
      if (!profile.username.trim() || profile.username.trim().length < 3) {
        toast.error("Kullanıcı adı en az 3 karakter olmalıdır.");
        setSaving(false);
        return;
      }
      const profanityCheck = checkUsernameProfanity(profile.username.trim());
      if (!profanityCheck.safe) {
        toast.error("Bu kullanıcı adı uygunsuz içerik barındırıyor. Lütfen farklı bir ad seçin.");
        setSaving(false);
        return;
      }
      updateData.username = profile.username.trim();
      updateData.username_changed_at = new Date().toISOString();
    }

    const { error } = await supabase.from("profiles").update(updateData).eq("user_id", user.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Profil güncellendi!");
      setOriginalUsername(profile.username);
      fetchProfile();
    }
    setSaving(false);
  };

  const handleSaveSettings = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("user_settings").upsert({
      user_id: user.id,
      ...settings,
      updated_at: new Date().toISOString(),
    } as any, { onConflict: "user_id" });
    if (error) toast.error(error.message);
    else toast.success("Ayarlar kaydedildi!");
    setSaving(false);
  };

  const handleDeleteAccount = async () => {
    if (!user || deleteConfirmText !== "HESABIMI SIL") return;
    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke("delete-account", {
        body: { confirmation: "DELETE_MY_ACCOUNT" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Hesabınız başarıyla silindi.");
      setDeleteDialogOpen(false);
      await supabase.auth.signOut();
      navigate("/auth");
    } catch (err: any) {
      toast.error(err.message || "Hesap silinemedi.");
    } finally {
      setDeleting(false);
    }
  };

  if (authLoading || !user) return null;

  const sections = [
    { id: "account", label: "Hesap Bilgileri", icon: User },
    { id: "academic", label: "Akademik Bilgiler", icon: GraduationCap },
    { id: "security", label: "Güvenlik", icon: Lock },
    { id: "privacy", label: "Gizlilik ve DM", icon: Shield },
    { id: "notifications", label: "Bildirimler", icon: Bell },
    { id: "danger", label: "Hesap Silme", icon: Trash2 },
  ];

  return (
    <Layout>
      <div className="app-page-wrap page-section-stack">
        <Surface variant="raised" border="subtle" radius="xl" padding="none" className="overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-primary/80 via-primary/40 to-accent/60" />
          <div className="h-20 gradient-hero" />
          <div className="px-4 py-4 sm:px-6 sm:py-5">
            <div className="flex items-start gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <Settings className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="font-heading text-[1.65rem] font-extrabold tracking-tight">Ayarlar</h1>
                <p className="text-sm text-muted-foreground">
                  Hesap, akademik kimlik, gizlilik ve bildirim tercihlerinizi yönetin.
                </p>
                <AcademicMeta
                  className="mt-2"
                  size="sm"
                  tone="muted"
                  items={[
                    ...(profile.university
                      ? [{ kind: "university" as const, label: "Üniversite", value: profile.university, emphasis: "subtle" as const }]
                      : []),
                    ...(profile.department
                      ? [{ kind: "department" as const, label: "Bölüm", value: profile.department, emphasis: "subtle" as const }]
                      : []),
                    ...(profile.class_year !== null
                      ? [{ kind: "custom" as const, label: "Sınıf", value: profile.class_year === 0 ? "Hazırlık" : `${profile.class_year}. Sınıf`, emphasis: "subtle" as const }]
                      : []),
                  ]}
                />
              </div>
            </div>
          </div>
        </Surface>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-[252px_minmax(0,1fr)]">
          {/* Sidebar */}
          <div>
            <Surface variant="raised" border="subtle" radius="xl" padding="sm" className="md:sticky md:top-20">
              <p className="px-2 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Bölümler</p>
              <div className="space-y-1 p-1.5">
                {sections.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setActiveSection(s.id)}
                    className={`w-full rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                      activeSection === s.id
                        ? "border-primary/40 bg-gradient-to-r from-primary/14 via-primary/6 to-background text-primary shadow-[var(--shadow-soft)] ring-1 ring-primary/20"
                        : "border-transparent text-muted-foreground hover:border-border/70 hover:bg-secondary/50 hover:text-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <s.icon className="h-4 w-4 shrink-0" />
                      <div className="min-w-0">
                        <p>{s.label}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </Surface>
          </div>

          {/* Content */}
          <div className="space-y-3.5">
            {activeSection === "account" && (
              <Surface variant="raised" border="subtle" radius="xl" padding="none">
                <CardHeader>
                  <CardTitle className="text-base font-extrabold">Hesap Bilgileri</CardTitle>
                  <CardDescription className="text-xs">Temel hesap bilgilerinizi yönetin.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3.5">
                  {/* Avatar Upload */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Profil Fotoğrafı</Label>
                    <div className="flex items-center gap-4">
                      <div className="relative group">
                        <Avatar className="h-16 w-16 border-2 border-border shadow-[var(--shadow-soft)]">
                          {avatarUrl ? (
                            <AvatarImage src={avatarUrl} alt="Avatar" />
                          ) : null}
                          <AvatarFallback className="text-xl font-bold bg-primary text-primary-foreground">
                            {(profile.username || user.email || "?")[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <button
                          type="button"
                          onClick={() => avatarInputRef.current?.click()}
                          className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          disabled={uploadingAvatar}
                        >
                          {uploadingAvatar ? (
                            <Loader2 className="h-5 w-5 text-white animate-spin" />
                          ) : (
                            <Camera className="h-5 w-5 text-white" />
                          )}
                        </button>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Button type="button" variant="outline" size="sm" className="h-8 rounded-lg text-xs" onClick={() => avatarInputRef.current?.click()} disabled={uploadingAvatar}>
                          {uploadingAvatar ? "Yükleniyor..." : "Fotoğraf Yükle"}
                        </Button>
                        {avatarUrl && (
                          <Button type="button" variant="ghost" size="sm" className="h-7 rounded-lg text-xs text-destructive hover:text-destructive" onClick={handleRemoveAvatar} disabled={uploadingAvatar}>
                            <Trash2 className="h-3 w-3 mr-1" /> Kaldır
                          </Button>
                        )}
                        <p className="text-xs text-muted-foreground">JPEG, PNG, WebP veya GIF. Maks 2MB.</p>
                      </div>
                    </div>
                    <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleAvatarUpload} />
                  </div>
                  <Separator />
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">E-posta</Label>
                    <Input value={user.email || ""} disabled className="h-9 rounded-xl bg-secondary/50 text-sm" />
                    <p className="text-xs text-muted-foreground">E-posta değişikliği şu anda desteklenmemektedir.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Kullanıcı Adı</Label>
                    <Input
                      value={profile.username}
                      onChange={(e) => setProfile((p) => ({ ...p, username: e.target.value }))}
                      placeholder="kullanici_adi"
                      maxLength={30}
                      disabled={!canChangeUsername()}
                      className="h-9 rounded-xl text-sm"
                    />
                    {!canChangeUsername() && (
                      <p className="text-xs text-warning">
                        Kullanıcı adınızı {daysUntilUsernameChange()} gün sonra değiştirebilirsiniz. (30 günde 1 kez)
                      </p>
                    )}
                    {canChangeUsername() && (
                      <p className="text-xs text-muted-foreground">Kullanıcı adı 30 günde bir değiştirilebilir.</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Görünen Ad (İsteğe bağlı)</Label>
                    <Input
                      value={profile.display_name}
                      onChange={(e) => setProfile((p) => ({ ...p, display_name: e.target.value }))}
                      placeholder="Ad Soyad"
                      maxLength={50}
                      className="h-9 rounded-xl text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Hakkımda (İsteğe bağlı)</Label>
                    <Textarea
                      value={profile.bio}
                      onChange={(e) => setProfile((p) => ({ ...p, bio: e.target.value }))}
                      placeholder="Kendinizi kısaca tanıtın..."
                      rows={3}
                      maxLength={300}
                        className="min-h-[108px] rounded-xl text-sm"
                    />
                    <p className="text-xs text-muted-foreground text-right">{profile.bio.length}/300</p>
                  </div>
                  <Button onClick={handleSaveProfile} disabled={saving} className="h-9 rounded-xl font-semibold">
                    {saving ? "Kaydediliyor..." : "Kaydet"}
                  </Button>
                </CardContent>
              </Surface>
            )}

            {activeSection === "academic" && (
              <div className="space-y-3.5">
                <Surface variant="raised" border="subtle" radius="xl" padding="none">
                  <CardHeader>
                    <CardTitle className="text-base font-extrabold">Akademik Bilgiler</CardTitle>
                    <CardDescription className="text-xs">
                      Üniversite ve bölüm bilgileri kayıt sırasında belirlenir ve değiştirilemez.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3.5">
                    <AcademicMeta
                      size="sm"
                      tone="muted"
                      items={[
                        { kind: "verified", label: "Doğrulanmış Öğrenci", emphasis: "default" },
                        ...(profile.university ? [{ kind: "university" as const, label: "Üniversite", value: profile.university, emphasis: "subtle" as const }] : []),
                        ...(profile.department ? [{ kind: "department" as const, label: "Bölüm", value: profile.department, emphasis: "subtle" as const }] : []),
                      ]}
                    />
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold flex items-center gap-1.5">
                        Üniversite
                        <Lock className="h-3 w-3 text-muted-foreground" />
                      </Label>
                      <Input
                        value={profile.university}
                        disabled
                        className="h-9 rounded-xl bg-secondary/50 text-sm"
                      />
                      <p className="text-xs text-muted-foreground">
                        Üniversite bilgisi e-posta adresinize bağlıdır ve değiştirilemez.
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold flex items-center gap-1.5">
                        Bölüm
                        <Lock className="h-3 w-3 text-muted-foreground" />
                      </Label>
                      <Input
                        value={profile.department}
                        disabled
                        className="h-9 rounded-xl bg-secondary/50 text-sm"
                      />
                      <p className="text-xs text-muted-foreground">
                        Bölüm bilgisi kayıt sırasında belirlenir ve değiştirilemez.
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold flex items-center gap-1.5">
                        Sınıf
                        <Lock className="h-3 w-3 text-muted-foreground" />
                      </Label>
                      <Input
                        value={profile.class_year !== null ? (profile.class_year === 0 ? "Hazırlık" : `${profile.class_year}. Sınıf`) : "Belirtilmemiş"}
                        disabled
                        className="h-9 rounded-xl bg-secondary/50 text-sm"
                      />
                      <p className="text-xs text-muted-foreground">
                        Sınıf düzeyi kayıt sırasında belirlenir ve değiştirilemez.
                      </p>
                    </div>
                  </CardContent>
                </Surface>

                <AcademicChangeRequestCard userId={user.id} currentProfile={profile} />

                {/* User's support tickets */}
                <UserSupportTickets userId={user.id} />
              </div>
            )}

            {activeSection === "security" && (
              <Surface variant="raised" border="subtle" radius="xl" padding="lg" className="space-y-3.5">
                <div>
                  <h2 className="font-heading text-base font-bold">Güvenlik</h2>
                  <p className="text-xs text-muted-foreground">İki adımlı doğrulama ile hesabınızı koruyun.</p>
                </div>
                <TwoFactorSetup enabled={mfaEnabled} onStatusChange={checkMfaStatus} />
              </Surface>
            )}

            {activeSection === "privacy" && (
              <div className="space-y-3.5">
                <Surface variant="raised" border="subtle" radius="xl" padding="none">
                  <CardHeader>
                    <CardTitle className="text-base font-extrabold">Gizlilik ve DM Ayarları</CardTitle>
                    <CardDescription className="text-xs">Kimler size mesaj gönderebileceğini belirleyin.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Kimler DM gönderebilir?</Label>
                      <Select value={settings.dm_allowed} onValueChange={(v) => setSettings((s) => ({ ...s, dm_allowed: v }))}>
                        <SelectTrigger className="h-9 rounded-xl text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="everyone">Herkes</SelectItem>
                          <SelectItem value="nobody">Hiç kimse</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        "Herkes" seçili ise tüm kullanıcılar size doğrudan mesaj gönderebilir.
                      </p>
                    </div>
                    <Separator />
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">Bağlantı isteklerini engelle</p>
                          <p className="text-xs text-muted-foreground">
                            Aktif olduğunda hiç kimse size bağlantı isteği gönderemez.
                          </p>
                        </div>
                        <Switch
                          checked={settings.connection_requests_blocked}
                          onCheckedChange={(v) => setSettings((s) => ({ ...s, connection_requests_blocked: v }))}
                        />
                      </div>
                    </div>
                    <Separator />
                    {/* Ghost Mode */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Ghost className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">Hayalet Mod</p>
                            <p className="text-xs text-muted-foreground">
                              Aktif olduğunda diğer kullanıcılar sizi çevrimiçi olarak göremez.
                            </p>
                          </div>
                        </div>
                        <Switch
                          checked={settings.ghost_mode}
                          onCheckedChange={(v) => setSettings((s) => ({ ...s, ghost_mode: v }))}
                        />
                      </div>
                    </div>
                    <Separator />
                    {/* DND Mode */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <BellOff className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">Rahatsız Etme Modu</p>
                            <p className="text-xs text-muted-foreground">
                              Aktif olduğunda yeni DM mesajları engellenir ve bildirimler sınırlandırılır.
                            </p>
                          </div>
                        </div>
                        <Switch
                          checked={settings.dnd_mode}
                          onCheckedChange={(v) => setSettings((s) => ({ ...s, dnd_mode: v }))}
                        />
                      </div>
                    </div>
                    <Separator />
                    <Button onClick={handleSaveSettings} disabled={saving} className="h-9 rounded-xl font-semibold">
                      {saving ? "Kaydediliyor..." : "Kaydet"}
                    </Button>
                  </CardContent>
                </Surface>

                <Surface variant="raised" border="subtle" radius="xl" padding="none">
                  <CardHeader>
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      Engellenen Kullanıcılar
                    </CardTitle>
                    <CardDescription className="text-xs">Engellediğiniz kullanıcıları görüntüleyin ve yönetin.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {loadingBlocked ? (
                      <StateBlock
                        variant="loading"
                        size="inline"
                        title="Engellenen kullanıcılar yükleniyor"
                        description="Lütfen bekleyin."
                      />
                    ) : blockedUsers.length === 0 ? (
                      <StateBlock
                        variant="empty"
                        size="inline"
                        icon={<ShieldOff className="h-4 w-4" />}
                        title="Henüz engellenen kullanıcı yok"
                        description="Bir kullanıcıyı DM ekranından engelleyebilirsiniz."
                      />
                    ) : (
                      <div className="space-y-2">
                        {blockedUsers.map((blocked) => (
                          <Surface
                            key={blocked.id}
                            variant="soft"
                            border="subtle"
                            padding="sm"
                            radius="lg"
                            className="flex items-center justify-between transition-colors hover:bg-secondary/60"
                          >
                            <div className="flex items-center gap-3">
                              <Avatar className="h-9 w-9">
                                <AvatarFallback className="bg-destructive/10 text-destructive text-xs font-bold">
                                  {(blocked.username || "?")[0].toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="text-sm font-semibold">{blocked.username || "Bilinmeyen"}</p>
                                <p className="text-xs text-muted-foreground">
                                  {[blocked.university, blocked.department].filter(Boolean).join(" · ") || "Bilgi yok"}
                                  {" · "}
                                  {formatDistanceToNow(new Date(blocked.created_at), { addSuffix: true, locale: tr })}
                                </p>
                              </div>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 rounded-xl text-xs"
                              disabled={unblocking === blocked.id}
                              onClick={() => handleUnblock(blocked.id)}
                            >
                              {unblocking === blocked.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                "Engeli Kaldır"
                              )}
                            </Button>
                          </Surface>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Surface>
              </div>
            )}

            {activeSection === "notifications" && (
              <Surface variant="raised" border="subtle" radius="xl" padding="none">
                <CardHeader>
                  <CardTitle className="text-base font-extrabold">Bildirim Ayarları</CardTitle>
                  <CardDescription className="text-xs">Hangi bildirimleri almak istediğinizi seçin.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3.5">
                  {[
                    { key: "mention_notifications" as const, label: "Bahsetme bildirimleri", desc: "Birisi sizi @kullanıcıadı ile etiketlediğinde" },
                    { key: "dm_notifications" as const, label: "DM bildirimleri", desc: "Yeni mesaj veya DM isteği geldiğinde" },
                    { key: "reply_notifications" as const, label: "Yanıt bildirimleri", desc: "İçeriğinize yanıt verildiğinde" },
                    { key: "vote_notifications" as const, label: "Oy bildirimleri", desc: "İçeriğiniz oy aldığında" },
                    { key: "system_notifications" as const, label: "Sistem bildirimleri", desc: "Platform haberleri ve güncellemeler" },
                  ].map((item) => (
                    <div key={item.key} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{item.label}</p>
                        <p className="text-xs text-muted-foreground">{item.desc}</p>
                      </div>
                      <Switch
                        checked={settings[item.key]}
                        onCheckedChange={(v) => setSettings((s) => ({ ...s, [item.key]: v }))}
                      />
                    </div>
                  ))}
                  <Separator />
                  <Button onClick={handleSaveSettings} disabled={saving} className="h-9 rounded-xl font-semibold">
                    {saving ? "Kaydediliyor..." : "Kaydet"}
                  </Button>
                </CardContent>
              </Surface>
            )}

            {activeSection === "danger" && (
              <div className="space-y-3.5">
                <Surface variant="raised" border="default" radius="xl" padding="none" className="border-destructive/20">
                  <CardHeader>
                    <CardTitle className="text-base font-bold text-destructive flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Hesap Silme
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Hesabınızı kalıcı olarak silin. Bu işlem geri alınamaz.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3.5">
                    <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20 space-y-2">
                      <p className="text-sm font-medium text-destructive">Dikkat: Bu işlem geri alınamaz!</p>
                      <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                        <li>Tüm gönderileriniz, yorumlarınız ve mesajlarınız silinecektir.</li>
                        <li>Kazandığınız puanlar ve rozetler kalıcı olarak kaldırılacaktır.</li>
                        <li>Aynı e-posta adresiyle 3 gün boyunca yeniden kayıt olamazsınız.</li>
                      </ul>
                    </div>
                    <Button
                      variant="destructive"
                      className="h-9 rounded-xl font-semibold"
                      onClick={() => setDeleteDialogOpen(true)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Hesabımı Sil
                    </Button>
                  </CardContent>
                </Surface>
              </div>
            )}

          </div>
        </div>

        {/* Delete Account Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-destructive flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Hesap Silme Onayı
              </DialogTitle>
              <DialogDescription>
                Bu işlem geri alınamaz. Hesabınız ve tüm verileriniz kalıcı olarak silinecektir.
                Aynı e-posta adresiyle 3 gün boyunca yeniden kayıt olamazsınız.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3.5">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Onaylamak için <span className="font-mono text-destructive">HESABIMI SIL</span> yazın
                </Label>
                <Input
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="HESABIMI SIL"
                  className="h-9 rounded-xl font-mono text-sm"
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => { setDeleteDialogOpen(false); setDeleteConfirmText(""); }}>
                İptal
              </Button>
              <Button
                variant="destructive"
                disabled={deleteConfirmText !== "HESABIMI SIL" || deleting}
                onClick={handleDeleteAccount}
              >
                {deleting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Siliniyor...</> : "Kalıcı Olarak Sil"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}

/* User Support Tickets View */
function UserSupportTickets({ userId }: { userId: string }) {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTickets = async () => {
      const { data } = await supabase
        .from("support_tickets")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);
      setTickets(data || []);
      setLoading(false);
    };
    fetchTickets();
  }, [userId]);

  if (loading) {
    return (
      <Surface variant="raised" border="subtle" radius="xl" padding="lg">
        <StateBlock variant="loading" size="inline" title="Destek talepleri yükleniyor" description="Lütfen bekleyin." />
      </Surface>
    );
  }
  if (tickets.length === 0) return null;

  return (
    <Surface variant="raised" border="subtle" radius="xl" padding="none">
      <CardHeader>
        <CardTitle className="text-base font-extrabold">Destek Taleplerim</CardTitle>
        <CardDescription className="text-xs">Gönderdiğiniz destek talepleri ve yanıtları.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {tickets.map((t: any) => (
          <Surface key={t.id} variant="soft" border="subtle" radius="lg" padding="sm" className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">{t.subject}</p>
              <Badge variant={t.status === "open" ? "destructive" : t.status === "replied" ? "default" : "secondary"} className="text-xs">
                {t.status === "open" ? "Açık" : t.status === "replied" ? "Yanıtlandı" : "Kapatıldı"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{t.message}</p>
            {t.admin_reply && (
              <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/10">
                <p className="text-xs font-semibold text-primary mb-1">Admin Yanıtı:</p>
                <p className="text-xs">{t.admin_reply}</p>
                {t.replied_at && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(t.replied_at), { addSuffix: true, locale: tr })}
                  </p>
                )}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(t.created_at), { addSuffix: true, locale: tr })}
            </p>
          </Surface>
        ))}
      </CardContent>
    </Surface>
  );
}

/* Academic Change Request Card */
function AcademicChangeRequestCard({ userId, currentProfile }: { userId: string; currentProfile: ProfileData }) {
  const [requestUni, setRequestUni] = useState(currentProfile.university);
  const [requestDept, setRequestDept] = useState(currentProfile.department);
  const [requestYear, setRequestYear] = useState(String(currentProfile.class_year ?? "1"));
  const [explanation, setExplanation] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!explanation.trim()) { toast.error("Lütfen değişiklik nedeninizi açıklayın."); return; }
    setLoading(true);
    const { error } = await supabase.from("academic_suggestions").insert({
      user_id: userId,
      type: "info_change",
      university: requestUni || currentProfile.university,
      department: requestDept || currentProfile.department,
      class_year: requestYear,
      explanation: explanation.trim(),
    } as any);
    if (error) toast.error("Gönderilemedi: " + error.message);
    else { toast.success("Değişiklik talebiniz gönderildi. Admin incelemesinden sonra güncellenecektir."); setExplanation(""); }
    setLoading(false);
  };

  return (
    <Surface variant="raised" border="subtle" radius="xl" padding="none">
      <CardHeader>
        <CardTitle className="text-base font-extrabold">Akademik Bilgi Değişiklik Talebi</CardTitle>
        <CardDescription className="text-xs">
          Yanlış veya güncellenmeyen bilgileriniz varsa değişiklik talebi gönderin. Admin onayından sonra güncellenecektir.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3.5">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Yeni Üniversite</Label>
          <Input value={requestUni} onChange={(e) => setRequestUni(e.target.value)} placeholder="Güncellenecek üniversite" className="h-9 rounded-xl text-sm" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Yeni Bölüm</Label>
          <Input value={requestDept} onChange={(e) => setRequestDept(e.target.value)} placeholder="Güncellenecek bölüm" className="h-9 rounded-xl text-sm" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Yeni Sınıf</Label>
          <Select value={requestYear} onValueChange={setRequestYear}>
            <SelectTrigger className="h-9 rounded-xl text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Hazırlık</SelectItem>
              {[1,2,3,4,5,6].map(y => <SelectItem key={y} value={String(y)}>{y}. Sınıf</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Değişiklik Nedeni <span className="text-destructive">*</span></Label>
          <Textarea value={explanation} onChange={(e) => setExplanation(e.target.value)} placeholder="Neden değişiklik yapılması gerektiğini açıklayın..." rows={3} maxLength={500} className="text-sm" />
        </div>
        <Button onClick={handleSubmit} disabled={loading || !explanation.trim()} className="h-9 rounded-xl font-semibold">
          {loading ? "Gönderiliyor..." : "Değişiklik Talebi Gönder"}
        </Button>
      </CardContent>
    </Surface>
  );
}

