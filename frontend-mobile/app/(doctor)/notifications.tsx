import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { fetchNotifications, markNotificationRead, markAllNotificationsRead } from '../../lib/api';
import { NotificationResponseDto } from '../../types/database';
import { colors, spacing, typography } from '../../constants/theme';

export default function DoctorNotificationsScreen() {
  const [notifications, setNotifications] = useState<NotificationResponseDto[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);
  const load = async () => { try { const res = await fetchNotifications(1, 50); setNotifications(res.items); } catch {} finally { setLoading(false); setRefreshing(false); } };
  const handleMarkRead = async (id: string) => { try { await markNotificationRead(id); setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n)); } catch {} };
  const handleMarkAll = async () => { try { await markAllNotificationsRead(); setNotifications(prev => prev.map(n => ({ ...n, read: true }))); } catch {} };

  const renderItem = ({ item }: { item: NotificationResponseDto }) => (
    <TouchableOpacity onPress={() => !item.read && handleMarkRead(item.id)}>
      <Card style={[styles.card, !item.read && styles.unread]}>
        <View style={styles.row}>
          <View style={styles.iconBg}><Ionicons name="notifications" size={20} color={colors.primary} /></View>
          <View style={styles.content}>
            <Text style={[styles.title, !item.read && { fontWeight: '700' }]}>{item.title}</Text>
            <Text style={styles.msg} numberOfLines={2}>{item.message}</Text>
            <Text style={styles.time}>{new Date(item.createdAt).toLocaleDateString('pt-BR')}</Text>
          </View>
          {!item.read && <View style={styles.dot} />}
        </View>
      </Card>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.screenTitle}>Notificações</Text>
        {notifications.some(n => !n.read) && <TouchableOpacity onPress={handleMarkAll}><Text style={styles.markAll}>Marcar lidas</Text></TouchableOpacity>}
      </View>
      <FlatList data={notifications} renderItem={renderItem} keyExtractor={i => i.id} contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
        ListEmptyComponent={!loading ? <EmptyState icon="notifications-off-outline" title="Sem notificações" /> : null} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  screenTitle: { ...typography.h2, color: colors.primaryDarker },
  markAll: { ...typography.caption, color: colors.primary },
  list: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxl },
  card: { marginBottom: spacing.sm },
  unread: { borderLeftWidth: 3, borderLeftColor: colors.primary },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  iconBg: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primaryPaler, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  content: { flex: 1 },
  title: { ...typography.bodySmallMedium, color: colors.gray800 },
  msg: { ...typography.caption, color: colors.gray500, marginTop: 2 },
  time: { ...typography.captionSmall, color: colors.gray400, marginTop: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginTop: 6 },
});
