/**
 * Chat Service
 * Handles chat and forum operations
 */

import {ChatMessage, ChatRoom, ForumTopic, ForumReply} from '@types/index';
import {logService} from './logService';

class ChatService {
  async getRooms(): Promise<ChatRoom[]> {
    try {
      // Simulated data
      const rooms: ChatRoom[] = [
        {
          id: 'room-operators',
          name: 'Node Operators',
          description: 'Discussion among node operators',
          type: 'operator',
          participants: 1247,
          unreadCount: 3,
          isMuted: false,
          lastMessage: {
            id: 'msg-001',
            senderId: 'user-123',
            senderName: 'Alice Validator',
            content: 'Anyone else experiencing high memory usage after the update?',
            type: 'text',
            timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
            isRead: false,
          },
        },
        {
          id: 'room-general',
          name: 'General Discussion',
          description: 'General community chat',
          type: 'community',
          participants: 5420,
          unreadCount: 0,
          isMuted: false,
          lastMessage: {
            id: 'msg-002',
            senderId: 'user-456',
            senderName: 'Bob Node',
            content: 'Great to see the network growing!',
            type: 'text',
            timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
            isRead: true,
          },
        },
        {
          id: 'room-support',
          name: 'Help & Support',
          description: 'Get help with node setup and issues',
          type: 'support',
          participants: 892,
          unreadCount: 0,
          isMuted: false,
        },
        {
          id: 'room-announcements',
          name: 'Announcements',
          description: 'Official announcements from the team',
          type: 'announcement',
          participants: 15420,
          unreadCount: 1,
          isMuted: false,
          lastMessage: {
            id: 'msg-003',
            senderId: 'system',
            senderName: 'Synapse Team',
            content: '🚀 Version 1.2.3 is now live with performance improvements!',
            type: 'system',
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
            isRead: false,
          },
        },
      ];

      return rooms;
    } catch (error) {
      logService.error('Failed to fetch chat rooms', error);
      throw error;
    }
  }

  async getMessages(roomId: string, before?: string): Promise<ChatMessage[]> {
    try {
      // Simulated messages
      const messages: ChatMessage[] = [];
      const senders = [
        {name: 'Alice Validator', avatar: null},
        {name: 'Bob Node', avatar: null},
        {name: 'Charlie', avatar: null},
        {name: 'Synapse Team', avatar: null},
      ];

      for (let i = 0; i < 20; i++) {
        const sender = senders[Math.floor(Math.random() * senders.length)];
        messages.push({
          id: `msg-${roomId}-${i}`,
          senderId: `user-${i}`,
          senderName: sender.name,
          senderAvatar: sender.avatar,
          content: this.getRandomMessage(),
          type: 'text',
          timestamp: new Date(Date.now() - i * 1000 * 60).toISOString(),
          isRead: i > 3,
        });
      }

      return messages;
    } catch (error) {
      logService.error(`Failed to fetch messages for room ${roomId}`, error);
      throw error;
    }
  }

  async sendMessage(
    roomId: string,
    content: string,
    type: string = 'text',
  ): Promise<ChatMessage> {
    try {
      const message: ChatMessage = {
        id: `msg-${Date.now()}`,
        senderId: 'current-user',
        senderName: 'You',
        content,
        type: type as any,
        timestamp: new Date().toISOString(),
        isRead: true,
      };

      logService.info('Message sent', {roomId, messageId: message.id});
      return message;
    } catch (error) {
      logService.error('Failed to send message', error);
      throw error;
    }
  }

  async getForumTopics(
    category?: string,
    page: number = 1,
  ): Promise<ForumTopic[]> {
    try {
      const topics: ForumTopic[] = [
        {
          id: 'topic-001',
          title: 'Best practices for node optimization',
          author: 'Alice Validator',
          content: 'Here are some tips for optimizing your node performance...',
          category: 'Guides',
          tags: ['optimization', 'performance', 'guide'],
          replies: 24,
          views: 1543,
          lastActivity: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
          isPinned: true,
          isLocked: false,
        },
        {
          id: 'topic-002',
          title: 'Network upgrade schedule - February 2024',
          author: 'Synapse Team',
          content: 'We are planning a network upgrade on February 15th...',
          category: 'Announcements',
          tags: ['upgrade', 'maintenance'],
          replies: 156,
          views: 8932,
          lastActivity: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
          isPinned: true,
          isLocked: true,
        },
        {
          id: 'topic-003',
          title: 'Troubleshooting connection issues',
          author: 'Bob Node',
          content: 'I\'ve been having trouble connecting to peers...',
          category: 'Support',
          tags: ['help', 'networking'],
          replies: 8,
          views: 234,
          lastActivity: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
          isPinned: false,
          isLocked: false,
        },
      ];

      return topics;
    } catch (error) {
      logService.error('Failed to fetch forum topics', error);
      throw error;
    }
  }

  async getForumReplies(topicId: string, page: number = 1): Promise<ForumReply[]> {
    try {
      const replies: ForumReply[] = [];
      for (let i = 0; i < 10; i++) {
        replies.push({
          id: `reply-${topicId}-${i}`,
          topicId,
          author: `User ${i + 1}`,
          content: `This is reply number ${i + 1}...`,
          timestamp: new Date(Date.now() - i * 1000 * 60 * 30).toISOString(),
          likes: Math.floor(Math.random() * 50),
          isAccepted: i === 0,
        });
      }

      return replies;
    } catch (error) {
      logService.error(`Failed to fetch replies for topic ${topicId}`, error);
      throw error;
    }
  }

  async createTopic(
    title: string,
    content: string,
    category: string,
    tags: string[],
  ): Promise<ForumTopic> {
    try {
      const topic: ForumTopic = {
        id: `topic-${Date.now()}`,
        title,
        author: 'You',
        content,
        category,
        tags,
        replies: 0,
        views: 0,
        lastActivity: new Date().toISOString(),
        isPinned: false,
        isLocked: false,
      };

      logService.info('Topic created', {topicId: topic.id});
      return topic;
    } catch (error) {
      logService.error('Failed to create topic', error);
      throw error;
    }
  }

  private getRandomMessage(): string {
    const messages = [
      'Has anyone tried the latest version?',
      'My node is running smoothly!',
      'What are the hardware requirements?',
      'Thanks for the help!',
      'Great community here!',
      'How do I optimize my settings?',
      'Check out the new documentation',
      'Looking forward to the next update',
    ];
    return messages[Math.floor(Math.random() * messages.length)];
  }
}

export const chatService = new ChatService();
