/**
 * Chat Room Screen
 * Individual chat room with messaging
 */

import React, {useEffect, useState, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {useDispatch, useSelector} from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import {RootState} from '@store/index';
import {fetchMessages, sendMessage, setActiveRoom} from '@store/slices/chatSlice';
import {ChatMessage} from '@types/index';

const ChatRoomScreen: React.FC<{route: any; navigation: any}> = ({
  route,
  navigation,
}) => {
  const {roomId, roomName} = route.params;
  const dispatch = useDispatch();
  const {messages, rooms} = useSelector((state: RootState) => state.chat);
  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  const roomMessages = messages[roomId] || [];
  const room = rooms.find(r => r.id === roomId);

  useEffect(() => {
    dispatch(setActiveRoom(roomId));
    dispatch(fetchMessages({roomId}));
    return () => {
      dispatch(setActiveRoom(null));
    };
  }, [roomId]);

  const handleSend = () => {
    if (inputText.trim()) {
      dispatch(sendMessage({roomId, content: inputText.trim()}));
      setInputText('');
    }
  };

  const renderMessage = ({item}: {item: ChatMessage}) => {
    const isCurrentUser = item.senderId === 'current-user';
    const isSystem = item.type === 'system';

    if (isSystem) {
      return (
        <View style={styles.systemMessage}>
          <View style={styles.systemBubble}>
            <Icon name="information" size={14} color="#6366F1" />
            <Text style={styles.systemText}>{item.content}</Text>
          </View>
          <Text style={styles.systemTime}>
            {new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
          </Text>
        </View>
      );
    }

    return (
      <View style={[styles.messageContainer, isCurrentUser && styles.myMessage]}>
        {!isCurrentUser && (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{item.senderName[0]}</Text>
          </View>
        )}
        <View style={[styles.messageBubble, isCurrentUser && styles.myBubble]}>
          {!isCurrentUser && (
            <Text style={styles.senderName}>{item.senderName}</Text>
          )}
          <Text style={[styles.messageText, isCurrentUser && styles.myMessageText]}>
            {item.content}
          </Text>
          <Text style={[styles.messageTime, isCurrentUser && styles.myMessageTime]}>
            {new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}>
      {/* Header Info */}
      <View style={styles.headerInfo}>
        <View style={styles.roomInfo}>
          <Text style={styles.roomName}>{roomName}</Text>
          <Text style={styles.roomStatus}>
            {room ? `${room.participants.toLocaleString()} participants` : ''}
          </Text>
        </View>
        <TouchableOpacity style={styles.headerButton}>
          <Icon name="information-outline" size={24} color="#111827" />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={roomMessages}
        renderItem={renderMessage}
        keyExtractor={(item, index) => item.id || index.toString()}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({animated: true})}
      />

      {/* Input */}
      <View style={styles.inputContainer}>
        <TouchableOpacity style={styles.attachButton}>
          <Icon name="plus-circle-outline" size={28} color="#6366F1" />
        </TouchableOpacity>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Type a message..."
            placeholderTextColor="#9CA3AF"
            multiline
            maxLength={1000}
          />
        </View>
        <TouchableOpacity
          style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!inputText.trim()}>
          <Icon name="send" size={24} color={inputText.trim() ? '#FFFFFF' : '#9CA3AF'} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  roomInfo: {
    flex: 1,
  },
  roomName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  roomStatus: {
    fontSize: 14,
    color: '#6B7280',
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesList: {
    padding: 16,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-end',
  },
  myMessage: {
    flexDirection: 'row-reverse',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  messageBubble: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 12,
    maxWidth: '70%',
    borderBottomLeftRadius: 4,
  },
  myBubble: {
    backgroundColor: '#6366F1',
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 4,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6366F1',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 16,
    color: '#111827',
    lineHeight: 22,
  },
  myMessageText: {
    color: '#FFFFFF',
  },
  messageTime: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  myMessageTime: {
    color: 'rgba(255,255,255,0.7)',
  },
  systemMessage: {
    alignItems: 'center',
    marginVertical: 12,
  },
  systemBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  systemText: {
    fontSize: 13,
    color: '#6366F1',
  },
  systemTime: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  attachButton: {
    padding: 4,
  },
  inputWrapper: {
    flex: 1,
    marginHorizontal: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    maxHeight: 100,
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    color: '#111827',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#F3F4F6',
  },
});

export default ChatRoomScreen;
