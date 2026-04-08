import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
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

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading]);

  useEffect(() => {
    if (user) { fetchProfile(); fetchSettings(); fetchBlockedUsers(); checkMfaStatus(); fetchAvatar(); }
  }, [user]);

  const checkMfaStatus = async () => {
    try {
      const { data } = await supabase.auth.mfa.listFactors();
      setMfaEnabled(!!data?.totp?.find((f) => f.status === "verified"));
    } catch {}
  };

  const fetchAvatar = async () => {
    if (!user) return;
    const { data } = await supabase.from("profiles").select("avatar_url").eq("user_id", user.id).single();
    if (data?.avatar_url) setAvatarUrl(data.avatar_url);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.type)) {
      toast.error("Sadece JPEG, PNG, WebP veya GIF yÃ¼kleyebilirsiniz.");
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
        toast.error("YÃ¼kleme baÅŸarÄ±sÄ±z: " + uploadError.message);
        return;
      }

      const { data: urlData } = supabase.storage.from("uploads").getPublicUrl(filePath);
      const publicUrl = urlData.publicUrl + "?t=" + Date.now();

      // NSFW check
      const modResult = await moderateImage(publicUrl, "avatar", user.id);
      if (!modResult.safe) {
        await supabase.storage.from("uploads").remove([filePath]);
        toast.error("Bu gÃ¶rsel platform kurallarÄ±nÄ± ihlal ediyor ve yÃ¼klenemez.");
        return;
      }

      // Update profile
      const { error: updateError } = await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("user_id", user.id);
      if (updateError) {
        toast.error("Profil gÃ¼ncellenemedi.");
        return;
      }

      setAvatarUrl(publicUrl);
      toast.success("Avatar gÃ¼ncellendi!");
    } catch {
      toast.error("Avatar yÃ¼klenirken bir hata oluÅŸtu.");
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
      toast.success("Avatar kaldÄ±rÄ±ldÄ±.");
    } catch {
      toast.error("Avatar kaldÄ±rÄ±lamadÄ±.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const fetchProfile = async () => {
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
  };

  const fetchSettings = async () => {
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
  };

  const fetchBlockedUsers = async () => {
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
  };

  const handleUnblock = async (blockId: string) => {
    setUnblocking(blockId);
    const { error } = await supabase.from("blocked_users").delete().eq("id", blockId);
    if (error) {
      toast.error("Engel kaldÄ±rÄ±lamadÄ±.");
    } else {
      toast.success("Engel kaldÄ±rÄ±ldÄ±.");
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
      toast.error(`KullanÄ±cÄ± adÄ±nÄ± ${daysUntilUsernameChange()} gÃ¼n sonra deÄŸiÅŸtirebilirsiniz.`);
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
        toast.error("GÃ¶rÃ¼nen ad uygunsuz iÃ§erik barÄ±ndÄ±rÄ±yor. LÃ¼tfen farklÄ± bir ad seÃ§in.");
        setSaving(false);
        return;
      }
    }

    // Instant bio check
    if (profile.bio.trim()) {
      const bioQuick = quickContentCheck(profile.bio.trim());
      if (!bioQuick.safe) {
        toast.error(bioQuick.reason || "HakkÄ±mda metni uygunsuz iÃ§erik barÄ±ndÄ±rÄ±yor.");
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
        toast.error("GÃ¶rÃ¼nen ad uygunsuz iÃ§erik barÄ±ndÄ±rÄ±yor.");
        setSaving(false);
        return;
      }
    }

    if (usernameChanged) {
      if (!profile.username.trim() || profile.username.trim().length < 3) {
        toast.error("KullanÄ±cÄ± adÄ± en az 3 karakter olmalÄ±dÄ±r.");
        setSaving(false);
        return;
      }
      const profanityCheck = checkUsernameProfanity(profile.username.trim());
      if (!profanityCheck.safe) {
        toast.error("Bu kullanÄ±cÄ± adÄ± uygunsuz iÃ§erik barÄ±ndÄ±rÄ±yor. LÃ¼tfen farklÄ± bir ad seÃ§in.");
        setSaving(false);
        return;
      }
      updateData.username = profile.username.trim();
      updateData.username_changed_at = new Date().toISOString();
    }

    const { error } = await supabase.from("profiles").update(updateData).eq("user_id", user.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Profil gÃ¼ncellendi!");
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
      toast.success("HesabÄ±nÄ±z baÅŸarÄ±yla silindi.");
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
    { id: "security", label: "GÃ¼venlik", icon: Lock },
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
                  Hesap, akademik kimlik, gizlilik ve bildirim tercihlerinizi yÃ¶netin.
                </p>
                <AcademicMeta
                  className="mt-2"
                  size="sm"
                  tone="muted"
                  items={[
                    ...(profile.university
                      ? [{ kind: "university" as const, label: "Ãœniversite", value: profile.university, emphasis: "subtle" as const }]
                      : []),
                    ...(profile.department
                      ? [{ kind: "department" as const, label: "BÃ¶lÃ¼m", value: profile.department, emphasis: "subtle" as const }]
                      : []),
                    ...(profile.class_year !== null
                      ? [{ kind: "custom" as const, label: "SÄ±nÄ±f", value: profile.class_year === 0 ? "HazÄ±rlÄ±k" : `${profile.class_year}. SÄ±nÄ±f`, emphasis: "subtle" as const }]
                      : []),
                  ]}
                />
              </div>
            </div>
          </div>
        </Surface>

        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-[248px_minmax(0,1fr)]">
          {/* Sidebar */}
          <div>
            <Surface variant="outline" border="subtle" radius="xl" padding="sm" className="md:sticky md:top-24">
              <p className="px-2 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">BÃ¶lÃ¼mler</p>
              <div className="space-y-1 p-1.5">
                {sections.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setActiveSection(s.id)}
                    className={`w-full rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                      activeSection === s.id
                        ? "border-primary/35 bg-gradient-to-r from-primary/12 via-primary/5 to-background text-primary shadow-[var(--shadow-soft)]"
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
                  <CardDescription className="text-xs">Temel hesap bilgilerinizi yÃ¶netin.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3.5">
                  {/* Avatar Upload */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Profil FotoÄŸrafÄ±</Label>
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
                          {uploadingAvatar ? "YÃ¼kleniyor..." : "FotoÄŸraf YÃ¼kle"}
                        </Button>
                        {avatarUrl && (
                          <Button type="button" variant="ghost" size="sm" className="h-7 rounded-lg text-xs text-destructive hover:text-destructive" onClick={handleRemoveAvatar} disabled={uploadingAvatar}>
                            <Trash2 className="h-3 w-3 mr-1" /> KaldÄ±r
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
                    <p className="text-xs text-muted-foreground">E-posta deÄŸiÅŸikliÄŸi ÅŸu anda desteklenmemektedir.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">KullanÄ±cÄ± AdÄ±</Label>
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
                        KullanÄ±cÄ± adÄ±nÄ±zÄ± {daysUntilUsernameChange()} gÃ¼n sonra deÄŸiÅŸtirebilirsiniz. (30 gÃ¼nde 1 kez)
                      </p>
                    )}
                    {canChangeUsername() && (
                      <p className="text-xs text-muted-foreground">KullanÄ±cÄ± adÄ± 30 gÃ¼nde bir deÄŸiÅŸtirilebilir.</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">GÃ¶rÃ¼nen Ad (Ä°steÄŸe baÄŸlÄ±)</Label>
                    <Input
                      value={profile.display_name}
                      onChange={(e) => setProfile((p) => ({ ...p, display_name: e.target.value }))}
                      placeholder="Ad Soyad"
                      maxLength={50}
                      className="h-9 rounded-xl text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">HakkÄ±mda (Ä°steÄŸe baÄŸlÄ±)</Label>
                    <Textarea
                      value={profile.bio}
                      onChange={(e) => setProfile((p) => ({ ...p, bio: e.target.value }))}
                      placeholder="Kendinizi kÄ±saca tanÄ±tÄ±n..."
                      rows={3}
                      maxLength={300}
                      className="rounded-xl text-sm"
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
                      Ãœniversite ve bÃ¶lÃ¼m bilgileri kayÄ±t sÄ±rasÄ±nda belirlenir ve deÄŸiÅŸtirilemez.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3.5">
                    <AcademicMeta
                      size="sm"
                      tone="muted"
                      items={[
                        { kind: "verified", label: "DoÄŸrulanmÄ±ÅŸ Ã–ÄŸrenci", emphasis: "default" },
                        ...(profile.university ? [{ kind: "university" as const, label: "Ãœniversite", value: profile.university, emphasis: "subtle" as const }] : []),
                        ...(profile.department ? [{ kind: "department" as const, label: "BÃ¶lÃ¼m", value: profile.department, emphasis: "subtle" as const }] : []),
                      ]}
                    />
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold flex items-center gap-1.5">
                        Ãœniversite
                        <Lock className="h-3 w-3 text-muted-foreground" />
                      </Label>
                      <Input
                        value={profile.university}
                        disabled
                        className="h-9 rounded-xl bg-secondary/50 text-sm"
                      />
                      <p className="text-xs text-muted-foreground">
                        Ãœniversite bilgisi e-posta adresinize baÄŸlÄ±dÄ±r ve deÄŸiÅŸtirilemez.
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold flex items-center gap-1.5">
                        BÃ¶lÃ¼m
                        <Lock className="h-3 w-3 text-muted-foreground" />
                      </Label>
                      <Input
                        value={profile.department}
                        disabled
                        className="h-9 rounded-xl bg-secondary/50 text-sm"
                      />
                      <p className="text-xs text-muted-foreground">
                        BÃ¶lÃ¼m bilgisi kayÄ±t sÄ±rasÄ±nda belirlenir ve deÄŸiÅŸtirilemez.
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold flex items-center gap-1.5">
                        SÄ±nÄ±f
                        <Lock className="h-3 w-3 text-muted-foreground" />
                      </Label>
                      <Input
                        value={profile.class_year !== null ? (profile.class_year === 0 ? "HazÄ±rlÄ±k" : `${profile.class_year}. SÄ±nÄ±f`) : "BelirtilmemiÅŸ"}
                        disabled
                        className="h-9 rounded-xl bg-secondary/50 text-sm"
                      />
                      <p className="text-xs text-muted-foreground">
                        SÄ±nÄ±f dÃ¼zeyi kayÄ±t sÄ±rasÄ±nda belirlenir ve deÄŸiÅŸtirilemez.
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
                  <h2 className="font-heading text-base font-bold">GÃ¼venlik</h2>
                  <p className="text-xs text-muted-foreground">Ä°ki adÄ±mlÄ± doÄŸrulama ile hesabÄ±nÄ±zÄ± koruyun.</p>
                </div>
                <TwoFactorSetup enabled={mfaEnabled} onStatusChange={checkMfaStatus} />
              </Surface>
            )}

            {activeSection === "privacy" && (
              <div className="space-y-3.5">
                <Surface variant="raised" border="subtle" radius="xl" padding="none">
                  <CardHeader>
                    <CardTitle className="text-base font-extrabold">Gizlilik ve DM AyarlarÄ±</CardTitle>
                    <CardDescription className="text-xs">Kimler size mesaj gÃ¶nderebileceÄŸini belirleyin.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Kimler DM gÃ¶nderebilir?</Label>
                      <Select value={settings.dm_allowed} onValueChange={(v) => setSettings((s) => ({ ...s, dm_allowed: v }))}>
                        <SelectTrigger className="h-9 rounded-xl text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="everyone">Herkes</SelectItem>
                          <SelectItem value="nobody">HiÃ§ kimse</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        "Herkes" seÃ§ili ise tÃ¼m kullanÄ±cÄ±lar size doÄŸrudan mesaj gÃ¶nderebilir.
                      </p>
                    </div>
                    <Separator />
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">BaÄŸlantÄ± isteklerini engelle</p>
                          <p className="text-xs text-muted-foreground">
                            Aktif olduÄŸunda hiÃ§ kimse size baÄŸlantÄ± isteÄŸi gÃ¶nderemez.
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
                              Aktif olduÄŸunda diÄŸer kullanÄ±cÄ±lar sizi Ã§evrimiÃ§i olarak gÃ¶remez.
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
                            <p className="text-sm font-medium">RahatsÄ±z Etme Modu</p>
                            <p className="text-xs text-muted-foreground">
                              Aktif olduÄŸunda yeni DM mesajlarÄ± engellenir ve bildirimler sÄ±nÄ±rlandÄ±rÄ±lÄ±r.
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
                      Engellenen KullanÄ±cÄ±lar
                    </CardTitle>
                    <CardDescription className="text-xs">EngellediÄŸiniz kullanÄ±cÄ±larÄ± gÃ¶rÃ¼ntÃ¼leyin ve yÃ¶netin.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {loadingBlocked ? (
                      <StateBlock
                        variant="loading"
                        size="inline"
                        title="Engellenen kullanÄ±cÄ±lar yÃ¼kleniyor"
                        description="LÃ¼tfen bekleyin."
                      />
                    ) : blockedUsers.length === 0 ? (
                      <StateBlock
                        variant="empty"
                        size="inline"
                        icon={<ShieldOff className="h-4 w-4" />}
                        title="HenÃ¼z engellenen kullanÄ±cÄ± yok"
                        description="Bir kullanÄ±cÄ±yÄ± DM ekranÄ±ndan engelleyebilirsiniz."
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
                                  {[blocked.university, blocked.department].filter(Boolean).join(" Â· ") || "Bilgi yok"}
                                  {" Â· "}
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
                                "Engeli KaldÄ±r"
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
                  <CardTitle className="text-base font-extrabold">Bildirim AyarlarÄ±</CardTitle>
                  <CardDescription className="text-xs">Hangi bildirimleri almak istediÄŸinizi seÃ§in.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3.5">
                  {[
                    { key: "mention_notifications" as const, label: "Bahsetme bildirimleri", desc: "Birisi sizi @kullanÄ±cÄ±adÄ± ile etiketlediÄŸinde" },
                    { key: "dm_notifications" as const, label: "DM bildirimleri", desc: "Yeni mesaj veya DM isteÄŸi geldiÄŸinde" },
                    { key: "reply_notifications" as const, label: "YanÄ±t bildirimleri", desc: "Ä°Ã§eriÄŸinize yanÄ±t verildiÄŸinde" },
                    { key: "vote_notifications" as const, label: "Oy bildirimleri", desc: "Ä°Ã§eriÄŸiniz oy aldÄ±ÄŸÄ±nda" },
                    { key: "system_notifications" as const, label: "Sistem bildirimleri", desc: "Platform haberleri ve gÃ¼ncellemeler" },
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
                      HesabÄ±nÄ±zÄ± kalÄ±cÄ± olarak silin. Bu iÅŸlem geri alÄ±namaz.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3.5">
                    <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20 space-y-2">
                      <p className="text-sm font-medium text-destructive">Dikkat: Bu iÅŸlem geri alÄ±namaz!</p>
                      <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                        <li>TÃ¼m gÃ¶nderileriniz, yorumlarÄ±nÄ±z ve mesajlarÄ±nÄ±z silinecektir.</li>
                        <li>KazandÄ±ÄŸÄ±nÄ±z puanlar ve rozetler kalÄ±cÄ± olarak kaldÄ±rÄ±lacaktÄ±r.</li>
                        <li>AynÄ± e-posta adresiyle 3 gÃ¼n boyunca yeniden kayÄ±t olamazsÄ±nÄ±z.</li>
                      </ul>
                    </div>
                    <Button
                      variant="destructive"
                      className="h-9 rounded-xl font-semibold"
                      onClick={() => setDeleteDialogOpen(true)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      HesabÄ±mÄ± Sil
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
                Hesap Silme OnayÄ±
              </DialogTitle>
              <DialogDescription>
                Bu iÅŸlem geri alÄ±namaz. HesabÄ±nÄ±z ve tÃ¼m verileriniz kalÄ±cÄ± olarak silinecektir.
                AynÄ± e-posta adresiyle 3 gÃ¼n boyunca yeniden kayÄ±t olamazsÄ±nÄ±z.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3.5">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Onaylamak iÃ§in <span className="font-mono text-destructive">HESABIMI SIL</span> yazÄ±n
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
                Ä°ptal
              </Button>
              <Button
                variant="destructive"
                disabled={deleteConfirmText !== "HESABIMI SIL" || deleting}
                onClick={handleDeleteAccount}
              >
                {deleting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Siliniyor...</> : "KalÄ±cÄ± Olarak Sil"}
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
        <StateBlock variant="loading" size="inline" title="Destek talepleri yÃ¼kleniyor" description="LÃ¼tfen bekleyin." />
      </Surface>
    );
  }
  if (tickets.length === 0) return null;

  return (
    <Surface variant="raised" border="subtle" radius="xl" padding="none">
      <CardHeader>
        <CardTitle className="text-base font-extrabold">Destek Taleplerim</CardTitle>
        <CardDescription className="text-xs">GÃ¶nderdiÄŸiniz destek talepleri ve yanÄ±tlarÄ±.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {tickets.map((t: any) => (
          <Surface key={t.id} variant="soft" border="subtle" radius="lg" padding="sm" className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">{t.subject}</p>
              <Badge variant={t.status === "open" ? "destructive" : t.status === "replied" ? "default" : "secondary"} className="text-xs">
                {t.status === "open" ? "AÃ§Ä±k" : t.status === "replied" ? "YanÄ±tlandÄ±" : "KapatÄ±ldÄ±"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{t.message}</p>
            {t.admin_reply && (
              <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/10">
                <p className="text-xs font-semibold text-primary mb-1">Admin YanÄ±tÄ±:</p>
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
    if (!explanation.trim()) { toast.error("LÃ¼tfen deÄŸiÅŸiklik nedeninizi aÃ§Ä±klayÄ±n."); return; }
    setLoading(true);
    const { error } = await supabase.from("academic_suggestions").insert({
      user_id: userId,
      type: "info_change",
      university: requestUni || currentProfile.university,
      department: requestDept || currentProfile.department,
      class_year: requestYear,
      explanation: explanation.trim(),
    } as any);
    if (error) toast.error("GÃ¶nderilemedi: " + error.message);
    else { toast.success("DeÄŸiÅŸiklik talebiniz gÃ¶nderildi. Admin incelemesinden sonra gÃ¼ncellenecektir."); setExplanation(""); }
    setLoading(false);
  };

  return (
    <Surface variant="raised" border="subtle" radius="xl" padding="none">
      <CardHeader>
        <CardTitle className="text-base font-extrabold">Akademik Bilgi DeÄŸiÅŸiklik Talebi</CardTitle>
        <CardDescription className="text-xs">
          YanlÄ±ÅŸ veya gÃ¼ncellenmeyen bilgileriniz varsa deÄŸiÅŸiklik talebi gÃ¶nderin. Admin onayÄ±ndan sonra gÃ¼ncellenecektir.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3.5">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Yeni Ãœniversite</Label>
          <Input value={requestUni} onChange={(e) => setRequestUni(e.target.value)} placeholder="GÃ¼ncellenecek Ã¼niversite" className="h-9 rounded-xl text-sm" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Yeni BÃ¶lÃ¼m</Label>
          <Input value={requestDept} onChange={(e) => setRequestDept(e.target.value)} placeholder="GÃ¼ncellenecek bÃ¶lÃ¼m" className="h-9 rounded-xl text-sm" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Yeni SÄ±nÄ±f</Label>
          <Select value={requestYear} onValueChange={setRequestYear}>
            <SelectTrigger className="h-9 rounded-xl text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="0">HazÄ±rlÄ±k</SelectItem>
              {[1,2,3,4,5,6].map(y => <SelectItem key={y} value={String(y)}>{y}. SÄ±nÄ±f</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">DeÄŸiÅŸiklik Nedeni <span className="text-destructive">*</span></Label>
          <Textarea value={explanation} onChange={(e) => setExplanation(e.target.value)} placeholder="Neden deÄŸiÅŸiklik yapÄ±lmasÄ± gerektiÄŸini aÃ§Ä±klayÄ±n..." rows={3} maxLength={500} className="text-sm" />
        </div>
        <Button onClick={handleSubmit} disabled={loading || !explanation.trim()} className="h-9 rounded-xl font-semibold">
          {loading ? "GÃ¶nderiliyor..." : "DeÄŸiÅŸiklik Talebi GÃ¶nder"}
        </Button>
      </CardContent>
    </Surface>
  );
}

