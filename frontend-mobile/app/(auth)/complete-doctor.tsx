import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { nav } from '../../lib/navigation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { AppCard } from '../../components/ui/AppCard';
import { AppButton } from '../../components/ui/AppButton';
import { AppInput } from '../../components/ui/AppInput';
import { Loading } from '../../components/Loading';
import { uploadCertificate, getActiveCertificate } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { spacing, borderRadius } from '../../lib/theme';
import { useAppTheme } from '../../lib/ui/useAppTheme';
import type { DesignColors } from '../../lib/designSystem';

/**
 * Tela obrigatória para médicos concluírem o cadastro com certificado digital.
 * Exibida após registro ou login quando profileComplete === false.
 */
export default function CompleteDoctorScreen() {
  const router = useRouter();
  const { refreshUser, signOut } = useAuth();
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [, setCertificate] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [password, setPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);

  useEffect(() => {
    loadCert();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadCert is stable, runs once on mount
  }, []);

  const loadCert = async () => {
    try {
      const cert = await getActiveCertificate();
      setCertificate(cert);
      if (cert) {
        await refreshUser();
        nav.replace(router, '/(doctor)/dashboard');
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
      const webFile = Platform.OS === 'web' ? selectedFile.file : undefined;
      const result = await uploadCertificate(selectedFile.uri, password, webFile);
      if (result.success) {
        await refreshUser();
        nav.replace(router, '/(doctor)/dashboard');
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
          nav.replace(router, '/(auth)/login');
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
        <View style={{ width: 44 }} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <AppCard style={{ ...styles.infoBanner, backgroundColor: colors.primarySoft }}>
          <Ionicons name="shield-checkmark" size={32} color={colors.primary} />
          <Text style={styles.infoTitle}>Certificado digital obrigatório</Text>
          <Text style={styles.infoDesc}>
            Para concluir seu cadastro, cadastre seu certificado digital. Ele é necessário para
            assinar receitas e pedidos de exame.
          </Text>
          <Text style={styles.infoDesc}>
            A senha do certificado não é armazenada: ela é usada apenas no momento da assinatura e não fica salva em nossos servidores.
          </Text>
        </AppCard>

        <AppCard style={styles.disclaimerCard}>
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
              {acceptedTerms ? <Ionicons name="checkmark" size={18} color={colors.white} /> : null}
            </View>
            <Text style={styles.termsCheckText}>
              Li e aceito os Termos de Uso.
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => nav.push(router, '/terms')} style={styles.termsLinkWrap}>
            <Text style={styles.termsLink}>Ler Termos de Uso</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.termsCheckRow, styles.termsCheckRowSecond]}
            onPress={() => setAcceptedPrivacy((v) => !v)}
            activeOpacity={0.8}
          >
            <View style={[styles.checkbox, acceptedPrivacy && styles.checkboxChecked]}>
              {acceptedPrivacy ? <Ionicons name="checkmark" size={18} color={colors.white} /> : null}
            </View>
            <Text style={styles.termsCheckText}>
              Li e aceito a Política de Privacidade.
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => nav.push(router, '/privacy')} style={styles.termsLinkWrap}>
            <Text style={styles.termsLink}>Ler Política de Privacidade</Text>
          </TouchableOpacity>
        </AppCard>

        <AppCard style={styles.uploadCard}>
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

          <AppInput
            label="Senha do Certificado"
            placeholder="Digite a senha do PFX (não é armazenada)"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="password"
            returnKeyType="done"
            blurOnSubmit={true}
            onSubmitEditing={handleUpload}
            editable={!uploading}
            leftIcon="lock-closed-outline"
          />

          <AppButton
            title="Enviar e concluir cadastro"
            onPress={handleUpload}
            loading={uploading}
            fullWidth
            leading={<Ionicons name="shield-checkmark" size={20} color={colors.white} />}
          />
        </AppCard>

        <AppCard style={styles.helpCard}>
          <Text style={styles.helpTitle}>Como obter um certificado?</Text>
          <Text style={styles.helpText}>
            1. Adquira um e-CPF A1 em uma Autoridade Certificadora (AC).
          </Text>
          <Text style={styles.helpText}>2. Faça o download do arquivo .PFX (PKCS#12).</Text>
          <Text style={styles.helpText}>3. Faça o upload aqui com a senha definida na emissão.</Text>
        </AppCard>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors: DesignColors) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.primaryDark },
  signOutText: { fontSize: 14, color: colors.error },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
  infoBanner: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    marginBottom: spacing.md,
  },
  infoTitle: { fontSize: 18, fontWeight: '700', color: colors.primaryDark, marginTop: spacing.sm },
  infoDesc: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
    lineHeight: 20,
  },
  uploadCard: { marginBottom: spacing.md },
  uploadTitle: { fontSize: 18, fontWeight: '700', color: colors.primaryDark, marginBottom: spacing.md },
  fileBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    marginBottom: spacing.md,
  },
  fileText: { fontSize: 14, fontWeight: '500', color: colors.primary, marginTop: spacing.sm },
  fileSize: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  helpCard: { marginBottom: spacing.md },
  helpTitle: { fontSize: 16, fontWeight: '600', color: colors.primaryDark, marginBottom: spacing.sm },
  helpText: { fontSize: 14, color: colors.textSecondary, marginBottom: 4, lineHeight: 20 },
  disclaimerCard: {
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  disclaimerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primaryDark,
    marginBottom: spacing.sm,
  },
  disclaimerText: {
    fontSize: 14,
    color: colors.textSecondary,
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
    borderColor: colors.border,
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
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  termsLinkWrap: {
    marginTop: spacing.sm,
  },
  termsLink: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  });
}
