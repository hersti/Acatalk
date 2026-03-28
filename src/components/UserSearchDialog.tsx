import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, Plus, MessageCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface UserSearchDialogProps {
  onUserSelected?: (userId: string) => void;
  triggerLabel?: string;
}

export default function UserSearchDialog({ onUserSelected, triggerLabel }: UserSearchDialogProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (q: string) => {
    setQuery(q);
    if (q.trim().length < 2) { setResults([]); return; }
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .or(`username.ilike.%${q.trim()}%,university.ilike.%${q.trim()}%,department.ilike.%${q.trim()}%`)
      .neq("user_id", user?.id || "")
      .limit(20);
    setResults(data || []);
    setLoading(false);
  };

  const handleSelect = (userId: string) => {
    if (onUserSelected) {
      onUserSelected(userId);
    } else {
      navigate(`/messages?to=${userId}`);
    }
    setOpen(false);
    setQuery("");
    setResults([]);
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5 text-xs">
          <Search className="h-3.5 w-3.5" />
          {triggerLabel || "Kullanıcı Ara"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">Kullanıcı Ara</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Kullanıcı adı, üniversite veya bölüm..."
              className="pl-9 h-10 rounded-xl"
              autoFocus
            />
          </div>

          <div className="max-h-64 overflow-y-auto space-y-1">
            {loading && <p className="text-xs text-muted-foreground text-center py-4">Aranıyor...</p>}
            {!loading && query.trim().length >= 2 && results.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">Sonuç bulunamadı.</p>
            )}
            {results.map((p) => (
              <button
                key={p.id}
                onClick={() => handleSelect(p.user_id)}
                className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-secondary/50 transition-colors text-left"
              >
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">
                    {(p.username || "?")[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.username || "Kullanıcı"}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {p.university || "—"} · {p.department || "—"} · {p.reputation_points ?? 0} puan
                  </p>
                </div>
                <MessageCircle className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
