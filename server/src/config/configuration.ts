import { URL } from 'url';

function parseRedisConfig(): {
  host: string;
  port: number;
  password?: string;
  tls?: Record<string, unknown>;
} {
  const url = process.env.REDIS_URL;

  if (url) {
    // REDIS_URL formats:
    // - redis://:password@host:port
    // - rediss://:password@host:port
    const u = new URL(url);

    return {
      host: u.hostname,
      port: Number(u.port || 6379),
      password: u.password || undefined,
      tls: u.protocol === 'rediss:' ? {} : undefined,
    };
  }

  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '', 10) || 6379,
  };
}

export default () => ({
  dev: process.env.NODE_ENV !== 'production',
  host: process.env.HOST || 'localhost',
  port: process.env.PORT || '3000',
  database: {
    path: process.env.DATABASE_PATH || 'data/mr_market.db',
  },
  redis: parseRedisConfig(),
  apiKeys: {
    binance: [
      {
        key: process.env.BINANCE_API_KEY,
        secret: process.env.BINANCE_SECRET,
      },
    ],
    mexc: [
      {
        key: process.env.MEXC_API_KEY,
        secret: process.env.MEXC_SECRET,
      },
    ],
    bitfinex: [
      {
        key: process.env.BITFINEX_API_KEY,
        secret: process.env.BITFINEX_SECRET,
      },
    ],
  },
  admin: {
    pass: process.env.ADMIN_PASSWORD,
    jwt_secret: process.env.JWT_SECRET,
    encryption_private_key: process.env.ENCRYPTION_PRIVATE_KEY,
  },
  mixin: {
    app_id: process.env.MIXIN_APP_ID,
    session_id: process.env.MIXIN_SESSION_ID,
    server_public_key: process.env.MIXIN_SERVER_PUBLIC_KEY,
    session_private_key: process.env.MIXIN_SESSION_PRIVATE_KEY,
    spend_private_key: process.env.MIXIN_SPEND_PRIVATE_KEY,
    oauth_secret: process.env.MIXIN_OAUTH_SECRET,
  },
  coingecko: {
    api_key: process.env.COINGECKO_API_KEY,
  },
  strategy: {
    run: process.env.RUN_STARTEGY_FOR_MIXIN_ORDERS || 'false',
    mixin_snapshots_run: process.env.RUN_MIXIN_SNAPSHOTS || 'false',
    tick_size_ms: parseInt(process.env.MARKET_MAKING_TICK_SIZE_MS, 10) || 1000,
    execute_intents: process.env.MARKET_MAKING_EXECUTE_INTENTS === 'true',
    intent_execution_driver:
      process.env.MARKET_MAKING_INTENT_EXECUTION_DRIVER || 'worker',
    intent_max_retries:
      parseInt(process.env.MARKET_MAKING_INTENT_MAX_RETRIES, 10) || 2,
    intent_retry_base_delay_ms:
      parseInt(process.env.MARKET_MAKING_INTENT_RETRY_BASE_DELAY_MS, 10) || 250,
    intent_worker_poll_interval_ms:
      parseInt(process.env.MARKET_MAKING_INTENT_WORKER_POLL_INTERVAL_MS, 10) ||
      100,
    intent_worker_max_in_flight:
      parseInt(process.env.MARKET_MAKING_INTENT_WORKER_MAX_IN_FLIGHT, 10) || 8,
    intent_worker_max_in_flight_per_exchange:
      parseInt(
        process.env.MARKET_MAKING_INTENT_WORKER_MAX_IN_FLIGHT_PER_EXCHANGE,
        10,
      ) || 1,
    max_open_orders_per_strategy:
      parseInt(process.env.MARKET_MAKING_MAX_OPEN_ORDERS_PER_STRATEGY, 10) || 50,
    /**
     * Global kill-switch for strategy intent execution.
     * When enabled, intent worker/executor will not place/cancel orders.
     * Use this for emergency stops without needing to redeploy.
     */
    kill_switch_enabled:
      process.env.MARKET_MAKING_KILL_SWITCH_ENABLED === 'true',
    withdraw_to_exchange_enabled:
      process.env.MARKET_MAKING_WITHDRAW_TO_EXCHANGE_ENABLED === 'true',
    queue_withdraw_on_payment_complete:
      process.env.MARKET_MAKING_QUEUE_WITHDRAW_ON_PAYMENT_COMPLETE === 'true',
  },
  web3: {
    network: {
      mainnet: {
        rpc_url: process.env.WEB3_MAINNET_RPC_URL,
      },
      sepolia: {
        rpc_url: process.env.WEB3_SEPOLIA_RPC_URL,
      },
      polygon: {
        rpc_url: process.env.WEB3_POLYGON_RPC_URL,
      },
      polygon_amoy: {
        rpc_url: process.env.WEB3_POLYGON_AMOY_RPC_URL,
      },
      bsc: {
        rpc_url: process.env.WEB3_BSC_MAINNET_RPC_URL,
      },
      bsc_testnet: {
        rpc_url: process.env.WEB3_BSC_TESTNET_RPC_URL,
      },
    },
    private_key: process.env.WEB3_PRIVATE_KEY,
    gas_multiplier: +process.env.WEB3_GAS_MULTIPLIER || 1,
  },
  hufi: {
    campaign_launcher: {
      api_url:
        process.env.HUFI_CAMPAIGN_LAUNCHER_API_URL || 'https://cl.hu.finance',
    },
    recording_oracle: {
      api_url:
        process.env.HUFI_RECORDING_ORACLE_API_URL || 'https://ro.hu.finance',
    },
  },
  reward: {
    mixin_vault_user_id: process.env.REWARD_MIXIN_VAULT_USER_ID,
  },
});
