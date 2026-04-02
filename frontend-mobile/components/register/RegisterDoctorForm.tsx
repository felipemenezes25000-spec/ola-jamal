import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { AppInput } from '../ui/AppInput';
import { SectionHeader } from '../ui/SectionHeader';
import { RegisterAddressFields } from './RegisterAddressFields';
import { spacing } from '../../lib/designSystem';
import type { DesignColors } from '../../lib/designSystem';

const s = spacing;

export interface RegisterDoctorFormProps {
  crm: string;
  setCrm: (v: string) => void;
  crmState: string;
  setCrmState: (v: string) => void;
  specialty: string;
  setSpecialty: (v: string) => void;
  specialtyOpen: boolean;
  setSpecialtyOpen: (v: boolean | ((o: boolean) => boolean)) => void;
  specialtySearch: string;
  setSpecialtySearch: (v: string) => void;
  specialtiesDisplayList: string[];
  professionalCep: string;
  setProfessionalCep: (v: string) => void;
  handleProfessionalCepChange: (text: string) => void;
  lookupProfessionalCep: () => void;
  professionalStreet: string;
  setProfessionalStreet: (v: string) => void;
  professionalNumber: string;
  setProfessionalNumber: (v: string) => void;
  professionalNeighborhood: string;
  setProfessionalNeighborhood: (v: string) => void;
  professionalComplement: string;
  setProfessionalComplement: (v: string) => void;
  professionalCity: string;
  setProfessionalCity: (v: string) => void;
  professionalState: string;
  setProfessionalState: (v: string) => void;
  professionalPhone: string;
  setProfessionalPhone: (v: string) => void;
  university: string;
  setUniversity: (v: string) => void;
  courses: string;
  setCourses: (v: string) => void;
  hospitalsServices: string;
  setHospitalsServices: (v: string) => void;
  certFile: { uri: string; name: string } | null;
  setCertFile: (v: { uri: string; name: string } | null) => void;
  certPassword: string;
  setCertPassword: (v: string) => void;
  fieldErrors: Record<string, string>;
  clearError: (field: string) => void;
  colors: DesignColors;
}

export function RegisterDoctorForm(props: RegisterDoctorFormProps) {
  const {
    crm,
    setCrm,
    crmState,
    setCrmState,
    specialty,
    setSpecialty,
    specialtyOpen,
    setSpecialtyOpen,
    specialtySearch,
    setSpecialtySearch,
    specialtiesDisplayList,
    professionalCep,
    handleProfessionalCepChange,
    lookupProfessionalCep,
    professionalStreet,
    setProfessionalStreet,
    professionalNumber,
    setProfessionalNumber,
    professionalNeighborhood,
    setProfessionalNeighborhood,
    professionalComplement,
    setProfessionalComplement,
    professionalCity,
    setProfessionalCity,
    professionalState,
    setProfessionalState,
    professionalPhone,
    setProfessionalPhone,
    university,
    setUniversity,
    courses,
    setCourses,
    hospitalsServices,
    setHospitalsServices,
    certFile,
    setCertFile,
    certPassword,
    setCertPassword,
    fieldErrors,
    clearError,
    colors,
  } = props;

  const styles = React.useMemo(() => makeStyles(colors), [colors]);

  return (
    <>
      <SectionHeader icon="medkit-outline" title="Dados profissionais" variant="form" />
      <View style={styles.row}>
        <AppInput
          label="CRM"
          required
          leftIcon="shield-checkmark-outline"
          placeholder="Ex.: 123456"
          value={crm}
          onChangeText={(t) => { setCrm(t); clearError('crm'); }}
          error={fieldErrors.crm}
          keyboardType="numeric"
          maxLength={7}
          returnKeyType="next"
          containerStyle={styles.flex1}
          hint="4 a 7 dígitos"
        />
        <AppInput
          label="UF do CRM"
          required
          leftIcon="location-outline"
          placeholder="SP"
          value={crmState}
          onChangeText={(t) => { setCrmState(t); clearError('crmState'); }}
          error={fieldErrors.crmState}
          maxLength={2}
          autoCapitalize="characters"
          returnKeyType="next"
          containerStyle={{ width: 120 }}
        />
      </View>

      {specialtiesDisplayList.length > 0 ? (
        <View style={styles.specialtyBlock}>
          <Text style={styles.specialtyLabel}>
            Especialidade <Text style={{ color: colors.error }}>*</Text>
          </Text>
          <TouchableOpacity
            style={[styles.specialtyTrigger, fieldErrors.specialty && styles.specialtyTriggerError]}
            onPress={() => setSpecialtyOpen((o) => !o)}
            activeOpacity={0.8}
          >
            <Ionicons name="medkit-outline" size={18} color={colors.textMuted} style={{ marginRight: 8 }} />
            <Text
              style={[styles.specialtyTriggerText, !specialty.trim() && styles.specialtyTriggerPlaceholder]}
              numberOfLines={1}
            >
              {specialty.trim() || 'Selecionar especialidade...'}
            </Text>
            <Ionicons name={specialtyOpen ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textMuted} />
          </TouchableOpacity>
          {specialtyOpen && (
            <View style={styles.specialtyDropdown}>
              <View style={styles.specialtySearchWrap}>
                <Ionicons name="search-outline" size={18} color={colors.textMuted} />
                <TextInput
                  style={styles.specialtySearchInput}
                  placeholder="Pesquisar especialidade..."
                  placeholderTextColor={colors.textMuted}
                  value={specialtySearch}
                  onChangeText={setSpecialtySearch}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="search"
                />
                {specialtySearch.length > 0 ? (
                  <TouchableOpacity onPress={() => setSpecialtySearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                ) : null}
              </View>
              <ScrollView style={styles.specialtyOptionsScroll} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                {(() => {
                  const filtered = specialtiesDisplayList.filter((s) =>
                    s.toLowerCase().includes(specialtySearch.trim().toLowerCase())
                  );
                  if (filtered.length === 0) {
                    return (
                      <View style={styles.specialtyOption}>
                        <Text style={styles.specialtyOptionEmpty}>Nenhuma especialidade encontrada</Text>
                      </View>
                    );
                  }
                  return filtered.map((s) => {
                    const isSelected = specialty.trim() === s;
                    return (
                      <TouchableOpacity
                        key={s}
                        style={[styles.specialtyOption, isSelected && styles.specialtyOptionSelected]}
                        onPress={() => {
                          setSpecialty(s);
                          setSpecialtySearch('');
                          setSpecialtyOpen(false);
                          clearError('specialty');
                        }}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[styles.specialtyOptionText, isSelected && styles.specialtyOptionTextSelected]}
                          numberOfLines={1}
                        >
                          {s}
                        </Text>
                        {isSelected ? <Ionicons name="checkmark-circle" size={20} color={colors.primary} /> : null}
                      </TouchableOpacity>
                    );
                  });
                })()}
              </ScrollView>
            </View>
          )}
          {fieldErrors.specialty ? <Text style={styles.fieldErrorText}>{fieldErrors.specialty}</Text> : null}
        </View>
      ) : (
        <AppInput
          label="Especialidade"
          required
          leftIcon="medkit-outline"
          placeholder="Carregando..."
          value={specialty}
          onChangeText={(t) => { setSpecialty(t); clearError('specialty'); }}
          error={fieldErrors.specialty}
          editable={false}
        />
      )}

      <SectionHeader icon="business-outline" title="Endereço profissional (opcional)" variant="form" />
      <RegisterAddressFields
        title=""
        cep={professionalCep}
        onCepChange={handleProfessionalCepChange}
        onCepBlur={lookupProfessionalCep}
        street={professionalStreet}
        onStreetChange={setProfessionalStreet}
        number={professionalNumber}
        onNumberChange={setProfessionalNumber}
        neighborhood={professionalNeighborhood}
        onNeighborhoodChange={setProfessionalNeighborhood}
        complement={professionalComplement}
        onComplementChange={setProfessionalComplement}
        city={professionalCity}
        onCityChange={setProfessionalCity}
        state={professionalState}
        onStateChange={(t) => setProfessionalState(t.trim().toUpperCase().slice(0, 2))}
        fieldErrors={{}}
        clearError={() => {}}
        required={false}
        colors={colors}
      />
      <AppInput
        label="Telefone profissional"
        placeholder="(11) 3333-4444"
        value={professionalPhone}
        onChangeText={setProfessionalPhone}
        leftIcon="call-outline"
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        returnKeyType="next"
      />

      <SectionHeader icon="school-outline" title="Formação e experiência (opcional)" variant="form" />
      <AppInput
        label="Instituição de formação"
        placeholder="Ex.: USP, Unifesp..."
        value={university}
        onChangeText={setUniversity}
        leftIcon="school-outline"
        autoCapitalize="words"
        autoCorrect={false}
        returnKeyType="next"
      />
      <AppInput
        label="Cursos e especializações"
        placeholder="Ex.: RQE, residências..."
        value={courses}
        onChangeText={setCourses}
        leftIcon="ribbon-outline"
        autoCapitalize="sentences"
        returnKeyType="next"
      />
      <AppInput
        label="Locais de atuação"
        placeholder="Ex.: hospitais, clínicas..."
        value={hospitalsServices}
        onChangeText={setHospitalsServices}
        leftIcon="medkit-outline"
        autoCapitalize="sentences"
        returnKeyType="next"
      />

      <View style={styles.certSection}>
        <View style={styles.certHeader}>
          <View style={styles.certIconWrap}>
            <Ionicons name="shield-checkmark" size={16} color={colors.primary} />
          </View>
          <View style={styles.flex1}>
            <Text style={styles.certSectionTitle}>Certificado digital</Text>
            <Text style={styles.certSectionDesc}>Opcional agora — você pode adicionar depois.</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.certFileBtn}
          onPress={async () => {
            try {
              const result = await DocumentPicker.getDocumentAsync({
                type: ['application/x-pkcs12', 'application/octet-stream'],
                copyToCacheDirectory: true,
              });
              if (!result.canceled && result.assets?.[0]) {
                const asset = result.assets[0];
                setCertFile({ uri: asset.uri, name: asset.name ?? 'document' });
              }
            } catch {
              Alert.alert('Erro', 'Não foi possível selecionar o arquivo.');
            }
          }}
          activeOpacity={0.8}
        >
          <View style={styles.certUploadIcon}>
            <Ionicons
              name={certFile ? 'document-attach' : 'cloud-upload-outline'}
              size={22}
              color={colors.primary}
            />
          </View>
          <Text style={styles.certFileBtnText}>{certFile ? certFile.name : 'Selecionar arquivo .PFX'}</Text>
        </TouchableOpacity>
        {certFile ? (
          <AppInput
            label="Senha do certificado"
            placeholder="Senha do PFX"
            value={certPassword}
            onChangeText={setCertPassword}
            secureTextEntry
            textContentType="password"
            returnKeyType="done"
            blurOnSubmit={true}
          />
        ) : null}
      </View>
    </>
  );
}

function makeStyles(colors: DesignColors) {
  return StyleSheet.create({
    row: { flexDirection: 'row', gap: s.sm },
    flex1: { flex: 1 },
    specialtyBlock: { marginBottom: s.md },
    specialtyLabel: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 6 },
    specialtyTrigger: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 14,
      backgroundColor: colors.surfaceSecondary,
      borderWidth: 1.5,
      borderColor: colors.border,
      minHeight: 52,
    },
    specialtyTriggerError: { borderColor: colors.error },
    specialtyTriggerText: { flex: 1, fontSize: 15, color: colors.text, marginRight: s.sm },
    specialtyTriggerPlaceholder: { color: colors.textMuted },
    specialtyDropdown: {
      marginTop: 6,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      maxHeight: 240,
      overflow: 'hidden',
      ...Platform.select({
        ios: { shadowColor: colors.text, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12 },
        android: { elevation: 4 },
        default: { shadowColor: colors.text, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12 },
      }),
    },
    specialtySearchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
      gap: 8,
    },
    specialtySearchInput: { flex: 1, fontSize: 15, color: colors.text, paddingVertical: 8 },
    specialtyOptionsScroll: { maxHeight: 190 },
    specialtyOption: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    specialtyOptionSelected: { backgroundColor: colors.primarySoft },
    specialtyOptionText: { flex: 1, fontSize: 15, color: colors.text, marginRight: s.sm },
    specialtyOptionTextSelected: { fontWeight: '600', color: colors.primaryDark },
    specialtyOptionEmpty: { fontSize: 14, color: colors.textMuted, fontStyle: 'italic' },
    fieldErrorText: { fontSize: 12, color: colors.error, marginTop: 4, marginLeft: 4 },
    certSection: {
      marginTop: s.md,
      padding: s.md,
      borderRadius: 16,
      backgroundColor: colors.surfaceSecondary,
      gap: 12,
    },
    certHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    certIconWrap: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 2,
    },
    certSectionTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
    certSectionDesc: { fontSize: 13, color: colors.textMuted, lineHeight: 18, marginTop: 2 },
    certFileBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 14,
      borderWidth: 2,
      borderColor: colors.primaryLight,
      borderStyle: 'dashed',
      backgroundColor: colors.surface,
    },
    certUploadIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    certFileBtnText: { flex: 1, fontSize: 14, fontWeight: '500', color: colors.primaryDark },
  });
}
