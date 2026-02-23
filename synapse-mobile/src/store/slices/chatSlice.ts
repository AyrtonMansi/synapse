/**
 * Chat Slice
 * Manages chat messages and social interactions
 */

import {createSlice, createAsyncThunk, PayloadAction} from '@reduxjs/toolkit';
import {ChatMessage, ChatRoom, ForumTopic, ForumReply} from '@types/index';
import {chatService} from '@services/chatService';

interface ChatState {
  rooms: ChatRoom[];
  messages: Record<string, ChatMessage[]>;
  topics: ForumTopic[];
  replies: Record<string, ForumReply[]>;
  activeRoom: string | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: ChatState = {
  rooms: [],
  messages: {},
  topics: [],
  replies: {},
  activeRoom: null,
  isLoading: false,
  error: null,
};

// Async thunks
export const fetchChatRooms = createAsyncThunk(
  'chat/fetchRooms',
  async (_, {rejectWithValue}) => {
    try {
      const rooms = await chatService.getRooms();
      return rooms;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  },
);

export const fetchMessages = createAsyncThunk(
  'chat/fetchMessages',
  async (
    {roomId, before}: {roomId: string; before?: string},
    {rejectWithValue},
  ) => {
    try {
      const messages = await chatService.getMessages(roomId, before);
      return {roomId, messages};
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  },
);

export const sendMessage = createAsyncThunk(
  'chat/sendMessage',
  async (
    {
      roomId,
      content,
      type,
    }: {roomId: string; content: string; type?: string},
    {rejectWithValue},
  ) => {
    try {
      const message = await chatService.sendMessage(roomId, content, type);
      return {roomId, message};
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  },
);

export const fetchForumTopics = createAsyncThunk(
  'chat/fetchTopics',
  async (
    {category, page}: {category?: string; page?: number},
    {rejectWithValue},
  ) => {
    try {
      const topics = await chatService.getForumTopics(category, page);
      return topics;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  },
);

export const fetchForumReplies = createAsyncThunk(
  'chat/fetchReplies',
  async (
    {topicId, page}: {topicId: string; page?: number},
    {rejectWithValue},
  ) => {
    try {
      const replies = await chatService.getForumReplies(topicId, page);
      return {topicId, replies};
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  },
);

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    setActiveRoom: (state, action: PayloadAction<string | null>) => {
      state.activeRoom = action.payload;
    },
    receiveMessage: (
      state,
      action: PayloadAction<{roomId: string; message: ChatMessage}>,
    ) => {
      const {roomId, message} = action.payload;
      if (!state.messages[roomId]) {
        state.messages[roomId] = [];
      }
      state.messages[roomId].push(message);

      // Update room's last message
      const room = state.rooms.find(r => r.id === roomId);
      if (room) {
        room.lastMessage = message;
        if (state.activeRoom !== roomId) {
          room.unreadCount += 1;
        }
      }
    },
    markRoomAsRead: (state, action: PayloadAction<string>) => {
      const room = state.rooms.find(r => r.id === action.payload);
      if (room) {
        room.unreadCount = 0;
      }
    },
    muteRoom: (
      state,
      action: PayloadAction<{roomId: string; muted: boolean}>,
    ) => {
      const room = state.rooms.find(r => r.id === action.payload.roomId);
      if (room) {
        room.isMuted = action.payload.muted;
      }
    },
    clearMessages: (state, action: PayloadAction<string>) => {
      delete state.messages[action.payload];
    },
  },
  extraReducers: builder => {
    builder
      .addCase(fetchChatRooms.pending, state => {
        state.isLoading = true;
      })
      .addCase(fetchChatRooms.fulfilled, (state, action) => {
        state.rooms = action.payload;
        state.isLoading = false;
      })
      .addCase(fetchMessages.fulfilled, (state, action) => {
        const {roomId, messages} = action.payload;
        state.messages[roomId] = messages;
      })
      .addCase(sendMessage.fulfilled, (state, action) => {
        const {roomId, message} = action.payload;
        if (!state.messages[roomId]) {
          state.messages[roomId] = [];
        }
        state.messages[roomId].push(message);
      })
      .addCase(fetchForumTopics.fulfilled, (state, action) => {
        state.topics = action.payload;
      })
      .addCase(fetchForumReplies.fulfilled, (state, action) => {
        const {topicId, replies} = action.payload;
        state.replies[topicId] = replies;
      });
  },
});

export const {
  setActiveRoom,
  receiveMessage,
  markRoomAsRead,
  muteRoom,
  clearMessages,
} = chatSlice.actions;

export default chatSlice.reducer;
