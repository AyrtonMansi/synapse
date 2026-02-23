/**
 * Secrets Management for Synapse Network
 * Handles loading secrets from various secret managers
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class SecretsManager {
  constructor(provider = process.env.SECRETS_PROVIDER) {
    this.provider = provider || 'env';
    this.cache = new Map();
    this.cacheExpiry = new Map();
  }

  /**
   * Get a secret value
   */
  async getSecret(key, defaultValue = null) {
    // Check cache first
    if (this.cache.has(key)) {
      const expiry = this.cacheExpiry.get(key);
      if (expiry && expiry > Date.now()) {
        return this.cache.get(key);
      }
      // Cache expired
      this.cache.delete(key);
      this.cacheExpiry.delete(key);
    }

    let value;

    switch (this.provider) {
      case 'aws':
        value = await this.getFromAWS(key);
        break;
      case 'vault':
        value = await this.getFromVault(key);
        break;
      case 'k8s':
        value = await this.getFromK8s(key);
        break;
      case 'azure':
        value = await this.getFromAzure(key);
        break;
      case 'file':
        value = await this.getFromFile(key);
        break;
      case 'env':
      default:
        value = process.env[key];
        break;
    }

    // Cache for 5 minutes
    if (value) {
      this.cache.set(key, value);
      this.cacheExpiry.set(key, Date.now() + 5 * 60 * 1000);
    }

    return value || defaultValue;
  }

  /**
   * Get secret from AWS Secrets Manager
   */
  async getFromAWS(key) {
    try {
      const AWS = require('aws-sdk');
      const secretsManager = new AWS.SecretsManager({
        region: process.env.AWS_REGION || 'us-east-1'
      });

      const secretName = process.env.AWS_SECRET_NAME || 'synapse/production';
      const data = await secretsManager.getSecretValue({ SecretId: secretName }).promise();
      
      if (data.SecretString) {
        const secrets = JSON.parse(data.SecretString);
        return secrets[key];
      }
    } catch (error) {
      console.warn(`Failed to load secret from AWS: ${error.message}`);
    }
    return null;
  }

  /**
   * Get secret from HashiCorp Vault
   */
  async getFromVault(key) {
    try {
      const vaultAddr = process.env.VAULT_ADDR;
      const vaultToken = process.env.VAULT_TOKEN;
      
      if (!vaultAddr || !vaultToken) {
        return null;
      }

      const axios = require('axios');
      const path = process.env.VAULT_PATH || 'secret/data/synapse/production';
      
      const response = await axios.get(`${vaultAddr}/v1/${path}`, {
        headers: { 'X-Vault-Token': vaultToken }
      });

      return response.data.data.data[key];
    } catch (error) {
      console.warn(`Failed to load secret from Vault: ${error.message}`);
    }
    return null;
  }

  /**
   * Get secret from Kubernetes secrets
   */
  async getFromK8s(key) {
    try {
      const namespace = process.env.KUBERNETES_NAMESPACE || 'default';
      const secretName = process.env.KUBERNETES_SECRET_NAME || 'synapse-secrets';
      
      const result = execSync(
        `kubectl get secret ${secretName} -n ${namespace} -o json`,
        { encoding: 'utf-8' }
      );

      const secret = JSON.parse(result);
      if (secret.data && secret.data[key]) {
        return Buffer.from(secret.data[key], 'base64').toString('utf-8');
      }
    } catch (error) {
      console.warn(`Failed to load secret from K8s: ${error.message}`);
    }
    return null;
  }

  /**
   * Get secret from Azure Key Vault
   */
  async getFromAzure(key) {
    try {
      const { DefaultAzureCredential } = require('@azure/identity');
      const { SecretClient } = require('@azure/keyvault-secrets');
      
      const vaultName = process.env.AZURE_KEYVAULT_NAME;
      if (!vaultName) return null;
      
      const url = `https://${vaultName}.vault.azure.net`;
      const credential = new DefaultAzureCredential();
      const client = new SecretClient(url, credential);
      
      const secret = await client.getSecret(key);
      return secret.value;
    } catch (error) {
      console.warn(`Failed to load secret from Azure: ${error.message}`);
    }
    return null;
  }

  /**
   * Get secret from local encrypted file
   */
  async getFromFile(key) {
    try {
      const secretsFile = process.env.SECRETS_FILE || '/etc/synapse/secrets.enc';
      
      if (!fs.existsSync(secretsFile)) {
        return null;
      }

      // Decrypt file if needed
      const encryptionKey = process.env.SECRETS_ENCRYPTION_KEY;
      let content;

      if (encryptionKey) {
        const crypto = require('crypto');
        const encrypted = fs.readFileSync(secretsFile);
        const decipher = crypto.createDecipher('aes-256-cbc', encryptionKey);
        content = decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8');
      } else {
        content = fs.readFileSync(secretsFile, 'utf-8');
      }

      const secrets = JSON.parse(content);
      return secrets[key];
    } catch (error) {
      console.warn(`Failed to load secret from file: ${error.message}`);
    }
    return null;
  }

  /**
   * Validate that required secrets are present
   */
  async validateRequiredSecrets() {
    const required = [
      'JWT_SECRET',
      // Add other required secrets here
    ];

    const missing = [];

    for (const key of required) {
      const value = await this.getSecret(key);
      if (!value) {
        missing.push(key);
      }
    }

    if (missing.length > 0) {
      throw new Error(`Missing required secrets: ${missing.join(', ')}`);
    }

    return true;
  }

  /**
   * Clear the cache
   */
  clearCache() {
    this.cache.clear();
    this.cacheExpiry.clear();
  }
}

// Singleton instance
let instance = null;

function getSecretsManager() {
  if (!instance) {
    instance = new SecretsManager();
  }
  return instance;
}

module.exports = {
  SecretsManager,
  getSecretsManager
};
