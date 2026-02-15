import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { fetchNotifications, markNotificationRead, markAllNotificationsRead } from '../../lib/api';
import { NotificationResponseDto } from '../../types/database';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';

export default function PatientNotificationsScreen() {
  const [notifications, setNotifications] = useState<NotificationResponseDto[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const res = await fetchNotifications(1, 50);
      setNotifications(res.items);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      await markNotificationRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch {}
  };

  const handleMarkAll = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch {}
  };

  const getIcon = (type: string): keyof typeof Ionicons.glyphMap => {
    switch (type) {
      case 'payment': return 'card';
      case 'consultation': return 'videocam';
      case 'system': return 'information-circle';
      default: return 'notifications';
    }
  };

  const getIconColor = (type: string) => {
    switch (type) {
      case 'payment': return colors.success;
      case 'consultation': return '#8B5CF6';
      case 'system': return colors.warning;
      default: return colors.primary;
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const renderItem = ({ item }: { item: NotificationResponseDto }) => (
    <TouchableOpacity onPress={() => !item.read && handleMarkRead(item.id)}>
      <Card style={[styles.card, !item.read && styles.cardUnread]}>
        <View style={styles.row}>
          <View style={[styles.iconBg, { backgroundColor: getIconColor(item.notificationType) + '15' }]}>
            <Ionicons name={getIcon(item.notificationType)} size={22} color={getIconColor(item.notificationType)} />
          </View>
          <View style={styles.content}>
            <Text style={[styles.notifTitle, !item.read && styles.bold]}>{item.title}</Text>
            <Text style={styles.notifMessage} numberOfLines={2}>{item.message}</Text>
            <Text style={styles.time}>
              {new Date(item.createdAt).toLocaleDateString('pt-BR')} às{' '}
              {new Date(item.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
          {!item.read && <View style={styles.unreadDot} />}
        </View>
      </Card>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Notificações</Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={handleMarkAll}>
            <Text style={styles.markAll}>Marcar todas como lidas</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={notifications}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
        ListEmptyComponent={
          !loading ? (
            <EmptyState icon="notifications-off-outline" title="Sem notificações" description="Você será notificado sobre atualizações" />
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm,
  },
  title: { ...typography.h2, color: colors.primaryDarker },
  markAll: { ...typography.caption, color: colors.primary },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  card: { marginBottom: spacing.sm },
  cardUnread: { borderLeftWidth: 3, borderLeftColor: colors.primary },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  iconBg: {
    width: 42, height: 42, borderRadius: 21,
    justifyContent: 'center', alignItems: 'center', marginRight: spacing.md,
  },
  content: { flex: 1 },
  notifTitle: { ...typography.bodySmallMedium, color: colors.gray800 },
  bold: { fontWeight: '700' },
  notifMessage: { ...typography.caption, color: colors.gray500, marginTop: 2 },
  time: { ...typography.captionSmall, color: colors.gray400, marginTop: 4 },
  unreadDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: colors.primary, marginTop: 6,
  },
});
