"use client";

import { useState } from "react";
import { iolAuth } from "@/lib/iol/auth";
import { useIolStore } from "@/lib/store/iol-store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function IOLLoginModal({ open, onClose, onSuccess }: Props) {
  const setLoggedIn = useIolStore((s) => s.setLoggedIn);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;

    setLoading(true);
    setError(null);

    try {
      iolAuth.setCredentials(username, password);
      await iolAuth.getAccessToken();
      setLoggedIn(true);
      onSuccess?.();
      onClose();
    } catch (err) {
      setError("Usuario o contraseña incorrectos. Verificá tus credenciales de IOL.");
      iolAuth.clearSession();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-tv-panel border-tv-border text-tv-text sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-tv-text">Conectar con IOL</DialogTitle>
          <DialogDescription className="text-tv-text-muted">
            Ingresá tus credenciales de InvertirOnLine. Se guardan localmente en tu dispositivo.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-tv-text-muted">Usuario IOL</label>
            <Input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="tu@email.com"
              className="bg-tv-bg border-tv-border text-tv-text placeholder:text-tv-text-dim"
              autoComplete="username"
              disabled={loading}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-tv-text-muted">Contraseña IOL</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="bg-tv-bg border-tv-border text-tv-text placeholder:text-tv-text-dim"
              autoComplete="current-password"
              disabled={loading}
            />
          </div>

          {error && (
            <p className="text-xs text-tv-red bg-tv-red/10 rounded px-3 py-2">{error}</p>
          )}

          <Button
            type="submit"
            disabled={loading || !username || !password}
            className="bg-tv-blue hover:bg-tv-blue/90 text-white"
          >
            {loading ? "Conectando…" : "Conectar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
