"use client";

import { useLayoutEffect } from "react";
import { Moon, Sun } from "lucide-react";
import { THEME_STORAGE_KEY as STORAGE_KEY } from "@/lib/theme";
import { Button, cx } from "./ui";

function storedTheme() {
  try {
    const theme = localStorage.getItem(STORAGE_KEY);
    return theme === "light" || theme === "dark" ? theme : null;
  } catch {
    return null;
  }
}

export function ThemeToggle({ withLabel = false, className }: { withLabel?: boolean; className?: string }) {
  // En desarrollo, Strict Mode limpia los atributos de <html> al remontar; se reaplica aquí.
  useLayoutEffect(() => {
    const theme = storedTheme();
    if (theme) document.documentElement.dataset.theme = theme;
  }, []);

  function toggle() {
    const root = document.documentElement;
    const current =
      root.dataset.theme ?? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = current === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {}
  }

  return (
    <Button
      variant="ghost"
      size={withLabel ? "md" : "icon"}
      onClick={toggle}
      aria-label={withLabel ? undefined : "Cambiar tema claro u oscuro"}
      title={withLabel ? undefined : "Cambiar tema"}
      className={cx(withLabel && "gap-3", className)}
    >
      <Moon className="dark:hidden" />
      <Sun className="hidden dark:block" />
      {withLabel && (
        <>
          <span className="dark:hidden">Tema oscuro</span>
          <span className="hidden dark:inline">Tema claro</span>
        </>
      )}
    </Button>
  );
}
