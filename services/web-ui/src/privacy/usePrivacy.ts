import { useState, useEffect, useCallback } from 'react';
import {
  PrivacyTier,
  PrivacyConfig,
  EncryptedSession,
  generateWorkspaceKey,
  exportWorkspaceKey,
  importWorkspaceKey,
  encryptMessage,
  decryptMessage,
  privacyDescriptions,
} from './crypto';

const STORAGE_KEY = 'synapse_privacy_config';
const SESSION_KEY = 'synapse_encrypted_sessions';

export interface Session {
  id: string;
  messages: EncryptedMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface EncryptedMessage {
  id: string;
  role: 'user' | 'assistant';
  encrypted: EncryptedSession;
  hash: string;
  timestamp: number;
}

export function usePrivacy() {
  const [config, setConfig] = useState<PrivacyConfig>({ tier: 'standard' });
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load config from localStorage
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.workspaceKey) {
            // Import the key
            const key = await importWorkspaceKey(parsed.workspaceKey);
            setConfig({
              tier: parsed.tier,
              keyId: parsed.keyId,
              workspaceKey: key,
            });
          } else {
            setConfig({ tier: parsed.tier });
          }
        }
        
        // Load sessions
        const storedSessions = localStorage.getItem(SESSION_KEY);
        if (storedSessions) {
          setSessions(JSON.parse(storedSessions));
        }
      } catch (err) {
        console.error('Failed to load privacy config:', err);
      }
      setIsInitialized(true);
    };
    
    loadConfig();
  }, []);

  // Save config to localStorage
  const saveConfig = useCallback(async (newConfig: PrivacyConfig) => {
    try {
      const toStore: any = { tier: newConfig.tier };
      
      if (newConfig.workspaceKey) {
        toStore.workspaceKey = await exportWorkspaceKey(newConfig.workspaceKey);
        toStore.keyId = newConfig.keyId;
      }
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
      setConfig(newConfig);
    } catch (err) {
      console.error('Failed to save privacy config:', err);
    }
  }, []);

  // Initialize encrypted mode (Tier 2)
  const initializeEncryption = useCallback(async () => {
    const { key, keyId } = await generateWorkspaceKey();
    const newConfig: PrivacyConfig = {
      tier: 'encrypted',
      workspaceKey: key,
      keyId,
    };
    await saveConfig(newConfig);
    return keyId;
  }, [saveConfig]);

  // Change privacy tier
  const setTier = useCallback(async (tier: PrivacyTier) => {
    if (tier === 'encrypted' && !config.workspaceKey) {
      await initializeEncryption();
    } else {
      await saveConfig({ ...config, tier });
    }
  }, [config, initializeEncryption, saveConfig]);

  // Export workspace key for backup
  const exportKey = useCallback(async () => {
    if (!config.workspaceKey) return null;
    return await exportWorkspaceKey(config.workspaceKey);
  }, [config.workspaceKey]);

  // Import workspace key from backup
  const importKey = useCallback(async (keyData: string) => {
    const key = await importWorkspaceKey(keyData);
    const exported = await crypto.subtle.exportKey('raw', key);
    const keyHash = await crypto.subtle.digest('SHA-256', exported);
    const keyId = Array.from(new Uint8Array(keyHash))
      .slice(0, 8)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    await saveConfig({
      tier: 'encrypted',
      workspaceKey: key,
      keyId,
    });
    
    return keyId;
  }, [saveConfig]);

  // Encrypt and store a message
  const storeMessage = useCallback(async (
    sessionId: string,
    messageId: string,
    role: 'user' | 'assistant',
    content: string
  ): Promise<string | null> => {
    if (config.tier === 'standard') return null;
    if (!config.workspaceKey) return null;

    try {
      const encrypted = await encryptMessage(content, config.workspaceKey);
      const hash = await hashContent(content);
      
      const encryptedMsg: EncryptedMessage = {
        id: messageId,
        role,
        encrypted,
        hash,
        timestamp: Date.now(),
      };

      setSessions(prev => {
        const sessionIndex = prev.findIndex(s => s.id === sessionId);
        let newSessions: Session[];
        
        if (sessionIndex >= 0) {
          // Update existing session
          newSessions = [...prev];
          newSessions[sessionIndex] = {
            ...newSessions[sessionIndex],
            messages: [...newSessions[sessionIndex].messages, encryptedMsg],
            updatedAt: Date.now(),
          };
        } else {
          // Create new session
          newSessions = [...prev, {
            id: sessionId,
            messages: [encryptedMsg],
            createdAt: Date.now(),
            updatedAt: Date.now(),
          }];
        }
        
        localStorage.setItem(SESSION_KEY, JSON.stringify(newSessions));
        return newSessions;
      });

      return hash;
    } catch (err) {
      console.error('Failed to encrypt message:', err);
      return null;
    }
  }, [config.tier, config.workspaceKey]);

  // Decrypt messages for display
  const decryptSession = useCallback(async (sessionId: string): Promise<Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
  }> | null> => {
    if (!config.workspaceKey) return null;

    const session = sessions.find(s => s.id === sessionId);
    if (!session) return null;

    try {
      const decrypted = await Promise.all(
        session.messages.map(async (msg) => ({
          id: msg.id,
          role: msg.role,
          content: await decryptMessage(msg.encrypted, config.workspaceKey!),
          timestamp: msg.timestamp,
        }))
      );
      return decrypted;
    } catch (err) {
      console.error('Failed to decrypt session:', err);
      return null;
    }
  }, [config.workspaceKey, sessions]);

  // Export session as encrypted blob
  const exportSession = useCallback((sessionId: string): string | null => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return null;
    
    const exportData = {
      version: 1,
      keyId: config.keyId,
      session,
      exportedAt: Date.now(),
    };
    
    return btoa(JSON.stringify(exportData));
  }, [config.keyId, sessions]);

  // Import session from blob
  const importSession = useCallback((blob: string): boolean => {
    try {
      const data = JSON.parse(atob(blob));
      if (data.version !== 1) return false;
      if (data.keyId !== config.keyId) {
        alert('This session was encrypted with a different workspace key');
        return false;
      }
      
      setSessions(prev => {
        const newSessions = [...prev, data.session];
        localStorage.setItem(SESSION_KEY, JSON.stringify(newSessions));
        return newSessions;
      });
      return true;
    } catch (err) {
      console.error('Failed to import session:', err);
      return false;
    }
  }, [config.keyId]);

  // Forget/delete session
  const forgetSession = useCallback((sessionId: string) => {
    setSessions(prev => {
      const newSessions = prev.filter(s => s.id !== sessionId);
      localStorage.setItem(SESSION_KEY, JSON.stringify(newSessions));
      return newSessions;
    });
  }, []);

  // Forget ALL sessions and keys
  const forgetAll = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SESSION_KEY);
    setConfig({ tier: 'standard' });
    setSessions([]);
  }, []);

  return {
    config,
    sessions,
    isInitialized,
    descriptions: privacyDescriptions,
    setTier,
    initializeEncryption,
    exportKey,
    importKey,
    storeMessage,
    decryptSession,
    exportSession,
    importSession,
    forgetSession,
    forgetAll,
  };
}

async function hashContent(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
