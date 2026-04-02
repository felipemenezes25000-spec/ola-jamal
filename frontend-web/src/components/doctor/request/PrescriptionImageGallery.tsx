/**
 * PrescriptionImageGallery — Galeria de imagens com zoom.
 * Alinhado ao mobile PrescriptionImageGallery.
 */
import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Image, Expand } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface PrescriptionImageGalleryProps {
  images: string[];
  label: string;
  iconBgColor?: string;
  className?: string;
}

export function PrescriptionImageGallery({
  images,
  label,
  iconBgColor = 'bg-primary/10',
  className,
}: PrescriptionImageGalleryProps) {
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);

  if (!images?.length) return null;

  return (
    <>
      <Card className={className}>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', iconBgColor)}>
              <Image className="h-4 w-4 text-primary" aria-hidden />
            </div>
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{label}</span>
            <span className="text-xs text-muted-foreground ml-auto">Clique para ampliar</span>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex gap-3 overflow-x-auto pb-2">
            {images.map((url, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setSelectedUrl(url)}
                className="relative shrink-0 rounded-xl overflow-hidden border border-border/50 hover:border-primary/30 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30"
                aria-label={`Ver imagem ${i + 1} de ${images.length}`}
              >
                <img
                  src={url}
                  alt={`${label} ${i + 1}`}
                  className="w-40 h-48 object-cover"
                />
                <div className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-black/50">
                  <Expand className="h-3.5 w-3.5 text-white" />
                </div>
                {images.length > 1 && (
                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/50 text-white text-xs font-medium">
                    {i + 1}/{images.length}
                  </div>
                )}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selectedUrl} onOpenChange={() => setSelectedUrl(null)}>
        <DialogContent className="max-w-full max-h-[90vh] w-fit p-0 overflow-hidden" aria-describedby={undefined}>
          <DialogHeader className="sr-only">
            <DialogTitle>Visualização ampliada</DialogTitle>
          </DialogHeader>
          {selectedUrl && (
            <img
              src={selectedUrl}
              alt="Imagem ampliada"
              className="max-h-[85vh] w-auto object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
