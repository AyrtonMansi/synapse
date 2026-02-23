/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WALLET_CONNECT_PROJECT_ID: string
  readonly VITE_API_URL: string
  readonly VITE_SYNAPSE_TOKEN_ADDRESS: string
  readonly VITE_SYNAPSE_STAKING_ADDRESS: string
  readonly VITE_SYNAPSE_REGISTRY_ADDRESS: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
