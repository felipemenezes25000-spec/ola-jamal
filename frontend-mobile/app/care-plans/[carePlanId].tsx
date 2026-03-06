import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import {
  carePlanTaskAction,
  getCarePlan,
  reviewCarePlan,
  uploadCarePlanTaskFile,
  type CarePlan,
  type CarePlanTask,
} from '../../lib/api-care-plans';
import { useAppTheme } from '../../lib/ui/useAppTheme';
import type { DesignColors } from '../../lib/designSystem';

export default function CarePlanDetailsScreen() {
  const router = useRouter();
  const { carePlanId } = useLocalSearchParams<{ carePlanId: string }>();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [carePlan, setCarePlan] = useState<CarePlan | null>(null);
  const id = Array.isArray(carePlanId) ? carePlanId[0] : carePlanId;
  const isDoctor = user?.role === 'doctor';
  const isPatient = user?.role === 'patient';
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await getCarePlan(id);
      setCarePlan(data);
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Não foi possível carregar o plano.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const title = useMemo(() => {
    if (!carePlan) return 'Plano de cuidados';
    return isDoctor ? 'Plano de cuidados do paciente' : 'Plano da sua consulta';
  }, [carePlan, isDoctor]);

  const runAction = async (task: CarePlanTask, action: 'start' | 'complete' | 'submit_results') => {
    if (!carePlan) return;
    try {
      setSaving(true);
      const updated = await carePlanTaskAction(carePlan.id, task.id, action);
      setCarePlan(updated);
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Não foi possível atualizar a tarefa.');
    } finally {
      setSaving(false);
    }
  };

  const uploadResult = async (task: CarePlanTask) => {
    if (!carePlan) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        type: ['image/*', 'application/pdf'],
      });
      if (result.canceled || !result.assets?.[0]) return;

      const file = result.assets[0];
      setSaving(true);
      await uploadCarePlanTaskFile(carePlan.id, task.id, {
        uri: file.uri,
        name: file.name ?? `resultado_${Date.now()}.pdf`,
        type: file.mimeType ?? 'application/octet-stream',
      });

      const updated = await carePlanTaskAction(carePlan.id, task.id, 'submit_results');
      setCarePlan(updated);
      Alert.alert('Sucesso', 'Resultado enviado para revisão médica.');
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Falha ao enviar resultado.');
    } finally {
      setSaving(false);
    }
  };

  const closePlan = async () => {
    if (!carePlan) return;
    try {
      setSaving(true);
      const decisions = carePlan.tasks
        .filter((t) => t.state === 'submitted')
        .map((t) => ({ taskId: t.id, decision: 'reviewed' }));
      const updated = await reviewCarePlan(carePlan.id, {
        closePlan: true,
        notes: 'Revisão concluída pelo médico responsável.',
        taskDecisions: decisions,
      });
      setCarePlan(updated);
      Alert.alert('Plano encerrado', 'O plano foi revisado e encerrado.');
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Não foi possível encerrar o plano.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.success} />
          <Text style={styles.subtle}>Carregando plano...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!carePlan) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.title}>Plano não encontrado</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.back()}>
            <Text style={styles.primaryBtnText}>Voltar</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
        >
          <Ionicons name="chevron-back" size={20} color={colors.border} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtle}>Status: {carePlan.status.replaceAll('_', ' ')}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {carePlan.tasks.map((task) => (
          <View key={task.id} style={styles.card}>
            <Text style={styles.cardTitle}>{task.title}</Text>
            <Text style={styles.cardMeta}>
              {task.type.replaceAll('_', ' ')} • {task.state.replaceAll('_', ' ')}
            </Text>
            {!!task.description && <Text style={styles.cardDescription}>{task.description}</Text>}

            {task.files.length > 0 && (
              <Text style={styles.filesInfo}>Arquivos enviados: {task.files.length}</Text>
            )}

            {isPatient && task.type === 'upload_result' && (
              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={() => runAction(task, 'start')}
                  disabled={saving}
                >
                  <Text style={styles.secondaryBtnText}>Iniciar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={() => uploadResult(task)}
                  disabled={saving}
                >
                  <Text style={styles.primaryBtnText}>Enviar resultado</Text>
                </TouchableOpacity>
              </View>
            )}

            {isPatient && task.type !== 'upload_result' && task.state === 'pending' && (
              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={() => runAction(task, 'start')}
                  disabled={saving}
                >
                  <Text style={styles.secondaryBtnText}>Iniciar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={() => runAction(task, 'complete')}
                  disabled={saving}
                >
                  <Text style={styles.primaryBtnText}>Concluir</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))}

        {isDoctor && carePlan.status === 'ready_for_review' && (
          <TouchableOpacity style={styles.primaryBtn} onPress={closePlan} disabled={saving}>
            <Text style={styles.primaryBtnText}>Revisar e encerrar plano</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors: DesignColors) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.black },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.text, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.border, fontSize: 18, fontWeight: '700' },
  subtle: { color: colors.textMuted, fontSize: 12 },
  content: { padding: 12, gap: 12, paddingBottom: 30 },
  card: { backgroundColor: colors.text, borderRadius: 12, padding: 12, gap: 6 },
  cardTitle: { color: colors.border, fontSize: 15, fontWeight: '700' },
  cardMeta: { color: colors.textMuted, fontSize: 12, textTransform: 'capitalize' },
  cardDescription: { color: colors.border, fontSize: 13, lineHeight: 18 },
  filesInfo: { color: colors.successLight, fontSize: 12, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  primaryBtn: { backgroundColor: colors.success, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, alignItems: 'center' },
  primaryBtnText: { color: colors.white, fontWeight: '800' },
  secondaryBtn: { backgroundColor: colors.textSecondary, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, alignItems: 'center' },
  secondaryBtnText: { color: colors.border, fontWeight: '700' },
  });
}
