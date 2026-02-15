import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Loading } from '../../components/Loading';
import { uploadCertificate, getActiveCertificate, revokeCertificate } from '../../lib/api';
import { colors, spacing, typography, borderRadius, shadows } from '../../constants/theme';

export default function CertificateUploadScreen() {
  const router = useRouter();
  const [certificate, setCertificate] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [password, setPassword] = useState('');

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
    } catch (error: any) {
      Alert.alert('Erro', error.message || 'Erro ao fazer upload do certificado');
    } finally { setUploading(false); }
  };

  const handleRevoke = () => {
    if (!certificate) return;
    Alert.alert('Revogar Certificado', 'Tem certeza? Você precisará cadastrar um novo.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Revogar', style: 'destructive', onPress: async () => {
        try { await revokeCertificate(certificate.id, 'Substituição pelo médico'); loadCert(); }
        catch (e: any) { Alert.alert('Erro', e.message); }
      }},
    ]);
  };

  if (loading) return <SafeAreaView style={styles.container}><Loading color={colors.primary} /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color={colors.primaryDark} /></TouchableOpacity>
        <Text style={styles.headerTitle}>Certificado Digital</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Info banner */}
        <Card style={[styles.infoBanner, { backgroundColor: colors.primaryPaler }]}>
          <Ionicons name="shield-checkmark" size={32} color={colors.primary} />
          <Text style={styles.infoTitle}>Certificado ICP-Brasil</Text>
          <Text style={styles.infoDesc}>Necessário para assinatura digital de receitas e documentos médicos.</Text>
        </Card>

        {/* Active certificate */}
        {certificate && (
          <Card style={styles.certCard}>
            <View style={styles.certHeader}>
              <View style={styles.certStatusDot} />
              <Text style={styles.certStatusText}>Certificado Ativo</Text>
            </View>
            <View style={styles.certInfo}>
              <Text style={styles.certLabel}>Titular</Text>
              <Text style={styles.certValue}>{certificate.subjectName}</Text>
            </View>
            <View style={styles.certInfo}>
              <Text style={styles.certLabel}>Emissor</Text>
              <Text style={styles.certValue}>{certificate.issuerName}</Text>
            </View>
            <View style={styles.certInfo}>
              <Text style={styles.certLabel}>Validade</Text>
              <Text style={styles.certValue}>
                {new Date(certificate.notBefore).toLocaleDateString('pt-BR')} - {new Date(certificate.notAfter).toLocaleDateString('pt-BR')}
              </Text>
            </View>
            <Button title="Revogar Certificado" variant="outline" onPress={handleRevoke} fullWidth style={{ marginTop: spacing.md, borderColor: colors.error }} />
          </Card>
        )}

        {/* Upload form */}
        {!certificate && (
          <Card style={styles.uploadCard}>
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

            <Button title="Enviar Certificado" onPress={handleUpload} loading={uploading} fullWidth icon={<Ionicons name="shield-checkmark" size={20} color={colors.white} />} />
          </Card>
        )}

        {/* Help section */}
        <Card style={styles.helpCard}>
          <Text style={styles.helpTitle}>Como obter um certificado?</Text>
          <Text style={styles.helpText}>1. Adquira um e-CPF A1 em uma Autoridade Certificadora (AC).</Text>
          <Text style={styles.helpText}>2. Faça o download do arquivo .PFX (PKCS#12).</Text>
          <Text style={styles.helpText}>3. Faça o upload aqui com a senha definida na emissão.</Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  headerTitle: { ...typography.h4, color: colors.primaryDarker },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
  infoBanner: { alignItems: 'center', paddingVertical: spacing.xl, marginBottom: spacing.md },
  infoTitle: { ...typography.h4, color: colors.primaryDark, marginTop: spacing.sm },
  infoDesc: { ...typography.bodySmall, color: colors.gray600, textAlign: 'center', marginTop: spacing.xs, paddingHorizontal: spacing.md },
  certCard: { marginBottom: spacing.md },
  certHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  certStatusDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.success, marginRight: 8 },
  certStatusText: { ...typography.bodySemiBold, color: colors.success },
  certInfo: { marginBottom: spacing.sm },
  certLabel: { ...typography.caption, color: colors.gray500 },
  certValue: { ...typography.bodySmallMedium, color: colors.gray800, marginTop: 2 },
  uploadCard: { marginBottom: spacing.md },
  uploadTitle: { ...typography.h4, color: colors.primaryDarker, marginBottom: spacing.md },
  fileBtn: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryPaler, borderWidth: 2, borderColor: colors.primary, borderStyle: 'dashed', borderRadius: borderRadius.xl, padding: spacing.xl, marginBottom: spacing.md },
  fileText: { ...typography.bodySmallMedium, color: colors.primary, marginTop: spacing.sm },
  fileSize: { ...typography.caption, color: colors.gray500, marginTop: 2 },
  helpCard: { marginBottom: spacing.md },
  helpTitle: { ...typography.bodySemiBold, color: colors.primaryDarker, marginBottom: spacing.sm },
  helpText: { ...typography.bodySmall, color: colors.gray600, marginBottom: 4 },
});
