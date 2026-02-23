/**
 * Social Screen
 * Chat rooms and forums
 */

import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import {useDispatch, useSelector} from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import {RootState} from '@store/index';
import {fetchChatRooms, fetchForumTopics} from '@store/slices/chatSlice';
import {ChatRoom, ForumTopic} from '@types/index';

const SocialScreen: React.FC<{navigation: any}> = ({navigation}) => {
  const dispatch = useDispatch();
  const {rooms, topics, isLoading} = useSelector((state: RootState) => state.chat);
  const [activeTab, setActiveTab] = useState<'chat' | 'forum'>('chat');

  useEffect(() => {
    dispatch(fetchChatRooms());
    dispatch(fetchForumTopics({}));
  }, []);

  const renderChatRoom = ({item}: {item: ChatRoom}) => (
    <TouchableOpacity
      style={styles.roomItem}
      onPress={() => navigation.navigate('ChatRoom', {roomId: item.id, roomName: item.name})}>
      <View style={[styles.roomIcon, {backgroundColor: getRoomColor(item.type)}]}>
        <Icon name={getRoomIcon(item.type)} size={24} color="#FFFFFF" />
      </View>
      <View style={styles.roomInfo}>
        <View style={styles.roomHeader}>
          <Text style={styles.roomName}>{item.name}</Text>
          {item.unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{item.unreadCount}</Text>
            </View>
          )}
        </View>
        <Text style={styles.roomDescription} numberOfLines={1}>
          {item.lastMessage ? item.lastMessage.content : item.description}
        </Text>
        <View style={styles.roomMeta}>
          <Icon name="account-group" size={14} color="#9CA3AF" />
          <Text style={styles.roomParticipants}>{item.participants.toLocaleString()}</Text>
          {item.lastMessage && (
            <>
              <Text style={styles.dot}>•</Text>
              <Text style={styles.roomTime}>
                {formatTime(item.lastMessage.timestamp)}
              </Text>
            </>
          )}
        </View>
      </View>
      {item.isMuted && (
        <Icon name="volume-off" size={18} color="#9CA3AF" style={styles.muteIcon} />
      )}
    </TouchableOpacity>
  );

  const renderTopic = ({item}: {item: ForumTopic}) => (
    <TouchableOpacity
      style={styles.topicItem}
      onPress={() => navigation.navigate('ForumTopic', {topicId: item.id})}>
      {item.isPinned && (
        <View style={styles.pinnedBadge}>
          <Icon name="pin" size={12} color="#FFFFFF" />
          <Text style={styles.pinnedText}>Pinned</Text>
        </View>
      )}
      <View style={styles.topicHeader}>
        <Text style={styles.topicTitle}>{item.title}</Text>
        {item.isLocked && <Icon name="lock" size={16} color="#9CA3AF" />}
      </View>
      <View style={styles.topicMeta}>
        <Text style={styles.topicAuthor}>{item.author}</Text>
        <Text style={styles.dot}>•</Text>
        <Text style={styles.topicCategory}>{item.category}</Text>
      </View>
      <View style={styles.topicStats}>
        <View style={styles.topicStat}>
          <Icon name="comment-outline" size={14} color="#9CA3AF" />
          <Text style={styles.topicStatText}>{item.replies}</Text>
        </View>
        <View style={styles.topicStat}>
          <Icon name="eye-outline" size={14} color="#9CA3AF" />
          <Text style={styles.topicStatText}>{item.views}</Text>
        </View>
        <Text style={styles.topicTime}>{formatTime(item.lastActivity)}</Text>
      </View>
      <View style={styles.topicTags}>
        {item.tags.slice(0, 3).map((tag, index) => (
          <View key={index} style={styles.tag}>
            <Text style={styles.tagText}>{tag}</Text>
          </View>
        ))}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Tab Switcher */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'chat' && styles.tabActive]}
          onPress={() => setActiveTab('chat')}>
          <Icon name="chat" size={20} color={activeTab === 'chat' ? '#6366F1' : '#6B7280'} />
          <Text style={[styles.tabText, activeTab === 'chat' && styles.tabTextActive]}>
            Chat Rooms
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'forum' && styles.tabActive]}
          onPress={() => setActiveTab('forum')}>
          <Icon name="forum" size={20} color={activeTab === 'forum' ? '#6366F1' : '#6B7280'} />
          <Text style={[styles.tabText, activeTab === 'forum' && styles.tabTextActive]}>
            Forum
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {activeTab === 'chat' ? (
        <FlatList
          data={rooms}
          renderItem={renderChatRoom}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <TouchableOpacity style={styles.searchBar}>
              <Icon name="magnify" size={20} color="#9CA3AF" />
              <Text style={styles.searchText}>Search chat rooms...</Text>
            </TouchableOpacity>
          }
        />
      ) : (
        <FlatList
          data={topics}
          renderItem={renderTopic}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <TouchableOpacity style={styles.searchBar}>
              <Icon name="magnify" size={20} color="#9CA3AF" />
              <Text style={styles.searchText}>Search topics...</Text>
            </TouchableOpacity>
          }
        />
      )}
    </View>
  );
};

const getRoomColor = (type: string) => {
  switch (type) {
    case 'operator':
      return '#6366F1';
    case 'support':
      return '#10B981';
    case 'announcement':
      return '#F59E0B';
    default:
      return '#8B5CF6';
  }
};

const getRoomIcon = (type: string) => {
  switch (type) {
    case 'operator':
      return 'server';
    case 'support':
      return 'help-circle';
    case 'announcement':
      return 'bullhorn';
    default:
      return 'chat';
  }
};

const formatTime = (timestamp: string) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  tabContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  tabActive: {
    backgroundColor: '#EEF2FF',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  tabTextActive: {
    color: '#6366F1',
  },
  list: {
    padding: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    gap: 12,
  },
  searchText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  roomItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  roomIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roomInfo: {
    flex: 1,
    marginLeft: 12,
  },
  roomHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  roomName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  unreadBadge: {
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  roomDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  roomMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  roomParticipants: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  dot: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  roomTime: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  muteIcon: {
    marginLeft: 8,
  },
  topicItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  pinnedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: '#6366F1',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  pinnedText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  topicHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  topicTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  topicMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  topicAuthor: {
    fontSize: 14,
    color: '#6366F1',
    fontWeight: '500',
  },
  topicCategory: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  topicStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 12,
  },
  topicStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  topicStatText: {
    fontSize: 12,
    color: '#6B7280',
  },
  topicTime: {
    fontSize: 12,
    color: '#9CA3AF',
    marginLeft: 'auto',
  },
  topicTags: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  tag: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tagText: {
    fontSize: 12,
    color: '#6B7280',
  },
});

export default SocialScreen;
