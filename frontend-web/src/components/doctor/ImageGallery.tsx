/**
 * ImageGallery — Grid de thumbnails com modal de visualização em tela cheia.
 * Para imagens de receita ou exame.
 */
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Image, Expand } from 'lucide-react';

export interface ImageGalleryProps {
  images: string[];
  label: string;
}

export function ImageGallery({ images, label }: ImageGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  if (!images || images.length === 0) return null;

  const openModal = (index: number) => setSelectedIndex(index);
  const closeModal = () => setSelectedIndex(null);

  return (
    <>
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Image className="h-4 w-4 text-primary" aria-hidden />
            {label}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {images.map((url, i) => (
              <button
                key={i}
                type="button"
                onClick={() => openModal(i)}
                className="relative aspect-[4/5] rounded-lg overflow-hidden border border-border hover:border-primary/50 transition-colors group focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
              >
                <img
                  src={url}
                  alt={`${label} ${i + 1}`}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <Expand className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 drop-shadow-md" />
                </div>
                {images.length > 1 && (
                  <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/60 text-white text-xs font-medium">
                    {i + 1}/{images.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={selectedIndex !== null} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] w-fit p-0 overflow-hidden">
          <DialogTitle className="sr-only">{label} — visualização ampliada</DialogTitle>
          {selectedIndex !== null && images[selectedIndex] && (
            <div className="relative">
              <img
                src={images[selectedIndex]}
                alt={`${label} ${selectedIndex + 1}`}
                className="max-h-[90vh] w-auto object-contain"
              />
              {images.length > 1 && (
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/60 text-white text-sm">
                  {selectedIndex + 1} / {images.length}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
