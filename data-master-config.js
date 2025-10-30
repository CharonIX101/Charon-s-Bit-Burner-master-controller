// data-master-config.js
// Master configuration for full automation (edit anything here).
// All times are milliseconds unless noted. All files are flat .js.

export const masterConfig = {
  // -------------------------------------------------------
  // PURCHASE POLICY (private servers & darkweb tools)
  // -------------------------------------------------------
  purchasePolicy: {
    autoBuyPrivate: true,             // Buy/upgrade private servers per tiers below
    darkwebMaxPriceFractionOfCash: 0.7,// Spend up to 70% of wallet on a single darkweb tool
    privateMaxPriceFractionOfCash: 0.9,// Spend up to 90% of wallet on a private server
    maxRetries: 3                     // Retries on failed purchases
  },

  // -------------------------------------------------------
  // PRIVATE SERVERS — GhostFarm plan
  // -------------------------------------------------------
  privateServers: {
    usePrivateIfPresent: true,        // Use your private servers for workers
    totalSlots: 25,                   // Max count to manage
    namePrefix: "GhostFarm",          // GhostFarm0..GhostFarm24 naming
    tiers: [
      { count: 2,  ramGB: 4096 },     // 2 × 4 TB
      { count: 4,  ramGB: 65536 },    // 4 × 64 TB
      { count: 19, ramGB: 1048576 }   // remainder × 1 PB (max)
    ]
  },

  // -------------------------------------------------------
  // RAM usage & kill policies
  // -------------------------------------------------------
  ramUsage: {
    privatePercent: 0.85,   // Use up to 85% RAM on private servers
    homePercent: 0.50,      // Use up to 50% RAM on home
    publicPercent: 1.00,    // Use up to 100% on rooted public servers
    reserveRatio: 0.02      // Always keep 2% RAM free as a safety buffer
  },
  killallPolicy: {
    doKillAllOnPublic: true,// Kill scripts on public hosts before using them
    doKillAllOnHome: false,
    doKillAllOnPrivate: false
  },

  // -------------------------------------------------------
  // ROOTING (periodic full sweep until all rooted)
  // -------------------------------------------------------
  rooting: {
    enabled: true,
    sweepIntervalMs: 20 * 60 * 1000, // Run a full auto-root pass every 20 minutes
    stopWhenAllRooted: true,         // Stop periodic sweep once all servers are rooted
    buyToolsFromDarkweb: true,       // Buy missing port tools during the sweep (uses caps above)
    maxRuntimePerServerMs: 120000,   // Per-target effort limit during a sweep (2 min)
    preferOwnedRunners: true         // Prefer private servers for any remote worker exec
  },

  // -------------------------------------------------------
  // EARLY GAME (low-RAM HGW) -> auto-handover to batcher
  // -------------------------------------------------------
  earlyGame: {
    enabled: true,
    loopMs: 1500,                    // HGW loop cadence
    batchReady: {                    // Conditions to exit early engine and start batcher
      minHackingLevel: 50,
      minRootedTargets: 5
    }
  },

  // -------------------------------------------------------
  // BATCHER (safe defaults; the daemon reads these)
  // -------------------------------------------------------
  batcher: {
    defaultHackPct: 0.02,            // Start around 2% hack
    minHackPct: 0.005,               // Floor 0.5%
    maxHackPct: 0.20,                // Ceiling 20%
    deltaMs: 200,                    // W/G/H separation in ms
    maxBatchesInFlight: 6,           // Overlapping batches
    targetReliability: 0.99          // Auto-tune to keep ~99% success
  },

  // -------------------------------------------------------
  // HACKNET automation
  // -------------------------------------------------------
  hacknet: {
    autoBuy: true,
    upgradePolicy: "balanced",       // balanced | cores-first | ram-first | level-first
    budgetFraction: 0.05,            // Spend up to 5% of wallet per check
    checkIntervalMs: 300000          // Every 5 minutes
  },

  // -------------------------------------------------------
  // FACTION automation (gated where SF-4 is required)
  // -------------------------------------------------------
  factions: {
    autoDiscover: true,
    autoJoinWhenAble: true,
    autoWork: true,
    workMode: "balanced"             // balanced | hacking | field | security
  },

  // -------------------------------------------------------
  // STOCKS (scan first, then auto-start; trader enforces 10% wallet cap)
  // -------------------------------------------------------
  stocks: {
    enable: true,
    controlScript: "stock_control.js",
    traderScript: "stock_band_trader.js",
    autoScanMs: 10 * 60 * 1000,      // Scan-only for 10 minutes then auto-start trades
    walletPctLimit: 0.10             // Never allocate more than 10% of wallet to positions
  },

  // -------------------------------------------------------
  // LOGGING — console-only; toggle what prints
  // -------------------------------------------------------
  logging: {
    summaryIntervalMs: 5 * 60 * 1000,// Print a concise summary every 5 minutes
    console: {
      summaryEnabled: true,
      errorsEnabled: true,
      moneyEnabled: true,
      xpEnabled: true,
      stocksEnabled: true,
      batcherEnabled: true,
      rootingEnabled: true,
      pidsEnabled: false,            // Per your request: DO NOT print active PIDs
      verboseWorkers: false          // Worker spam off
    }
  },

  // -------------------------------------------------------
  // DRY RUN (for tests only)
  // -------------------------------------------------------
  dryRun: {
    enabled: false,                  // Live by default
    simulateThreadsOnly: false,
    noActualHacks: false
  }
};
