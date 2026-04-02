/**
 * Dialog de atalhos de teclado — mostra todos os atalhos disponíveis.
 * Estilo clean, inspirado no Notion/Linear.
 */
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { SHORTCUTS_LIST } from '@/hooks/useKeyboardShortcuts';
import { Keyboard } from 'lucide-react';

interface ShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShortcutsDialog({ open, onOpenChange }: ShortcutsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Keyboard className="h-4 w-4 text-primary" />
            Atalhos de teclado
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-1 pt-2">
          {SHORTCUTS_LIST.map((shortcut, i) => (
            <div
              key={i}
              className="flex items-center justify-between py-2 px-1 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <span className="text-sm text-foreground">{shortcut.label}</span>
              <div className="flex items-center gap-1">
                {shortcut.keys.map((key, j) => (
                  <span key={j}>
                    {j > 0 && <span className="text-muted-foreground mx-0.5 text-xs">+</span>}
                    <kbd className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-md bg-muted border border-border/50 text-[11px] font-mono text-muted-foreground shadow-sm">
                      {key}
                    </kbd>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground text-center pt-2 border-t border-border">
          No Windows/Linux, use <kbd className="px-1 py-0.5 rounded bg-muted border border-border/50 text-[10px] font-mono">Ctrl</kbd> no lugar de <kbd className="px-1 py-0.5 rounded bg-muted border border-border/50 text-[10px] font-mono">⌘</kbd>
        </p>
      </DialogContent>
    </Dialog>
  );
}
