/**
 * Dashboard Screen
 * Main overview of nodes and earnings
 */

import React, {useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import {useDispatch, useSelector} from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {LineChart} from 'react-native-chart-kit';
import {Dimensions} from 'react-native';

import {RootState} from '@store/index';
import {fetchNodes} from '@store/slices/nodesSlice';
import {fetchEarnings} from '@store/slices/earningsSlice';
import {Node, DailyEarning} from '@types/index';

const screenWidth = Dimensions.get('window').width;

const DashboardScreen: React.FC<{navigation: any}> = ({navigation}) => {
  const dispatch = useDispatch();
  const {nodes, isLoading: nodesLoading} = useSelector(
    (state: RootState) => state.nodes,
  );
  const {data: earningsData, isLoading: earningsLoading} = useSelector(
    (state: RootState) => state.earnings,
  );
  const {walletAddress} = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    dispatch(fetchNodes());
    if (walletAddress) {
      dispatch(fetchEarnings({walletAddress}));
    }
  };

  const onlineNodes = nodes.filter(n => n.status === 'online').length;
  const totalRewards = earningsData?.totalEarned || 0;

  const chartData = {
    labels: earningsData?.dailyEarnings?.slice(-7).map((d: DailyEarning) => {
      const date = new Date(d.date);
      return `${date.getMonth() + 1}/${date.getDate()}`;
    }) || [],
    datasets: [
      {
        data:
          earningsData?.dailyEarnings?.slice(-7).map((d: DailyEarning) => d.amount) ||
          [],
      },
    ],
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={nodesLoading || earningsLoading} onRefresh={loadData} />
      }>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Good morning</Text>
          <Text style={styles.walletAddress}>
            {walletAddress
              ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
              : 'Not connected'}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.notificationButton}
          onPress={() => navigation.navigate('Notifications')}>
          <Icon name="bell-outline" size={24} color="#111827" />
          <View style={styles.notificationBadge}>
            <Text style={styles.badgeText}>3</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <StatCard
          icon="server"
          title="Active Nodes"
          value={`${onlineNodes}/${nodes.length}`}
          subtitle="Online"
          color="#10B981"
        />
        <StatCard
          icon="cash"
          title="Total Earnings"
          value={`${totalRewards.toLocaleString()} SYN`}
          subtitle="All time"
          color="#6366F1"
        />
      </View>

      {/* Earnings Chart */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Earnings (Last 7 Days)</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Earnings')}>
            <Text style={styles.seeAll}>See All</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.chartContainer}>
          {earningsData?.dailyEarnings && (
            <LineChart
              data={chartData}
              width={screenWidth - 48}
              height={180}
              chartConfig={{
                backgroundColor: '#FFFFFF',
                backgroundGradientFrom: '#FFFFFF',
                backgroundGradientTo: '#FFFFFF',
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(99, 102, 241, ${opacity})`,
                labelColor: (opacity = 1) => `rgba(107, 114, 128, ${opacity})`,
                style: {
                  borderRadius: 16,
                },
                propsForDots: {
                  r: '4',
                  strokeWidth: '2',
                  stroke: '#6366F1',
                },
              }}
              bezier
              style={styles.chart}
            />
          )}
        </View>
      </View>

      {/* Node Status */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Node Status</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Nodes')}>
            <Text style={styles.seeAll}>Manage</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.nodesContainer}>
          {nodes.slice(0, 3).map(node => (
            <NodeStatusCard
              key={node.id}
              node={node}
              onPress={() =>
                navigation.navigate('NodeDetails', {nodeId: node.id})
              }
            />
          ))}
          {nodes.length === 0 && (
            <TouchableOpacity
              style={styles.addNodeCard}
              onPress={() => navigation.navigate('Nodes')}>
              <Icon name="plus-circle" size={32} color="#6366F1" />
              <Text style={styles.addNodeText}>Add Your First Node</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActions}>
          <QuickActionButton
            icon="lightning-bolt"
            label="Start All"
            onPress={() => {}}
            color="#F59E0B"
          />
          <QuickActionButton
            icon="stop-circle"
            label="Stop All"
            onPress={() => {}}
            color="#EF4444"
          />
          <QuickActionButton
            icon="refresh"
            label="Restart"
            onPress={() => {}}
            color="#10B981"
          />
          <QuickActionButton
            icon="cog"
            label="Settings"
            onPress={() => navigation.navigate('Settings')}
            color="#6B7280"
          />
        </View>
      </View>
    </ScrollView>
  );
};

const StatCard: React.FC<{
  icon: string;
  title: string;
  value: string;
  subtitle: string;
  color: string;
}> = ({icon, title, value, subtitle, color}) => (
  <View style={styles.statCard}>
    <View style={[styles.statIcon, {backgroundColor: `${color}20`}]}>
      <Icon name={icon} size={24} color={color} />
    </View>
    <Text style={styles.statTitle}>{title}</Text>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statSubtitle}>{subtitle}</Text>
  </View>
);

const NodeStatusCard: React.FC<{node: Node; onPress: () => void}> = ({
  node,
  onPress,
}) => {
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

  return (
    <TouchableOpacity style={styles.nodeCard} onPress={onPress}>
      <View style={styles.nodeHeader}>
        <View style={styles.nodeInfo}>
          <Text style={styles.nodeName}>{node.name}</Text>
          <Text style={styles.nodeType}>{node.type}</Text>
        </View>
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
          <Text
            style={[
              styles.statusText,
              {color: getStatusColor(node.status)},
            ]}>
            {node.status}
          </Text>
        </View>
      </View>
      <View style={styles.nodeMetrics}>
        <View style={styles.metric}>
          <Text style={styles.metricValue}>{node.cpuUsage}%</Text>
          <Text style={styles.metricLabel}>CPU</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricValue}>{node.memoryUsage}%</Text>
          <Text style={styles.metricLabel}>Memory</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricValue}>{node.peersConnected}</Text>
          <Text style={styles.metricLabel}>Peers</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const QuickActionButton: React.FC<{
  icon: string;
  label: string;
  onPress: () => void;
  color: string;
}> = ({icon, label, onPress, color}) => (
  <TouchableOpacity style={styles.quickAction} onPress={onPress}>
    <View style={[styles.quickActionIcon, {backgroundColor: `${color}20`}]}>
      <Icon name={icon} size={24} color={color} />
    </View>
    <Text style={styles.quickActionLabel}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#FFFFFF',
  },
  greeting: {
    fontSize: 14,
    color: '#6B7280',
  },
  walletAddress: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginTop: 4,
  },
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#EF4444',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 24,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statTitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 12,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 4,
  },
  statSubtitle: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  section: {
    padding: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  seeAll: {
    fontSize: 14,
    color: '#6366F1',
    fontWeight: '500',
  },
  chartContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  chart: {
    borderRadius: 16,
  },
  nodesContainer: {
    gap: 12,
  },
  nodeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  nodeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  nodeInfo: {
    flex: 1,
  },
  nodeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  nodeType: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
    textTransform: 'capitalize',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  nodeMetrics: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 24,
  },
  metric: {
    flex: 1,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  metricLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  addNodeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  addNodeText: {
    fontSize: 16,
    color: '#6366F1',
    marginTop: 8,
    fontWeight: '500',
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickAction: {
    alignItems: 'center',
  },
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickActionLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 8,
  },
});

export default DashboardScreen;
