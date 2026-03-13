import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useListBottomPadding } from '../../lib/ui/responsive';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../lib/ui/useAppTheme';
import type { DesignColors } from '../../lib/designSystem';
import { FadeIn } from '../../components/ui/FadeIn';
import { searchCatmat, type CatmatMedicamento } from '../../lib/sus-references';

const SUS_GREEN = '#16A34A';

type Tab = 'soap' | 'vitais' | 'prescricao' | 'historico';

export default function AtendimentoScreen() {
  const insets = useSafeAreaInsets();
  const listPadding = useListBottomPadding();
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [tab, setTab] = useState<Tab>('soap');

  // SOAP fields
  const [subjetivo, setSubjetivo] = useState('');
  const [objetivo, setObjetivo] = useState('');
  const [avaliacao, setAvaliacao] = useState('');
  const [plano, setPlano] = useState('');

  // Sinais vitais
  const [pa, setPa] = useState('');
  const [temp, setTemp] = useState('');
  const [fc, setFc] = useState('');
  const [fr, setFr] = useState('');
  const [peso, setPeso] = useState('');
  const [altura, setAltura] = useState('');
  const [satO2, setSatO2] = useState('');
  const [glicemia, setGlicemia] = useState('');

  // Prescrição
  const [medicamento, setMedicamento] = useState('');
  const [posologia, setPosologia] = useState('');
  const [prescricoes, setPrescricoes] = useState<{ med: string; pos: string; codigo?: string }[]>([]);
  const [catmatResults, setCatmatResults] = useState<CatmatMedicamento[]>([]);

  const handleMedChange = (text: string) => {
    setMedicamento(text);
    setCatmatResults(searchCatmat(text));
  };

  const selectCatmat = (item: CatmatMedicamento) => {
    setMedicamento(`${item.nome} ${item.concentracao} (${item.forma})`);
    setCatmatResults([]);
  };

  const addPrescricao = () => {
    if (!medicamento.trim()) return;
    setPrescricoes(prev => [...prev, { med: medicamento.trim(), pos: posologia.trim() }]);
    setMedicamento('');
    setPosologia('');
  };

  const salvarAtendimento = () => {
    Alert.alert('Atendimento Salvo', 'O atendimento foi registrado com sucesso.\n\nOs dados serão incluídos na próxima exportação e-SUS.');
  };

  const imc = useMemo(() => {
    const p = parseFloat(peso);
    const a = parseFloat(altura);
    if (p > 0 && a > 0) return (p / (a * a)).toFixed(1);
    return '';
  }, [peso, altura]);

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'soap', label: 'SOAP', icon: 'document-text-outline' },
    { key: 'vitais', label: 'Sinais Vitais', icon: 'pulse-outline' },
    { key: 'prescricao', label: 'Prescrição', icon: 'medical-outline' },
    { key: 'historico', label: 'Histórico', icon: 'time-outline' },
  ];

  const FieldLabel = ({ text }: { text: string }) => (
    <Text style={styles.fieldLabel}>{text}</Text>
  );

  const SoapField = ({ label, value, onChangeText, lines = 3 }: { label: string; value: string; onChangeText: (t: string) => void; lines?: number }) => (
    <View style={styles.fieldGroup}>
      <FieldLabel text={label} />
      <TextInput
        style={[styles.textArea, { minHeight: lines * 24 }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={`Registrar ${label.toLowerCase()}...`}
        placeholderTextColor={colors.textMuted}
        multiline
        textAlignVertical="top"
      />
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Patient header */}
      <View style={styles.patientHeader}>
        <View style={styles.patientAvatar}>
          <Text style={styles.patientAvatarText}>M</Text>
        </View>
        <View style={styles.patientInfo}>
          <Text style={styles.patientName}>Maria da Silva</Text>
          <Text style={styles.patientSub}>38 anos • F • CPF: 123.456.789-00</Text>
          <Text style={styles.patientSub}>UBS Central — Dr. Carlos Mendes</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {tabs.map(t => (
          <Pressable
            key={t.key}
            style={[styles.tabItem, tab === t.key && styles.tabItemActive]}
            onPress={() => setTab(t.key)}
          >
            <Ionicons name={t.icon as any} size={16} color={tab === t.key ? SUS_GREEN : colors.textMuted} />
            <Text style={[styles.tabLabel, tab === t.key && styles.tabLabelActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={[styles.scrollContent, { paddingBottom: listPadding }]} showsVerticalScrollIndicator={false}>
        {tab === 'soap' && (
          <FadeIn visible>
            <SoapField label="Subjetivo (Queixa)" value={subjetivo} onChangeText={setSubjetivo} lines={4} />
            <SoapField label="Objetivo (Exame Físico)" value={objetivo} onChangeText={setObjetivo} lines={4} />
            <SoapField label="Avaliação (Diagnóstico)" value={avaliacao} onChangeText={setAvaliacao} lines={3} />
            <SoapField label="Plano (Conduta)" value={plano} onChangeText={setPlano} lines={4} />

            <View style={styles.fieldGroup}>
              <FieldLabel text="CID-10" />
              <TextInput style={styles.input} placeholder="Ex: J06.9" placeholderTextColor={colors.textMuted} />
            </View>
          </FadeIn>
        )}

        {tab === 'vitais' && (
          <FadeIn visible>
            <View style={styles.vitaisGrid}>
              {[
                { label: 'Pressão Arterial', value: pa, set: setPa, placeholder: '120/80', unit: 'mmHg' },
                { label: 'Temperatura', value: temp, set: setTemp, placeholder: '36.5', unit: '°C' },
                { label: 'Freq. Cardíaca', value: fc, set: setFc, placeholder: '72', unit: 'bpm' },
                { label: 'Freq. Respiratória', value: fr, set: setFr, placeholder: '18', unit: 'rpm' },
                { label: 'Peso', value: peso, set: setPeso, placeholder: '70.0', unit: 'kg' },
                { label: 'Altura', value: altura, set: setAltura, placeholder: '1.70', unit: 'm' },
                { label: 'Saturação O₂', value: satO2, set: setSatO2, placeholder: '98', unit: '%' },
                { label: 'Glicemia', value: glicemia, set: setGlicemia, placeholder: '95', unit: 'mg/dL' },
              ].map((field, i) => (
                <View key={i} style={styles.vitalCard}>
                  <Text style={styles.vitalLabel}>{field.label}</Text>
                  <View style={styles.vitalInputRow}>
                    <TextInput
                      style={styles.vitalInput}
                      value={field.value}
                      onChangeText={field.set}
                      placeholder={field.placeholder}
                      placeholderTextColor={colors.textMuted}
                      keyboardType="decimal-pad"
                    />
                    <Text style={styles.vitalUnit}>{field.unit}</Text>
                  </View>
                </View>
              ))}
            </View>
            {imc ? (
              <View style={styles.imcCard}>
                <Text style={styles.imcLabel}>IMC Calculado</Text>
                <Text style={styles.imcValue}>{imc} kg/m²</Text>
              </View>
            ) : null}
          </FadeIn>
        )}

        {tab === 'prescricao' && (
          <FadeIn visible>
            <View style={styles.fieldGroup}>
              <FieldLabel text="Medicamento (CATMAT/RENAME)" />
              <TextInput style={styles.input} value={medicamento} onChangeText={handleMedChange} placeholder="Digite para buscar na tabela RENAME..." placeholderTextColor={colors.textMuted} />
              {catmatResults.length > 0 && (
                <View style={styles.autocompleteList}>
                  {catmatResults.map((item, idx) => (
                    <Pressable key={idx} style={styles.autocompleteItem} onPress={() => selectCatmat(item)}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.autocompleteName}>{item.nome} {item.concentracao}</Text>
                        <Text style={styles.autocompleteDetail}>{item.forma} • CATMAT: {item.codigo} • {item.grupo}</Text>
                      </View>
                      <Ionicons name="add-circle-outline" size={18} color={SUS_GREEN} />
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
            <View style={styles.fieldGroup}>
              <FieldLabel text="Posologia" />
              <TextInput style={styles.input} value={posologia} onChangeText={setPosologia} placeholder="Ex: 1 comprimido 8/8h por 3 dias" placeholderTextColor={colors.textMuted} />
            </View>
            <Pressable style={styles.addMedBtn} onPress={addPrescricao}>
              <Ionicons name="add-circle-outline" size={18} color={SUS_GREEN} />
              <Text style={styles.addMedBtnText}>Adicionar Medicamento</Text>
            </Pressable>

            {prescricoes.length > 0 && (
              <View style={styles.prescList}>
                <Text style={styles.prescListTitle}>Medicamentos ({prescricoes.length})</Text>
                {prescricoes.map((p, i) => (
                  <View key={i} style={styles.prescItem}>
                    <View style={styles.prescItemDot} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.prescMed}>{p.med}</Text>
                      {p.pos ? <Text style={styles.prescPos}>{p.pos}</Text> : null}
                    </View>
                    <Pressable onPress={() => setPrescricoes(prev => prev.filter((_, idx) => idx !== i))}>
                      <Ionicons name="trash-outline" size={16} color={colors.error} />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
          </FadeIn>
        )}

        {tab === 'historico' && (
          <FadeIn visible>
            {[
              { data: '28/02/2026', prof: 'Dra. Fernanda Lima', tipo: 'Pré-natal', cid: 'Z34.0', resumo: 'Gestação de 20 semanas, sem intercorrências.' },
              { data: '15/01/2026', prof: 'Dr. Carlos Mendes', tipo: 'Consulta', cid: 'J06.9', resumo: 'IVAS, prescrito Amoxicilina 500mg 8/8h 7 dias.' },
              { data: '03/12/2025', prof: 'Dra. Fernanda Lima', tipo: 'Pré-natal', cid: 'Z34.0', resumo: 'Gestação de 14 semanas, USG normal.' },
            ].map((h, i) => (
              <View key={i} style={styles.histCard}>
                <View style={styles.histHeader}>
                  <Text style={styles.histDate}>{h.data}</Text>
                  <View style={styles.histBadge}>
                    <Text style={styles.histBadgeText}>{h.tipo}</Text>
                  </View>
                </View>
                <Text style={styles.histProf}>{h.prof}</Text>
                <Text style={styles.histCid}>CID: {h.cid}</Text>
                <Text style={styles.histResumo}>{h.resumo}</Text>
              </View>
            ))}
          </FadeIn>
        )}

        {/* Save button */}
        <Pressable style={styles.saveBtn} onPress={salvarAtendimento}>
          <Ionicons name="checkmark-circle" size={20} color="#fff" />
          <Text style={styles.saveBtnText}>Salvar Atendimento</Text>
        </Pressable>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: DesignColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  patientHeader: { flexDirection: 'row', gap: 12, padding: 16, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  patientAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: SUS_GREEN + '15', alignItems: 'center', justifyContent: 'center' },
  patientAvatarText: { fontSize: 20, fontWeight: '700', color: SUS_GREEN },
  patientInfo: { flex: 1 },
  patientName: { fontSize: 18, fontWeight: '700', color: colors.text },
  patientSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  tabBar: { flexDirection: 'row', backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.borderLight, paddingHorizontal: 8 },
  tabItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabItemActive: { borderBottomColor: SUS_GREEN },
  tabLabel: { fontSize: 11, fontWeight: '600', color: colors.textMuted },
  tabLabelActive: { color: SUS_GREEN },
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },
  fieldGroup: { marginBottom: 16 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 6 },
  input: { backgroundColor: colors.surface, borderRadius: 10, padding: 12, fontSize: 15, color: colors.text, borderWidth: 1, borderColor: colors.borderLight },
  textArea: { backgroundColor: colors.surface, borderRadius: 10, padding: 12, fontSize: 15, color: colors.text, borderWidth: 1, borderColor: colors.borderLight },
  vitaisGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  vitalCard: { width: '48%' as any, backgroundColor: colors.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.borderLight },
  vitalLabel: { fontSize: 11, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 },
  vitalInputRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  vitalInput: { flex: 1, fontSize: 18, fontWeight: '700', color: colors.text, padding: 0 },
  vitalUnit: { fontSize: 12, color: colors.textMuted, fontWeight: '500' },
  imcCard: { marginTop: 12, backgroundColor: SUS_GREEN + '10', borderRadius: 12, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  imcLabel: { fontSize: 14, fontWeight: '600', color: SUS_GREEN },
  imcValue: { fontSize: 20, fontWeight: '800', color: SUS_GREEN },
  addMedBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10 },
  addMedBtnText: { fontSize: 14, fontWeight: '600', color: SUS_GREEN },
  prescList: { marginTop: 12 },
  prescListTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 8 },
  prescItem: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: colors.borderLight },
  prescItemDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: SUS_GREEN },
  prescMed: { fontSize: 14, fontWeight: '600', color: colors.text },
  prescPos: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  autocompleteList: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderLight, borderRadius: 10, marginTop: 4, marginBottom: 8, overflow: 'hidden' },
  autocompleteItem: { flexDirection: 'row', alignItems: 'center', padding: 10, gap: 8, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  autocompleteName: { fontSize: 13, fontWeight: '600', color: colors.text },
  autocompleteDetail: { fontSize: 10, color: colors.textSecondary, marginTop: 1 },
  histCard: { backgroundColor: colors.surface, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.borderLight },
  histHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  histDate: { fontSize: 13, fontWeight: '700', color: SUS_GREEN },
  histBadge: { backgroundColor: SUS_GREEN + '15', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  histBadgeText: { fontSize: 11, fontWeight: '600', color: SUS_GREEN },
  histProf: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  histCid: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  histResumo: { fontSize: 13, color: colors.text, marginTop: 6, lineHeight: 18 },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: SUS_GREEN, paddingVertical: 14, borderRadius: 12, marginTop: 20 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
