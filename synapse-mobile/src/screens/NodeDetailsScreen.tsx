/**
 * Node Details Screen
 * Detailed view and control of a specific node
 */

import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import {useDispatch, useSelector} from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import {RootState} from '@store/index';
import {
  startNode,
  stopNode,
  emergencyStopNode,
  restartNode,
  fetchNodeLogs,
} from '@store/slices/nodesSlice';
import {Node} from '@types/index';

const NodeDetailsScreen: React.FC<{route: any; navigation: any}> = ({
  route,
  navigation,
}) => {
  const {nodeId} = route.params;
  const dispatch = useDispatch();
  const {nodes, logs, operationInProgress} = useSelector(
    (state: RootState) => state.nodes,
  );
  const node = nodes.find(n => n.id === nodeId);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'logs'>('overview');

  useEffect(() => {
    if (node) {
      navigation.setOptions({title: node.name});
      dispatch(fetchNodeLogs({nodeId, limit: 50}));
    }
  }, [node, navigation]);

  const onRefresh = () => {
    setRefreshing(true);
    dispatch(fetchNodeLogs({nodeId, limit: 50}));
    setTimeout(() => setRefreshing(false), 1000);
  };

  if (!node) {
    return (
      <View style={styles.container}>
        <Text>Node not found</Text>
      </View>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return '#10B981';
      case 'offline':
        return '#EF4444';
      case 'syncing':
        return '#F59E0B';
      case 'error':
        return '#DC2626';
      default:
        return '#6B7280';
    }
  };

  const handleEmergencyStop = () => {
    Alert.alert(
      '⚠️ Emergency Stop',
      'This will forcefully terminate the node process. Use only in emergencies!',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Emergency Stop',
          style: 'destructive',
          onPress: () => dispatch(emergencyStopNode(nodeId)),
        },
      ],
    );
  };

  const canStart = node.status === 'offline' || node.status === 'error';
  const canStop = node.status === 'online' || node.status === 'syncing';
  const isOperating = operationInProgress[nodeId];
  const nodeLogs = logs[nodeId] || [];

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }>
      {/* Status Card */}
      <View style={styles.statusCard}>
        <View style={styles.statusHeader}>
          <View
            style={[
              styles.statusBadge,
              {backgroundColor: `${getStatusColor(node.status)}20`},
            ]}>
            <View
              style={[
                styles.statusDot,
                {backgroundColor: getStatusColor(node.status)},
              ]}
            />
            <Text style={[styles.statusText, {color: getStatusColor(node.status)}]}>
              {node.status.toUpperCase()}
            </Text>
          </View>
          <Text style={styles.versionText}>v{node.version}</Text>
        </View>

        {/* Control Buttons */}
        <View style={styles.controls}>
          <ControlButton
            icon="play"
            label="Start"
            color="#10B981"
            onPress={() => dispatch(startNode(nodeId))}
            disabled={!canStart || isOperating}
          />
          <ControlButton
            icon="stop"
            label="Stop"
            color="#EF4444"
            onPress={() => dispatch(stopNode(nodeId))}
            disabled={!canStop || isOperating}
          />
          <ControlButton
            icon="restart"
            label="Restart"
            color="#F59E0B"
            onPress={() => dispatch(restartNode(nodeId))}
            disabled={isOperating}
          />
          <ControlButton
            icon="alert-octagon"
            label="Emergency"
            color="#DC2626"
            onPress={handleEmergencyStop}
            disabled={isOperating}
          />
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TabButton
          label="Overview"
          isActive={activeTab === 'overview'}
          onPress={() => setActiveTab('overview')}
        />
        <TabButton
          label="Logs"
          isActive={activeTab === 'logs'}
          onPress={() => setActiveTab('logs')}
        />
      </View>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <View style={styles.tabContent}>
          {/* Resource Usage */}
          <Text style={styles.sectionTitle}>Resource Usage</Text>
          <View style={styles.metricsGrid}>
            <MetricCard icon="cpu-64-bit" label="CPU" value={`${node.cpuUsage}%`} color="#6366F1" />
            <MetricCard icon="memory" label="Memory" value={`${node.memoryUsage}%`} color="#10B981" />
            <MetricCard icon="harddisk" label="Disk" value={`${node.diskUsage}%`} color="#F59E0B" />
            <MetricCard icon="network" label="Peers" value={node.peersConnected.toString()} color="#8B5CF6" />
          </View>

          {/* Sync Status */}
          <Text style={styles.sectionTitle}>Synchronization</Text>
          <View style={styles.syncCard}>
            <View style={styles.syncInfo}>
              <Text style={styles.syncLabel}>Block Height</Text>
              <Text style={styles.syncValue}>
                {node.lastSyncedBlock.toLocaleString()} / {node.totalBlocks.toLocaleString()}
              </Text>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, {width: `${(node.lastSyncedBlock / node.totalBlocks) * 100}%`}]} />
            </View>
            <Text style={styles.syncPercentage}>
              {((node.lastSyncedBlock / node.totalBlocks) * 100).toFixed(2)}% Synced
            </Text>
          </View>

          {/* Network Stats */}
          <Text style={styles.sectionTitle}>Network</Text>
          <View style={styles.networkCard}>
            <NetworkStat icon="download" label="Download" value={formatBytes(node.networkIn)} />
            <NetworkStat icon="upload" label="Upload" value={formatBytes(node.networkOut)} />
          </View>
        </View>
      )}

      {activeTab === 'logs' && (
        <View style={styles.tabContent}>
          <View style={styles.logsHeader}>
            <Text style={styles.sectionTitle}>Recent Logs</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Logs', {nodeId})}>
              <Text style={styles.viewAllLogs}>View All</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.logsList}>
            {nodeLogs.slice(0, 10).map((log, index) => (
              <View key={index} style={styles.logEntry}>
                <View style={styles.logHeader}>
                  <Text style={[styles.logLevel, {color: getLogLevelColor(log.level)}]}>
                    {log.level.toUpperCase()}
                  </Text>
                  <Text style={styles.logTime}>
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </Text>
                </View>
                <Text style={styles.logMessage}>{log.message}</Text>
              </View>
            ))}
            {nodeLogs.length === 0 && (
              <Text style={styles.noLogs}>No logs available</Text>
            )}
          </View>
        </View>
      )}
    </ScrollView>
  );
};

const getLogLevelColor = (level: string) => {
  switch (level) {
    case 'error':
      return '#EF4444';
    case 'warn':
      return '#F59E0B';
    default:
      return '#10B981';
  }
};

const TabButton: React.FC<{label: string; isActive: boolean; onPress: () => void}> = ({
  label,
  isActive,
  onPress,
}) => (
  <TouchableOpacity style={[styles.tab, isActive && styles.tabActive]} onPress={onPress}>
    <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{label}</Text>
  </TouchableOpacity>
);

const ControlButton: React.FC<{
  icon: string;
  label: string;
  color: string;
  onPress: () => void;
  disabled?: boolean;
}> = ({icon, label, color, onPress, disabled}) => (
  <TouchableOpacity
    style={[styles.controlButton, {backgroundColor: `${color}20`}, disabled && styles.controlButtonDisabled]}
    onPress={onPress}
    disabled={disabled}>
    <Icon name={icon} size={20} color={color} />
    <Text style={[styles.controlButtonText, {color}]}>{label}</Text>
  </TouchableOpacity>
);

const MetricCard: React.FC<{icon: string; label: string; value: string; color: string}> = ({
  icon,
  label,
  value,
  color,
}) => (
  <View style={styles.metricCard}>
    <View style={[styles.metricIcon, {backgroundColor: `${color}20`}]}>
      <Icon name={icon} size={20} color={color} />
    </View>
    <Text style={styles.metricLabel}>{label}</Text>
    <Text style={styles.metricValue}>{value}</Text>
  </View>
);

const NetworkStat: React.FC<{icon: string; label: string; value: string}> = ({icon, label, value}) => (
  <View style={styles.networkStat}>
    <Icon name={icon} size={20} color="#6366F1" />
    <View style={styles.networkStatText}>
      <Text style={styles.networkStatLabel}>{label}</Text>
      <Text style={styles.networkStatValue}>{value}</Text>
    </View>
  </View>
);

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  statusCard: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  versionText: {
    fontSize: 14,
    color: '#6B7280',
  },
  controls: {
    flexDirection: 'row',
    gap: 8,
  },
  controlButton: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    gap: 4,
  },
  controlButtonDisabled: {
    opacity: 0.5,
  },
  controlButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    padding: 4,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#111827',
  },
  tabContent: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  metricCard: {
    width: '23%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  metricIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 8,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginTop: 4,
  },
  syncCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  syncInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  syncLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  syncValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#6366F1',
    borderRadius: 4,
  },
  syncPercentage: {
    fontSize: 12,
    color: '#6366F1',
    marginTop: 8,
    fontWeight: '500',
  },
  networkCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  networkStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  networkStatText: {
    alignItems: 'flex-start',
  },
  networkStatLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  networkStatValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  logsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  viewAllLogs: {
    fontSize: 14,
    color: '#6366F1',
    fontWeight: '500',
  },
  logsList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
  },
  logEntry: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingVertical: 12,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  logLevel: {
    fontSize: 10,
    fontWeight: '600',
  },
  logTime: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  logMessage: {
    fontSize: 14,
    color: '#374151',
  },
  noLogs: {
    textAlign: 'center',
    color: '#9CA3AF',
    padding: 24,
  },
});

export default NodeDetailsScreen;
