import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../../lib/themeDoctor';
import { DoctorCard } from '../ui/DoctorCard';
import { CompatibleImage } from '../CompatibleImage';
import { ZoomableImage } from '../ZoomableImage';

interface PrescriptionImageGalleryProps {
  images: string[];
  label: string;
  iconBackgroundColor: string;
  style?: object;
}

export function PrescriptionImageGallery({ images, label, iconBackgroundColor, style }: PrescriptionImageGalleryProps) {
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);

  if (!images || images.length === 0) return null;

  return (
    <>
      <DoctorCard style={style}>
        <View style={s.sectionHeader}>
          <View style={[s.sectionIconWrap, { backgroundColor: iconBackgroundColor }]}>
            <Ionicons name="image" size={16} color={colors.primary} />
          </View>
          <Text style={s.sectionLabel}>{label}</Text>
          <Text style={s.zoomHint}>Toque para ampliar</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.imageScroll}>
          {images.map((img, i) => (
            <TouchableOpacity key={i} onPress={() => setSelectedImageUri(img)} activeOpacity={0.8} style={s.thumbContainer}>
              <CompatibleImage uri={img} style={s.img} resizeMode="cover" />
              <View style={s.zoomBadge}>
                <Ionicons name="expand" size={14} color="#fff" />
              </View>
              {images.length > 1 && (
                <View style={s.imgCounter}>
                  <Text style={s.imgCounterText}>{i + 1}/{images.length}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </DoctorCard>

      <Modal
        visible={selectedImageUri !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedImageUri(null)}
        statusBarTranslucent
      >
        <View style={s.modalContainer}>
          <TouchableOpacity style={s.modalCloseButton} onPress={() => setSelectedImageUri(null)} activeOpacity={0.7}>
            <Ionicons name="close" size={32} color="#fff" />
          </TouchableOpacity>
          {selectedImageUri && (
            <View style={s.modalImageWrapper}>
              {Platform.OS === 'web' && /\.(heic|heif)$/i.test(selectedImageUri) ? (
                <CompatibleImage uri={selectedImageUri} style={s.modalImageFull} resizeMode="contain" />
              ) : (
                <ZoomableImage uri={selectedImageUri} onClose={() => setSelectedImageUri(null)} />
              )}
            </View>
          )}
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionIconWrap: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  sectionLabel: { fontSize: 11, fontFamily: typography.fontFamily.bold, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.8, textTransform: 'uppercase', flex: 1, marginBottom: 2 },
  zoomHint: { fontSize: 10, color: colors.textMuted, fontFamily: typography.fontFamily.regular },
  imageScroll: { marginTop: 4 },
  img: { width: 160, height: 200, borderRadius: 14 },
  thumbContainer: { marginRight: 10, position: 'relative' },
  zoomBadge: { position: 'absolute', bottom: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 12, padding: 5, alignItems: 'center', justifyContent: 'center' },
  imgCounter: { position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  imgCounterText: { fontSize: 10, fontFamily: typography.fontFamily.semibold, fontWeight: '600', color: '#fff' },
  modalContainer: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.95)', justifyContent: 'center', alignItems: 'center' },
  modalImageWrapper: { flex: 1, width: '100%', alignSelf: 'stretch' },
  modalImageFull: { flex: 1, width: '100%', minHeight: 300 },
  modalCloseButton: { position: 'absolute', top: Platform.OS === 'web' ? 20 : 60, right: spacing.md, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 25, padding: 10, width: 50, height: 50, justifyContent: 'center', alignItems: 'center' },
});
