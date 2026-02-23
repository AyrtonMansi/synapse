/**
 * Nodes Screen
 * List and manage all nodes
 */

import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import {useDispatch, useSelector} from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import {RootState} from '@store/index';
import {
  fetchNodes,
  startNode,
  stopNode,
  emergencyStopNode,
  setSelectedNode,
} from '@store/slices/nodesSlice';
import {Node} from '@types/index';

const NodesScreen: React.FC<{navigation: any}> = ({navigation}) => {
  const dispatch = useDispatch();
  const {nodes, isLoading, operationInProgress} = useSelector(
    (state: RootState) => state.nodes,
  );
  const [filter, setFilter] = useState<'all' | 'online' | 'offline'>('all');

  useEffect(() => {
    dispatch(fetchNodes());
  }, []);

  const filteredNodes = nodes.filter(node => {
    if (filter === 'online') return node.status === 'online' || node.status === 'syncing';
    if (filter === 'offline') return node.status === 'offline' || node.status === 'error';
    return true;
  });

  const handleStartNode = (nodeId: string) => {
    dispatch(startNode(nodeId));
  };

  const handleStopNode = (nodeId: string) => {
    Alert.alert(
      'Stop Node',
      'Are you sure you want to stop this node?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Stop',
          style: 'default',
          onPress: () => dispatch(stopNode(nodeId)),
        },
      ],
    );
  };

  const handleEmergencyStop = (nodeId: string) => {
    Alert.alert(
      '⚠️ Emergency Stop',
      'This will forcefully terminate the node process. Only use in emergencies!',
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

  const renderNode = ({item}: {item: Node}) => (
    <NodeListItem
      node={item}
      isOperating={operationInProgress[item.id]}
      onPress={() => {
        dispatch(setSelectedNode(item));
        navigation.navigate('NodeDetails', {nodeId: item.id});
      }}
      onStart={() => handleStartNode(item.id)}
      onStop={() => handleStopNode(item.id)}
      onEmergencyStop={() => handleEmergencyStop(item.id)}
    />
  );

  return (
    <View style={styles.container}>
      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <FilterTab
          label="All"
          count={nodes.length}
          isActive={filter === 'all'}
          onPress={() => setFilter('all')}
        />
        <FilterTab
          label="Online"
          count={nodes.filter(n => n.status === 'online' || n.status === 'syncing').length}
          isActive={filter === 'online'}
          onPress={() => setFilter('online')}
        />
        <FilterTab
          label="Offline"
          count={nodes.filter(n => n.status === 'offline' || n.status === 'error').length}
          isActive={filter === 'offline'}
          onPress={() => setFilter('offline')}
        />
      </View>

      {/* Node List */}
      <FlatList
        data={filteredNodes}
        renderItem={renderNode}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={() => dispatch(fetchNodes())} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Icon name="server-off" size={64} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>No Nodes Found</Text>
            <Text style={styles.emptySubtitle}>
              {filter === 'all'
                ? 'Add your first node to get started'
                : `No ${filter} nodes`}
            </Text>
          </View>
        }
      />

      {/* Add Node FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          /* Show add node modal */
        }}>
        <Icon name="plus" size={24} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
};

const FilterTab: React.FC<{
  label: string;
  count: number;
  isActive: boolean;
  onPress: () => void;
}> = ({label, count, isActive, onPress}) => (
  <TouchableOpacity
    style={[styles.filterTab, isActive && styles.filterTabActive]}
    onPress={onPress}>
    <Text style={[styles.filterTabText, isActive && styles.filterTabTextActive]}>
      {label}
    </Text>
    <View style={[styles.filterBadge, isActive && styles.filterBadgeActive]}>
      <Text style={[styles.filterBadgeText, isActive && styles.filterBadgeTextActive]}>
        {count}
      </Text>
    </View>
  </TouchableOpacity>
);

const NodeListItem: React.FC<{
  node: Node;
  isOperating: boolean;
  onPress: () => void;
  onStart: () => void;
  onStop: () => void;
  onEmergencyStop: () => void;
}> = ({node, isOperating, onPress, onStart, onStop, onEmergencyStop}) => {
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
      case 'maintenance':
        return '#6B7280';
      default:
        return '#9CA3AF';
    }
  };

  const canStart = node.status === 'offline' || node.status === 'error';
  const canStop = node.status === 'online' || node.status === 'syncing';

  return (
    <TouchableOpacity style={styles.nodeItem} onPress={onPress}>
      <View style={styles.nodeMain}>
        <View
          style={[
            styles.statusIndicator,
            {backgroundColor: getStatusColor(node.status)},
          ]}
        />
        <View style={styles.nodeInfo}>
          <Text style={styles.nodeName}>{node.name}</Text>
          <View style={styles.nodeMeta}>
            <Text style={styles.nodeType}>{node.type}</Text>
            <Text style={styles.nodeVersion}>v{node.version}</Text>
          </View>
          <View style={styles.nodeStats}>
            <Stat icon="cpu-64-bit" value={`${node.cpuUsage}%`} />
            <Stat icon="memory" value={`${node.memoryUsage}%`} />
            <Stat icon="network" value={`${node.peersConnected}`} />
          </View>
        </View>
        <View style={styles.nodeActions}>
          {isOperating ? (
            <View style={styles.loadingIndicator}>
              <Icon name="loading" size={20} color="#6366F1" />
            </View>
          ) : (
            <>
              {canStart && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.startButton]}
                  onPress={e => {
                    e.stopPropagation();
                    onStart();
                  }}>
                  <Icon name="play" size={16} color="#FFFFFF" />
                </TouchableOpacity>
              )}
              {canStop && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.stopButton]}
                  onPress={e => {
                    e.stopPropagation();
                    onStop();
                  }}>
                  <Icon name="stop" size={16} color="#FFFFFF" />
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </View>
      <View style={styles.nodeFooter}>
        <Text style={styles.statusText}>
          Status: <Text style={{color: getStatusColor(node.status)}}>{node.status}</Text>
        </Text>
        <Text style={styles.uptimeText}>
          Uptime: {formatUptime(node.uptime)}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const Stat: React.FC<{icon: string; value: string}> = ({icon, value}) => (
  <View style={styles.stat}>
    <Icon name={icon} size={14} color="#9CA3AF" />
    <Text style={styles.statText}>{value}</Text>
  </View>
);

const formatUptime = (seconds: number): string => {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h`;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  filterContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    gap: 6,
  },
  filterTabActive: {
    backgroundColor: '#EEF2FF',
  },
  filterTabText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  filterTabTextActive: {
    color: '#6366F1',
  },
  filterBadge: {
    backgroundColor: '#E5E7EB',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBadgeActive: {
    backgroundColor: '#6366F1',
  },
  filterBadgeText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
  filterBadgeTextActive: {
    color: '#FFFFFF',
  },
  list: {
    padding: 16,
    gap: 12,
  },
  nodeItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  nodeMain: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  statusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
    marginRight: 12,
  },
  nodeInfo: {
    flex: 1,
  },
  nodeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  nodeMeta: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  nodeType: {
    fontSize: 12,
    color: '#6B7280',
    textTransform: 'capitalize',
  },
  nodeVersion: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  nodeStats: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 12,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 12,
    color: '#6B7280',
  },
  nodeActions: {
    flexDirection: 'row',
    gap: 8,
  },
  loadingIndicator: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  startButton: {
    backgroundColor: '#10B981',
  },
  stopButton: {
    backgroundColor: '#EF4444',
  },
  nodeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  statusText: {
    fontSize: 12,
    color: '#6B7280',
  },
  uptimeText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  emptyState: {
    alignItems: 'center',
    padding: 48,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366F1',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});

export default NodesScreen;
