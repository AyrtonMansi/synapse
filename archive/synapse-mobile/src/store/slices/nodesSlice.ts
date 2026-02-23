/**
 * Nodes Slice
 * Manages node state and operations
 */

import {createSlice, createAsyncThunk, PayloadAction} from '@reduxjs/toolkit';
import {Node, NodeStatus, NodeLogs, LogEntry} from '@types/index';
import {nodeService} from '@services/nodeService';

interface NodesState {
  nodes: Node[];
  selectedNode: Node | null;
  logs: Record<string, LogEntry[]>;
  isLoading: boolean;
  error: string | null;
  operationInProgress: Record<string, boolean>;
}

const initialState: NodesState = {
  nodes: [],
  selectedNode: null,
  logs: {},
  isLoading: false,
  error: null,
  operationInProgress: {},
};

// Async thunks
export const fetchNodes = createAsyncThunk(
  'nodes/fetchNodes',
  async (_, {rejectWithValue}) => {
    try {
      const nodes = await nodeService.getNodes();
      return nodes;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  },
);

export const startNode = createAsyncThunk(
  'nodes/startNode',
  async (nodeId: string, {rejectWithValue}) => {
    try {
      await nodeService.startNode(nodeId);
      return nodeId;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  },
);

export const stopNode = createAsyncThunk(
  'nodes/stopNode',
  async (nodeId: string, {rejectWithValue}) => {
    try {
      await nodeService.stopNode(nodeId);
      return nodeId;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  },
);

export const emergencyStopNode = createAsyncThunk(
  'nodes/emergencyStopNode',
  async (nodeId: string, {rejectWithValue}) => {
    try {
      await nodeService.emergencyStopNode(nodeId);
      return nodeId;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  },
);

export const restartNode = createAsyncThunk(
  'nodes/restartNode',
  async (nodeId: string, {rejectWithValue}) => {
    try {
      await nodeService.restartNode(nodeId);
      return nodeId;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  },
);

export const updateNodeSettings = createAsyncThunk(
  'nodes/updateSettings',
  async (
    {nodeId, settings}: {nodeId: string; settings: any},
    {rejectWithValue},
  ) => {
    try {
      await nodeService.updateSettings(nodeId, settings);
      return {nodeId, settings};
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  },
);

export const fetchNodeLogs = createAsyncThunk(
  'nodes/fetchLogs',
  async (
    {nodeId, limit}: {nodeId: string; limit?: number},
    {rejectWithValue},
  ) => {
    try {
      const logs = await nodeService.getLogs(nodeId, limit);
      return {nodeId, logs};
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  },
);

const nodesSlice = createSlice({
  name: 'nodes',
  initialState,
  reducers: {
    setNodes: (state, action: PayloadAction<Node[]>) => {
      state.nodes = action.payload;
    },
    setSelectedNode: (state, action: PayloadAction<Node | null>) => {
      state.selectedNode = action.payload;
    },
    updateNodeStatus: (
      state,
      action: PayloadAction<{nodeId: string; status: NodeStatus}>,
    ) => {
      const node = state.nodes.find(n => n.id === action.payload.nodeId);
      if (node) {
        node.status = action.payload.status;
        node.updatedAt = new Date().toISOString();
      }
    },
    updateNodeMetrics: (
      state,
      action: PayloadAction<{nodeId: string; metrics: Partial<Node>}>,
    ) => {
      const node = state.nodes.find(n => n.id === action.payload.nodeId);
      if (node) {
        Object.assign(node, action.payload.metrics);
        node.updatedAt = new Date().toISOString();
      }
    },
    addLogEntry: (
      state,
      action: PayloadAction<{nodeId: string; entry: LogEntry}>,
    ) => {
      const {nodeId, entry} = action.payload;
      if (!state.logs[nodeId]) {
        state.logs[nodeId] = [];
      }
      state.logs[nodeId].unshift(entry);
      // Keep only last 1000 logs per node
      if (state.logs[nodeId].length > 1000) {
        state.logs[nodeId] = state.logs[nodeId].slice(0, 1000);
      }
    },
    clearError: state => {
      state.error = null;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(fetchNodes.pending, state => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchNodes.fulfilled, (state, action) => {
        state.nodes = action.payload;
        state.isLoading = false;
      })
      .addCase(fetchNodes.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(startNode.pending, (state, action) => {
        state.operationInProgress[action.meta.arg] = true;
      })
      .addCase(startNode.fulfilled, (state, action) => {
        state.operationInProgress[action.payload] = false;
        const node = state.nodes.find(n => n.id === action.payload);
        if (node) {
          node.status = 'syncing';
        }
      })
      .addCase(startNode.rejected, (state, action) => {
        state.operationInProgress[action.meta.arg] = false;
        state.error = action.payload as string;
      })
      .addCase(stopNode.pending, (state, action) => {
        state.operationInProgress[action.meta.arg] = true;
      })
      .addCase(stopNode.fulfilled, (state, action) => {
        state.operationInProgress[action.payload] = false;
        const node = state.nodes.find(n => n.id === action.payload);
        if (node) {
          node.status = 'offline';
        }
      })
      .addCase(stopNode.rejected, (state, action) => {
        state.operationInProgress[action.meta.arg] = false;
        state.error = action.payload as string;
      })
      .addCase(emergencyStopNode.fulfilled, (state, action) => {
        const node = state.nodes.find(n => n.id === action.payload);
        if (node) {
          node.status = 'offline';
        }
      })
      .addCase(fetchNodeLogs.fulfilled, (state, action) => {
        const {nodeId, logs} = action.payload;
        state.logs[nodeId] = logs;
      });
  },
});

export const {
  setNodes,
  setSelectedNode,
  updateNodeStatus,
  updateNodeMetrics,
  addLogEntry,
  clearError,
} = nodesSlice.actions;

export default nodesSlice.reducer;
