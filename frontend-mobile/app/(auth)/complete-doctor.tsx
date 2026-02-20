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
import { uploadCertificate, getActiveCertificate } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';

/**
 * Tela obrigatória para médicos concluírem o cadastro com certificado digital.
 * Exibida após registro ou login quando profileComplete === false.
 */
export default function CompleteDoctorScreen() {
  const router = useRouter();
  const { refreshUser, signOut } = useAuth();
  const [certificate, setCertificate] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [password, setPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);

  useEffect(() => {
    loadCert();
  }, []);

  const loadCert = async () => {
    try {
      const cert = await getActiveCertificate();
      setCertificate(cert);
      if (cert) {
        await refreshUser();
        router.replace('/(doctor)/dashboard' as any);
      }
    } catch {
      // no cert yet
    } finally {
      setLoading(false);
    }
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
    } catch {
      Alert.alert('Erro', 'Não foi possível selecionar o arquivo');
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      Alert.alert('Atenção', 'Selecione o arquivo PFX');
      return;
    }
    if (!password) {
      Alert.alert('Atenção', 'Informe a senha do certificado');
      return;
    }
    if (!acceptedTerms || !acceptedPrivacy) {
      Alert.alert('Atenção', 'Aceite os Termos de Uso e a Política de Privacidade para continuar.');
      return;
    }
    setUploading(true);
    try {
      const result = await uploadCertificate(selectedFile.uri, password);
      if (result.success) {
        await refreshUser();
        router.replace('/(doctor)/dashboard' as any);
      } else {
        Alert.alert('Erro', result.message || 'Certificado inválido');
      }
    } catch (error: unknown) {
      Alert.alert(
        'Erro',
        (error as Error)?.message || String(error) || 'Erro ao fazer upload do certificado'
      );
    } finally {
      setUploading(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sair',
      'Deseja sair? Você poderá concluir o cadastro do certificado no próximo acesso.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sair', style: 'destructive', onPress: async () => {
          await signOut();
          router.replace('/(auth)/login' as any);
        }},
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Loading color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sair</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Completar cadastro</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Card style={{ ...styles.infoBanner, backgroundColor: colors.primaryPaler }}>
          <Ionicons name="shield-checkmark" size={32} color={colors.primary} />
          <Text style={styles.infoTitle}>Certificado digital obrigatório</Text>
          <Text style={styles.infoDesc}>
            Para concluir seu cadastro, cadastre seu certificado digital. Ele é necessário para
            assinar receitas e pedidos de exame.
          </Text>
          <Text style={styles.infoDesc}>
            A senha do certificado não é armazenada: ela é usada apenas no momento da assinatura e não fica salva em nossos servidores.
          </Text>
        </Card>

        <Card style={styles.disclaimerCard}>
          <Text style={styles.disclaimerTitle}>Uso de IA, Certificado e Documentos</Text>
          <Text style={styles.disclaimerText}>
            A plataforma utiliza IA no atendimento (triagem e leitura de receitas e exames). A senha do certificado não é armazenada — é usada apenas no momento da assinatura.
          </Text>
          <TouchableOpacity
            style={styles.termsCheckRow}
            onPress={() => setAcceptedTerms((v) => !v)}
            activeOpacity={0.8}
          >
            <View style={[styles.checkbox, acceptedTerms && styles.checkboxChecked]}>
              {acceptedTerms ? <Ionicons name="checkmark" size={18} color="#fff" /> : null}
            </View>
            <Text style={styles.termsCheckText}>
              Li e aceito os Termos de Uso.
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/terms' as any)} style={styles.termsLinkWrap}>
            <Text style={styles.termsLink}>Ler Termos de Uso</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.termsCheckRow, styles.termsCheckRowSecond]}
            onPress={() => setAcceptedPrivacy((v) => !v)}
            activeOpacity={0.8}
          >
            <View style={[styles.checkbox, acceptedPrivacy && styles.checkboxChecked]}>
              {acceptedPrivacy ? <Ionicons name="checkmark" size={18} color="#fff" /> : null}
            </View>
            <Text style={styles.termsCheckText}>
              Li e aceito a Política de Privacidade.
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/privacy' as any)} style={styles.termsLinkWrap}>
            <Text style={styles.termsLink}>Ler Política de Privacidade</Text>
          </TouchableOpacity>
        </Card>

        <Card style={styles.uploadCard}>
          <Text style={styles.uploadTitle}>Upload do Certificado</Text>

          <TouchableOpacity style={styles.fileBtn} onPress={pickFile}>
            <Ionicons
              name={selectedFile ? 'document-attach' : 'cloud-upload'}
              size={32}
              color={colors.primary}
            />
            <Text style={styles.fileText}>
              {selectedFile ? selectedFile.name : 'Selecionar arquivo .PFX'}
            </Text>
            {selectedFile && (
              <Text style={styles.fileSize}>{(selectedFile.size / 1024).toFixed(0)} KB</Text>
            )}
          </TouchableOpacity>

          <Input
            label="Senha do Certificado"
            placeholder="Digite a senha do PFX (não é armazenada)"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            leftIcon="lock-closed-outline"
          />

          <Button
            title="Enviar e concluir cadastro"
            onPress={handleUpload}
            loading={uploading}
            fullWidth
            icon={<Ionicons name="shield-checkmark" size={20} color={colors.white} />}
          />
        </Card>

        <Card style={styles.helpCard}>
          <Text style={styles.helpTitle}>Como obter um certificado?</Text>
          <Text style={styles.helpText}>
            1. Adquira um e-CPF A1 em uma Autoridade Certificadora (AC).
          </Text>
          <Text style={styles.helpText}>2. Faça o download do arquivo .PFX (PKCS#12).</Text>
          <Text style={styles.helpText}>3. Faça o upload aqui com a senha definida na emissão.</Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: { ...typography.h4, color: colors.primaryDarker },
  signOutText: { ...typography.bodySmall, color: colors.error },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
  infoBanner: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    marginBottom: spacing.md,
  },
  infoTitle: { ...typography.h4, color: colors.primaryDark, marginTop: spacing.sm },
  infoDesc: {
    ...typography.bodySmall,
    color: colors.gray600,
    textAlign: 'center',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  uploadCard: { marginBottom: spacing.md },
  uploadTitle: { ...typography.h4, color: colors.primaryDarker, marginBottom: spacing.md },
  fileBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryPaler,
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    marginBottom: spacing.md,
  },
  fileText: { ...typography.bodySmallMedium, color: colors.primary, marginTop: spacing.sm },
  fileSize: { ...typography.caption, color: colors.gray500, marginTop: 2 },
  helpCard: { marginBottom: spacing.md },
  helpTitle: { ...typography.bodySemiBold, color: colors.primaryDarker, marginBottom: spacing.sm },
  helpText: { ...typography.bodySmall, color: colors.gray600, marginBottom: 4 },
  disclaimerCard: {
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  disclaimerTitle: {
    ...typography.bodySemiBold,
    color: colors.primaryDarker,
    marginBottom: spacing.sm,
  },
  disclaimerText: {
    ...typography.bodySmall,
    color: colors.gray600,
    marginBottom: spacing.sm,
    lineHeight: 20,
  },
  termsCheckRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: spacing.xs,
  },
  termsCheckRowSecond: {
    marginTop: spacing.sm,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.gray400,
    marginRight: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  termsCheckText: {
    flex: 1,
    ...typography.bodySmall,
    color: colors.gray700,
    lineHeight: 20,
  },
  termsLinkWrap: {
    marginTop: spacing.sm,
  },
  termsLink: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
