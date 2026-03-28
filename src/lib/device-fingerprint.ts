/**
 * Simple browser fingerprint for device recognition.
 * Not a full fingerprint library — just enough to detect new devices.
 */
export function generateDeviceFingerprint(): string {
  const components = [
    navigator.userAgent,
    navigator.language,
    screen.width + "x" + screen.height,
    screen.colorDepth?.toString() || "",
    new Date().getTimezoneOffset().toString(),
    navigator.hardwareConcurrency?.toString() || "",
    (navigator as any).deviceMemory?.toString() || "",
  ];
  
  // Simple hash
  const str = components.join("|");
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

export function getDeviceInfo() {
  const ua = navigator.userAgent;
  let browser = "Unknown";
  let os = "Unknown";

  if (ua.includes("Firefox")) browser = "Firefox";
  else if (ua.includes("Edg")) browser = "Edge";
  else if (ua.includes("Chrome")) browser = "Chrome";
  else if (ua.includes("Safari")) browser = "Safari";

  if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Mac")) os = "macOS";
  else if (ua.includes("Linux")) os = "Linux";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";

  return { browser, os, fingerprint: generateDeviceFingerprint() };
}

const KNOWN_DEVICES_KEY = "known_devices";

export function isNewDevice(): boolean {
  const current = generateDeviceFingerprint();
  const known = JSON.parse(localStorage.getItem(KNOWN_DEVICES_KEY) || "[]") as string[];
  return !known.includes(current);
}

export function markDeviceAsKnown(): void {
  const current = generateDeviceFingerprint();
  const known = JSON.parse(localStorage.getItem(KNOWN_DEVICES_KEY) || "[]") as string[];
  if (!known.includes(current)) {
    known.push(current);
    // Keep last 10 devices
    if (known.length > 10) known.shift();
    localStorage.setItem(KNOWN_DEVICES_KEY, JSON.stringify(known));
  }
}
