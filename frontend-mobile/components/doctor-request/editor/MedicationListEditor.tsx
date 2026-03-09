import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { DesignColors } from '../../../lib/designSystem';
import { DoctorCard } from '../../ui/DoctorCard';

interface MedicationListEditorProps {
  medications: string[];
  onUpdate: (index: number, value: string) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
  colors: DesignColors;
}

export const MedicationListEditor = React.memo(function MedicationListEditor({
  medications, onUpdate, onRemove, onAdd, colors,
}: MedicationListEditorProps) {
  return (
    <DoctorCard style={styles.card}>
      <View style={styles.header}>
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>MEDICAMENTOS NA RECEITA</Text>
        <TouchableOpacity onPress={onAdd} style={styles.addBtn} activeOpacity={0.7}>
          <Ionicons name="add-circle" size={22} color={colors.primary} />
          <Text style={[styles.addText, { color: colors.primary }]}>Adicionar</Text>
        </TouchableOpacity>
      </View>
      <Text style={[styles.hint, { color: colors.textMuted }]}>
        Formato: Nome — posologia — quantidade (ex: Dipirona 500mg — 1cp 6/6h — 20 comprimidos)
      </Text>
      {medications.length === 0 ? (
        <Text style={[styles.empty, { color: colors.textMuted }]}>
          Nenhum medicamento. Use + nas sugestões, busque por CID ou adicione.
        </Text>
      ) : (
        medications.map((med, i) => (
          <View key={i} style={[styles.row, { borderBottomColor: colors.borderLight }]}>
            <View style={[styles.index, { backgroundColor: colors.primarySoft }]}>
              <Text style={[styles.indexText, { color: colors.primary }]}>{i + 1}</Text>
            </View>
            <TextInput
              style={[styles.input, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
              value={med}
              onChangeText={(v) => onUpdate(i, v)}
              placeholder={`Medicamento ${i + 1}`}
              placeholderTextColor={colors.textMuted}
            />
            <TouchableOpacity onPress={() => onRemove(i)} style={styles.removeBtn} hitSlop={8}>
              <Ionicons name="remove-circle" size={24} color={colors.error} />
            </TouchableOpacity>
          </View>
        ))
      )}
    </DoctorCard>
  );
});

interface ExamListEditorProps {
  exams: string[];
  onUpdate: (index: number, value: string) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
  colors: DesignColors;
}

export const ExamListEditor = React.memo(function ExamListEditor({
  exams, onUpdate, onRemove, onAdd, colors,
}: ExamListEditorProps) {
  return (
    <DoctorCard style={styles.card}>
      <View style={styles.header}>
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>EXAMES SOLICITADOS</Text>
        <TouchableOpacity onPress={onAdd} style={styles.addBtn} activeOpacity={0.7}>
          <Ionicons name="add-circle" size={22} color={colors.primary} />
          <Text style={[styles.addText, { color: colors.primary }]}>Adicionar</Text>
        </TouchableOpacity>
      </View>
      <Text style={[styles.hint, { color: colors.textMuted }]}>
        Liste os exames solicitados (um por linha)
      </Text>
      {exams.map((ex, i) => (
        <View key={i} style={[styles.row, { borderBottomColor: colors.borderLight }]}>
          <View style={[styles.index, { backgroundColor: colors.primarySoft }]}>
            <Text style={[styles.indexText, { color: colors.primary }]}>{i + 1}</Text>
          </View>
          <TextInput
            style={[styles.input, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
            value={ex}
            onChangeText={(v) => onUpdate(i, v)}
            placeholder={`Exame ${i + 1}`}
            placeholderTextColor={colors.textMuted}
          />
          <TouchableOpacity onPress={() => onRemove(i)} style={styles.removeBtn} hitSlop={8}>
            <Ionicons name="remove-circle" size={24} color={colors.error} />
          </TouchableOpacity>
        </View>
      ))}
    </DoctorCard>
  );
});

const styles = StyleSheet.create({
  card: { marginBottom: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sectionTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addText: { fontSize: 14, fontWeight: '600' },
  hint: { fontSize: 12, marginBottom: 12, lineHeight: 16 },
  empty: { fontSize: 13, fontStyle: 'italic', paddingVertical: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  index: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  indexText: { fontSize: 12, fontWeight: '700' },
  input: {
    flex: 1,
    fontSize: 14,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
  },
  removeBtn: { padding: 4, flexShrink: 0 },
});
