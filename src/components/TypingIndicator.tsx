import type { TypingUser } from "@/hooks/useTypingIndicator";

export function TypingIndicator({ typingUsers }: { typingUsers: TypingUser[] }) {
  if (typingUsers.length === 0) return null;

  const text =
    typingUsers.length === 1
      ? `${typingUsers[0].username} yazıyor`
      : typingUsers.length === 2
        ? `${typingUsers[0].username} ve ${typingUsers[1].username} yazıyor`
        : `${typingUsers[0].username} ve ${typingUsers.length - 1} kişi yazıyor`;

  return (
    <div className="px-4 py-1.5 text-[11px] text-muted-foreground animate-pulse flex items-center gap-1.5">
      <span className="flex gap-0.5">
        <span className="h-1 w-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
        <span className="h-1 w-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
        <span className="h-1 w-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
      </span>
      {text}...
    </div>
  );
}
