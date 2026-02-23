/**
 * Forum Topic Screen
 * View and reply to forum topics
 */

import React, {useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import {useDispatch, useSelector} from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import {RootState} from '@store/index';
import {fetchForumReplies} from '@store/slices/chatSlice';
import {ForumReply} from '@types/index';

const ForumTopicScreen: React.FC<{route: any; navigation: any}> = ({
  route,
  navigation,
}) => {
  const {topicId} = route.params;
  const dispatch = useDispatch();
  const {topics, replies} = useSelector((state: RootState) => state.chat);

  const topic = topics.find(t => t.id === topicId);
  const topicReplies = replies[topicId] || [];

  useEffect(() => {
    dispatch(fetchForumReplies({topicId}));
  }, [topicId]);

  if (!topic) {
    return (
      <View style={styles.container}>
        <Text>Topic not found</Text>
      </View>
    );
  }

  const renderReply = ({item, index}: {item: ForumReply; index: number}) => (
    <View style={styles.replyItem}>
      <View style={styles.replyHeader}>
        <View style={styles.authorAvatar}>
          <Text style={styles.avatarText}>{item.author[0]}</Text>
        </View>
        <View style={styles.replyMeta}>
          <Text style={styles.authorName}>{item.author}</Text>
          <Text style={styles.replyTime}>
            {new Date(item.timestamp).toLocaleDateString()}
          </Text>
        </View>
        {item.isAccepted && (
          <View style={styles.acceptedBadge}>
            <Icon name="check-circle" size={14} color="#10B981" />
            <Text style={styles.acceptedText}>Accepted</Text>
          </View>
        )}
      </View>
      <Text style={styles.replyContent}>{item.content}</Text>
      <View style={styles.replyActions}>
        <TouchableOpacity style={styles.replyAction}>
          <Icon name="thumb-up-outline" size={18} color="#6B7280" />
          <Text style={styles.replyActionText}>{item.likes}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.replyAction}>
          <Icon name="reply-outline" size={18} color="#6B7280" />
          <Text style={styles.replyActionText}>Reply</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={topicReplies}
        renderItem={renderReply}
        keyExtractor={(item, index) => item.id || index.toString()}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.topicContainer}>
            {/* Topic Header */}
            {topic.isPinned && (
              <View style={styles.pinnedBanner}>
                <Icon name="pin" size={16} color="#6366F1" />
                <Text style={styles.pinnedText}>Pinned Topic</Text>
              </View>
            )}

            {/* Topic Title */}
            <Text style={styles.topicTitle}>{topic.title}</Text>

            {/* Author Info */}
            <View style={styles.authorRow}>
              <View style={styles.authorAvatar}>
                <Text style={styles.avatarText}>{topic.author[0]}</Text>
              </View>
              <View style={styles.authorInfo}>
                <Text style={styles.authorName}>{topic.author}</Text>
                <View style={styles.topicMeta}>
                  <Text style={styles.categoryBadge}>{topic.category}</Text>
                  <Text style={styles.dot}>•</Text>
                  <Text style={styles.metaText}>
                    {new Date(topic.lastActivity).toLocaleDateString()}
                  </Text>
                </View>
              </View>
            </View>

            {/* Topic Content */}
            <Text style={styles.topicContent}>{topic.content}</Text>

            {/* Tags */}
            <View style={styles.tagsContainer}>
              {topic.tags.map((tag, index) => (
                <View key={index} style={styles.tag}>
                  <Text style={styles.tagText}>#{tag}</Text>
                </View>
              ))}
            </View>

            {/* Topic Stats */}
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Icon name="comment-outline" size={18} color="#6B7280" />
                <Text style={styles.statText}>{topic.replies} replies</Text>
              </View>
              <View style={styles.stat}>
                <Icon name="eye-outline" size={18} color="#6B7280" />
                <Text style={styles.statText}>{topic.views} views</Text>
              </View>
              <TouchableOpacity style={styles.shareButton}>
                <Icon name="share-variant" size={18} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* Replies Header */}
            <Text style={styles.repliesHeader}>
              {topic.replies} Replies
            </Text>
          </View>
        }
        ListEmptyComponent={
          <Text style={styles.noReplies}>No replies yet. Be the first!</Text>
        }
      />

      {/* Reply Button */}
      <TouchableOpacity style={styles.replyButton}>
        <Icon name="reply" size={20} color="#FFFFFF" />
        <Text style={styles.replyButtonText}>Reply to Topic</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  list: {
    paddingBottom: 80,
  },
  topicContainer: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginBottom: 12,
  },
  pinnedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  pinnedText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6366F1',
  },
  topicTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  authorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  authorInfo: {
    marginLeft: 12,
  },
  authorName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  topicMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  categoryBadge: {
    backgroundColor: '#EEF2FF',
    color: '#6366F1',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    fontSize: 12,
    fontWeight: '500',
  },
  dot: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  metaText: {
    fontSize: 13,
    color: '#6B7280',
  },
  topicContent: {
    fontSize: 16,
    color: '#374151',
    lineHeight: 24,
    marginBottom: 16,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  tag: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tagText: {
    fontSize: 13,
    color: '#6B7280',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginRight: 20,
  },
  statText: {
    fontSize: 14,
    color: '#6B7280',
  },
  shareButton: {
    marginLeft: 'auto',
  },
  repliesHeader: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    padding: 16,
    backgroundColor: '#F9FAFB',
  },
  replyItem: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  replyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  replyMeta: {
    marginLeft: 12,
    flex: 1,
  },
  replyTime: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  acceptedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  acceptedText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '500',
  },
  replyContent: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 22,
    marginLeft: 52,
  },
  replyActions: {
    flexDirection: 'row',
    gap: 16,
    marginLeft: 52,
    marginTop: 12,
  },
  replyAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  replyActionText: {
    fontSize: 13,
    color: '#6B7280',
  },
  noReplies: {
    textAlign: 'center',
    color: '#9CA3AF',
    padding: 24,
  },
  replyButton: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#6366F1',
    paddingVertical: 14,
    borderRadius: 12,
  },
  replyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default ForumTopicScreen;
