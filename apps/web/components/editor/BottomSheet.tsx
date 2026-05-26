"use client";

import { type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

/**
 * BottomSheet
 *
 * Mobile-first bottom drawer built on Radix Dialog (already a project
 * dependency). Locks the panel content at 70vh so the canvas behind stays
 * partially visible — users keep their CV in view while editing settings or
 * reading AI suggestions.
 *
 * Why Radix Dialog instead of `vaul` / a hand-rolled portal:
 *   - free focus trap, scroll lock, and `Esc` handling
 *   - one fewer dependency to vet for a feature that only needs a sheet
 *   - the swipe-down gesture is approximated via a drag affordance handle
 *     plus a top-edge drag listener; a more polished gesture model can be
 *     swapped in later without touching the call sites.
 */
export interface BottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
}

export function BottomSheet({
  open,
  onOpenChange,
  title,
  children,
}: BottomSheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                className="fixed inset-0 z-40 bg-black/40"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
              />
            </Dialog.Overlay>

            <Dialog.Content asChild aria-describedby={undefined}>
              <motion.div
                className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t bg-background shadow-2xl outline-none"
                style={{ height: "70vh" }}
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                drag="y"
                dragDirectionLock
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={0.15}
                onDragEnd={(_, info) => {
                  // Generous threshold so accidental scroll touches don't
                  // close the sheet.
                  if (info.offset.y > 120 || info.velocity.y > 600) {
                    onOpenChange(false);
                  }
                }}
                transition={{
                  type: "spring",
                  damping: 30,
                  stiffness: 300,
                  // Reduced-motion users get a fast, non-spring transition.
                  ...((typeof window !== "undefined" &&
                    window.matchMedia("(prefers-reduced-motion: reduce)").matches)
                    ? { type: "tween", duration: 0.12 }
                    : {}),
                }}
              >
                {/* Drag affordance */}
                <div className="flex justify-center pt-2 pb-1" aria-hidden="true">
                  <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
                </div>

                <div className="flex items-center justify-between px-4 py-2 border-b">
                  <Dialog.Title className="text-sm font-semibold">
                    {title}
                  </Dialog.Title>
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      className="p-1 rounded hover:bg-muted text-muted-foreground"
                      aria-label="Tutup"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </Dialog.Close>
                </div>

                <div className="overflow-y-auto h-[calc(70vh-80px)]">
                  {children}
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
