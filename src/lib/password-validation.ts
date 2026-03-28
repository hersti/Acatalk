export interface PasswordCheck {
  label: string;
  met: boolean;
}

export function validatePassword(password: string): PasswordCheck[] {
  return [
    { label: "En az 8 karakter", met: password.length >= 8 },
    { label: "Büyük harf (A-Z)", met: /[A-Z]/.test(password) },
    { label: "Küçük harf (a-z)", met: /[a-z]/.test(password) },
    { label: "Rakam (0-9)", met: /[0-9]/.test(password) },
    { label: "Özel karakter (!@#$...)", met: /[^A-Za-z0-9]/.test(password) },
  ];
}

export function isPasswordStrong(password: string): boolean {
  return validatePassword(password).every((c) => c.met);
}

export function getPasswordStrength(password: string): number {
  const checks = validatePassword(password);
  return checks.filter((c) => c.met).length;
}
