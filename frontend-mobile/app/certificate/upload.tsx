import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { DoctorHeader } from '../../components/ui/DoctorHeader';
import { DoctorCard } from '../../components/ui/DoctorCard';
import { PrimaryButton } from '../../components/ui/PrimaryButton';
import { Input } from '../../components/Input';
import { Loading } from '../../components/Loading';
import { uploadCertificate, getActiveCertificate, revokeCertificate } from '../../lib/api';
import { colors, spacing, typography, borderRadius, doctorDS } from '../../lib/themeDoctor';

export default function CertificateUploadScreen() {
  const router = useRouter();
  const [certificate, setCertificate] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [password, setPassword] = useState('');
  const [revoking, setRevoking] = useState(false);

  useEffect(() => { loadCert(); }, []);

  const loadCert = async () => {
    try { const cert = await getActiveCertificate(); setCertificate(cert); }
    catch {} finally { setLoading(false); }
  };

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/x-pkcs12', 'application/octet-stream'],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets?.[0]) {
        setSelectedFile(result.assets[0]);
      }
    } catch { Alert.alert('Erro', 'Não foi possível selecionar o arquivo'); }
  };

  const handleUpload = async () => {
    if (!selectedFile) { Alert.alert('Atenção', 'Selecione o arquivo PFX'); return; }
    if (!password) { Alert.alert('Atenção', 'Informe a senha do certificado'); return; }
    setUploading(true);
    try {
      const result = await uploadCertificate(selectedFile.uri, password);
      if (result.success) {
        Alert.alert('Sucesso', result.message || 'Certificado cadastrado com sucesso!');
        setSelectedFile(null);
        setPassword('');
        loadCert();
      } else {
        Alert.alert('Erro', result.message || 'Certificado inválido');
      }
    } catch (error: unknown) {
      Alert.alert('Erro', (error as Error)?.message || String(error) || 'Erro ao fazer upload do certificado');
    } finally { setUploading(false); }
  };

  const handleRevoke = () => {
    if (!certificate || revoking) return;
    Alert.alert('Revogar Certificado', 'Tem certeza? Você precisará cadastrar um novo.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Revogar',
        style: 'destructive',
        onPress: async () => {
          setRevoking(true);
          try {
            await revokeCertificate(certificate.id, 'Substituição pelo médico');
            loadCert();
          } catch (e: unknown) {
            Alert.alert('Erro', (e as Error)?.message || String(e));
          } finally {
            setRevoking(false);
          }
        },
      },
    ]);
  };

  if (loading) return <SafeAreaView style={styles.container}><Loading color={colors.primary} /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.container}>
      <DoctorHeader title="Certificado Digital" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Info banner */}
        <DoctorCard style={styles.infoBanner}>
          <Ionicons name="shield-checkmark" size={32} color={colors.primary} />
          <Text style={styles.infoTitle}>Certificado ICP-Brasil</Text>
          <Text style={styles.infoDesc}>Necessário para assinatura digital de receitas e documentos médicos.</Text>
        </DoctorCard>

        {/* Active certificate */}
        {certificate && (
          <DoctorCard style={styles.certCard}>
            <View style={styles.certHeader}>
              <View style={styles.certStatusDot} />
              <Text style={styles.certStatusText}>Certificado Ativo</Text>
            </View>
            <View style={styles.certInfo}>
              <Text style={styles.certLabel}>Titular</Text>
              <Text style={styles.certValue} numberOfLines={3} ellipsizeMode="tail">{certificate.subjectName}</Text>
            </View>
            <View style={styles.certInfo}>
              <Text style={styles.certLabel}>Emissor</Text>
              <Text style={styles.certValue} numberOfLines={3} ellipsizeMode="tail">{certificate.issuerName}</Text>
            </View>
            <View style={styles.certInfo}>
              <Text style={styles.certLabel}>Validade</Text>
              <Text style={styles.certValue}>
                {new Date(certificate.notBefore).toLocaleDateString('pt-BR')} - {new Date(certificate.notAfter).toLocaleDateString('pt-BR')}
              </Text>
            </View>
            <Pressable
              style={({ pressed }) => [
                styles.revokeBtn,
                pressed && styles.revokeBtnPressed,
                revoking && styles.revokeBtnDisabled,
              ]}
              onPress={handleRevoke}
              disabled={revoking}
            >
              {revoking ? (
                <ActivityIndicator size="small" color={colors.error} />
              ) : (
                <>
                  <Ionicons name="trash-outline" size={18} color={colors.error} />
                  <Text style={styles.revokeBtnText}>Revogar Certificado</Text>
                </>
              )}
            </Pressable>
          </DoctorCard>
        )}

        {/* Upload form */}
        {!certificate && (
          <DoctorCard style={styles.uploadCard}>
            <Text style={styles.uploadTitle}>Upload do Certificado</Text>

            <TouchableOpacity style={styles.fileBtn} onPress={pickFile}>
              <Ionicons name={selectedFile ? 'document-attach' : 'cloud-upload'} size={32} color={colors.primary} />
              <Text style={styles.fileText}>{selectedFile ? selectedFile.name : 'Selecionar arquivo .PFX'}</Text>
              {selectedFile && <Text style={styles.fileSize}>{(selectedFile.size / 1024).toFixed(0)} KB</Text>}
            </TouchableOpacity>

            <Input
              label="Senha do Certificado"
              placeholder="Digite a senha do PFX"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              leftIcon="lock-closed-outline"
            />

            <PrimaryButton label="Enviar Certificado" onPress={handleUpload} loading={uploading} style={styles.uploadBtn} />
          </DoctorCard>
        )}

        {/* Help section */}
        <DoctorCard style={styles.helpCard}>
          <Text style={styles.helpTitle}>Como obter um certificado?</Text>
          <Text style={styles.helpText}>1. Adquira um e-CPF A1 em uma Autoridade Certificadora (AC).</Text>
          <Text style={styles.helpText}>2. Faça o download do arquivo .PFX (PKCS#12).</Text>
          <Text style={styles.helpText}>3. Faça o upload aqui com a senha definida na emissão.</Text>
        </DoctorCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.md, paddingBottom: spacing.xxl },
  infoBanner: { alignItems: 'center', marginBottom: doctorDS.sectionGap },
  infoTitle: { fontSize: 18, fontFamily: typography.fontFamily.bold, fontWeight: '700', color: colors.primaryDark, marginTop: spacing.sm },
  infoDesc: { fontSize: 13, fontFamily: typography.fontFamily.regular, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs, paddingHorizontal: spacing.md },
  certCard: { marginBottom: spacing.md },
  certHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  certStatusDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.success, marginRight: 8 },
  certStatusText: { fontSize: 14, fontFamily: typography.fontFamily.semibold, fontWeight: '600', color: colors.success },
  certInfo: { marginBottom: spacing.sm },
  certLabel: { fontSize: 12, fontFamily: typography.fontFamily.medium, color: colors.textMuted },
  certValue: { fontSize: 14, fontFamily: typography.fontFamily.regular, color: colors.text, marginTop: 2 },
  uploadCard: { marginBottom: spacing.md },
  uploadTitle: { fontSize: 18, fontFamily: typography.fontFamily.bold, color: colors.text, marginBottom: spacing.md },
  uploadBtn: { marginTop: spacing.sm },
  fileBtn: {
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft,
    borderWidth: 2, borderColor: colors.primary, borderStyle: 'dashed', borderRadius: 18,
    padding: spacing.xl, marginBottom: spacing.md,
  },
  fileText: { fontSize: 14, fontFamily: typography.fontFamily.semibold, color: colors.primary, marginTop: spacing.sm },
  fileSize: { fontSize: 12, fontFamily: typography.fontFamily.regular, color: colors.textMuted, marginTop: 2 },
  helpCard: { marginBottom: spacing.md },
  helpTitle: { fontSize: 15, fontFamily: typography.fontFamily.semibold, color: colors.text, marginBottom: spacing.sm },
  helpText: { fontSize: 13, fontFamily: typography.fontFamily.regular, color: colors.textSecondary, marginBottom: 4 },
  revokeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    borderWidth: 2,
    borderColor: colors.error,
    borderRadius: borderRadius.md,
    backgroundColor: 'transparent',
  },
  revokeBtnPressed: { opacity: 0.8 },
  revokeBtnDisabled: { opacity: 0.7 },
  revokeBtnText: { fontSize: 14, fontFamily: typography.fontFamily.semibold, fontWeight: '600', color: colors.error },
});
