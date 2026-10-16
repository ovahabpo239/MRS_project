"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { NavLinks } from "./nav-links";
import type { NavItem } from "@/config/navigation";

type Props = { items: readonly NavItem[]; brand: string; children?: ReactNode };

export function MobileMenu({ items, brand, children }: Props) {
  const [open, setOpen] = useState(false);
  const openButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    document.body.classList.add("overflow-hidden");
    closeButton.current?.focus();
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    const trigger = openButton.current;
    return () => {
      document.body.classList.remove("overflow-hidden");
      document.removeEventListener("keydown", onKey);
      trigger?.focus();
    };
  }, [open, close]);

  return (
    <>
      <button
        ref={openButton}
        type="button"
        aria-label="Open menu"
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => setOpen(true)}
        className="flex items-center justify-center p-2 text-on-surface transition-colors hover:text-primary md:hidden"
      >
        <Menu className="size-8" aria-hidden="true" />
      </button>
      <div
        id="mobile-menu"
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        inert={!open}
        className={`fixed inset-0 z-[60] flex flex-col bg-background/95 backdrop-blur-xl transition-transform duration-500 motion-reduce:transition-none md:hidden ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex h-20 items-center justify-between px-margin-mobile">
          <Link
            href="/"
            onClick={close}
            className="font-headline-md text-headline-md font-black tracking-tighter text-primary"
          >
            {brand}
          </Link>
          <button
            ref={closeButton}
            type="button"
            aria-label="Close menu"
            onClick={close}
            className="p-2 text-on-surface transition-colors hover:text-primary"
          >
            <X className="size-8" aria-hidden="true" />
          </button>
        </div>
        <div className="flex flex-grow flex-col items-center justify-center gap-10">
          <NavLinks
            items={items}
            onNavigate={close}
            className="flex flex-col items-center gap-10"
            linkClassName="font-headline-md text-2xl"
          />
          <div onClick={close}>{children}</div>
        </div>
      </div>
    </>
  );
}
