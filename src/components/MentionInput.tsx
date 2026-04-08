import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Star } from "lucide-react";

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  maxLength?: number;
}

interface UserSuggestion {
  user_id: string;
  username: string;
  university?: string;
  department?: string;
  class_year?: number | null;
  reputation_points?: number | null;
  bio?: string | null;
}

export default function MentionInput({ value, onChange, onSubmit, placeholder, rows = 2, className, maxLength }: MentionInputProps) {
  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStart, setMentionStart] = useState(-1);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const searchUsers = useCallback(async (query: string) => {
    if (query.length < 1) { setSuggestions([]); return; }
    const { data } = await supabase
      .from("profiles")
      .select("user_id, username, university, department, class_year, reputation_points, bio")
      .ilike("username", `%${query}%`)
      .not("username", "is", null)
      .limit(6);
    setSuggestions((data as UserSuggestion[]) || []);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    onChange(newValue);

    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = newValue.slice(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

    if (mentionMatch) {
      setMentionStart(cursorPos - mentionMatch[0].length);
      setMentionQuery(mentionMatch[1]);
      setShowSuggestions(true);
      setSelectedIdx(0);
      // Debounce search
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => searchUsers(mentionMatch[1]), 150);
    } else {
      setShowSuggestions(false);
      setMentionQuery("");
    }
  };

  const insertMention = (username: string) => {
    const before = value.slice(0, mentionStart);
    const after = value.slice(mentionStart + mentionQuery.length + 1);
    const newValue = `${before}@${username} ${after}`;
    onChange(newValue);
    setShowSuggestions(false);
    setMentionQuery("");
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Mention suggestions navigation
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx((prev) => Math.min(prev + 1, suggestions.length - 1));
        return;
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx((prev) => Math.max(prev - 1, 0));
        return;
      } else if (e.key === "Enter" || e.key === "Tab") {
        if (suggestions[selectedIdx]) {
          e.preventDefault();
          insertMention(suggestions[selectedIdx].username);
        }
        return;
      } else if (e.key === "Escape") {
        setShowSuggestions(false);
        return;
      }
    }
    // Enter to send (without shift)
    if (e.key === "Enter" && !e.shiftKey && onSubmit) {
      e.preventDefault();
      onSubmit();
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        className={className}
        maxLength={maxLength}
      />
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute left-0 right-0 bottom-full mb-1 bg-card border rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto"
        >
          {suggestions.map((s, i) => (
            <button
              key={s.user_id}
              type="button"
              onClick={() => insertMention(s.username)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors ${
                i === selectedIdx ? "bg-primary/10" : "hover:bg-secondary/50"
              }`}
            >
              <Avatar className="h-7 w-7">
                <AvatarFallback className="text-[10px] font-bold bg-primary/10 text-primary">
                  {(s.username || "?")[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <span className="font-semibold text-primary">@{s.username}</span>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  {s.university && <span>{s.university}</span>}
                  {s.department && <span>· {s.department}</span>}
                  {s.reputation_points != null && s.reputation_points > 0 && (
                    <span className="flex items-center gap-0.5"><Star className="h-2.5 w-2.5" />{s.reputation_points}</span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
