import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Star, GraduationCap, Building2 } from "lucide-react";

type MentionProfile = {
  user_id: string;
  username: string;
  university?: string;
  department?: string;
  class_year?: number | null;
  reputation_points?: number | null;
  bio?: string | null;
};

export function RenderMentions({ text }: { text: string }) {
  const parts = text.split(/(@\w+)/g);
  return parts.map((part, i) => {
    if (part.match(/^@\w+$/)) {
      const username = part.slice(1);
      return <MentionLink key={i} username={username} />;
    }
    return <span key={i}>{part}</span>;
  });
}

function MentionLink({ username }: { username: string }) {
  const [profile, setProfile] = useState<MentionProfile | null>(null);
  const [loaded, setLoaded] = useState(false);

  const fetchProfile = async () => {
    if (loaded) return;
    const { data } = await supabase
      .from("profiles")
      .select("user_id, username, university, department, class_year, reputation_points, bio")
      .eq("username", username)
      .maybeSingle();
    setProfile(data as MentionProfile | null);
    setLoaded(true);
  };

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <Link
          to={profile ? `/user/${profile.user_id}` : `/?search=${username}`}
          className="text-primary font-semibold hover:underline bg-primary/5 px-0.5 rounded"
          onClick={(e) => e.stopPropagation()}
          onMouseEnter={fetchProfile}
        >
          @{username}
        </Link>
      </HoverCardTrigger>
      <HoverCardContent className="w-64 p-3" side="top" align="start">
        {profile ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <Avatar className="h-9 w-9">
                <AvatarFallback className="text-sm font-bold bg-primary/10 text-primary">
                  {(profile.username || "?")[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-sm font-bold truncate">@{profile.username}</p>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Star className="h-2.5 w-2.5 text-primary" />
                  <span className="font-semibold text-primary">{profile.reputation_points ?? 0}</span>
                  <span>puan</span>
                </div>
              </div>
            </div>
            {(profile.university || profile.department) && (
              <div className="space-y-0.5 text-[11px] text-muted-foreground">
                {profile.university && (
                  <div className="flex items-center gap-1">
                    <GraduationCap className="h-3 w-3 shrink-0" />
                    <span>{profile.university}</span>
                  </div>
                )}
                {profile.department && (
                  <div className="flex items-center gap-1">
                    <Building2 className="h-3 w-3 shrink-0" />
                    <span>{profile.department}</span>
                    {profile.class_year && <span>· {profile.class_year}. Sınıf</span>}
                  </div>
                )}
              </div>
            )}
            {profile.bio && (
              <p className="text-[11px] text-muted-foreground line-clamp-2 italic">{profile.bio}</p>
            )}
          </div>
        ) : loaded ? (
          <p className="text-xs text-muted-foreground">Kullanıcı bulunamadı.</p>
        ) : (
          <div className="flex items-center justify-center py-2">
            <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}
