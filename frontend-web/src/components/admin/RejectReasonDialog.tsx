import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface RejectReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
  doctorName: string;
}

export const RejectReasonDialog = ({
  open,
  onOpenChange,
  onConfirm,
  doctorName,
}: RejectReasonDialogProps) => {
  const [reason, setReason] = useState("");

  useEffect(() => {
    // Reset reason when dialog opens — intentional synchronous setState
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) setReason('');
  }, [open]);

  const handleConfirm = () => {
    onConfirm(reason);
    setReason("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Recusar médico</DialogTitle>
          <DialogDescription>
            Informe o motivo da recusa de <strong>{doctorName}</strong>.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          placeholder="Motivo da recusa..."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
          aria-label="Motivo da recusa"
        />
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={!reason.trim()}>
            Confirmar recusa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
