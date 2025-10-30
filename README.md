# Charon-s-Bit-Burner-master-controller
⚙️ Bitburner Master Automation Stack

Version: 1.0
Author: Charon_IX
Game: Bitburner

If you have any questions comments or concerns please feel free to message me on discord @ Charon_IX / Charon1578

Language: Netscript 2 (JS syntax)

🧠 Overview

This is a fully-automated Bitburner control system that manages every major progression layer — from first login to late-game income farming — all through a single command:

run master.js
=============================================================================================================================================================================
Once started, it continuously:
Roots every server and buys missing DarkWeb tools
Launches early-game hack/grow/weaken loops
Seamlessly transitions to an adaptive batcher (HWGW) for late-game income
Auto-purchases and upgrades private servers
Manages and expands Hacknet nodes
Trades the stock market intelligently (buy low / sell high)
Joins and works for factions when APIs allow
Prints a clean, rolling 5-minute performance summary (money, XP, errors, etc.)
=============================================================================================================================================================================
📁 File structure
Category	Files
Core control:	master.js, lib-config.js, data-master-config.js
Subsystem daemons:	systems-rooting.js, systems-earlygame.js, systems-batcher.js, batcher-daemon.js, systems-hacknet-mgr.js, systems-privates-mgr.js, systems-stocks-mgr.js
Workers (HGW):	workers-hack.js, workers-grow.js, workers-weaken.js
Stocks:	stock_band_trader.js, stock_control.js
Backdoor helper:	backdoor-worker-micro.js
State stubs (data modules):	data-rooting_state.js, data-batcher_state.js, data-stock_state.js, data-stock_trades.js, data-stock_errors.js

All files live in your home directory.
No subfolders are required — the “data-” prefixes just make grouping clearer.
=============================================================================================================================================================================
🚀 Setup

Copy every .js file above into your Bitburner home directory.

Verify RootV3.js exists (used by the rooting subsystem).

Open the in-game terminal and run:

killall
run master.js


Sit back — automation starts instantly.
=============================================================================================================================================================================
🧩 How it works (subsystem summary)
Subsystem	Function
master.js	Launches and monitors all subsystems; prints 5-min summaries.
systems-rooting.js	Every 20 min scans all servers, opens ports, nukes, and buys missing DarkWeb tools (up to 70 % of wallet). Stops when all are rooted.
systems-earlygame.js	Performs simple grow/weaken/hack loops until you reach configured thresholds.
batcher-daemon.js + systems-batcher.js	Advanced just-in-time batcher with configurable timing and hack % controls.
systems-privates-mgr.js	Buys/renames private servers per tier plan (4 TB → 64 TB → 1 PB).
systems-hacknet-mgr.js	Expands Hacknet using up to 5 % of wallet per check.
systems-stocks-mgr.js	Runs the stock trader: 10 min scan, then auto-starts stock_band_trader.js.
stock_band_trader.js	Tracks highs/lows; buys bottom 30 %, sells top 30 %; ≤ 10 % wallet exposure.
stock_control.js	Manual port-control utility (e.g. run stock_control.js stop).
workers-hack/grow/weaken.js	Minimal per-target executors used by earlygame/batcher.
backdoor-worker-micro.js	Tiny helper that installs backdoors when needed.
⚙️ Configuration (data-master-config.js)

All behavior is driven by this file — it’s a commented JS object, not JSON.
Every key is documented in-line. Highlights:

purchasePolicy: {
  darkwebMaxPriceFractionOfCash: 0.7,  // spend up to 70 % wallet on DarkWeb tools
  privateMaxPriceFractionOfCash: 0.9   // up to 90 % on private servers
},

rooting: {
  sweepIntervalMs: 1200000,            // re-root every 20 min
  stopWhenAllRooted: true,
  buyToolsFromDarkweb: true
},

stocks: {
  autoScanMs: 600000,                  // 10 min scan phase
  walletPctLimit: 0.10                 // ≤ 10 % wallet exposure
},

logging: {
  summaryIntervalMs: 300000,           // 5-min summaries
  console: { pidsEnabled: false }      // no PID spam
}


Edit this file anytime; changes take effect on the next master.js restart.

💬 Console logging

Every 5 minutes the master prints:

[Summary @ 12:30]
Rooted: 96 / 96  |  Money/sec: $1.42m  |  Hacking XP/hr: 2.3e6
Stocks: +$48.7m  |  Errors: 0  |  Hacknet income: $0.19m/s


Toggle any section on/off via the logging.console options.

🧠 Manual controls

Stocks

run stock_control.js start
run stock_control.js stop
run stock_control.js reset
run stock_control.js band 0.25
run stock_control.js cap 1000000000


Dry-run mode (simulation only)

dryRun: { enabled: true }

🛠 Known limitations

Auto-buying DarkWeb tools requires access to ns.purchaseTor() and ns.purchaseProgram(). Without SF-4 the script will simply skip those purchases.

Faction auto-work/join also requires SF-4 (Singularity API). Otherwise it logs a notice and continues.

🏁 Goal behavior

A brand-new save can run master.js immediately.

Within ~20 minutes you’ll have every early server rooted.

Money, XP, and Hacknet snowball automatically.

By mid-game the batcher replaces the simple HGW loop.

Late-game, the system idles at near-max passive income and auto-stocks.

The only manual step left is buying augments and resetting.

📈 Metrics displayed

Money gained per second / minute / hour / day

XP per second / minute / hour / day

Rooted server counts

Hacknet and stock income summaries

Any active error conditions

📜 License / Sharing

Feel free to fork, modify, and share.
Attribution to Charon_IX appreciated if you redistribute or publish derivatives.

🧪 Testing plan

Fresh install → run master.js.

Observe rooting and DarkWeb purchases within first 20 min.

Confirm early HGW → batcher transition around hacking lvl 50.

Verify private servers auto-scale and Hacknet expands.

After 10 min stocks begin trading automatically.

Check 5-min summaries for money & XP progression.

💡 Tip: for faster debugging, run tail master.js in a separate window — all daemons write their key events there.
