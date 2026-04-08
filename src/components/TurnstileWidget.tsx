import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: any) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
    onTurnstileLoad?: () => void;
  }
}

interface Props {
  onVerify: (token: string) => void;
  onExpire?: () => void;
}

export default function TurnstileWidget({ onVerify, onExpire }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onVerifyRef = useRef(onVerify);
  const onExpireRef = useRef(onExpire);
  const [siteKey, setSiteKey] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    onVerifyRef.current = onVerify;
    onExpireRef.current = onExpire;
  }, [onExpire, onVerify]);

  // Fetch site key from edge function
  useEffect(() => {
    supabase.functions.invoke("get-turnstile-key").then(({ data }) => {
      if (data?.siteKey) setSiteKey(data.siteKey);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!siteKey) return;

    if (!document.getElementById("turnstile-script")) {
      const script = document.createElement("script");
      script.id = "turnstile-script";
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad";
      script.async = true;
      window.onTurnstileLoad = () => setLoaded(true);
      document.head.appendChild(script);
    } else if (window.turnstile) {
      setLoaded(true);
    }

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        try { window.turnstile.remove(widgetIdRef.current); } catch {}
        widgetIdRef.current = null;
      }
    };
  }, [siteKey]);

  useEffect(() => {
    if (!loaded || !containerRef.current || !window.turnstile || !siteKey) return;
    if (widgetIdRef.current) return;

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      callback: (token: string) => onVerifyRef.current(token),
      "expired-callback": () => onExpireRef.current?.(),
      theme: "auto",
      size: "flexible",
    });
  }, [loaded, siteKey]);

  if (!siteKey) return null;

  return <div ref={containerRef} className="mt-2" />;
}
