/**
 * Earnings Details Screen
 * Detailed earnings view
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import {useSelector} from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {BarChart, LineChart} from 'react-native-chart-kit';
import {Dimensions} from 'react-native';

import {RootState} from '@store/index';

const screenWidth = Dimensions.get('window').width;

const EarningsDetailsScreen: React.FC = () => {
  const {data: earnings} = useSelector((state: RootState) => state.earnings);

  return (
    <ScrollView style={styles.container}>
      {/* Summary Cards */}
      <View style={styles.summaryContainer}>
        <SummaryCard
          title="Total Earned"
          value={`${earnings?.totalEarned?.toLocaleString() || '0'} SYN`}
          icon="cash-multiple"
          color="#6366F1"
        />
        <SummaryCard
          title="Pending"
          value={`${earnings?.pendingRewards?.toLocaleString() || '0'} SYN`}
          icon="clock-outline"
          color="#F59E0B"
        />
      </View>

      {/* Stats Grid */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Statistics</Text>
        <View style={styles.statsGrid}>
          <StatBox
            label="Average Daily"
            value={`${(
              (earnings?.dailyEarnings?.reduce((a: any, b: any) => a + b.amount, 0) || 0) /
              (earnings?.dailyEarnings?.length || 1)
            ).toFixed(2)} SYN`}
          />
          <StatBox
            label="Best Day"
            value={`${Math.max(
              ...(earnings?.dailyEarnings?.map((d: any) => d.amount) || [0])
            ).toFixed(2)} SYN`}
          />
        </View>
      </View>

      {/* Transactions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Earnings</Text>
        <View style={styles.transactionsList}>
          {earnings?.dailyEarnings?.slice(0, 10).map((earning: any, index: number) => (
            <TransactionItem
              key={index}
              date={earning.date}
              amount={earning.amount}
            />
          ))}
        </View>
      </View>
    </ScrollView>
  );
};

const SummaryCard: React.FC<{
  title: string;
  value: string;
  icon: string;
  color: string;
}> = ({title, value, icon, color}) => (
  <View style={[styles.summaryCard, {backgroundColor: `${color}15`}]}>
    <View style={[styles.summaryIcon, {backgroundColor: `${color}30`}]}>
      <Icon name={icon} size={28} color={color} />
    </View>
    <Text style={styles.summaryTitle}>{title}</Text>
    <Text style={[styles.summaryValue, {color}]}>{value}</Text>
  </View>
);

const StatBox: React.FC<{label: string; value: string}> = ({label, value}) => (
  <View style={styles.statBox}>
    <Text style={styles.statLabel}>{label}</Text>
    <Text style={styles.statValue}>{value}</Text>
  </View>
);

const TransactionItem: React.FC<{date: string; amount: number}> = ({
  date,
  amount,
}) => (
  <View style={styles.transactionItem}>
    <View style={styles.transactionIcon}>
      <Icon name="cash-plus" size={20} color="#10B981" />
    </View>
    <View style={styles.transactionInfo}>
      <Text style={styles.transactionTitle}>Node Rewards</Text>
      <Text style={styles.transactionDate}>
        {new Date(date).toLocaleDateString()}
      </Text>
    </View>
    <Text style={styles.transactionAmount}>+{amount.toFixed(2)} SYN</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  summaryContainer: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
  },
  summaryIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryTitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 12,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 4,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statBox: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
  },
  statLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginTop: 4,
  },
  transactionsList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#D1FAE5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  transactionInfo: {
    flex: 1,
    marginLeft: 12,
  },
  transactionTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
  },
  transactionDate: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  transactionAmount: {
    fontSize: 15,
    fontWeight: '600',
    color: '#10B981',
  },
});

export default EarningsDetailsScreen;
