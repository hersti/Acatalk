import { validatePassword, getPasswordStrength } from "@/lib/password-validation";
import { Check, X } from "lucide-react";

interface Props {
  password: string;
}

export default function PasswordStrengthIndicator({ password }: Props) {
  const checks = validatePassword(password);
  const strength = getPasswordStrength(password);

  if (!password) return null;

  const strengthLabel =
    strength <= 2 ? "Zayıf" : strength <= 3 ? "Orta" : strength <= 4 ? "İyi" : "Güçlü";
  const strengthColor =
    strength <= 2
      ? "bg-destructive"
      : strength <= 3
      ? "bg-warning"
      : strength <= 4
      ? "bg-primary"
      : "bg-success";

  return (
    <div className="space-y-2 mt-1.5">
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${strengthColor}`}
            style={{ width: `${(strength / 5) * 100}%` }}
          />
        </div>
        <span className="text-[10px] font-medium text-muted-foreground">{strengthLabel}</span>
      </div>
      <ul className="space-y-0.5">
        {checks.map((check) => (
          <li key={check.label} className="flex items-center gap-1.5 text-[10px]">
            {check.met ? (
              <Check className="h-3 w-3 text-success" />
            ) : (
              <X className="h-3 w-3 text-muted-foreground" />
            )}
            <span className={check.met ? "text-success" : "text-muted-foreground"}>
              {check.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
