/**
 * Earnings Screen
 * Track and manage earnings
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
import {BarChart} from 'react-native-chart-kit';
import {Dimensions} from 'react-native';

import {RootState} from '@store/index';
import {fetchEarnings, claimRewards} from '@store/slices/earningsSlice';
import {DailyEarning} from '@types/index';

const screenWidth = Dimensions.get('window').width;

const EarningsScreen: React.FC<{navigation: any}> = ({navigation}) => {
  const dispatch = useDispatch();
  const {data: earnings, isLoading, claimInProgress} = useSelector(
    (state: RootState) => state.earnings,
  );
  const {walletAddress} = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    if (walletAddress) {
      dispatch(fetchEarnings({walletAddress}));
    }
  }, [walletAddress]);

  const handleClaim = () => {
    if (walletAddress && earnings?.pendingRewards) {
      dispatch(claimRewards({walletAddress}));
    }
  };

  const chartData = {
    labels: earnings?.dailyEarnings?.slice(-7).map((d: DailyEarning) => {
      const date = new Date(d.date);
      return `${date.getMonth() + 1}/${date.getDate()}`;
    }) || [],
    datasets: [
      {
        data: earnings?.dailyEarnings?.slice(-7).map((d: DailyEarning) => d.amount) || [],
      },
    ],
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={isLoading}
          onRefresh={() => walletAddress && dispatch(fetchEarnings({walletAddress}))}
        />
      }>
      {/* Total Earnings Card */}
      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>Total Earnings</Text>
        <Text style={styles.totalValue}>
          {earnings?.totalEarned?.toLocaleString() || '0'} SYN
        </Text>
        <View style={styles.totalStats}>
          <View style={styles.totalStat}>
            <Text style={styles.totalStatLabel}>Pending</Text>
            <Text style={styles.totalStatValue}>
              {earnings?.pendingRewards?.toLocaleString() || '0'} SYN
            </Text>
          </View>
          <View style={styles.totalStat}>
            <Text style={styles.totalStatLabel}>Claimed</Text>
            <Text style={styles.totalStatValue}>
              {earnings?.claimedRewards?.toLocaleString() || '0'} SYN
            </Text>
          </View>
        </View>
        {earnings?.pendingRewards > 0 && (
          <TouchableOpacity
            style={[styles.claimButton, claimInProgress && styles.claimButtonDisabled]}
            onPress={handleClaim}
            disabled={claimInProgress}>
            <Text style={styles.claimButtonText}>
              {claimInProgress ? 'Claiming...' : 'Claim Rewards'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Daily Chart */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Last 7 Days</Text>
        <View style={styles.chartCard}>
          {earnings?.dailyEarnings && (
            <BarChart
              data={chartData}
              width={screenWidth - 48}
              height={220}
              chartConfig={{
                backgroundColor: '#FFFFFF',
                backgroundGradientFrom: '#FFFFFF',
                backgroundGradientTo: '#FFFFFF',
                decimalPlaces: 0,
                color: () => '#6366F1',
                labelColor: () => '#6B7280',
              }}
              style={styles.chart}
            />
          )}
        </View>
      </View>

      {/* Recent Activity */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <TouchableOpacity onPress={() => navigation.navigate('EarningsDetails')}>
            <Text style={styles.seeAll}>See All</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.activityList}>
          {earnings?.dailyEarnings?.slice(0, 5).map((earning, index) => (
            <ActivityItem
              key={index}
              date={earning.date}
              amount={earning.amount}
              nodes={earning.nodes}
            />
          ))}
        </View>
      </View>

      {/* Monthly Overview */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Monthly Overview</Text>
        <View style={styles.monthlyList}>
          {earnings?.monthlyEarnings?.slice(0, 3).map((month, index) => (
            <MonthlyItem
              key={index}
              month={month.month}
              amount={month.amount}
              growth={month.growth}
            />
          ))}
        </View>
      </View>
    </ScrollView>
  );
};

const ActivityItem: React.FC<{date: string; amount: number; nodes: number}> = ({
  date,
  amount,
  nodes,
}) => (
  <View style={styles.activityItem}>
    <View style={styles.activityIcon}>
      <Icon name="cash-plus" size={20} color="#10B981" />
    </View>
    <View style={styles.activityInfo}>
      <Text style={styles.activityDate}>
        {new Date(date).toLocaleDateString()}
      </Text>
      <Text style={styles.activityNodes}>{nodes} nodes active</Text>
    </View>
    <Text style={styles.activityAmount}>+{amount.toFixed(2)} SYN</Text>
  </View>
);

const MonthlyItem: React.FC<{month: string; amount: number; growth: number}> = ({
  month,
  amount,
  growth,
}) => (
  <View style={styles.monthlyItem}>
    <View style={styles.monthlyInfo}>
      <Text style={styles.monthlyName}>
        {new Date(month + '-01').toLocaleDateString(undefined, {month: 'long', year: 'numeric'})}
      </Text>
      <View style={styles.growthBadge}>
        <Icon
          name={growth >= 0 ? 'trending-up' : 'trending-down'}
          size={12}
          color={growth >= 0 ? '#10B981' : '#EF4444'}
        />
        <Text style={[styles.growthText, {color: growth >= 0 ? '#10B981' : '#EF4444'}]}>
          {growth >= 0 ? '+' : ''}{growth.toFixed(1)}%
        </Text>
      </View>
    </View>
    <Text style={styles.monthlyAmount}>{amount.toLocaleString()} SYN</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  totalCard: {
    backgroundColor: '#6366F1',
    margin: 16,
    borderRadius: 20,
    padding: 24,
  },
  totalLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  totalValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 8,
  },
  totalStats: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 24,
  },
  totalStat: {
    flex: 1,
  },
  totalStatLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  totalStatValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 4,
  },
  claimButton: {
    backgroundColor: '#FFFFFF',
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  claimButtonDisabled: {
    opacity: 0.7,
  },
  claimButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6366F1',
  },
  section: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  seeAll: {
    fontSize: 14,
    color: '#6366F1',
  },
  chartCard: {
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
  activityList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#D1FAE5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityInfo: {
    flex: 1,
    marginLeft: 12,
  },
  activityDate: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  activityNodes: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  activityAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
  },
  monthlyList: {
    gap: 12,
  },
  monthlyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
  },
  monthlyInfo: {
    flex: 1,
  },
  monthlyName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  growthBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  growthText: {
    fontSize: 12,
    fontWeight: '500',
  },
  monthlyAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
});

export default EarningsScreen;
