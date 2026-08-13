// ==UserScript==
// @name         Candle Client for RugPlay
// @namespace    candle.rugplay
// @version      2.0.0
// @description  Candle Client for RugPlay by Chromites. Right Shift opens the client. 215 mods in 13 categories, all off until enabled. On-site mods render directly on rugplay.com, the rest live inside the client. Every mod runs on real RugPlay API endpoints and real platform rules. Nothing is faked.
// @author       Chromites
// @match        https://rugplay.com/*
// @match        http://localhost:5173/*
// @match        http://localhost:3002/*
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-idle
// @noframes
// ==/UserScript==

/*
 * Candle Client v2.0.0, by Chromites.
 *
 * Right Shift toggles the client. 215 mods in 13 categories, all OFF by default.
 * Flip a mod on and it takes effect. The Site category renders directly on the
 * page (a HUD over rugplay.com), the rest enhance the client window. All
 * backed by real RugPlay endpoints and the real server rules from the repo:
 *   GET  /api/coins/top, /api/market, /api/coin/{s}(/{chart-history,holders,comments}),
 *   /api/trades/recent, /api/leaderboard, /api/hopium/questions(/{id}),
 *   /api/portfolio/{summary,total}, /api/transactions, /api/achievements(/{unclaimed,claim}),
 *   /api/season, /api/notifications, /api/coin/create, /api/user/arcade-stats,
 *   /api/rewards/claim, /api/prestige, /api/shop/{inventory,crate,equip}, /api/keys,
 *   /api/settings/{blocked,mentions,volume}, /api/user/{username}
 *   POST /api/coin/{s}/trade, /api/hopium/questions/{id}/bet, /api/coin/{s}/comments,
 *   /api/coin/{s}/comments/{id}/like, /api/transfer, /api/achievements/claim,
 *   /api/rewards/claim, /api/prestige, /api/shop/crate, /api/shop/equip,
 *   /api/promo/verify, /api/settings/{mentions,volume}   PATCH /api/notifications
 *
 * Real rules baked in: coin launch $1,100 ($100 fee + $1,000 pool), 0.3% swap fee,
 * 1% transfer fee, 60s creator lock, dice 1/6 x3 (-50%), coinflip fair, slots -2.8%,
 * mines/tower 95% payout, daily rewards $1,200-8,500 with prestige multipliers,
 * prestige costs $100k/250k/1M/5M/25M, crate tiers 150/400/1000/2500 gems,
 * 67 achievements, 10 name colors. Read-only in spirit: every write is deliberate.
 */


'use strict';

(() => {
  // ════════════════════════════════════════════════════════════════════
  // Constants
  // ════════════════════════════════════════════════════════════════════

  const VERSION = '2.0.0';
  const DEVELOPER = 'Chromites';
  const SWAP_FEE = 0.003;

  const DEFAULT_SETTINGS = {
    tickerSeconds: 8,
    marketPageSize: 25,
    theme: 'auto',      // auto | dark | light
    accent: 'red',      // red | ember | violet | emerald | cyan
    fontScale: 100,     // 85 - 130 percent
    lastView: null,     // remembered view id (View Memory mod)
    toastPos: 'br',     // br | tr (Toast Position mod)
  };

  // Real static data pulled from the RugPlay source (lib/data + lib/utils).
  const PRESTIGE_COSTS = { 1: 100000, 2: 250000, 3: 1000000, 4: 5000000, 5: 25000000 };
  const PRESTIGE_NAMES = { 1: 'Prestige I', 2: 'Prestige II', 3: 'Prestige III', 4: 'Prestige IV', 5: 'Prestige V' };
  const PRESTIGE_MULTIPLIERS = { 0: 1.0, 1: 1.25, 2: 1.5, 3: 1.75, 4: 2.0, 5: 2.5 };
  const DAILY_REWARD_TIERS = [1200,1500,1800,2100,2500,3000,3500,4000,4200,4400,4600,4800,5000,5200,5400,5600,5800,6000,6200,6400,6600,6800,7000,7200,7400,7600,7800,8000,8200,8500];
  const CRATE_TIERS = [
    { id: 'standard', label: 'Small Crate', cost: 150, accent: '#a0724a', rewards: [
      { weight: 40, type: 'buss', min: 250, max: 2000, label: '$250-2,000' },
      { weight: 25, type: 'buss', min: 2000, max: 5000, label: '$2,000-5,000' },
      { weight: 25, type: 'color', rarity: 'uncommon', min: 100, max: 100, label: 'Uncommon color + $100' },
      { weight: 10, type: 'color', rarity: 'rare', min: 250, max: 250, label: 'Rare color + $250' },
    ] },
    { id: 'premium', label: 'Fatass Crate', cost: 400, accent: '#5b8dd9', rewards: [
      { weight: 25, type: 'buss', min: 1000, max: 5000, label: '$1,000-5,000' },
      { weight: 15, type: 'buss', min: 5000, max: 15000, label: '$5,000-15,000' },
      { weight: 30, type: 'color', rarity: 'rare', min: 500, max: 500, label: 'Rare color + $500' },
      { weight: 22, type: 'color', rarity: 'epic', min: 1500, max: 1500, label: 'Epic color + $1,500' },
      { weight: 8, type: 'color', rarity: 'legendary', min: 5000, max: 5000, label: 'Legendary color + $5,000' },
    ] },
    { id: 'legendary', label: 'Motion Crate', cost: 1000, accent: '#e5a63b', rewards: [
      { weight: 15, type: 'buss', min: 5000, max: 25000, label: '$5,000-25,000' },
      { weight: 30, type: 'color', rarity: 'rare', min: 1000, max: 1000, label: 'Rare color + $1,000' },
      { weight: 30, type: 'color', rarity: 'epic', min: 2500, max: 2500, label: 'Epic color + $2,500' },
      { weight: 25, type: 'color', rarity: 'legendary', min: 10000, max: 10000, label: 'Legendary color + $10,000' },
    ] },
    { id: 'mythic', label: 'Auraful Crate', cost: 2500, accent: '#c24adb', rewards: [
      { weight: 10, type: 'buss', min: 15000, max: 75000, label: '$15,000-75,000' },
      { weight: 35, type: 'color', rarity: 'epic', min: 5000, max: 5000, label: 'Epic color + $5,000' },
      { weight: 55, type: 'color', rarity: 'legendary', min: 20000, max: 20000, label: 'Legendary color + $20,000' },
    ] },
  ];
  const NAME_COLORS = [
    { key: 'green', label: 'Green Candle', rarity: 'uncommon', price: 300, style: 'color:#22c55e' },
    { key: 'blue', label: 'Blue Chip', rarity: 'uncommon', price: 300, style: 'color:#3b82f6' },
    { key: 'orange', label: 'Orange Peel', rarity: 'uncommon', price: 400, style: 'color:#fb923c' },
    { key: 'purple', label: 'Purple Haze', rarity: 'rare', price: 700, style: 'color:#a855f7' },
    { key: 'red', label: 'Red Alert', rarity: 'rare', price: 700, style: 'color:#ef4444' },
    { key: 'gold', label: 'Gold Rush', rarity: 'epic', price: 1400, style: 'color:#facc15' },
    { key: 'fire', label: 'Degen Fire', rarity: 'epic', price: 1800, style: 'background-image:linear-gradient(90deg,#f97316,#ef4444,#f59e0b);-webkit-background-clip:text;background-clip:text;color:transparent' },
    { key: 'ocean', label: 'Ocean Wave', rarity: 'epic', price: 1600, style: 'background-image:linear-gradient(90deg,#06b6d4,#3b82f6,#8b5cf6);-webkit-background-clip:text;background-clip:text;color:transparent' },
    { key: 'rainbow', label: 'Rainbow Baby', rarity: 'legendary', price: 4500, style: 'background-image:linear-gradient(90deg,#ef4444,#f97316,#eab308,#22c55e,#3b82f6,#8b5cf6,#ec4899);-webkit-background-clip:text;background-clip:text;color:transparent' },
    { key: 'diamond', label: 'Diamond Hands', rarity: 'legendary', price: 5000, style: 'background-image:linear-gradient(135deg,#e2e8f0,#67e8f9,#c084fc,#e2e8f0);-webkit-background-clip:text;background-clip:text;color:transparent' },
  ];
  const RARITY_LABEL = { uncommon: 'Uncommon', rare: 'Rare', epic: 'Epic', legendary: 'Legendary' };
  const RARITY_COLOR = { uncommon: '#34d399', rare: '#60a5fa', epic: '#c084fc', legendary: '#facc15' };
  const GEM_PACKAGES = [
    { id: 'starter', price: 1.99, gems: 500, bonusPct: 0 },
    { id: 'value', price: 4.99, gems: 1300, bonusPct: 5 },
    { id: 'builder', price: 9.99, gems: 2800, bonusPct: 15 },
    { id: 'whale', price: 24.99, gems: 8000, bonusPct: 30 },
  ];
  const ACH_DIFFICULTY = ['easy', 'medium', 'hard', 'legendary'];
  const ACH_CATEGORIES = ['trading', 'wealth', 'creation', 'arcade', 'streaks', 'prestige', 'hopium', 'social', 'shop', 'special', 'season'];

  const TF_OPTIONS = [
    { id: '1m', label: '1m', hours: 24 },
    { id: '5m', label: '5m', hours: 24 },
    { id: '15m', label: '15m', hours: 72 },
    { id: '1h', label: '1h', hours: 168 },
    { id: '4h', label: '4h', hours: 720 },
    { id: '1d', label: '1d', hours: 2160 },
  ];

  // ── Mod registry - 215 mods across 13 categories, every one real ───

  const MODS = [
    // Site (35) - mods that render directly on rugplay.com
    { id: 'locktimer', name: 'Creator Lock', cat: 'Site', icon: 'lock', def: false, desc: 'Onsite countdown for the 60s dev-only trading window.' },
    { id: 'coinage', name: 'Coin Age', cat: 'Site', icon: 'calendar', def: false, desc: 'Onsite chip showing when the coin launched.' },
    { id: 'athmarker', name: 'All-Time High', cat: 'Site', icon: 'flame', def: false, desc: 'Onsite ATH chip computed from chart history.' },
    { id: 'poolwatch', name: 'Pool Watch', cat: 'Site', icon: 'droplet', def: false, desc: 'Onsite liquidity pool amounts on coin pages.' },
    { id: 'devdom', name: 'Dev Dominance', cat: 'Site', icon: 'crown', def: false, desc: 'Onsite creator supply-share warning chip.' },
    { id: 'pricealerts', name: 'Price Alerts', cat: 'Site', icon: 'bell', def: false, desc: 'Onsite one-tap ±10% / ±50% alert buttons.' },
    { id: 'holderradar', name: 'Holder Radar', cat: 'Site', icon: 'radar', def: false, desc: 'Onsite top-3 holders mini list.' },
    { id: 'livefeed', name: 'Live Feed', cat: 'Site', icon: 'zap', def: false, desc: 'Onsite live trades widget on every page.' },
    { id: 'seasoncard', name: 'Season Card', cat: 'Site', icon: 'calendar', def: false, desc: 'Onsite season banner with real countdown.' },
    { id: 'treemap', name: 'Market Treemap', cat: 'Site', icon: 'grid', def: false, desc: 'Onsite market treemap on /market.' },
    { id: 'marketstats', name: 'Market Snapshot', cat: 'Site', icon: 'chart', def: false, desc: 'Onsite listed count + biggest gainer/loser.' },
    { id: 'movers', name: 'Movers Board', cat: 'Site', icon: 'activity', def: false, desc: 'Onsite gainers/losers strip on /market.' },
    { id: 'launchkit', name: 'Launch Kit', cat: 'Site', icon: 'flame', def: false, desc: 'Onsite creation-cost widget on /coin/create.' },
    { id: 'gemswallet', name: 'Gems Wallet', cat: 'Site', icon: 'diamond', def: false, desc: 'Onsite gem balance chip on portfolio pages.' },
    { id: 'networth', name: 'Net Worth', cat: 'Site', icon: 'chart', def: false, desc: 'Onsite net-worth chip on portfolio pages.' },
    { id: 'prestigestatus', name: 'Prestige Status', cat: 'Site', icon: 'crown', def: false, desc: 'Onsite prestige chip on portfolio and prestige pages.' },
    { id: 'crateodds', name: 'Crate EV', cat: 'Site', icon: 'calculator', def: false, desc: 'Onsite crate expected-value widget on /shop.' },
    { id: 'riskmeter', name: 'House Edge Meter', cat: 'Site', icon: 'shield', def: false, desc: 'Onsite game edge table on /arcade.' },
    { id: 'qdepth', name: 'Pool Depth', cat: 'Site', icon: 'droplet', def: false, desc: 'Onsite hopium stakes-per-side widget.' },
    { id: 'countdown', name: 'Countdown', cat: 'Site', icon: 'clock', def: false, desc: 'Onsite resolution countdown on hopium pages.' },
    { id: 'siteprice', name: 'Price Chip', cat: 'Site', icon: 'tag', def: false, desc: 'Onsite live price chip on coin pages.' },
    { id: 'sitechange', name: '24h Change Chip', cat: 'Site', icon: 'activity', def: false, desc: 'Onsite 24h change chip on coin pages.' },
    { id: 'sitemcap', name: 'Market Cap Chip', cat: 'Site', icon: 'chart', def: false, desc: 'Onsite market cap chip on coin pages.' },
    { id: 'sitevol', name: 'Volume Chip', cat: 'Site', icon: 'bars', def: false, desc: 'Onsite 24h volume chip on coin pages.' },
    { id: 'sitefeed', name: 'Trade Tape', cat: 'Site', icon: 'zap', def: false, desc: 'Onsite per-coin trade tape from recent trades.' },
    { id: 'sitecomments', name: 'Comment Widget', cat: 'Site', icon: 'send', def: false, desc: 'Onsite latest comments on coin pages.' },
    { id: 'sitehopium', name: 'Hopium Widget', cat: 'Site', icon: 'trend', def: false, desc: 'Onsite active questions widget on /hopium.' },
    { id: 'siteleader', name: 'Leader Widget', cat: 'Site', icon: 'skull', def: false, desc: 'Onsite rugpuller widget on /leaderboard.' },
    { id: 'siteach', name: 'Achievement Widget', cat: 'Site', icon: 'award', def: false, desc: 'Onsite unlocked-count chip.' },
    { id: 'siterewards', name: 'Claim Reminder', cat: 'Site', icon: 'gift', def: false, desc: 'Onsite daily-claim reminder chip.' },
    { id: 'sitekeys', name: 'Key Widget', cat: 'Site', icon: 'key', def: false, desc: 'Onsite API key budget chip.' },
    { id: 'sitearcade', name: 'Arcade Widget', cat: 'Site', icon: 'dice', def: false, desc: 'Onsite arcade win/loss chip on /arcade.' },
    { id: 'sitetransfers', name: 'Transfer Widget', cat: 'Site', icon: 'send', def: false, desc: 'Onsite recent transfer widget on /portfolio.' },
    { id: 'siteseasonjoin', name: 'Season Join', cat: 'Site', icon: 'crown', def: false, desc: 'Onsite one-tap season entry (double-confirmed).' },
    { id: 'siteusername', name: 'Username Check', cat: 'Site', icon: 'at', def: false, desc: 'Onsite username availability widget on /settings.' },
    { id: 'mentionradar', name: 'Mention Radar', cat: 'Site', icon: 'at', def: false, desc: 'Onsite unread @mention counter from your real notifications.' },
    { id: 'friendtags', name: 'Friend Tags', cat: 'Site', icon: 'tag', def: false, desc: 'Onsite friend rank tags next to usernames in comments.' },
    { id: 'quicktransfer', name: 'Quick Transfer', cat: 'Site', icon: 'send', def: false, desc: 'Onsite Send button on profile pages.' },
    // Trading (24) - coin terminal
    { id: 'quicktrade', name: 'Quick Trade', cat: 'Trading', icon: 'zap', def: false, desc: 'BUY/SELL terminal with live pool math on every coin.' },
    { id: 'slippage', name: 'Slippage Meter', cat: 'Trading', icon: 'gauge', def: false, desc: 'Live AMM price-impact badge computed from the pool.' },
    { id: 'feeinfo', name: 'Fee Breakdown', cat: 'Trading', icon: 'tag', def: false, desc: 'Exact 0.3% swap fee shown per trade.' },
    { id: 'timeframes', name: 'Chart Timeframes', cat: 'Trading', icon: 'clock', def: false, desc: '1m/5m/15m/1h/4h/1d candle windows.' },
    { id: 'crosshair', name: 'Chart Crosshair', cat: 'Trading', icon: 'target', def: false, desc: 'Hover OHLC tooltip on the candles.' },
    { id: 'volumebars', name: 'Volume Bars', cat: 'Trading', icon: 'bars', def: false, desc: 'Volume under every candle.' },
    { id: 'quicksell', name: 'Quick Sell', cat: 'Trading', icon: 'percent', def: false, desc: '25/50/75/100% preset sells from your actual bag.' },
    { id: 'latestcandle', name: 'Last Candle', cat: 'Trading', icon: 'candle', def: false, desc: 'OHLC of the most recent candle from chart history.' },
    { id: 'volumedepth', name: 'Volume ÷ MCap', cat: 'Trading', icon: 'activity', def: false, desc: '24h volume against market cap ratio stat.' },
    { id: 'poolsplit', name: 'Pool Split', cat: 'Trading', icon: 'droplet', def: false, desc: 'Base-currency vs token side of the pool.' },
    { id: 'feeswap', name: 'Swap Fee', cat: 'Trading', icon: 'tag', def: false, desc: 'The exact 0.3% fee in BUSS on every trade.' },
    { id: 'breakcalc', name: 'Break-Even', cat: 'Trading', icon: 'calculator', def: false, desc: 'Price you need to clear fees on a round trip.' },
    { id: 'orderflow', name: 'Order Flow', cat: 'Trading', icon: 'zap', def: false, desc: 'Buy vs sell split for the coin from recent trades.' },
    { id: 'avgprice', name: 'Avg Entry', cat: 'Trading', icon: 'chart', def: false, desc: 'Your average buy price from real transactions.' },
    { id: 'positionvalue', name: 'Position Value', cat: 'Trading', icon: 'wallet', def: false, desc: 'Your bag value for the coin in the terminal.' },
    { id: 'buypresets', name: 'Quick Buy', cat: 'Trading', icon: 'zap', def: false, desc: '$100 / $500 / $1K preset buys in the trade panel.' },
    { id: 'holdtime', name: 'Hold Time', cat: 'Trading', icon: 'clock', def: false, desc: 'How long you have held the coin, from transactions.' },
    { id: 'swaphistory', name: 'Swap History', cat: 'Trading', icon: 'book', def: false, desc: 'Your recent swaps for this coin in the terminal.' },
    { id: 'pooldepthbar', name: 'Depth Ratio', cat: 'Trading', icon: 'bars', def: false, desc: 'Pool depth against market cap as a ratio bar.' },
    { id: 'devwatch', name: 'Dev Watch', cat: 'Trading', icon: 'eye', def: false, desc: 'Flags the creator\'s buys and sells in the feed.' },
    { id: 'wallettrack', name: 'Wallet Track', cat: 'Trading', icon: 'wallet', def: false, desc: 'Your cash balance shown in the trade panel.' },
    { id: 'permillion', name: 'Per Million', cat: 'Trading', icon: 'grid', def: false, desc: 'Price per 1M tokens - a cleaner mental scale.' },
    { id: 'volatility', name: 'Volatility', cat: 'Trading', icon: 'activity', def: false, desc: '24h high-low range from the 1d candles.' },
    { id: 'fromlaunch', name: 'From Launch', cat: 'Trading', icon: 'flame', def: false, desc: 'How many x above the $0.000001 launch price.' },
    // Market (22)
    { id: 'searchpro', name: 'Search Pro', cat: 'Market', icon: 'search', def: false, desc: 'Debounced name/symbol search in the market.' },
    { id: 'filterkit', name: 'Filter Kit', cat: 'Market', icon: 'sliders', def: false, desc: 'Price ranges and change filters in the market.' },
    { id: 'sortable', name: 'Sortable Columns', cat: 'Market', icon: 'arrowdown', def: false, desc: 'Server-side sorting on every market column.' },
    { id: 'paging', name: 'Pager', cat: 'Market', icon: 'book', def: false, desc: 'Paginated market results.' },
    { id: 'topboard', name: 'Top Board', cat: 'Market', icon: 'trophy', def: false, desc: 'Largest coins by market cap on the overview.' },
    { id: 'rugpullers', name: 'Rugpuller Board', cat: 'Market', icon: 'skull', def: false, desc: '24h leaderboard of the biggest extractors.' },
    { id: 'pricedist', name: 'Price Spread', cat: 'Market', icon: 'chart', def: false, desc: 'Price distribution histogram of the current page.' },
    { id: 'mcapdist', name: 'MCap Spread', cat: 'Market', icon: 'grid', def: false, desc: 'Market-cap distribution histogram.' },
    { id: 'chgdist', name: 'Change Spread', cat: 'Market', icon: 'activity', def: false, desc: '24h change distribution histogram.' },
    { id: 'mcapfilter', name: 'MCap Filter', cat: 'Market', icon: 'sliders', def: false, desc: 'Client-side market-cap range chips.' },
    { id: 'volfilter', name: 'Volume Filter', cat: 'Market', icon: 'bars', def: false, desc: 'Client-side volume range chips.' },
    { id: 'marketclock', name: 'Market Clock', cat: 'Market', icon: 'clock', def: false, desc: 'Freshness stamp: last refresh Ns ago.' },
    { id: 'coincount', name: 'Coin Count', cat: 'Market', icon: 'hash', def: false, desc: 'Total listed coin count on the market view.' },
    { id: 'topgainer', name: 'Top Gainer', cat: 'Market', icon: 'trend', def: false, desc: 'Biggest gainer card on the market view.' },
    { id: 'toploser', name: 'Top Loser', cat: 'Market', icon: 'trend', def: false, desc: 'Biggest loser card on the market view.' },
    { id: 'bigmover', name: 'Big Mover', cat: 'Market', icon: 'zap', def: false, desc: 'Largest absolute change card.' },
    { id: 'microcaps', name: 'Micro Caps', cat: 'Market', icon: 'star', def: false, desc: 'Highlight coins under $50K market cap.' },
    { id: 'megaliths', name: 'Megaliths', cat: 'Market', icon: 'trophy', def: false, desc: 'Highlight coins above $5M market cap.' },
    { id: 'heatrow', name: 'Heat Rows', cat: 'Market', icon: 'palette', def: false, desc: 'Heat-colored 24h change in market rows.' },
    { id: 'avgsize', name: 'Avg Trade Size', cat: 'Market', icon: 'calculator', def: false, desc: 'Average trade value from recent trades.' },
    { id: 'tradepace', name: 'Trade Pace', cat: 'Market', icon: 'activity', def: false, desc: 'Trades landing in the last minute.' },
    { id: 'priceband', name: 'Price Band', cat: 'Market', icon: 'tag', def: false, desc: 'Compact price column band in rows.' },
    // Hopium (12)
    { id: 'hopium', name: 'Prediction Markets', cat: 'Hopium', icon: 'trend', def: false, desc: 'Browse and analyze active questions.' },
    { id: 'oddsbars', name: 'Odds Bars', cat: 'Hopium', icon: 'bars', def: false, desc: 'YES/NO probability bars on every question.' },
    { id: 'probchart', name: 'Probability Chart', cat: 'Hopium', icon: 'trend', def: false, desc: 'YES% history chart on question detail.' },
    { id: 'betting', name: 'Bet Terminal', cat: 'Hopium', icon: 'coin', def: false, desc: 'Place YES/NO bets straight from the client.' },
    { id: 'hopiumstatus', name: 'Status Filter', cat: 'Hopium', icon: 'sliders', def: false, desc: 'ACTIVE / RESOLVED / ALL question filters.' },
    { id: 'hotmarkets', name: 'Hot Markets', cat: 'Hopium', icon: 'flame', def: false, desc: 'Most-staked questions strip.' },
    { id: 'nearresolve', name: 'Near Resolve', cat: 'Hopium', icon: 'clock', def: false, desc: 'Markets resolving within 24 hours.' },
    { id: 'qcounts', name: 'Question Counts', cat: 'Hopium', icon: 'hash', def: false, desc: 'ACTIVE / RESOLVED totals row.' },
    { id: 'qspread', name: 'Pool Spread', cat: 'Hopium', icon: 'activity', def: false, desc: 'YES/NO imbalance edge per question.' },
    { id: 'qev', name: 'Bet EV', cat: 'Hopium', icon: 'calculator', def: false, desc: 'Expected value of betting each side.' },
    { id: 'resolvedlist', name: 'Resolved List', cat: 'Hopium', icon: 'book', def: false, desc: 'Separate resolved-question section.' },
    { id: 'qvolume', name: 'Staked Volume', cat: 'Hopium', icon: 'coin', def: false, desc: 'Total dollars staked on each market.' },
    // Gamble (18)
    { id: 'gamelab', name: 'Gamble Lab', cat: 'Gamble', icon: 'dice', def: false, desc: 'EV calculators for every arcade game, from the real rules.' },
    { id: 'evdice', name: 'Dice EV', cat: 'Gamble', icon: 'dice', def: false, desc: 'Odds for the 1-6 dice game. Spoiler: 50% house edge.' },
    { id: 'evcoinflip', name: 'Coinflip EV', cat: 'Gamble', icon: 'coin', def: false, desc: 'The one fair game on the platform.' },
    { id: 'evslots', name: 'Slots EV', cat: 'Gamble', icon: 'sparkle', def: false, desc: 'Full payout table for the 6-symbol reels.' },
    { id: 'evmines', name: 'Mines EV', cat: 'Gamble', icon: 'bomb', def: false, desc: 'Survival probability per pick on the 25-tile grid.' },
    { id: 'evtower', name: 'Tower EV', cat: 'Gamble', icon: 'layers', def: false, desc: 'Per-floor multiplier table for every difficulty.' },
    { id: 'arcadestats', name: 'Arcade Stats', cat: 'Gamble', icon: 'chart', def: false, desc: 'Your win/loss record across the arcade.' },
    { id: 'winstreak', name: 'Win / Loss Ratio', cat: 'Gamble', icon: 'activity', def: false, desc: 'Record split and win rate from your arcade stats.' },
    { id: 'wagercalc', name: 'Wager EV Calculator', cat: 'Gamble', icon: 'calculator', def: false, desc: 'Expected return on any wager, per game rules.' },
    { id: 'minesgrid', name: 'Mines Simulator', cat: 'Gamble', icon: 'grid', def: false, desc: 'A 25-tile mines grid with the real odds per reveal.' },
    { id: 'towercalc', name: 'Tower Table', cat: 'Gamble', icon: 'layers', def: false, desc: 'Full multiplier table: all floors × difficulties.' },
    { id: 'minescalc', name: 'Mines Table', cat: 'Gamble', icon: 'bomb', def: false, desc: 'Multiplier table for picks × mine counts.' },
    { id: 'coinflipmath', name: 'Streak Math', cat: 'Gamble', icon: 'coin', def: false, desc: 'Odds of n coinflip wins in a row.' },
    { id: 'slotscombo', name: 'Slots Combos', cat: 'Gamble', icon: 'sparkle', def: false, desc: 'The 6 symbols and their ×5 / ×2 payouts.' },
    { id: 'betlimits', name: 'Bet Limits', cat: 'Gamble', icon: 'shield', def: false, desc: 'Tower max bets per difficulty: $1M / $100K / $10K.' },
    { id: 'minesrules', name: 'Mines Rules', cat: 'Gamble', icon: 'info', def: false, desc: 'The real rules card: 3-24 mines on 25 tiles.' },
    { id: 'edgegauge', name: 'Edge Gauge', cat: 'Gamble', icon: 'gauge', def: false, desc: 'House edge of every game at a glance.' },
    { id: 'fairness', name: 'Fairness Rank', cat: 'Gamble', icon: 'trophy', def: false, desc: 'All games ranked by how fair they are.' },
    // Portfolio (16)
    { id: 'portfolio', name: 'Portfolio', cat: 'Portfolio', icon: 'wallet', def: false, desc: 'Full positions view with totals.' },
    { id: 'holdings', name: 'Holdings Table', cat: 'Portfolio', icon: 'grid', def: false, desc: 'Every coin you hold, with value and 24h.' },
    { id: 'txlog', name: 'Transaction Log', cat: 'Portfolio', icon: 'book', def: false, desc: 'Your recent trades and transfers.' },
    { id: 'cashcard', name: 'Cash Card', cat: 'Portfolio', icon: 'wallet', def: false, desc: 'Highlight your liquid BUSS balance.' },
    { id: 'transfer', name: 'Cash Transfer', cat: 'Portfolio', icon: 'send', def: false, desc: 'Send BUSS to another user (min $10).' },
    { id: 'txfilter', name: 'Tx Filters', cat: 'Portfolio', icon: 'sliders', def: false, desc: 'BUY / SELL / TRANSFER type filters on your log.' },
    { id: 'txsearch', name: 'Tx Search', cat: 'Portfolio', icon: 'search', def: false, desc: 'Search your transaction history.' },
    { id: 'bell', name: 'Notification Bell', cat: 'Portfolio', icon: 'bell', def: false, desc: 'Unread badge in the title bar with mark-all-read.' },
    { id: 'holdingpct', name: 'Holding %', cat: 'Portfolio', icon: 'percent', def: false, desc: 'Each position as a share of your portfolio.' },
    { id: 'allocation', name: 'Allocation', cat: 'Portfolio', icon: 'pie', def: false, desc: 'Cash vs coins allocation bar.' },
    { id: 'biggesthold', name: 'Biggest Hold', cat: 'Portfolio', icon: 'trophy', def: false, desc: 'Your largest position, highlighted.' },
    { id: 'txsummary', name: 'Tx Summary', cat: 'Portfolio', icon: 'hash', def: false, desc: 'BUY / SELL / TRANSFER counts in your log.' },
    { id: 'txlatest', name: 'Latest Tx', cat: 'Portfolio', icon: 'clock', def: false, desc: 'Your most recent transaction card.' },
    { id: 'holdingcount', name: 'Holdings Count', cat: 'Portfolio', icon: 'grid', def: false, desc: 'How many coins you currently hold.' },
    { id: 'avgentry', name: 'Avg Entry', cat: 'Portfolio', icon: 'chart', def: false, desc: 'Value per token across your holdings.' },
    { id: 'topvalue', name: 'Top Value', cat: 'Portfolio', icon: 'flame', def: false, desc: 'Highest-value holding card.' },
    // Social (12)
    { id: 'comments', name: 'Comment Deck', cat: 'Social', icon: 'send', def: false, desc: 'Read and post comments on any coin.' },
    { id: 'likes', name: 'Like Meter', cat: 'Social', icon: 'heart', def: false, desc: 'Comment like counts and one-click likes.' },
    { id: 'profilepeek', name: 'Profile Peek', cat: 'Social', icon: 'user', def: false, desc: 'Open any trader profile from holders and feeds.' },
    { id: 'devcredit', name: 'Dev Credit', cat: 'Social', icon: 'crown', def: false, desc: 'Creator name on every coin terminal.' },
    { id: 'livepage', name: 'Live Page', cat: 'Social', icon: 'zap', def: false, desc: 'The full real-time trade feed section.' },
    { id: 'watchstar', name: 'Watch Star', cat: 'Social', icon: 'star', def: false, desc: 'One-click watch toggle on market rows.' },
    { id: 'sparklines', name: 'Spark Lines', cat: 'Social', icon: 'trend', def: false, desc: 'Mini price charts in the watchlist.' },
    { id: 'namecolorfeed', name: 'Name Colors', cat: 'Social', icon: 'palette', def: false, desc: 'Name colors rendered in feeds and leaders.' },
    { id: 'founderbadge', name: 'Founder Badge', cat: 'Social', icon: 'crown', def: false, desc: 'Founder badges shown in feeds and profiles.' },
    { id: 'blockprofile', name: 'Block From Profile', cat: 'Social', icon: 'ban', def: false, desc: 'Block a user from their profile modal (confirmed).' },
    { id: 'profileachievements', name: 'Profile Achievements', cat: 'Social', icon: 'award', def: false, desc: 'Achievements on any profile via the real endpoint.' },
    { id: 'userstats', name: 'User Stats', cat: 'Social', icon: 'chart', def: false, desc: 'Joined date, prestige and portfolio on profiles.' },
    { id: 'ranks', name: 'Rank Tags', cat: 'Social', icon: 'tag', def: false, desc: 'Your friend rank labels on comment rows, holders and feeds.' },
    { id: 'mentionping', name: 'Mention Ping', cat: 'Social', icon: 'bell', def: false, desc: 'Toast the moment a new @mention notification lands.' },
    // Shop (10)
    { id: 'inventory', name: 'Inventory', cat: 'Shop', icon: 'grid', def: false, desc: 'Your gems, owned name colors and founder badge.' },
    { id: 'crateshop', name: 'Crate Shop', cat: 'Shop', icon: 'box', def: false, desc: 'The four real crate tiers with exact costs and odds.' },
    { id: 'namecolors', name: 'Name Colors', cat: 'Shop', icon: 'palette', def: false, desc: 'The full catalog: 10 colors, rarities, gem prices.' },
    { id: 'equipper', name: 'Equip Color', cat: 'Shop', icon: 'check', def: false, desc: 'Set your active name color on the site.' },
    { id: 'opencrate', name: 'Open Crate', cat: 'Shop', icon: 'unlock', def: false, desc: 'Actually open a crate with your gems (confirmed).' },
    { id: 'colorpreview', name: 'Color Preview', cat: 'Shop', icon: 'eye', def: false, desc: 'Live render of every name color style.' },
    { id: 'gempackages', name: 'Gem Packages', cat: 'Shop', icon: 'diamond', def: false, desc: 'The real gem bundles: prices and bonus percents.' },
    { id: 'colorrarity', name: 'Color Rarity', cat: 'Shop', icon: 'tag', def: false, desc: 'Uncommon / Rare / Epic / Legendary tags on colors.' },
    { id: 'cratecontents', name: 'Crate Contents', cat: 'Shop', icon: 'box', def: false, desc: 'Exact reward tables and weights per crate tier.' },
    { id: 'ownedcolors', name: 'Owned Colors', cat: 'Shop', icon: 'check', def: false, desc: 'Owned colors section highlighted in the catalog.' },
    // Achievements (10)
    { id: 'achievementdeck', name: 'Achievement Deck', cat: 'Achievements', icon: 'award', def: false, desc: 'The full achievement catalog with states.' },
    { id: 'unclaimedbadge', name: 'Unclaimed Badge', cat: 'Achievements', icon: 'bell', def: false, desc: 'Live claimable count from the server.' },
    { id: 'claimall', name: 'Claim All', cat: 'Achievements', icon: 'check', def: false, desc: 'Cash in every claimable reward in one click.' },
    { id: 'difficultyfilter', name: 'Difficulty Filter', cat: 'Achievements', icon: 'filter', def: false, desc: 'Easy / Medium / Hard / Legendary chips.' },
    { id: 'categoryfilter', name: 'Category Filter', cat: 'Achievements', icon: 'grid', def: false, desc: 'Filter by the 11 real categories.' },
    { id: 'rewardview', name: 'Reward View', cat: 'Achievements', icon: 'coin', def: false, desc: 'Cash + gem payouts on every achievement.' },
    { id: 'progressbars', name: 'Progress Bars', cat: 'Achievements', icon: 'chart', def: false, desc: 'Server progress toward target values.' },
    { id: 'achcount', name: 'Unlock Counter', cat: 'Achievements', icon: 'hash', def: false, desc: 'Unlocked / total achievement counter.' },
    { id: 'recentunlock', name: 'Recent Unlock', cat: 'Achievements', icon: 'clock', def: false, desc: 'Your latest unlocked achievement card.' },
    { id: 'achsearch', name: 'Ach Search', cat: 'Achievements', icon: 'search', def: false, desc: 'Search the achievement catalog.' },
    // Rewards (9)
    { id: 'dailyrewards', name: 'Daily Rewards', cat: 'Rewards', icon: 'gift', def: false, desc: 'Your claim status and login streak.' },
    { id: 'claimdaily', name: 'Claim Daily', cat: 'Rewards', icon: 'check', def: false, desc: 'Claim the real daily reward + 10 gems.' },
    { id: 'streakcalc', name: 'Streak Math', cat: 'Rewards', icon: 'activity', def: false, desc: 'The 12h/36h streak window, exactly as the server computes it.' },
    { id: 'rewardtiers', name: 'Reward Tiers', cat: 'Rewards', icon: 'list', def: false, desc: 'The real 30-day reward table, $1,200 to $8,500.' },
    { id: 'prestigebonus', name: 'Prestige Bonus', cat: 'Rewards', icon: 'crown', def: false, desc: 'Daily reward multipliers per prestige level.' },
    { id: 'nextclaim', name: 'Next Claim', cat: 'Rewards', icon: 'clock', def: false, desc: 'Live countdown to your next claim window.' },
    { id: 'windowtable', name: 'Claim Window', cat: 'Rewards', icon: 'book', def: false, desc: 'The 12h / 36h claim window rules table.' },
    { id: 'streakday', name: 'Streak Day', cat: 'Rewards', icon: 'hash', def: false, desc: 'Your current streak day highlighted.' },
    { id: 'daymult', name: 'Today Multiplier', cat: 'Rewards', icon: 'zap', def: false, desc: 'Today\'s reward × prestige multiplier.' },
    // Prestige (6)
    { id: 'prestigedesk', name: 'Prestige Desk', cat: 'Prestige', icon: 'crown', def: false, desc: 'Your level, portfolio and what prestige does.' },
    { id: 'prestigecosts', name: 'Cost Ladder', cat: 'Prestige', icon: 'tag', def: false, desc: 'The real $100k to $25M prestige ladder.' },
    { id: 'prestigepost', name: 'Prestige Now', cat: 'Prestige', icon: 'zap', def: false, desc: 'Run the real prestige reset (double-confirmed).' },
    { id: 'prestigeplan', name: 'Prestige Plan', cat: 'Prestige', icon: 'book', def: false, desc: 'Exactly what resets and what survives.' },
    { id: 'prestigemult', name: 'Multiplier Ladder', cat: 'Prestige', icon: 'chart', def: false, desc: 'The ×1.0 → ×2.5 reward multiplier ladder.' },
    { id: 'prestigeprogress', name: 'Prestige Progress', cat: 'Prestige', icon: 'activity', def: false, desc: 'Net worth vs next prestige cost.' },
    // Account (10)
    { id: 'promo', name: 'Promo Codes', cat: 'Account', icon: 'gift', def: false, desc: 'Redeem real promo codes against the server.' },
    { id: 'keystatus', name: 'API Key', cat: 'Account', icon: 'key', def: false, desc: 'Your key status and remaining request budget.' },
    { id: 'blocklist', name: 'Block List', cat: 'Account', icon: 'ban', def: false, desc: 'Everyone you have blocked on the site.' },
    { id: 'mentionprefs', name: 'Mention Settings', cat: 'Account', icon: 'at', def: false, desc: 'Toggle @mention notifications on the site.' },
    { id: 'volumecontrol', name: 'Site Volume', cat: 'Account', icon: 'volume', def: false, desc: 'Set the real site master volume and mute.' },
    { id: 'usernamecheck', name: 'Username Check', cat: 'Account', icon: 'at', def: false, desc: 'Check availability via the real endpoint.' },
    { id: 'keycreate', name: 'Create Key', cat: 'Account', icon: 'plus', def: false, desc: 'Create your API key (one at a time).' },
    { id: 'keyregenerate', name: 'Regenerate Key', cat: 'Account', icon: 'refresh', def: false, desc: 'Rotate your API key (confirmed).' },
    { id: 'dataexport', name: 'Data Export', cat: 'Account', icon: 'download', def: false, desc: 'Download your account data export.' },
    { id: 'blockuser', name: 'Block User', cat: 'Account', icon: 'ban', def: false, desc: 'Block any username on the site (confirmed).' },
    // Client (16)
    { id: 'toasts', name: 'Toasts', cat: 'Client', icon: 'bell', def: false, desc: 'Event notifications inside the client.' },
    { id: 'skeletons', name: 'Skeletons', cat: 'Client', icon: 'grid', def: false, desc: 'Shimmer loading states while data loads.' },
    { id: 'compact', name: 'Compact UI', cat: 'Client', icon: 'sliders', def: false, desc: 'Denser spacing for power users.' },
    { id: 'glowfx', name: 'Glow FX', cat: 'Client', icon: 'sparkle', def: false, desc: 'Extra glow and depth effects around the client.' },
    { id: 'themepick', name: 'Theme', cat: 'Client', icon: 'moon', def: false, desc: 'Auto / dark / light client theme.' },
    { id: 'fontscale', name: 'Font Scale', cat: 'Client', icon: 'zoom', def: false, desc: 'Scale the whole client from 85% to 130%.' },
    { id: 'accentpick', name: 'Accent', cat: 'Client', icon: 'palette', def: false, desc: 'Pick the brand color: red, ember, violet, emerald, cyan.' },
    { id: 'viewmemory', name: 'View Memory', cat: 'Client', icon: 'clock', def: false, desc: 'Reopen the last view you were on.' },
    { id: 'toastpos', name: 'Toast Position', cat: 'Client', icon: 'target', def: false, desc: 'Move toasts to the top-right instead of bottom-right.' },
    { id: 'versiontag', name: 'Version Tag', cat: 'Client', icon: 'tag', def: false, desc: 'The striped version badge in the sidebar.' },
    { id: 'credits', name: 'Credits', cat: 'Client', icon: 'info', def: false, desc: 'The Chromites credits footer and about modal.' },
    { id: 'animation', name: 'Menu Animation', cat: 'Client', icon: 'sparkle', def: false, desc: 'The spring open/close motion for the menu.' },
    { id: 'shadowfx', name: 'Deep Shadow', cat: 'Client', icon: 'moon', def: false, desc: 'Stronger window shadow and depth.' },
    { id: 'autoclose', name: 'Auto Close', cat: 'Client', icon: 'x', def: false, desc: 'Close the menu when clicking the backdrop.' },
    { id: 'keyhints', name: 'Key Hints', cat: 'Client', icon: 'key', def: false, desc: 'RShift / Esc hints in the footer.' },
    { id: 'statusbar', name: 'Status Bar', cat: 'Client', icon: 'activity', def: false, desc: 'Clock and data freshness in the window footer.' },
    // v2.0 - the real-time engine and the platform explorer
    { id: 'realtime', name: 'Real-Time Engine', cat: 'Client', icon: 'zap', def: false, desc: 'Connect to RugPlay public WebSocket: live trades, prices, arcade activity.' },
    { id: 'routers', name: 'Routes Explorer', cat: 'Client', icon: 'book', def: false, desc: 'Searchable reference of every real API route with a try-it runner.' },
    { id: 'largetrade', name: 'Large Trade Alerts', cat: 'Market', icon: 'bell', def: false, desc: 'Toast when a $100k+ trade lands, straight from the live socket.' },
    { id: 'arcadelive', name: 'Arcade Live', cat: 'Gamble', icon: 'dice', def: false, desc: 'Real-time arcade activity feed from the socket.' },
    { id: 'arcadestats', name: 'Arcade Record', cat: 'Gamble', icon: 'chart', def: false, desc: 'Your lifetime arcade wins and losses from /api/user/arcade-stats.' },
    { id: 'hopiumcreate', name: 'Hopium Composer', cat: 'Hopium', icon: 'send', def: false, desc: 'Propose questions with the real rules: $100k+ balance, 2 per hour.' },
    { id: 'achwalls', name: 'Achievement Walls', cat: 'Achievements', icon: 'award', def: false, desc: 'See any trader unlocked achievements from their public profile.' },
    { id: 'siteliveprice', name: 'Site Live Price', cat: 'Site', icon: 'tag', def: false, desc: 'Onsite coin price chip that updates from the live socket.' },
    { id: 'sitelivearcade', name: 'Site Arcade Live', cat: 'Site', icon: 'dice', def: false, desc: 'Onsite live arcade activity chip on /arcade.' },
    { id: 'sitelargetrades', name: 'Site Large Trades', cat: 'Site', icon: 'zap', def: false, desc: 'Onsite latest $100k+ trade chip on every page.' },
  ];

  // ════════════════════════════════════════════════════════════════════
  // Utils
  // ════════════════════════════════════════════════════════════════════

  const $ = (sel, root = document) => root.querySelector(sel);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function createBus() {
    const map = new Map();
    return {
      on(name, fn) {
        if (!map.has(name)) map.set(name, new Set());
        map.get(name).add(fn);
        return () => map.get(name)?.delete(fn);
      },
      emit(name, payload) {
        map.get(name)?.forEach((fn) => {
          try { fn(payload); } catch (e) { console.error('[Candle] listener error', e); }
        });
      },
    };
  }

  function debounce(fn, ms) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  function fmtPrice(n) {
    if (!isFinite(n)) return '-';
    const abs = Math.abs(n);
    if (abs >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
    if (abs >= 1) return n.toLocaleString('en-US', { maximumFractionDigits: 4 });
    if (abs >= 1e-6) return parseFloat(n.toFixed(8)).toString();
    return n.toExponential(2);
  }

  function fmtPct(n) {
    if (!isFinite(n)) return '-';
    const s = n >= 9999999 ? '9,999,999' : (Math.abs(n) >= 100 ? n.toLocaleString('en-US', { maximumFractionDigits: 1 }) : n.toFixed(2));
    return `${n >= 0 ? '+' : ''}${s}%`;
  }

  function fmtDateTime(unix) {
    const d = new Date(unix * 1000);
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function timeAgo(ts) {
    const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
    if (s < 10) return 'just now';
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }

  function countdown(unix) {
    const s = Math.max(0, Math.ceil((unix * 1000 - Date.now()) / 1000));
    return fmtDur(s);
  }

  function fmtDur(s) {
    s = Math.max(0, Math.floor(s));
    if (s >= 86400) return `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h`;
    if (s >= 3600) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
    if (s >= 60) return `${Math.floor(s / 60)}m ${s % 60}s`;
    return `${s}s`;
  }

  // ════════════════════════════════════════════════════════════════════
  // Storage
  // ════════════════════════════════════════════════════════════════════

  const hasGM = typeof GM_getValue === 'function' && typeof GM_setValue === 'function';

  const storage = {
    get(key, fallback) {
      try {
        if (hasGM) {
          const raw = GM_getValue(key);
          return raw === undefined || raw === null ? fallback : raw;
        }
        const raw = localStorage.getItem(key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        if (hasGM) GM_setValue(key, value);
        else localStorage.setItem(key, JSON.stringify(value));
      } catch { /* storage unavailable */ }
    },
  };

  // ════════════════════════════════════════════════════════════════════
  // API client
  // ════════════════════════════════════════════════════════════════════

  class ApiError extends Error {
    constructor(message, status) {
      super(message);
      this.status = status;
    }
  }

  const cache = new Map();
  const inflight = new Map();
  let authed = null;

  function cacheSweep() {
    const cutoff = Date.now() - 5 * 60 * 1000;
    for (const [k, v] of cache) if (v.ts < cutoff) cache.delete(k);
  }

  async function apiGet(path, { ttl = 15000, retries = 1 } = {}) {
    const now = Date.now();
    const hit = cache.get(path);
    if (hit && now - hit.ts < ttl) return hit.data;
    if (inflight.has(path)) return inflight.get(path);

    const run = async () => {
      const res = await fetch(path, {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      });
      let data = null;
      try { data = await res.json(); } catch { /* non-JSON */ }
      if (!res.ok) {
        const msg = (data && (data.message || data.error)) || `HTTP ${res.status}`;
        throw new ApiError(msg, res.status);
      }
      if (data !== null) {
        cache.set(path, { ts: Date.now(), data });
        cacheSweep();
      }
      return data;
    };

    const p = run().finally(() => inflight.delete(path));
    inflight.set(path, p);

    try {
      return await p;
    } catch (e) {
      if (e instanceof ApiError && (e.status >= 500 || e.status === 429) && retries > 0) {
        await sleep(1200);
        return apiGet(path, { ttl, retries: retries - 1 });
      }
      if (e instanceof ApiError && e.status === 401) setAuthed(false);
      throw e;
    }
  }

  async function apiPost(path, body) {
    const res = await fetch(path, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    });
    let data = null;
    try { data = await res.json(); } catch { /* non-JSON */ }
    if (!res.ok) {
      if (res.status === 401) setAuthed(false);
      const msg = (data && (data.message || data.error)) || `HTTP ${res.status}`;
      throw new ApiError(msg, res.status);
    }
    return data;
  }

  async function apiPatch(path, body) {
    const res = await fetch(path, {
      method: 'PATCH',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    });
    let data = null;
    try { data = await res.json(); } catch { /* non-JSON */ }
    if (!res.ok) {
      if (res.status === 401) setAuthed(false);
      const msg = (data && (data.message || data.error)) || `HTTP ${res.status}`;
      throw new ApiError(msg, res.status);
    }
    return data;
  }

  function setAuthed(v) {
    if (authed !== v) {
      authed = v;
      bus.emit('auth', v);
    }
  }

  async function checkAuth(force) {
    if (authed !== null && !force) return authed;
    try {
      await apiGet('/api/portfolio/total', { ttl: 300000 });
      setAuthed(true);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setAuthed(false);
      else setAuthed(authed !== null ? authed : false);
    }
    return authed;
  }

  // ════════════════════════════════════════════════════════════════════
  // Real-time engine - RugPlay's public WebSocket (wss://ws.rugplay.com)
  // Protocol from the repo (website/websocket/src/main.ts):
  //   send {type:'subscribe',channel:'trades:all'|'trades:large'}, {type:'set_coin',coinSymbol}, {type:'set_user',userId}
  //   recv live-trade / all-trades / price_update / arcade_activity /
  //        new_comment / comment_liked / notification / ping
  // ════════════════════════════════════════════════════════════════════

  let ws = null;
  let wsTimer = null;
  let wsReconnectTimer = null;
  let wsAlive = false;
  let wsMyId = null;

  function wsUrl() {
    // the live site injects PUBLIC_WEBSOCKET_URL into its inline env config
    try {
      const html = document.documentElement.outerHTML;
      const m = html.match(/PUBLIC_WEBSOCKET_URL"?:\s*"([^"]+)"/);
      if (m && m[1]) return m[1].replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
    } catch (e) { /* fall through to default */ }
    return 'wss://ws.rugplay.com';
  }

  function wsSend(obj) {
    if (ws && ws.readyState === 1) {
      try { ws.send(JSON.stringify(obj)); } catch (e) { /* ignore */ }
    }
  }

  function wsScheduleReconnect() {
    if (wsReconnectTimer) return;
    wsReconnectTimer = setTimeout(() => {
      wsReconnectTimer = null;
      wsConnect();
    }, 5000);
  }

  function wsConnect() {
    if (ws && (ws.readyState === 0 || ws.readyState === 1)) return;
    try {
      ws = new WebSocket(wsUrl());
    } catch (e) {
      wsScheduleReconnect();
      return;
    }
    ws.onopen = () => {
      wsAlive = true;
      bus.emit('ws', true);
      wsSend({ type: 'subscribe', channel: 'trades:all' });
      wsSend({ type: 'subscribe', channel: 'trades:large' });
      wsSend({ type: 'set_coin', coinSymbol: '@global' });
      if (wsMyId) wsSend({ type: 'set_user', userId: String(wsMyId) });
    };
    ws.onmessage = (ev) => {
      let m = null;
      try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (!m || !m.type) return;
      if (m.type === 'ping') { wsSend({ type: 'pong' }); return; }
      bus.emit('ws:' + m.type, m);
    };
    ws.onclose = () => {
      wsAlive = false;
      bus.emit('ws', false);
      ws = null;
      wsScheduleReconnect();
    };
    ws.onerror = () => { try { ws.close(); } catch (e) { /* ignore */ } };
  }

  function wsStart() {
    if (wsTimer) return;
    wsConnect();
    wsTimer = setInterval(() => {
      if (ws && ws.readyState === 2) wsConnect();
    }, 15000);
  }

  function wsStop() {
    if (wsTimer) { clearInterval(wsTimer); wsTimer = null; }
    if (wsReconnectTimer) { clearTimeout(wsReconnectTimer); wsReconnectTimer = null; }
    if (ws) { try { ws.close(); } catch (e) { /* ignore */ } ws = null; }
    wsAlive = false;
    bus.emit('ws', false);
  }

  // ════════════════════════════════════════════════════════════════════
  // State - settings, mods, watchlist, alerts
  // ════════════════════════════════════════════════════════════════════

  const bus = createBus();

  let settings = { ...DEFAULT_SETTINGS, ...(storage.get('candle:settings', {}) || {}) };

  function defaultMods() {
    const m = {};
    MODS.forEach((x) => { m[x.id] = x.def; });
    return m;
  }

  let mods = { ...defaultMods(), ...(storage.get('candle:mods', {}) || {}) };

  function isMod(id) {
    return mods[id] !== false;
  }

  function toggleMod(id) {
    mods[id] = !isMod(id);
    storage.set('candle:mods', mods);
    bus.emit('mods', id);
  }

  function saveSettings() {
    storage.set('candle:settings', settings);
    bus.emit('settings', settings);
  }

  function getWatchlist() {
    return storage.get('candle:watchlist', []) || [];
  }
  function setWatchlist(list) {
    storage.set('candle:watchlist', list);
    bus.emit('watchlist', list);
  }
  function isWatched(sym) {
    return getWatchlist().includes(sym);
  }
  // friends & ranks - local labels, stored in the client, never forged server-side
  const RANK_TAGS = ['Friend', 'Whale', 'Watch', 'Rival'];
  function getFriends() {
    return storage.get('candle:friends', []) || [];
  }
  function saveFriends(list) {
    storage.set('candle:friends', list);
    bus.emit('friends', list);
  }
  function friendRank(username) {
    if (!username) return null;
    const f = getFriends().find((x) => String(x.username).toLowerCase() === String(username).toLowerCase());
    return f ? f.tag : null;
  }
  function rankChip(username) {
    const tag = friendRank(username);
    if (!tag) return null;
    return h('span', { class: 'rank-chip tag-' + tag.toLowerCase() }, tag);
  }
  function toggleWatch(sym) {
    const list = getWatchlist();
    const next = list.includes(sym) ? list.filter((s) => s !== sym) : [...list, sym];
    setWatchlist(next);
    return next.includes(sym);
  }

  function getAlerts() {
    return storage.get('candle:alerts', []) || [];
  }
  function setAlerts(list) {
    storage.set('candle:alerts', list);
    bus.emit('alerts', list);
  }
  function addAlert(a) {
    setAlerts([...getAlerts(), a]);
  }
  function removeAlert(id) {
    setAlerts(getAlerts().filter((a) => a.id !== id));
  }

  // ════════════════════════════════════════════════════════════════════
  // Icons
  // ════════════════════════════════════════════════════════════════════

  const ICONS = {
    candle: '<path d="M12 3.5c1.9 2.3 3.8 4 3.8 6.6A3.8 3.8 0 0 1 8.2 10c0-2.6 1.9-4.3 3.8-6.5z"/><rect x="9.2" y="12.4" width="5.6" height="6.4" rx="1"/><path d="M10.6 12.4h.8M12.6 12.4h.8" stroke-width="1.2"/>',
    activity: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
    bars: '<path d="M4 20V10M10 20V4M16 20v-6M22 20V7"/>',
    star: '<path d="M12 2.6l2.8 5.7 6.3.9-4.6 4.5 1.1 6.3L12 17.1l-5.6 2.9 1.1-6.3-4.6-4.5 6.3-.9L12 2.6z"/>',
    starFilled: '<path fill="currentColor" stroke="none" d="M12 2.6l2.8 5.7 6.3.9-4.6 4.5 1.1 6.3L12 17.1l-5.6 2.9 1.1-6.3-4.6-4.5 6.3-.9L12 2.6z"/>',
    trend: '<path d="M3 17l5-5 4 4 8-8"/><path d="M14 8h6v6"/>',
    trophy: '<path d="M8 21h8M12 17v4M7 4h10v6a5 5 0 0 1-10 0V4z"/><path d="M7 6H4.5A1.5 1.5 0 0 0 6 9h1M17 6h2.5A1.5 1.5 0 0 1 18 9h-1"/>',
    award: '<circle cx="12" cy="9" r="5.5"/><path d="M8.8 13.6L7.8 21.5l4.2-2.7 4.2 2.7-1-7.9"/>',
    wallet: '<path d="M4 6h13a2 2 0 0 1 2 2v10H5a2 2 0 0 1-2-2V6z"/><path d="M4 6V5a1 1 0 0 1 1-1h10"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
    zap: '<path d="M13 3L5 13h6l-1 8 8-10h-6l1-8z"/>',
    sliders: '<path d="M4 8h9M17 8h3M4 16h3M11 16h9"/><circle cx="15.5" cy="8" r="1.8"/><circle cx="8.5" cy="16" r="1.8"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    back: '<path d="M14 6l-6 6 6 6"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/>',
    warning: '<path d="M12 3.5L21 20H3L12 3.5z"/><path d="M12 10v4"/><circle cx="12" cy="17.4" r="0.4"/>',
    external: '<path d="M14 5h5v5M19 5l-8 8"/><path d="M19 13v6H5V5h6"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4"/><circle cx="12" cy="8.2" r="0.4"/>',
    send: '<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/>',
    dice: '<rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="8.5" cy="9.5" r="1"/><circle cx="15.5" cy="9.5" r="1"/><circle cx="8.5" cy="14.5" r="1"/><circle cx="15.5" cy="14.5" r="1"/>',
    coin: '<circle cx="12" cy="12" r="9"/><path d="M12 7v10M9 9.5h6"/>',
    gauge: '<path d="M12 14l4-4"/><path d="M4 18a9 9 0 1 1 16 0"/>',
    tag: '<path d="M20 12l-8 8-9-9V4h7l10 8z"/><circle cx="8.5" cy="8.5" r="1"/>',
    radar: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><path d="M12 12l5-5"/><circle cx="12" cy="12" r="1"/>',
    droplet: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
    crown: '<path d="M3 7l4.5 4L12 5l4.5 6L21 7l-1.5 11h-15L3 7z"/>',
    calendar: '<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
    flame: '<path d="M12 3c2.2 2.6 4.4 4.7 4.4 7.6a4.4 4.4 0 0 1-8.8 0C7.6 7.7 9.8 5.6 12 3z"/><path d="M9.5 15.5a3 3 0 0 0 5 0"/>',
    skull: '<circle cx="9" cy="12" r="5"/><circle cx="15" cy="12" r="5"/><path d="M9 17v3h2v-2M15 17v3h-2v-2M9 17H7v-1M15 17h2v-1"/>',
    bomb: '<circle cx="10" cy="14" r="6"/><path d="M14 10l4-4M15 4h5v5"/>',
    layers: '<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-6M22 20V7"/>',
    grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
    book: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4z"/><path d="M5 17a3 3 0 0 1 3-3h11"/>',
    heart: '<path d="M12 20s-7-4.5-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.5-9 9-9 9z"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.5-6 8-6s8 2 8 6"/>',
    key: '<circle cx="8" cy="14" r="4.5"/><path d="M11.5 10.5L20 2M16 6l3 3"/>',
    sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z"/><path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15z"/>',
    arrowdown: '<path d="M12 5v14M6 13l6 6 6-6"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    check: '<path d="M5 13l4 4L19 7"/>',
    rocket: '<path d="M12 2s5 3.5 5 9c0 3-1 5.5-1 5.5h-8s-1-2.5-1-5.5c0-5.5 5-9 5-9z"/><path d="M9 13.5s.5 5-2 8c3-1 5-3 5-3M15 13.5s-.5 5 2 8c-3-1-5-3-5-3"/>',
    moon: '<path d="M20 13A8 8 0 1 1 11 4a6.5 6.5 0 0 0 9 9z"/>',
    zoom: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/><path d="M11 8v6M8 11h6"/>',
    palette: '<path d="M12 3a9 9 0 1 0 0 18c1.2 0 1.8-.9 1.4-1.8-.6-1.4.9-2.4 2.1-1.7 1 .6 2 .2 2-1.5A8.5 8.5 0 0 0 12 3z"/><circle cx="8" cy="10" r="1"/><circle cx="12" cy="7.5" r="1"/><circle cx="16" cy="10" r="1"/>',
    box: '<path d="M3 8l9-4 9 4v8l-9 4-9-4V8z"/><path d="M3 8l9 4 9-4M12 12v8"/>',
    unlock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.7-1.4"/>',
    ban: '<circle cx="12" cy="12" r="9"/><path d="M5.5 5.5l13 13"/>',
    at: '<circle cx="12" cy="12" r="4"/><path d="M16 12v1.5a2.5 2.5 0 0 0 5 0V12a9 9 0 1 0-3.2 6.9"/>',
    volume: '<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>',
    gift: '<rect x="4" y="9" width="16" height="11" rx="1.5"/><path d="M12 9v11M4 13h16M12 9s-1-5-4-5c-2 0-3 1.5-3 3.5S9 9 12 9zm0 0s1-5 4-5c2 0 3 1.5 3 3.5S15 9 12 9z"/>',
    calculator: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01"/>',
    percent: '<path d="M19 5L5 19"/><circle cx="7.5" cy="7.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z"/><path d="M9 12l2 2 4-4"/>',
    filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
    diamond: '<path d="M12 3l8 9-8 9-8-9 8-9z"/><path d="M4.5 12h15M12 3l-3 9 3 9 3-9-3-9z"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
  };

  function icon(name, size = 16) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', String(size));
    svg.setAttribute('height', String(size));
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.7');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = ICONS[name] || '';
    return svg;
  }

  // ════════════════════════════════════════════════════════════════════
  // DOM helper
  // ════════════════════════════════════════════════════════════════════

  function h(tag, props = {}, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k in el && k !== 'list' && k !== 'type') el[k] = v;
      else el.setAttribute(k, String(v));
    }
    for (const c of children.flat(Infinity)) {
      if (c === undefined || c === null || c === false) continue;
      el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    }
    return el;
  }

  // ════════════════════════════════════════════════════════════════════
  // UI kit
  // ════════════════════════════════════════════════════════════════════

  function sectionTitle(label, iconName, right) {
    return h('div', { class: 'sec-head' },
      h('span', { class: 'sec-ico' }, icon(iconName, 13)),
      h('span', { class: 'sec-title' }, label),
      right || null,
    );
  }

  function skeleton(width = '100%', height = '10px') {
    // Skeletons mod: off = plain block, no shimmer
    return h('div', { class: isMod('skeletons') ? 'skel' : 'skel skel-off', style: `width:${width};height:${height}` });
  }

  function emptyState(title, hint, iconName = 'info') {
    return h('div', { class: 'state' },
      h('div', { class: 'state-icon' }, icon(iconName, 20)),
      h('div', { class: 'state-title' }, title),
      hint ? h('div', { class: 'state-hint' }, hint) : null,
    );
  }

  function errorState(message, retryFn) {
    return h('div', { class: 'state' },
      h('div', { class: 'state-icon err' }, icon('warning', 20)),
      h('div', { class: 'state-title' }, 'Something went wrong'),
      h('div', { class: 'state-hint' }, message),
      retryFn ? h('button', { class: 'btn btn-ghost', onclick: retryFn }, icon('refresh', 13), ' Retry') : null,
    );
  }

  function changeEl(n) {
    const cls = n >= 0 ? 'up' : 'down';
    return h('span', { class: `mono ${cls}` }, `${n >= 0 ? '▲' : '▼'} ${fmtPct(n)}`);
  }

  function heatEl(n) {
    if (!isMod('heatrow')) return changeEl(n);
    // heat scale: 0% → muted, big moves → saturated accent
    const abs = Math.min(Math.abs(num(n, 0)) / 300, 1);
    const col = n >= 0 ? `rgba(52,211,153,${(0.55 + abs * 0.45).toFixed(3)})` : `rgba(248,113,113,${(0.55 + abs * 0.45).toFixed(3)})`;
    return h('span', { class: 'mono', style: `color:${col};font-weight:${abs > 0.5 ? 800 : 600}` }, `${n >= 0 ? '▲' : '▼'} ${fmtPct(n)}`);
  }

  function switchEl(on, onChange) {
    return h('button', {
      class: `sw ${on ? 'on' : ''}`,
      role: 'switch',
      'aria-checked': on ? 'true' : 'false',
      onclick: (ev) => {
        ev.stopPropagation();
        onChange(!on);
      },
    }, h('span', { class: 'sw-thumb' }));
  }

  // two-step confirm button - a deliberate second click before any write
  function confirmBtn(label, onConfirm, opts = {}) {
    const btn = h('button', { class: opts.cls || 'btn btn-primary' }, label);
    let armed = false;
    let armTimer = null;
    btn.addEventListener('click', async () => {
      if (!armed) {
        armed = true;
        btn.textContent = opts.confirm || 'Confirm?';
        btn.classList.add('armed');
        armTimer = setTimeout(() => {
          armed = false;
          btn.textContent = label;
          btn.classList.remove('armed');
        }, 3500);
        return;
      }
      clearTimeout(armTimer);
      armed = false;
      btn.disabled = true;
      btn.textContent = label;
      btn.classList.remove('armed');
      try {
        await onConfirm(btn);
      } catch (e) {
        toast('error', opts.errTitle || 'Action failed', e.message || 'Could not complete action');
      } finally {
        btn.disabled = false;
      }
    });
    return btn;
  }

  function toast(type, title, message, duration = 2600) {
    if (!isMod('toasts')) return;
    const box = $('.candle-toasts', shadow);
    if (!box) return;
    box.classList.toggle('toast-tr', (settings.toastPos || 'br') === 'tr');
    const el = h('div', { class: `toast toast-${type}`, role: 'status' },
      h('div', { class: 'toast-icon' }, icon(type === 'error' ? 'warning' : type === 'success' ? 'zap' : 'info', 15)),
      h('div', { class: 'toast-body' },
        h('div', { class: 'toast-title' }, title),
        message ? h('div', { class: 'toast-msg' }, message) : null,
      ),
    );
    box.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 220);
    }, duration);
  }

  // ════════════════════════════════════════════════════════════════════
  // AMM math (mirrors the server: x*y=k, 0.3% fee)
  // ════════════════════════════════════════════════════════════════════

  function estimateBuy(amount, poolCoin, poolBase) {
    const fee = amount * SWAP_FEE;
    const into = amount - fee;
    const k = poolCoin * poolBase;
    const nb = poolBase + into;
    const nc = k / nb;
    const coins = poolCoin - nc;
    const price = poolBase / poolCoin;
    const newPrice = nb / nc;
    return { coins, newPrice, impact: ((newPrice - price) / price) * 100, fee };
  }

  function estimateSell(coinQty, poolCoin, poolBase) {
    const actual = Math.min(coinQty, poolCoin * 0.995);
    const k = poolCoin * poolBase;
    const nc = poolCoin + actual;
    const nb = k / nc;
    const gross = poolBase - nb;
    const fee = gross * SWAP_FEE;
    const price = poolBase / poolCoin;
    const newPrice = nb / nc;
    return { received: gross - fee, newPrice, impact: ((newPrice - price) / price) * 100, fee };
  }

  function impactTone(impact) {
    if (impact <= 1) return 'good';
    if (impact <= 5) return 'mid';
    return 'bad';
  }

  // ════════════════════════════════════════════════════════════════════
  // Arcade EV - exact rules from the server source
  // ════════════════════════════════════════════════════════════════════

  const EV = {
    dice() {
      const p = 1 / 6;
      const mult = 3;
      return { label: 'Dice · pick 1-6', chance: p, mult, ev: p * mult, edge: p * mult - 1 };
    },
    coinflip() {
      const p = 1 / 2;
      const mult = 2;
      return { label: 'Coinflip', chance: p, mult, ev: p * mult, edge: p * mult - 1 };
    },
    slots() {
      // 6 symbols: 3-of-a-kind x5 (P = 1/36), 2-of-a-kind x2 (P = 5/12)
      const p3 = 1 / 36, p2 = 5 / 12;
      const ev = p3 * 5 + p2 * 2;
      return { label: 'Slots · 6 symbols', p3, p2, ev, edge: ev - 1 };
    },
    mines(picks, mines) {
      const TILES = 25;
      let p = 1;
      for (let i = 0; i < picks; i++) p *= (TILES - mines - i) / (TILES - i);
      const mult = p > 0 ? (1 / p) * 0.95 : 1;
      return { label: `Mines · ${mines} mines`, p, mult, ev: 0.95, edge: -0.05 };
    },
    tower(floor, diff) {
      const cfg = { easy: { tiles: 3, bombs: 1 }, medium: { tiles: 4, bombs: 2 }, hard: { tiles: 5, bombs: 3 } };
      const c = cfg[diff];
      const safe = c.tiles - c.bombs;
      const p = Math.pow(safe / c.tiles, floor);
      const mult = p > 0 ? Math.max(1, (1 / p) * 0.95) : 1;
      return { label: `Tower · ${diff}`, p, mult, ev: 0.95, edge: -0.05 };
    },
  };

  function evRow(label, value, tone) {
    return h('div', { class: 'ev-row' },
      h('span', { class: 'ev-k' }, label),
      h('span', { class: `ev-v mono ${tone || ''}` }, value),
    );
  }

  // ════════════════════════════════════════════════════════════════════
  // Normalizers - every endpoint is read defensively
  // ════════════════════════════════════════════════════════════════════

  function num(v, d = 0) {
    const n = typeof v === 'string' ? parseFloat(v) : v;
    return isFinite(n) ? n : d;
  }

  function asArray(x) {
    if (Array.isArray(x)) return x;
    if (x && Array.isArray(x.data)) return x.data;
    if (x && Array.isArray(x.items)) return x.items;
    if (x && Array.isArray(x.results)) return x.results;
    if (x && Array.isArray(x.coins)) return x.coins;
    if (x && Array.isArray(x.questions)) return x.questions;
    if (x && Array.isArray(x.users)) return x.users;
    if (x && Array.isArray(x.achievements)) return x.achievements;
    if (x && Array.isArray(x.trades)) return x.trades;
    if (x && Array.isArray(x.comments)) return x.comments;
    if (x && Array.isArray(x.notifications)) return x.notifications;
    if (x && Array.isArray(x.holdings)) return x.holdings;
    if (x && Array.isArray(x.holders)) return x.holders;
    if (x && Array.isArray(x.transactions)) return x.transactions;
    if (x && Array.isArray(x.candlestickData)) return x.candlestickData;
    if (x && Array.isArray(x.volumeData)) return x.volumeData;
    if (x && Array.isArray(x.probabilityHistory)) return x.probabilityHistory;
    if (x && Array.isArray(x.topRugpullers)) return x.topRugpullers;
    if (x && Array.isArray(x.biggestLosers)) return x.biggestLosers;
    return [];
  }

  function fmtQty(n) {
    if (!isFinite(n)) return '-';
    const abs = Math.abs(n);
    if (abs >= 1e9) return (n / 1e9).toFixed(2) + 'B';
    if (abs >= 1e6) return (n / 1e6).toFixed(2) + 'M';
    if (abs >= 1e3) return (n / 1e3).toFixed(2) + 'K';
    return parseFloat(n.toFixed(4)).toString();
  }

  function fmtBuss(n) {
    if (!isFinite(n)) return '-';
    return '$' + (n >= 1000 ? n.toLocaleString('en-US', { maximumFractionDigits: 2 }) : n.toFixed(2));
  }

  function fmtShort(n) {
    if (!isFinite(n)) return '-';
    const abs = Math.abs(n);
    if (abs >= 1e12) return (n / 1e12).toFixed(2) + 'T';
    if (abs >= 1e9) return (n / 1e9).toFixed(2) + 'B';
    if (abs >= 1e6) return (n / 1e6).toFixed(2) + 'M';
    if (abs >= 1e3) return (n / 1e3).toFixed(2) + 'K';
    return n.toFixed(2);
  }

  // squarified treemap layout - same visual language as rugplay.com/treemap
  function treemapLayout(items, W, H) {
    const results = [];
    const vals = items.map((it) => ({ ...it, value: Math.max(it.value, 0) }));
    const total = vals.reduce((s, it) => s + it.value, 0) || 1;
    const norm = vals.map((it) => ({ ...it, value: (it.value / total) * W * H }));
    const sorted = norm.slice().sort((a, b) => b.value - a.value);
    let x = 0, y = 0, w = W, h = H;
    let row = [];
    let i = 0;

    const worst = (r, len) => {
      const s = r.reduce((a, b) => a + b.value, 0);
      if (!s) return Infinity;
      const mx = Math.max(...r.map((b) => b.value));
      const mn = Math.min(...r.map((b) => b.value));
      return Math.max((len * len * mx) / (s * s), (s * s) / (len * len * mn));
    };
    const layoutRow = (r) => {
      const s = r.reduce((a, b) => a + b.value, 0);
      if (!s) return;
      const len = w >= h ? w : h;
      const side = s / len;
      let ox = x, oy = y;
      if (w >= h) {
        r.forEach((b) => {
          const bh = (b.value / s) * len;
          results.push({ x: ox, y: oy, w: side, h: bh, item: b });
          oy += bh;
        });
        x += side; w -= side;
      } else {
        r.forEach((b) => {
          const bw = (b.value / s) * len;
          results.push({ x: ox, y: oy, w: bw, h: side, item: b });
          ox += bw;
        });
        y += side; h -= side;
      }
    };

    while (i < sorted.length && w > 2 && h > 2) {
      const len = w >= h ? w : h;
      const cur = row.length ? worst(row, len) : Infinity;
      const next = sorted[i];
      const trial = [...row, next];
      if (cur === Infinity || worst(trial, len) <= cur) {
        row = trial;
        i += 1;
        if (i === sorted.length) layoutRow(row);
      } else {
        layoutRow(row);
        row = [next];
        i += 1;
        if (i === sorted.length) layoutRow(row);
      }
    }
    if (row.length && w > 2 && h > 2) layoutRow(row);
    return results;
  }

  // ════════════════════════════════════════════════════════════════════
  // The emblem - Candle's brand mark
  // ════════════════════════════════════════════════════════════════════

  const LOGO_MARKUP = `
    <defs>
      <radialGradient id="lg-glow" cx="0.5" cy="0.38" r="0.62">
        <stop offset="0" stop-color="#ef4444" stop-opacity="0.55"/>
        <stop offset="1" stop-color="#ef4444" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="lg-brd" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#f87171"/>
        <stop offset="0.55" stop-color="#dc2626"/>
        <stop offset="1" stop-color="#7f1d1d"/>
      </linearGradient>
      <linearGradient id="lg-flm" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0" stop-color="#fca5a5"/>
        <stop offset="0.5" stop-color="#ef4444"/>
        <stop offset="1" stop-color="#fecaca"/>
      </linearGradient>
    </defs>
    <circle cx="32" cy="31" r="29" fill="url(#lg-glow)"/>
    <path d="M32 6.5 53.5 19v26L32 57.5 10.5 45V19Z" fill="#181818" stroke="url(#lg-brd)" stroke-width="2.6"/>
    <path d="M32 11.5 49 21.4v21.2L32 52.5 15 42.6V21.4Z" fill="none" stroke="#ffffff" stroke-opacity="0.05" stroke-width="1"/>
    <g transform="translate(17 9) scale(1.4)">
      <path d="M12 3.5c1.9 2.3 3.8 4 3.8 6.6A3.8 3.8 0 0 1 8.2 10c0-2.6 1.9-4.3 3.8-6.5z" fill="url(#lg-flm)"/>
      <rect x="9.2" y="12.4" width="5.6" height="6.4" rx="1" fill="#fafafa"/>
      <path d="M11 18.8v2.6" stroke="#f87171" stroke-width="1.1" stroke-linecap="round"/>
    </g>
    <g>
      <rect x="21.5" y="43" width="5" height="10" rx="1.2" fill="#ef4444" opacity="0.55"/>
      <rect x="29.5" y="38" width="5" height="15" rx="1.2" fill="#ef4444"/>
      <rect x="37.5" y="45" width="5" height="8" rx="1.2" fill="#f87171" opacity="0.4"/>
    </g>
  `;

  function logoMark(size = 34) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 64 64');
    svg.setAttribute('width', String(size));
    svg.setAttribute('height', String(size));
    svg.setAttribute('class', 'logo-mark');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = LOGO_MARKUP;
    return svg;
  }

  // ════════════════════════════════════════════════════════════════════
  // Sparkline
  // ════════════════════════════════════════════════════════════════════

  function sparkline(prices, { w = 110, h = 30, up = true } = {}) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('width', String(w));
    svg.setAttribute('height', String(h));
    svg.setAttribute('preserveAspectRatio', 'none');
    if (!prices || prices.length < 2) {
      svg.innerHTML = `<rect x="0" y="0" width="${w}" height="${h}" rx="3" fill="#262626"/>`;
      return svg;
    }
    const lo = Math.min(...prices), hi = Math.max(...prices);
    const span = hi - lo || hi * 0.01 || 1;
    const pts = prices.map((p, i) => `${(i / (prices.length - 1)) * w},${h - 3 - ((p - lo) / span) * (h - 6)}`).join(' ');
    const col = up ? '#34d399' : '#ef4444';
    svg.innerHTML = `<polyline points="${pts}" fill="none" stroke="${col}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`;
    return svg;
  }

  // ════════════════════════════════════════════════════════════════════
  // Candle chart - server-aggregated candles + volume, crosshair tooltip
  // ════════════════════════════════════════════════════════════════════

  function candleChart(candles, volumes, height = 250) {
    const W = 900;
    const box = h('div', { class: 'chart-box', style: `height:${height}px` });
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${height}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('class', 'chart-svg');
    box.appendChild(svg);

    if (!candles || candles.length === 0) {
      box.appendChild(emptyState('No chart data yet', 'Candles appear as soon as trades land', 'trend'));
      return box;
    }

    const tip = h('div', { class: 'chart-tip' });
    const cross = h('div', { class: 'chart-cross' });
    box.appendChild(tip);
    box.appendChild(cross);

    const pad = { t: 12, r: 8, b: 16, l: 8 };
    const pw = W - pad.l - pad.r;
    const ph = height - pad.t - pad.b;

    let lo = Infinity, hi = -Infinity;
    candles.forEach((c) => { lo = Math.min(lo, c.low); hi = Math.max(hi, c.high); });
    const span = hi - lo || hi * 0.01 || 1;
    const y = (p) => pad.t + ph - ((p - lo) / span) * ph;
    const cw = pw / candles.length;
    const bodyW = Math.max(1.5, Math.min(10, cw * 0.62));

    let maxVol = 0;
    if (volumes) volumes.forEach((v) => { maxVol = Math.max(maxVol, num(v.volume)); });

    const NS = 'http://www.w3.org/2000/svg';
    candles.forEach((c, i) => {
      const x = pad.l + i * cw;
      const cx = x + cw / 2;
      const up = c.close >= c.open;
      const col = up ? '#34d399' : '#ef4444';

      if (maxVol > 0 && volumes && volumes[i]) {
        const vh = Math.max(2, (num(volumes[i].volume) / maxVol) * 26);
        const vr = document.createElementNS(NS, 'rect');
        vr.setAttribute('x', String(x));
        vr.setAttribute('y', String(height - pad.b + 2));
        vr.setAttribute('width', String(Math.max(1, cw - 2)));
        vr.setAttribute('height', String(vh));
        vr.setAttribute('fill', up ? '#34d399' : '#ef4444');
        vr.setAttribute('opacity', '0.28');
        svg.appendChild(vr);
      }

      const wick = document.createElementNS(NS, 'line');
      wick.setAttribute('x1', String(cx));
      wick.setAttribute('y1', String(y(c.high)));
      wick.setAttribute('x2', String(cx));
      wick.setAttribute('y2', String(y(c.low)));
      wick.setAttribute('stroke', col);
      wick.setAttribute('stroke-width', '1.2');
      wick.setAttribute('vector-effect', 'non-scaling-stroke');
      svg.appendChild(wick);

      const yo = y(c.open), yc = y(c.close);
      const body = document.createElementNS(NS, 'rect');
      body.setAttribute('x', String(cx - bodyW / 2));
      body.setAttribute('y', String(Math.min(yo, yc)));
      body.setAttribute('width', String(bodyW));
      body.setAttribute('height', String(Math.max(1.5, Math.abs(yc - yo))));
      body.setAttribute('fill', col);
      body.setAttribute('rx', '1');
      svg.appendChild(body);
    });

    let lastIdx = -1;
    box.addEventListener('mousemove', (ev) => {
      const rect = box.getBoundingClientRect();
      const frac = (ev.clientX - rect.left) / rect.width;
      const idx = Math.max(0, Math.min(candles.length - 1, Math.floor(frac * candles.length)));
      if (idx !== lastIdx) {
        lastIdx = idx;
        const c = candles[idx];
        const ch = c.close >= c.open ? 'up' : 'down';
        tip.innerHTML = '';
        tip.appendChild(h('div', { class: 'chart-tip-t' }, fmtDateTime(c.time)));
        tip.appendChild(evRow('O', fmtPrice(c.open)));
        tip.appendChild(evRow('H', fmtPrice(c.high)));
        tip.appendChild(evRow('L', fmtPrice(c.low)));
        tip.appendChild(evRow('C', fmtPrice(c.close), ch));
        tip.style.display = 'block';
        cross.style.display = 'block';
        cross.style.left = `${(idx / candles.length) * 100}%`;
      }
      const tipW = tip.offsetWidth || 150;
      let left = ev.clientX - rect.left - tipW / 2;
      left = Math.max(4, Math.min(rect.width - tipW - 4, left));
      tip.style.left = `${left}px`;
      tip.style.top = `${Math.max(4, ev.clientY - rect.top - tip.offsetHeight - 10)}px`;
    });
    box.addEventListener('mouseleave', () => {
      tip.style.display = 'none';
      cross.style.display = 'none';
      lastIdx = -1;
    });

    return box;
  }

  // ════════════════════════════════════════════════════════════════════
  // Small shared bits
  // ════════════════════════════════════════════════════════════════════

  function avatar(name, size = 26) {
    const letter = (name || '?').trim().charAt(0).toUpperCase() || '?';
    return h('div', { class: 'avatar', style: `width:${size}px;height:${size}px;font-size:${Math.round(size * 0.5)}px` }, letter);
  }

  // the real shop catalog name colors, rendered as CSS
  function nameColorStyle(key) {
    const G = {
      green: 'color:#22c55e', blue: 'color:#3b82f6', orange: 'color:#fb923c',
      purple: 'color:#a855f7', red: 'color:#ef4444', gold: 'color:#eab308',
      fire: 'background:linear-gradient(90deg,#f97316,#ef4444,#f59e0b);-webkit-background-clip:text;background-clip:text;color:transparent',
      ocean: 'background:linear-gradient(90deg,#06b6d4,#3b82f6,#8b5cf6);-webkit-background-clip:text;background-clip:text;color:transparent',
      rainbow: 'background:linear-gradient(90deg,#ef4444,#f97316,#eab308,#22c55e,#3b82f6,#8b5cf6,#ec4899);-webkit-background-clip:text;background-clip:text;color:transparent',
      diamond: 'background:linear-gradient(135deg,#e2e8f0,#67e8f9,#c084fc,#e2e8f0);-webkit-background-clip:text;background-clip:text;color:transparent',
    };
    return G[key] || null;
  }

  function badge(text, cls = '') {
    return h('span', { class: `badge ${cls}` }, text);
  }

  function statCell(label, value, sub) {
    return h('div', { class: 'stat' },
      h('div', { class: 'stat-label' }, label),
      h('div', { class: 'stat-value mono' }, value),
      sub ? h('div', { class: 'stat-sub' }, sub) : null,
    );
  }

  function profileModal(username) {
    const wrap = h('div', { class: 'modal-back' },
      h('div', { class: 'modal' },
        h('div', { class: 'modal-head' },
          h('span', { class: 'modal-title' }, 'Trader'),
          h('button', { class: 'traffic-mini', onclick: () => wrap.remove() }, icon('x', 13)),
        ),
        h('div', { class: 'modal-body' }, skeleton()),
      ),
    );
    wrap.addEventListener('click', (ev) => { if (ev.target === wrap) wrap.remove(); });
    $('.candle-window', shadow).appendChild(wrap);

    apiGet(`/api/user/${encodeURIComponent(username)}`, { ttl: 30000 })
      .then((d) => {
        const u = d && (d.user || d);
        const body = $('.modal-body', wrap);
        if (!u || !u.username) {
          body.innerHTML = '';
          body.appendChild(emptyState('Profile unavailable', 'This user hides their profile', 'user'));
          return;
        }
        const rows = [
          ['Username', u.username],
          ['Name', u.name || '-'],
          ['Joined', u.joinedAt ? fmtDateTime(new Date(u.joinedAt).getTime() / 1000) : '-'],
        ];
        body.innerHTML = '';
        body.appendChild(h('div', { class: 'profile-row' }, avatar(u.username, 40), h('div', { class: 'profile-meta' },
          h('div', { class: 'profile-name' }, u.name || u.username, u.founderBadge && isMod('founderbadge') ? h('span', { class: 'mini-tag' }, 'founder') : null),
          h('div', { class: 'profile-username' }, '@' + u.username),
        )));
        rows.forEach(([k, v]) => body.appendChild(evRow(k, v)));
        if (isMod('userstats')) {
          if (u.prestigeLevel !== undefined && u.prestigeLevel !== null) body.appendChild(evRow('Prestige', String(u.prestigeLevel)));
          if (u.totalPortfolioValue !== undefined) body.appendChild(evRow('Net worth', fmtBuss(num(u.totalPortfolioValue))));
          if (u.totalCoinsCreated !== undefined) body.appendChild(evRow('Coins created', String(u.totalCoinsCreated)));
        }
        if (isMod('profileachievements')) {
          const achRow = h('div', { class: 'ev' });
          body.appendChild(achRow);
          const uid = u.id || u.userId;
          if (uid) {
            apiGet(`/api/user/${uid}/achievements`, { ttl: 30000 }).then((d) => {
              const list = asArray(d && d.achievements);
              if (list.length) {
                achRow.appendChild(evRow('Achievements', `${list.filter((a) => a.unlocked).length} unlocked`));
              }
            }).catch(() => {});
          }
        }
        if (isMod('achwalls') && u.username) {
          body.appendChild(h('button', { class: 'btn btn-ghost btn-sm', style: 'width:100%', onclick: () => achievementWallModal(u.username) }, icon('award', 13), ' Achievement wall'));
        }
        if (isMod('blockprofile') && u.username) {
          body.appendChild(confirmBtn(`Block @${u.username}`, async () => {
            await apiPost(`/api/user/${encodeURIComponent(u.username)}/block`, {});
            toast('success', 'Blocked', `@${u.username} added to your block list`);
            wrap.remove();
          }, { confirm: 'Really block?', cls: 'btn btn-danger' }));
        }
        if (u.username && (isMod('ranks') || isMod('quicktransfer'))) {
          const row = h('div', { class: 'profile-actions' },
            h('button', { class: 'btn btn-ghost btn-sm', onclick: () => transferModal(u.username) }, icon('send', 12), ' Send'),
          );
          if (isMod('ranks')) {
            const sel = h('select', { class: 'select select-sm' }, RANK_TAGS.map((t) => h('option', { value: t }, t)));
            sel.addEventListener('change', () => {
              const list = getFriends();
              const hit = list.find((x) => x.username.toLowerCase() === u.username.toLowerCase());
              if (hit) hit.tag = sel.value;
              else list.push({ username: u.username, tag: sel.value, addedAt: Date.now() });
              saveFriends(list);
              toast('success', 'Rank set', `@${u.username} → ${sel.value}`);
            });
            row.appendChild(sel);
          }
          body.appendChild(row);
        }
      })
      .catch((e) => {
        const body = $('.modal-body', wrap);
        body.innerHTML = '';
        body.appendChild(emptyState('Profile unavailable', e.message || 'Could not load this trader', 'user'));
      });
  }

  // ════════════════════════════════════════════════════════════════════
  // Coin terminal
  // ════════════════════════════════════════════════════════════════════

  function coinView(symRaw) {
    const sym = String(symRaw).toUpperCase();
    let coin = null;
    let tf = '1m';
    let tradeSide = 'BUY';
    let athCell = null;
    let myQty = null;

    // live creator-lock countdown (60s dev-only window from the server)
    function makeLockBadge(c) {
      const el = h('span', { class: 'badge warn lock-badge' }, 'creator lock');
      if (!isMod('locktimer')) return el;
      const unlock = c.tradingUnlocksAt ? new Date(c.tradingUnlocksAt).getTime() : null;
      const tick = () => {
        if (!unlock || Date.now() >= unlock) { el.textContent = c.isLocked ? 'creator lock' : 'unlocked'; return; }
        const s = Math.max(0, Math.ceil((unlock - Date.now()) / 1000));
        el.textContent = `creator lock · ${s}s`;
      };
      tick();
      const t = setInterval(tick, 1000);
      onCleanup(() => clearInterval(t));
      return el;
    }

    const root = h('div', { class: 'view coin-view' });
    const statGrid = h('div', { class: 'stat-grid' });
    const chartCard = h('div', { class: 'card' });
    const tradeCard = h('div', { class: 'card' });
    const rightCol = h('div', { class: 'right-col' });
    const holderCard = h('div', { class: 'card' });
    const commentCard = h('div', { class: 'card' });

    // header row
    const backBtn = h('button', { class: 'btn btn-ghost btn-sm', onclick: () => goBack() }, icon('back', 14), ' Back');
    const watchBtn = h('button', { class: 'btn btn-soft btn-sm', onclick: () => {
      const on = toggleWatch(sym);
      watchBtn.innerHTML = '';
      watchBtn.appendChild(icon(on ? 'starFilled' : 'star', 14));
      watchBtn.appendChild(document.createTextNode(on ? ' Watched' : ' Watch'));
      toast('success', on ? 'Added to watchlist' : 'Removed from watchlist', sym);
    } }, icon('star', 14), ' Watch');

    root.appendChild(h('div', { class: 'view-toolbar' }, backBtn, watchBtn));

    const titleBlock = h('div', { class: 'coin-head' });
    const statsWrap = h('div', { class: 'coin-stats' });
    root.appendChild(titleBlock);
    root.appendChild(statsWrap);
    root.appendChild(h('div', { class: 'coin-cols' }, chartCard, h('div', { class: 'coin-side' }, tradeCard, rightCol)));
    root.appendChild(holderCard);
    root.appendChild(commentCard);

    const offAuth = bus.on('auth', () => { if (coin) renderTrade(coin); });
    onCleanup(() => offAuth());

    // ── chart card ──
    function renderChart() {
      chartCard.innerHTML = '';
      const pills = h('div', { class: 'tf-row' },
        TF_OPTIONS.map((o) => h('button', {
          class: `tf-pill ${o.id === tf ? 'on' : ''}`,
          onclick: () => { tf = o.id; renderChart(); },
        }, o.label)),
      );
      chartCard.appendChild(h('div', { class: 'card-head' },
        h('div', { class: 'card-title' }, icon('trend', 14), h('span', {}, 'Price Chart')),
        pills,
      ));
      chartCard.appendChild(h('div', { class: 'chart-wrap' }, skeleton('100%', '250px')));
      const wrap = $('.chart-wrap', chartCard);

      const before = Math.floor(Date.now() / 1000);
      apiGet(`/api/coin/${sym}/chart-history?timeframe=${tf}&before=${before}`, { ttl: 8000 })
        .then((d) => {
          const candles = asArray(d && d.candlestickData);
          const volumes = asArray(d && d.volumeData);
          wrap.innerHTML = '';
          wrap.appendChild(candleChart(candles, volumes));
          if (isMod('latestcandle') && candles.length) {
            const last = candles[candles.length - 1];
            const up = num(last.close) >= num(last.open);
            wrap.appendChild(h('div', { class: 'last-candle mono' },
              h('span', { class: 'lc-t' }, 'LAST CANDLE'),
              h('span', {}, `O ${fmtPrice(num(last.open))}`),
              h('span', {}, `H ${fmtPrice(num(last.high))}`),
              h('span', {}, `L ${fmtPrice(num(last.low))}`),
              h('span', { class: up ? 'up' : 'down' }, `C ${fmtPrice(num(last.close))}`),
              h('span', { class: 'lc-vol' }, `vol ${fmtShort(num(last.volume))}`),
            ));
          }
          if (isMod('athmarker') && athCell && candles.length) {
            const ath = Math.max(...candles.map((x) => num(x.high ?? x.h)));
            const sv = athCell.querySelector('.stat-value');
            const ss = athCell.querySelector('.stat-sub');
            if (sv) sv.textContent = fmtPrice(ath);
            if (ss) ss.textContent = `from ${candles.length} candles`;
          }
        })
        .catch((e) => {
          wrap.innerHTML = '';
          wrap.appendChild(errorState(e.message, renderChart));
        });
    }

    // ── trade card ──
    function renderTrade(c) {
      tradeCard.innerHTML = '';
      tradeCard.appendChild(h('div', { class: 'card-head' },
        h('div', { class: 'card-title' }, icon('zap', 14), h('span', {}, 'Quick Trade')),
        h('span', { class: 'card-note mono' }, '0.3% fee'),
      ));
      if (authed === null) {
        tradeCard.appendChild(h('div', { class: 'trade-auth' }, skeleton('100%', '64px')));
        return;
      }
      if (authed === false) {
        tradeCard.appendChild(emptyState('Sign in to trade', 'Trading runs on your own RugPlay session', 'lock'));
        return;
      }

      const sideRow = h('div', { class: 'side-row' },
        h('button', { class: `side-pill buy ${tradeSide === 'BUY' ? 'on' : ''}`, onclick: () => { tradeSide = 'BUY'; renderTrade(c); } }, 'BUY'),
        h('button', { class: `side-pill sell ${tradeSide === 'SELL' ? 'on' : ''}`, onclick: () => { tradeSide = 'SELL'; renderTrade(c); } }, 'SELL'),
      );
      const amountInput = h('input', {
        class: 'input', type: 'number', min: '0', step: 'any', placeholder: tradeSide === 'BUY' ? 'BUSS to spend' : 'Coins to sell',
      });
      const preview = h('div', { class: 'trade-preview' });
      const goBtn = h('button', { class: 'btn btn-primary', disabled: true }, `Swap ${tradeSide}`);

      function updatePreview() {
        const amt = num(parseFloat(amountInput.value), 0);
        if (amt <= 0) {
          preview.innerHTML = '';
          goBtn.disabled = true;
          return;
        }
        const est = tradeSide === 'BUY'
          ? estimateBuy(amt, c.poolCoinAmount, c.poolBaseCurrencyAmount)
          : estimateSell(amt, c.poolCoinAmount, c.poolBaseCurrencyAmount);
        preview.innerHTML = '';
        preview.appendChild(evRow('You pay', tradeSide === 'BUY' ? fmtBuss(amt) : fmtQty(amt)));
        preview.appendChild(evRow('You get', tradeSide === 'BUY' ? fmtQty(est.coins) : fmtBuss(est.received)));
        preview.appendChild(evRow('Swap fee', fmtBuss(est.fee)));
        if (isMod('feeswap')) preview.appendChild(evRow('Fee rate', '0.30% of trade'));
        preview.appendChild(evRow('Price impact', `${est.impact.toFixed(2)}%`, impactTone(est.impact)));
        if (isMod('breakcalc')) {
          const be = (num(est.newPrice, num(c.currentPrice)) || num(c.currentPrice)) * (1.003 / 0.997);
          preview.appendChild(evRow('Break-even', fmtPrice(be), 'beats both 0.3% fees'));
        }
        goBtn.disabled = false;
      }

      amountInput.addEventListener('input', updatePreview);
      goBtn.addEventListener('click', async () => {
        const amt = num(parseFloat(amountInput.value), 0);
        if (amt <= 0) return;
        goBtn.disabled = true;
        goBtn.textContent = 'Swapping…';
        try {
          const res = await apiPost(`/api/coin/${sym}/trade`, { type: tradeSide, amount: amt });
          const got = tradeSide === 'BUY' ? (res.coinsBought ?? res.coinsReceived ?? res.coins) : (res.totalReceived ?? res.totalCost);
          toast('success', `${tradeSide} executed`, `${fmtQty(num(got))} · price ${fmtPrice(num(res.newPrice))}`);
          bus.emit('portfolio');
          loadCoin();
        } catch (e) {
          toast('error', 'Trade failed', e.message || 'Could not execute swap');
        } finally {
          goBtn.disabled = false;
          goBtn.textContent = `Swap ${tradeSide}`;
        }
      });

      if (isMod('wallettrack') && authed) {
        const cashRow = h('div', { class: 'wallet-track mono' });
        tradeCard.appendChild(cashRow);
        apiGet('/api/portfolio/total', { ttl: 8000 }).then((d) => { cashRow.textContent = `cash ${fmtBuss(num(d && d.baseCurrencyBalance))}`; }).catch(() => {});
      }
      if (tradeSide === 'BUY' && isMod('buypresets') && authed) {
        tradeCard.appendChild(h('div', { class: 'quick-sell-row' },
          h('span', { class: 'qs-label' }, 'Buy'),
          ['100', '500', '1000'].map((amt) => h('button', {
            class: 'btn btn-ghost btn-sm',
            onclick: () => { amountInput.value = amt; updatePreview(); },
          }, '$' + (+amt).toLocaleString())),
        ));
      }
      if (tradeSide === 'SELL' && isMod('quicksell') && authed) {
        tradeCard.appendChild(h('div', { class: 'quick-sell-row' },
          h('span', { class: 'qs-label' }, 'Sell'),
          ['25', '50', '75', '100'].map((p) => h('button', {
            class: 'btn btn-ghost btn-sm',
            onclick: async (ev) => {
              const btn = ev.currentTarget;
              btn.disabled = true;
              try {
                if (myQty === null) {
                  const d = await apiGet('/api/portfolio/total', { ttl: 8000 });
                  const hold = asArray(d && d.coinHoldings).find((x) => String(x.symbol).toUpperCase() === sym);
                  myQty = hold ? num(hold.quantity) : 0;
                }
                amountInput.value = String(+(myQty * (num(p, 0) / 100)).toFixed(6));
                updatePreview();
              } catch (e) {
                toast('error', 'Could not load your bag', e.message);
              } finally {
                btn.disabled = false;
              }
            },
          }, `${p}%`)),
        ));
      }
      tradeCard.appendChild(sideRow);
      tradeCard.appendChild(amountInput);
      tradeCard.appendChild(preview);
      tradeCard.appendChild(goBtn);
    }

    // ── pool + alerts ──
    function renderRight(c) {
      rightCol.innerHTML = '';
      if (isMod('poolwatch')) {
        const pool = h('div', { class: 'card' },
          sectionTitle('Pool Watch', 'droplet'),
          h('div', { class: 'ev' },
            evRow('Pool BUSS', fmtBuss(c.poolBaseCurrencyAmount)),
            evRow('Pool ' + sym, fmtQty(c.poolCoinAmount)),
            evRow('Liquidity', fmtBuss(Math.min(c.poolBaseCurrencyAmount, c.poolCoinAmount * c.currentPrice))),
            evRow('Circulating', fmtQty(c.circulatingSupply)),
          ),
        );
        rightCol.appendChild(pool);
      }
      if (isMod('pricealerts')) {
        const price = num(c.currentPrice);
        const add = (dir, pct) => addAlert({ id: Date.now() + Math.random(), symbol: sym, target: price * (1 + (dir * pct) / 100), dir, pct });
        const alerts = h('div', { class: 'card' },
          sectionTitle('Price Alerts', 'bell'),
          h('div', { class: 'alert-row' },
            h('button', { class: 'btn btn-soft btn-sm', onclick: () => { add(1, 10); toast('success', 'Alert set', `${sym} +10% above ${fmtPrice(price)}`); } }, '▲ +10%'),
            h('button', { class: 'btn btn-soft btn-sm', onclick: () => { add(-1, 10); toast('success', 'Alert set', `${sym} −10% below ${fmtPrice(price)}`); } }, '▼ −10%'),
            h('button', { class: 'btn btn-soft btn-sm', onclick: () => { add(1, 50); toast('success', 'Alert set', `${sym} +50% above ${fmtPrice(price)}`); } }, '▲ +50%'),
            h('button', { class: 'btn btn-soft btn-sm', onclick: () => { add(-1, 50); toast('success', 'Alert set', `${sym} −50% below ${fmtPrice(price)}`); } }, '▼ −50%'),
          ),
          h('div', { class: 'card-hint' }, 'Alerts fire as client toasts and stay on until hit or removed.'),
        );
        rightCol.appendChild(alerts);
      }
      renderDevDom(c);
    }

    // ── dev dominance (updates in place - never wipes the right column) ──
    function renderDevDom(c) {
      if (!isMod('devdom')) return;
      const creator = c.creatorUsername || (c.creator && c.creator.username) || null;
      const topHolder = coinHolders && coinHolders[0];
      const devShare = creator && topHolder && topHolder.username === creator ? topHolder.percentage : null;
      const old = $('.dev-card', rightCol);
      if (old) old.remove();
      if (devShare !== null) {
        rightCol.appendChild(h('div', { class: 'card dev-card' },
          sectionTitle('Dev Dominance', 'crown'),
          h('div', { class: 'ev' },
            evRow('Creator', '@' + creator),
            evRow('Share', devShare.toFixed(1) + '%', devShare > 50 ? 'bad' : 'good'),
          ),
          devShare > 50 ? h('div', { class: 'card-hint warn' }, 'The creator controls the majority supply. Extreme rug risk.') : null,
        ));
      }
    }

    // ── trade intel (order flow, dev watch, my position) ──
    function renderIntel(c) {
      const want = ['orderflow', 'devwatch', 'avgprice', 'positionvalue', 'holdtime', 'swaphistory'].some((m) => isMod(m));
      if (!want) return;
      const card = h('div', { class: 'card' },
        sectionTitle('Trade Intel', 'radar'),
        h('div', { class: 'ev' }, h('div', { class: 'skeleton-block' }, skeleton('100%', '110px'))),
      );
      rightCol.appendChild(card);
      const body = $('.ev', card);
      const mySym = sym;
      let myCash = null;

      // order flow + dev watch from the live tape
      apiGet('/api/trades/recent?limit=60', { ttl: 6000 })
        .then((d) => {
          const list = asArray(d && d.trades).filter((t) => String(t.coinSymbol || '').toUpperCase() === mySym);
          const buys = list.filter((t) => String(t.type || '').toUpperCase() === 'BUY').length;
          const sells = list.filter((t) => String(t.type || '').toUpperCase() === 'SELL').length;
          const total = buys + sells;
          const dev = c.creatorUsername || (c.creator && c.creator.username);
          if (total > 0 && isMod('orderflow')) {
            const buyPct = Math.round((buys / total) * 100);
            body.appendChild(evRow('Order flow', `${buys}B · ${sells}S`));
            body.appendChild(h('div', { class: 'flow-bar' },
              h('div', { class: 'flow-buy', style: `width:${buyPct}%` }),
              h('div', { class: 'flow-sell', style: `width:${100 - buyPct}%` }),
            ));
            body.appendChild(h('div', { class: 'flow-legend mono' }, `${buyPct}% buys · ${100 - buyPct}% sells`));
          }
          if (dev && isMod('devwatch')) {
            const devTrades = list.filter((t) => String(t.username || '').toLowerCase() === String(dev).toLowerCase());
            const devBuys = devTrades.filter((t) => String(t.type || '').toUpperCase() === 'BUY').length;
            const devSells = devTrades.filter((t) => String(t.type || '').toUpperCase() === 'SELL').length;
            if (devTrades.length) {
              body.appendChild(evRow('Dev watch', `${devBuys}B · ${devSells}S`, devSells > devBuys ? 'bad' : 'good'));
            } else {
              body.appendChild(evRow('Dev watch', 'no recent dev trades'));
            }
          }
        })
        .catch(() => {});

      // my position + history from real transactions
      apiGet('/api/portfolio/total', { ttl: 8000 }).then((d) => {
        const hold = asArray(d && d.coinHoldings).find((x) => String(x.symbol).toUpperCase() === mySym);
        myCash = num(d && d.baseCurrencyBalance);
        if (hold && isMod('positionvalue')) body.appendChild(evRow('My position', fmtQty(num(hold.quantity)) + ' · ' + fmtBuss(num(hold.value)), 'good'));
      }).catch(() => {});

      apiGet('/api/transactions', { ttl: 10000 }).then((d) => {
        const txs = asArray(d && d.transactions).filter((t) => String(t.symbol || '').toUpperCase() === mySym && t.type === 'BUY');
        if (txs.length && isMod('avgprice')) {
          const qty = txs.reduce((s, t) => s + num(t.coinAmount, 0), 0);
          const cost = txs.reduce((s, t) => s + num(t.totalBaseCurrencyAmount, 0), 0);
          if (qty > 0) body.appendChild(evRow('Avg entry', fmtPrice(cost / qty)));
        }
        if (txs.length && isMod('holdtime')) {
          const first = Math.min(...txs.map((t) => num(t.createdAt)));
          body.appendChild(evRow('Holding for', timeAgo(first * 1000)));
        }
        const mine = asArray(d && d.transactions).filter((t) => String(t.symbol || '').toUpperCase() === mySym);
        if (mine.length && isMod('swaphistory')) {
          const recent = mine.slice(-4).reverse();
          recent.forEach((t) => {
            const isBuy = t.type === 'BUY';
            body.appendChild(evRow(isBuy ? 'Bought' : t.type === 'TRANSFER_OUT' ? 'Sent' : 'Sold', fmtBuss(num(t.totalBaseCurrencyAmount)), isBuy ? 'good' : 'bad'));
          });
        }
      }).catch(() => {});
    }

    let coinHolders = null;

    // ── holders ──
    function renderHolders(c) {
      if (!isMod('holderradar')) return;
      holderCard.innerHTML = '';
      holderCard.appendChild(h('div', { class: 'card-head' },
        h('div', { class: 'card-title' }, icon('radar', 14), h('span', {}, 'Holder Radar')),
        h('span', { class: 'card-note' }, 'top by balance'),
      ));
      const body = h('div', { class: 'holder-list' });
      holderCard.appendChild(body);
      body.appendChild(h('div', { class: 'skeleton-block' }, skeleton('100%', '90px')));
      apiGet(`/api/coin/${sym}/holders?limit=10`, { ttl: 15000 })
        .then((d) => {
          const list = asArray(d && d.holders);
          coinHolders = list;
          body.innerHTML = '';
          if (list.length === 0) {
            body.appendChild(emptyState('No holders yet', 'Be the first in the pool', 'user'));
            return;
          }
          renderDevDom(c);
          list.forEach((hd, i) => {
            const row = h('div', { class: 'holder-row' },
              h('span', { class: 'holder-rank mono' }, String(i + 1).padStart(2, '0')),
              h('button', {
                class: 'holder-user',
                onclick: () => (isMod('profilepeek') ? profileModal(hd.username) : null),
              }, avatar(hd.username, 24), h('span', {}, hd.username || 'anon')),
              h('span', { class: 'mono holder-qty' }, fmtQty(num(hd.quantity))),
              h('span', { class: 'mono holder-pct' }, `${num(hd.percentage).toFixed(1)}%`),
              h('span', { class: 'mono holder-liq' }, fmtBuss(num(hd.liquidationValue))),
            );
            body.appendChild(row);
          });
        })
        .catch((e) => {
          body.innerHTML = '';
          body.appendChild(errorState(e.message));
        });
    }

    // ── comments ──
    function renderComments() {
      if (!isMod('comments')) return;
      commentCard.innerHTML = '';
      commentCard.appendChild(h('div', { class: 'card-head' },
        h('div', { class: 'card-title' }, icon('send', 14), h('span', {}, 'Comment Deck')),
      ));
      const list = h('div', { class: 'comment-list' });
      list.appendChild(h('div', { class: 'skeleton-block' }, skeleton('100%', '60px')));
      commentCard.appendChild(list);

      if (authed) {
        const composer = h('div', { class: 'composer' },
          h('input', { class: 'input', placeholder: 'Say something about ' + sym + ' · @ mentions ping them' }),
          h('button', { class: 'btn btn-primary btn-sm', onclick: async (ev) => {
            const input = $('input', composer);
            const content = (input.value || '').trim();
            if (!content) return;
            const btn = ev.currentTarget;
            btn.disabled = true;
            try {
              await apiPost(`/api/coin/${sym}/comments`, { content });
              input.value = '';
              toast('success', 'Comment posted', sym);
              renderComments();
            } catch (e) {
              toast('error', 'Could not post', e.message);
              btn.disabled = false;
            }
          } }, icon('send', 13), ' Post'),
        );
        commentCard.appendChild(composer);
        attachMentionAutocomplete($('input', composer), () => {
          const pool = getFriends().map((f) => f.username);
          (coinHolders || []).forEach((hd) => pool.push(hd.username));
          return [...new Set(pool.filter(Boolean))];
        });
      }

      apiGet(`/api/coin/${sym}/comments`, { ttl: 10000 })
        .then((d) => {
          const comments = asArray(d && d.comments);
          list.innerHTML = '';
          if (comments.length === 0) {
            list.appendChild(emptyState('No comments yet', 'Break the silence', 'send'));
            return;
          }
          comments.slice(0, 30).forEach((cm) => {
            const likes = num(cm.likeCount ?? cm.likesCount ?? cm.likes ?? cm.like_count, 0);
            const uname = cm.username || cm.userUsername;
            const row = h('div', { class: 'comment-row' },
              avatar(uname, 26),
              h('div', { class: 'comment-main' },
                h('div', { class: 'comment-meta' },
                  h('span', { class: 'comment-user' }, uname || 'anon'), isMod('ranks') && rankChip(uname),
                  h('span', { class: 'comment-time' }, cm.createdAt ? timeAgo(new Date(cm.createdAt).getTime()) : ''),
                ),
                h('div', { class: 'comment-text' }, cm.content || ''),
              ),
              isMod('likes') && cm.id ? h('button', {
                class: 'like-btn',
                onclick: async () => {
                  try {
                    await apiPost(`/api/coin/${sym}/comments/${cm.id}/like`, {});
                    toast('success', 'Liked', 'Comment');
                    renderComments();
                  } catch (e) {
                    toast('error', 'Could not like', e.message);
                  }
                },
              }, icon('heart', 13), h('span', {}, String(likes))) : null,
            );
            list.appendChild(row);
          });
        })
        .catch((e) => {
          list.innerHTML = '';
          list.appendChild(errorState(e.message));
        });
    }

    // ── main loader ──
    function loadCoin() {
      statsWrap.innerHTML = '';
      statsWrap.appendChild(h('div', { class: 'skeleton-block' }, skeleton('100%', '56px')));
      apiGet(`/api/coin/${sym}`, { ttl: 6000 })
        .then((d) => {
          const c = d && d.coin;
          if (!c) throw new Error('Coin not found');
          coin = c;
          const up = num(c.change24h) >= 0;
          titleBlock.innerHTML = '';
          titleBlock.appendChild(h('div', { class: 'coin-name-row' },
            avatar(c.symbol || sym, 30),
            h('div', { class: 'coin-name-block' },
              h('div', { class: 'coin-title' }, c.symbol || sym, c.name && c.name !== (c.symbol || sym) ? h('span', { class: 'coin-sub' }, c.name) : null),
              h('div', { class: 'coin-tags' },
                c.creatorUsername || (c.creator && c.creator.username) ? h('button', {
                  class: 'dev-chip',
                  onclick: () => (isMod('devcredit') && isMod('profilepeek') ? profileModal(c.creatorUsername || c.creator.username) : null),
                }, icon('crown', 11), ' dev · ' + (c.creatorUsername || c.creator.username)) : null,
                (c.isLocked || (c.tradingUnlocksAt && new Date(c.tradingUnlocksAt).getTime() > Date.now())) ? makeLockBadge(c) : null,
                (isMod('coinage') && c.createdAt) ? badge('launched ' + timeAgo(new Date(c.createdAt).getTime()), '') : null,
              ),
            ),
          ));
          statsWrap.innerHTML = '';
          statsWrap.appendChild(statCell('Price', fmtPrice(num(c.currentPrice)), changeEl(num(c.change24h))));
          statsWrap.appendChild(statCell('Market Cap', fmtBuss(num(c.marketCap))));
          statsWrap.appendChild(statCell('Volume 24h', fmtBuss(num(c.volume24h))));
          statsWrap.appendChild(statCell('Circulating', fmtQty(num(c.circulatingSupply))));
          statsWrap.appendChild(statCell('Pool', fmtBuss(num(c.poolBaseCurrencyAmount))));
          if (isMod('coinage') && c.createdAt) statsWrap.appendChild(statCell('Created', timeAgo(new Date(c.createdAt).getTime())));
          if (isMod('permillion')) statsWrap.appendChild(statCell('Per 1M', fmtBuss(num(c.currentPrice) * 1e6)));
          if (isMod('fromlaunch')) statsWrap.appendChild(statCell('From Launch', `${fmtShort(num(c.currentPrice) / 0.000001)}×`, 'from $0.000001'));
          if (isMod('volumedepth')) {
            const mc = num(c.marketCap);
            statsWrap.appendChild(statCell('Vol ÷ MCap', mc > 0 ? (num(c.volume24h) / mc * 100).toFixed(1) + '%' : '-'));
          }
          if (isMod('poolsplit')) {
            const base = num(c.poolBaseCurrencyAmount);
            const tok = num(c.poolCoinAmount) * num(c.currentPrice);
            statsWrap.appendChild(statCell('Pool Split', fmtBuss(base) + ' / ' + fmtBuss(tok), 'BUSS / tokens'));
          }
          if (isMod('athmarker')) { athCell = statCell('All-Time High', '-', 'from chart'); statsWrap.appendChild(athCell); }
          if (isMod('volatility')) {
            const volCell = statCell('24h Range', '-');
            statsWrap.appendChild(volCell);
            const before = Math.floor(Date.now() / 1000);
            apiGet(`/api/coin/${sym}/chart-history?timeframe=1d&before=${before}`, { ttl: 30000 }).then((d) => {
              const cs = asArray(d && d.candlestickData);
              if (!cs.length) return;
              const hi = Math.max(...cs.map((x) => num(x.high ?? x.h)));
              const lo = Math.min(...cs.map((x) => num(x.low ?? x.l)));
              if (lo > 0) {
                const sv = volCell.querySelector('.stat-value');
                const ss = volCell.querySelector('.stat-sub');
                if (sv) sv.textContent = `±${((hi - lo) / lo * 100).toFixed(1)}%`;
                if (ss) ss.textContent = `${fmtPrice(lo)} - ${fmtPrice(hi)}`;
              }
            }).catch(() => {});
          }
          if (isMod('pooldepthbar') && num(c.marketCap) > 0) {
            const depth = Math.min(100, (num(c.poolBaseCurrencyAmount) / num(c.marketCap)) * 100);
            statsWrap.appendChild(h('div', { class: 'depth-bar-wrap' },
              h('div', { class: 'depth-bar-label' }, h('span', {}, 'Pool depth vs MCap'), h('span', { class: 'mono' }, depth.toFixed(1) + '%')),
              h('div', { class: 'depth-bar' }, h('div', { class: 'depth-bar-fill', style: `width:${depth.toFixed(1)}%` })),
            ));
          }
          renderTrade(c);
          renderRight(c);
          renderIntel(c);
          renderHolders(c);
          renderComments();
        })
        .catch((e) => {
          statsWrap.innerHTML = '';
          statsWrap.appendChild(errorState(e.message, loadCoin));
        });
    }

    renderChart();
    loadCoin();
    return root;
  }

  // ════════════════════════════════════════════════════════════════════
  // Overview
  // ════════════════════════════════════════════════════════════════════

  function overviewView() {
    const root = h('div', { class: 'view' });

    const netWorth = h('div', { class: 'card' });
    const season = h('div', { class: 'card' });
    const movers = h('div', { class: 'card' });
    const top = h('div', { class: 'card' });
    const feed = h('div', { class: 'card' });
    const launch = h('div', { class: 'card' });

    const grid = h('div', { class: 'overview-grid' },
      h('div', { class: 'grid-2' }, netWorth, season),
      h('div', { class: 'grid-2' }, movers, top),
      h('div', { class: 'grid-2' }, feed, launch),
    );
    root.appendChild(grid);

    function miniRow(coin, right) {
      return h('button', { class: 'mini-row', onclick: () => openCoin(coin.symbol) },
        avatar(coin.symbol, 24),
        h('div', { class: 'mini-main' },
          h('div', { class: 'mini-name' }, coin.symbol),
          h('div', { class: 'mini-sub' }, coin.name || ''),
        ),
        right,
      );
    }

    // net worth
    netWorth.appendChild(sectionTitle('Net Worth', 'wallet'));
    const nwBody = h('div', {});
    netWorth.appendChild(nwBody);
    const nwRefresh = () => {
      nwBody.innerHTML = '';
      nwBody.appendChild(skeleton('100%', '44px'));
      apiGet('/api/portfolio/total', { ttl: 15000 })
        .then((d) => {
          nwBody.innerHTML = '';
          if (!d || d.baseCurrencyBalance === undefined) {
            nwBody.appendChild(emptyState('Not signed in', 'Sign in on rugplay.com to see your portfolio', 'lock'));
            return;
          }
          const row = h('div', { class: 'nw-row' },
            statCell('Total', fmtBuss(num(d.totalValue)), 'net worth'),
            statCell('Cash', fmtBuss(num(d.baseCurrencyBalance)), 'BUSS'),
            statCell('In Coins', fmtBuss(num(d.totalCoinValue)), `${asArray(d.coinHoldings).length} positions`),
          );
          nwBody.appendChild(row);
        })
        .catch((e) => {
          nwBody.innerHTML = '';
          nwBody.appendChild(errorState(e.message));
        });
    };
    nwRefresh();
    const offPortfolio = bus.on('portfolio', nwRefresh);
    onCleanup(() => offPortfolio());

    // season
    season.appendChild(sectionTitle('Season', 'calendar'));
    const sBody = h('div', {});
    season.appendChild(sBody);
    apiGet('/api/season', { ttl: 60000 })
      .then((d) => {
        sBody.innerHTML = '';
        const s = d && d.season;
        if (!s) {
          sBody.appendChild(emptyState('No active season', 'Check back when the next one starts', 'calendar'));
          return;
        }
        const endsAt = s.endsAt ? (typeof s.endsAt === 'number' ? s.endsAt : new Date(s.endsAt).getTime() / 1000) : null;
        const me = d && d.me;
        sBody.appendChild(h('div', { class: 'season-name' }, s.name || 'Season'),
          endsAt ? h('div', { class: 'season-count' }, 'ends in ', h('span', { class: 'mono' }, countdown(endsAt))) : null,
          me && isFinite(num(me.rank)) ? h('div', { class: 'season-rank' }, `your rank · #${me.rank}`) : null,
        );
      })
      .catch((e) => {
        sBody.innerHTML = '';
        sBody.appendChild(errorState(e.message));
      });

    // movers
    movers.appendChild(sectionTitle('Movers', 'activity'));
    const mBody = h('div', {});
    movers.appendChild(mBody);
    mBody.appendChild(skeleton('100%', '120px'));
    Promise.all([
      apiGet('/api/market?sortBy=change24h&sortOrder=desc&changeFilter=gainers&limit=4', { ttl: 20000 }),
      apiGet('/api/market?sortBy=change24h&sortOrder=asc&changeFilter=losers&limit=4', { ttl: 20000 }),
    ]).then(([g, l]) => {
      mBody.innerHTML = '';
      const gs = asArray(g && g.coins).slice(0, 4);
      const ls = asArray(l && l.coins).slice(0, 4);
      const col = (title, list, up) => h('div', { class: 'mini-col' },
        h('div', { class: 'mini-col-title' }, title),
        list.length ? list.map((c) => miniRow(c, changeEl(num(c.change24h)))) : h('div', { class: 'card-hint' }, 'None'),
      );
      mBody.appendChild(h('div', { class: 'movers-cols' }, col('Gainers', gs, true), col('Losers', ls, false)));
    }).catch((e) => {
      mBody.innerHTML = '';
      mBody.appendChild(errorState(e.message));
    });

    // top board
    top.appendChild(sectionTitle('Top Board', 'trophy'));
    const tBody = h('div', {});
    top.appendChild(tBody);
    tBody.appendChild(skeleton('100%', '140px'));
    apiGet('/api/market?sortBy=marketCap&limit=6', { ttl: 20000 })
      .then((d) => {
        tBody.innerHTML = '';
        const list = asArray(d && d.coins).slice(0, 6);
        if (!list.length) { tBody.appendChild(emptyState('Empty market', 'No coins listed yet')); return; }
        list.forEach((c, i) => tBody.appendChild(miniRow(c,
          h('div', { class: 'mini-right' },
            h('div', { class: 'mono' }, fmtBuss(num(c.marketCap))),
            h('div', { class: 'mini-sub' }, changeEl(num(c.change24h))),
          ),
        )));
      })
      .catch((e) => {
        tBody.innerHTML = '';
        tBody.appendChild(errorState(e.message));
      });

    // live feed
    feed.appendChild(sectionTitle('Live Feed', 'zap'));
    const fBody = h('div', {});
    feed.appendChild(fBody);
    fBody.appendChild(skeleton('100%', '120px'));
    apiGet('/api/trades/recent?limit=8', { ttl: 8000 })
      .then((d) => {
        fBody.innerHTML = '';
        const trades = asArray(d && d.trades).slice(0, 8);
        if (!trades.length) { fBody.appendChild(emptyState('Quiet market', 'No trades in the last few minutes', 'zap')); return; }
        trades.forEach((t) => {
          const isBuy = (t.type || '').toUpperCase() === 'BUY';
          fBody.appendChild(h('div', { class: 'feed-row' },
            avatar(t.username || t.symbol, 22),
            h('div', { class: 'mini-main' },
              h('div', { class: 'mini-name' }, t.symbol || '-', ' ', h('span', { class: isBuy ? 'up' : 'down' }, isBuy ? 'BUY' : 'SELL')),
              h('div', { class: 'mini-sub' }, (t.username || 'anon') + ' · ' + (t.createdAt ? timeAgo(new Date(t.createdAt).getTime()) : '')),
            ),
            h('span', { class: 'mono' }, fmtBuss(num(t.totalBaseCurrencyAmount ?? t.amount ?? t.value))),
          ));
        });
      })
      .catch((e) => {
        fBody.innerHTML = '';
        fBody.appendChild(errorState(e.message));
      });

    // launch kit
    launch.appendChild(sectionTitle('Launch Kit', 'flame'));
    const lBody = h('div', {});
    launch.appendChild(lBody);
    apiGet('/api/coin/create', { ttl: 30000 })
      .then((d) => {
        lBody.innerHTML = '';
        const fee = num(d && (d.fee ?? d.creationFee ?? d.feeAmount), 100);
        const liq = num(d && (d.liquidityDeposit ?? d.liquidity ?? d.liquidityAmount), 1000);
        lBody.appendChild(h('div', { class: 'ev' },
          evRow('Creation fee', fmtBuss(fee)),
          evRow('Liquidity deposit', fmtBuss(liq)),
          evRow('Total to launch', fmtBuss(fee + liq), 'bad'),
        ));
        lBody.appendChild(h('div', { class: 'card-hint' }, 'Ready to ship your own token? Do it from the RugPlay site.'));
      })
      .catch(() => {
        lBody.innerHTML = '';
        lBody.appendChild(emptyState('Launch costs $1,100', '$100 fee + $1,000 liquidity. Earn first.', 'flame'));
      });

    return root;
  }

  // ════════════════════════════════════════════════════════════════════
  // Market
  // ════════════════════════════════════════════════════════════════════

  function marketView() {
    const root = h('div', { class: 'view' });
    let page = 1;
    const state = { search: '', sortBy: 'marketCap', sortOrder: 'desc', priceFilter: 'all', changeFilter: 'all' };
    let totalPages = 1;

    const search = h('input', {
      class: 'input search-input',
      placeholder: 'Search coins…',
    });
    search.addEventListener('input', debounce((ev) => {
      state.search = ev.target.value.trim();
      page = 1;
      load();
    }, 350));

    const sortSel = h('select', { class: 'select' },
      ['marketCap', 'currentPrice', 'change24h', 'volume24h', 'createdAt'].map((k) => h('option', { value: k, selected: state.sortBy === k }, k)),
    );
    sortSel.addEventListener('change', () => { state.sortBy = sortSel.value; page = 1; load(); });

    const dirBtn = h('button', { class: 'btn btn-ghost btn-sm', onclick: () => {
      state.sortOrder = state.sortOrder === 'desc' ? 'asc' : 'desc';
      dirBtn.textContent = state.sortOrder === 'desc' ? '▼ desc' : '▲ asc';
      load();
    } }, state.sortOrder === 'desc' ? '▼ desc' : '▲ asc');

    const priceSel = h('select', { class: 'select' },
      [['all', 'All prices'], ['under1', 'Under $1'], ['1to10', '$1 - $10'], ['10to100', '$10 - $100'], ['over100', 'Over $100']].map(([v, l]) => h('option', { value: v, selected: state.priceFilter === v }, l)),
    );
    priceSel.addEventListener('change', () => { state.priceFilter = priceSel.value; page = 1; load(); });

    const changeSel = h('select', { class: 'select' },
      [['all', 'All changes'], ['gainers', 'Gainers'], ['losers', 'Losers'], ['hot', 'Hot'], ['wild', 'Wild']].map(([v, l]) => h('option', { value: v, selected: state.changeFilter === v }, l)),
    );
    changeSel.addEventListener('change', () => { state.changeFilter = changeSel.value; page = 1; load(); });

    const newestBtn = h('button', { class: 'btn btn-ghost btn-sm', onclick: () => {
      state.sortBy = 'createdAt'; state.sortOrder = 'desc'; page = 1;
      sortSel.value = 'createdAt'; dirBtn.textContent = '▼ desc';
      load();
    } }, icon('rocket', 13), ' Newest');
    let treemapMode = false;
    const treemapBtn = h('button', { class: 'btn btn-ghost btn-sm', onclick: () => {
      treemapMode = !treemapMode;
      treemapBtn.innerHTML = '';
      treemapBtn.appendChild(icon('grid', 13));
      treemapBtn.appendChild(document.createTextNode(treemapMode ? ' Table' : ' Treemap'));
      table.innerHTML = '';
      pager.style.display = treemapMode ? 'none' : 'flex';
      if (treemapMode) loadTreemap(); else load();
    } }, icon('grid', 13), ' Treemap');

    const toolbar = h('div', { class: 'market-toolbar' },
      search, sortSel, dirBtn, priceSel, changeSel, newestBtn,
      isMod('treemap') ? treemapBtn : null,
    );
    const statsStrip = h('div', { class: 'market-stats mono' });
    const table = h('div', { class: 'mkt-table' });
    const pager = h('div', { class: 'pager' });
    if (isMod('marketstats')) root.appendChild(statsStrip);
    root.appendChild(toolbar);

    // ── market analytics (mod-gated) ──
    const clockEl = h('span', { class: 'market-clock mono' });
    const tradeStats = h('div', { class: 'market-clock mono' });
    if (isMod('marketclock')) root.appendChild(clockEl);
    if (isMod('avgsize') || isMod('tradepace')) root.appendChild(tradeStats);
    const clientFilters = { mcap: 'all', vol: 'all' };
    const filterRow = h('div', { class: 'chip-row' });
    const cardsRow = h('div', { class: 'mkt-cards' });
    const distRow = h('div', { class: 'mkt-dists' });
    if (isMod('mcapfilter') || isMod('volfilter')) root.appendChild(filterRow);
    if (isMod('topgainer') || isMod('toploser') || isMod('bigmover')) root.appendChild(cardsRow);
    if (isMod('pricedist') || isMod('mcapdist') || isMod('chgdist')) root.appendChild(distRow);

    function renderFilterChips() {
      filterRow.innerHTML = '';
      if (isMod('mcapfilter')) {
        filterRow.appendChild(h('span', { class: 'chip-label mono' }, 'MCap'));
        [['all', 'All'], ['micro', '< $50K'], ['small', '$50K-$1M'], ['mid', '$1M-$5M'], ['large', '> $5M']].forEach(([v, l]) => {
          filterRow.appendChild(h('button', {
            class: `chip ${clientFilters.mcap === v ? 'on' : ''}`,
            onclick: (ev) => { clientFilters.mcap = v; renderFilterChips(); load(); },
          }, l));
        });
      }
      if (isMod('volfilter')) {
        filterRow.appendChild(h('span', { class: 'chip-label mono' }, 'Vol'));
        [['all', 'All'], ['low', '< $10K'], ['mid', '$10K-$100K'], ['high', '> $100K']].forEach(([v, l]) => {
          filterRow.appendChild(h('button', {
            class: `chip ${clientFilters.vol === v ? 'on' : ''}`,
            onclick: (ev) => { clientFilters.vol = v; renderFilterChips(); load(); },
          }, l));
        });
      }
    }
    renderFilterChips();

    function mcapKey(mc) {
      if (mc < 50000) return 'micro';
      if (mc < 1e6) return 'small';
      if (mc < 5e6) return 'mid';
      return 'large';
    }
    function volKey(v) {
      if (v < 10000) return 'low';
      if (v < 1e5) return 'mid';
      return 'high';
    }

    function renderCards(coins) {
      cardsRow.innerHTML = '';
      if (!coins.length) return;
      const byChg = [...coins].sort((a, b) => num(b.change24h) - num(a.change24h));
      const gainer = byChg[0], loser = byChg[byChg.length - 1];
      let big = coins[0];
      coins.forEach((c) => { if (Math.abs(num(c.change24h)) > Math.abs(num(big.change24h))) big = c; });
      const card = (label, c, tone) => h('div', { class: `card mkt-card ${tone}` },
        h('div', { class: 'mkt-card-label' }, label),
        h('div', { class: 'mkt-card-sym' }, c.symbol),
        h('div', { class: `mono ${tone}` }, fmtPct(num(c.change24h))),
        h('div', { class: 'mkt-card-sub mono' }, fmtBuss(num(c.marketCap))),
      );
      if (isMod('topgainer')) cardsRow.appendChild(card('TOP GAINER', gainer, 'up'));
      if (isMod('toploser')) cardsRow.appendChild(card('TOP LOSER', loser, 'down'));
      if (isMod('bigmover')) cardsRow.appendChild(card('BIG MOVER', big, Math.abs(num(big.change24h)) > 100 ? 'up' : ''));
    }

    function renderDists(coins) {
      distRow.innerHTML = '';
      if (!coins.length) return;
      const bar = (label, buckets) => {
        const max = Math.max(1, ...buckets.map((b) => b.v));
        distRow.appendChild(h('div', { class: 'card dist-card' },
          h('div', { class: 'dist-label' }, label),
          h('div', { class: 'dist-bars' },
            buckets.map((b) => h('div', { class: 'dist-col', title: `${b.l}: ${b.v}` },
              h('div', { class: 'dist-bar', style: `height:${(b.v / max * 100).toFixed(0)}%` }),
              h('span', { class: 'dist-lbl mono' }, b.l),
            )),
          ),
        ));
      };
      if (isMod('pricedist')) {
        const b = [0, 0, 0, 0, 0];
        coins.forEach((c) => { const p = num(c.currentPrice); if (p < 0.001) b[0]++; else if (p < 0.01) b[1]++; else if (p < 0.1) b[2]++; else if (p < 1) b[3]++; else b[4]++; });
        bar('PRICE', [['<.001', b[0]], ['<.01', b[1]], ['<.1', b[2]], ['<1', b[3]], ['1+', b[4]]]);
      }
      if (isMod('mcapdist')) {
        const b = [0, 0, 0, 0];
        coins.forEach((c) => { b[['micro', 'small', 'mid', 'large'].indexOf(mcapKey(num(c.marketCap)))]++; });
        bar('MCAP', [['<50K', b[0]], ['<1M', b[1]], ['<5M', b[2]], ['5M+', b[3]]]);
      }
      if (isMod('chgdist')) {
        const b = [0, 0, 0, 0, 0];
        coins.forEach((c) => { const ch = num(c.change24h); if (ch < -50) b[0]++; else if (ch < 0) b[1]++; else if (ch < 50) b[2]++; else if (ch < 200) b[3]++; else b[4]++; });
        bar('CHANGE', [['-50', b[0]], ['neg', b[1]], ['+50', b[2]], ['+200', b[3]], ['200+', b[4]]]);
      }
    }

    function loadTradeStats() {
      if (!isMod('avgsize') && !isMod('tradepace')) return;
      apiGet('/api/trades/recent?limit=60', { ttl: 6000 }).then((d) => {
        const list = asArray(d && d.trades);
        if (!list.length) return;
        const parts = [];
        if (isMod('avgsize')) parts.push(`avg trade ${fmtBuss(list.reduce((s, t) => s + num(t.totalValue), 0) / list.length)}`);
        if (isMod('tradepace')) {
          const now = Date.now() / 1000;
          const recent = list.filter((t) => now - num(t.timestamp) <= 60).length;
          parts.push(`${recent} trades/min`);
        }
        tradeStats.textContent = parts.join(' · ');
      }).catch(() => {});
    }
    loadTradeStats();

    root.appendChild(table);
    root.appendChild(pager);

    function loadStats() {
      if (!isMod('marketstats')) return;
      statsStrip.innerHTML = '';
      Promise.all([
        apiGet('/api/market?sortBy=change24h&sortOrder=desc&limit=100', { ttl: 60000 }),
        apiGet('/api/market?sortBy=change24h&sortOrder=asc&limit=100', { ttl: 60000 }),
      ]).then(([g, l]) => {
        const gs = asArray(g && g.coins).filter((c) => num(c.change24h) > 0);
        const ls = asArray(l && l.coins).filter((c) => num(c.change24h) < 0);
        const hot = gs[0], cold = ls[0];
        const parts = [`${num(g && g.total, 0).toLocaleString()} listed`];
        if (hot) parts.push(`hot ${hot.symbol} ${fmtPct(num(hot.change24h))}`);
        if (cold) parts.push(`cold ${cold.symbol} ${fmtPct(num(cold.change24h))}`);
        statsStrip.textContent = parts.join(' · ');
      }).catch(() => { statsStrip.textContent = ''; });
    }

    function loadTreemap() {
      table.innerHTML = '';
      table.appendChild(h('div', { class: 'card-head treemap-head' },
        h('div', { class: 'card-title' }, icon('grid', 14), h('span', {}, 'Market Treemap')),
        h('span', { class: 'card-note' }, 'area = market cap · color = 24h'),
      ));
      const box = h('div', { class: 'treemap' });
      table.appendChild(box);
      box.appendChild(h('div', { class: 'skeleton-block' }, skeleton('100%', '300px')));
      apiGet('/api/market?sortBy=marketCap&sortOrder=desc&limit=100', { ttl: 20000 })
        .then((d) => {
          const coins = asArray(d && d.coins);
          box.innerHTML = '';
          if (!coins.length) { box.appendChild(emptyState('No data', 'The treemap needs market data', 'grid')); return; }
          const cells = treemapLayout(coins.map((c) => ({
            symbol: c.symbol, value: Math.max(num(c.marketCap), 1), change: num(c.change24h), price: num(c.currentPrice),
          })), box.clientWidth || 780, 300);
          cells.forEach((cl) => {
            const ch = cl.item.change;
            let bg = 'rgba(107,114,128,.35)';
            if (Math.abs(ch) >= 0.5) {
              const intensity = 0.35 + Math.min(Math.abs(ch) / 100, 1) * 0.65;
              bg = ch >= 0 ? `rgba(16,185,129,${intensity.toFixed(3)})` : `rgba(239,68,68,${intensity.toFixed(3)})`;
            }
            box.appendChild(h('button', {
              class: 'treemap-cell',
              style: `left:${cl.x.toFixed(1)}px;top:${cl.y.toFixed(1)}px;width:${cl.w.toFixed(1)}px;height:${cl.h.toFixed(1)}px;background:${bg}`,
              title: `${cl.item.symbol} · ${fmtPrice(cl.item.price)} · ${fmtPct(ch)}`,
              onclick: () => openCoin(cl.item.symbol),
            }, h('span', { class: 'tc-sym' }, cl.item.symbol), h('span', { class: 'tc-cap mono' }, '$' + fmtShort(cl.item.value))));
          });
        })
        .catch((e) => { box.innerHTML = ''; box.appendChild(errorState(e.message, loadTreemap)); });
    }

    loadStats();

    const pageInfo = h('span', { class: 'pager-info mono' });
    const prevBtn = h('button', { class: 'btn btn-ghost btn-sm', onclick: () => { if (page > 1) { page -= 1; load(); } } }, '‹ Prev');
    const nextBtn = h('button', { class: 'btn btn-ghost btn-sm', onclick: () => { if (page < totalPages) { page += 1; load(); } } }, 'Next ›');
    pager.appendChild(prevBtn);
    pager.appendChild(pageInfo);
    pager.appendChild(nextBtn);

    function head(label) {
      return h('div', { class: 'mkt-th' }, label);
    }

    const startTs = Date.now();
    function load() {
      table.innerHTML = '';
      const q = new URLSearchParams();
      if (state.search) q.set('search', state.search);
      q.set('sortBy', state.sortBy);
      q.set('sortOrder', state.sortOrder);
      q.set('priceFilter', state.priceFilter);
      q.set('changeFilter', state.changeFilter);
      q.set('page', String(page));
      q.set('limit', String(settings.marketPageSize || 25));
      const rows = h('div', { class: 'mkt-rows' });
      table.appendChild(h('div', { class: 'mkt-grid mkt-head' }, head('Coin'), head('Price'), head('24h'), head('Mcap'), head('Vol'), head('')));
      table.appendChild(rows);
      rows.appendChild(h('div', { class: 'skeleton-block' }, skeleton('100%', '220px')));

      apiGet(`/api/market?${q.toString()}`, { ttl: 12000 })
        .then((d) => {
          const coins = asArray(d && d.coins);
          const total = num(d && d.total);
          rows.innerHTML = '';
          if (!coins.length) {
            rows.appendChild(emptyState('No coins found', state.search ? 'Try a different search' : 'Nothing matches these filters', 'search'));
            return;
          }
          const pages = Math.max(1, Math.ceil(total / (settings.marketPageSize || 25)));
          totalPages = pages;
          pageInfo.textContent = `page ${page} / ${pages} · ${total.toLocaleString()} coins`;
          prevBtn.disabled = page <= 1;
          nextBtn.disabled = page >= pages;
          if (isMod('marketclock')) clockEl.textContent = `updated ${Math.max(1, Math.round((Date.now() - startTs) / 1000))}s ago`;
          // client-side mcap / volume filters
          if (clientFilters.mcap !== 'all' || clientFilters.vol !== 'all') {
            const list = coins.filter((c) => {
              if (clientFilters.mcap !== 'all' && mcapKey(num(c.marketCap)) !== clientFilters.mcap) return false;
              if (clientFilters.vol !== 'all' && volKey(num(c.volume24h)) !== clientFilters.vol) return false;
              return true;
            });
            coins.splice(0, coins.length, ...list);
          }
          renderCards(coins);
          renderDists(coins);
          coins.forEach((c) => {
            const mc = num(c.marketCap), vol = num(c.volume24h), ch = num(c.change24h);
            const rowCls = ['mkt-grid', 'mkt-row'];
            if (isMod('microcaps') && mc > 0 && mc < 50000) rowCls.push('micro');
            if (isMod('megaliths') && mc >= 5e6) rowCls.push('mega');
            const row = h('button', { class: rowCls.join(' '), onclick: () => openCoin(c.symbol) },
              h('div', { class: 'mkt-cell mkt-coin' }, avatar(c.symbol, 24), h('div', {},
                h('div', { class: 'mkt-sym' }, c.symbol),
                h('div', { class: 'mkt-name' }, c.name || ''),
              )),
              h('div', { class: 'mkt-cell mono' },
                isMod('priceband') ? h('span', { class: 'price-dot', style: `background:${ch >= 0 ? '#34d399' : '#ef4444'}` }) : null,
                fmtPrice(num(c.currentPrice)),
              ),
              h('div', { class: 'mkt-cell' }, heatEl(ch)),
              h('div', { class: 'mkt-cell mono' }, fmtBuss(mc)),
              h('div', { class: 'mkt-cell mono' }, fmtBuss(vol)),
              h('div', { class: 'mkt-cell mkt-star', onclick: (ev) => {
                ev.stopPropagation();
                const on = toggleWatch(c.symbol);
                ev.currentTarget.innerHTML = '';
                ev.currentTarget.appendChild(icon(on ? 'starFilled' : 'star', 14));
              } }, icon(isWatched(c.symbol) ? 'starFilled' : 'star', 14)),
            );
            rows.appendChild(row);
          });
        })
        .catch((e) => {
          rows.innerHTML = '';
          rows.appendChild(errorState(e.message, load));
        });
    }

    load();
    return root;
  }

  // ════════════════════════════════════════════════════════════════════
  // Watchlist
  // ════════════════════════════════════════════════════════════════════

  function watchlistView() {
    const root = h('div', { class: 'view' });
    const grid = h('div', { class: 'watch-grid' });
    root.appendChild(grid);

    function load() {
      const list = getWatchlist();
      grid.innerHTML = '';
      if (!list.length) {
        grid.appendChild(emptyState('Watchlist is empty', 'Star coins in the market or coin terminal to track them', 'star'));
        return;
      }
      list.forEach((sym) => {
        const card = h('button', { class: 'card watch-card', onclick: () => openCoin(sym) },
          h('div', { class: 'watch-head' },
            avatar(sym, 26),
            h('div', { class: 'mini-main' },
              h('div', { class: 'mini-name' }, sym),
              h('div', { class: 'mini-sub' }, 'loading…'),
            ),
            h('button', {
              class: 'btn btn-ghost btn-sm',
              onclick: (ev) => { ev.stopPropagation(); toggleWatch(sym); load(); },
            }, icon('x', 13)),
          ),
          h('div', { class: 'watch-chart' }, skeleton('100%', '30px')),
          h('div', { class: 'watch-stats' }, skeleton('60%', '12px'), skeleton('40%', '12px')),
        );
        grid.appendChild(card);

        apiGet(`/api/coin/${sym}`, { ttl: 15000 })
          .then((d) => {
            const c = d && d.coin;
            if (!c) return;
            const sub = $('.mini-sub', card);
            if (sub) sub.textContent = c.name || '';
            const closes = asArray(d && d.candlestickData).map((k) => num(k.close)).filter((v) => v > 0);
            const chart = $('.watch-chart', card);
            const stats = $('.watch-stats', card);
            if (chart) {
              chart.innerHTML = '';
              chart.appendChild(sparkline(closes.length > 1 ? closes : [num(c.currentPrice)], { w: 150, h: 30 }));
            }
            if (stats) {
              stats.innerHTML = '';
              stats.appendChild(h('div', { class: 'mono watch-price' }, fmtPrice(num(c.currentPrice))));
              stats.appendChild(changeEl(num(c.change24h)));
            }
          })
          .catch(() => { /* card keeps its skeleton → graceful */ });
      });
    }

    load();
    const off = bus.on('watchlist', load);
    onCleanup(() => off());
    return root;
  }

  // ════════════════════════════════════════════════════════════════════
  // Hopium
  // ════════════════════════════════════════════════════════════════════

  function oddsBar(q) {
    const yesPct = num(q.yesPercentage ?? q.yesPercent, 0);
    const bar = h('div', { class: 'odds' },
      h('div', { class: 'odds-track' },
        h('div', { class: 'odds-fill yes', style: `width:${Math.max(0, Math.min(100, yesPct))}%` }),
      ),
      h('div', { class: 'odds-labels' },
        h('span', { class: 'mono up' }, `YES ${yesPct.toFixed(0)}%`),
        h('span', { class: 'mono down' }, `NO ${(100 - yesPct).toFixed(0)}%`),
      ),
    );
    return bar;
  }

  function hopiumView() {
    const root = h('div', { class: 'view' });
    let nearOnly = false;
    const statusSel = isMod('hopiumstatus') ? h('select', { class: 'select' },
      [['ACTIVE', 'Active'], ['ALL', 'All'], ['RESOLVED', 'Resolved']].map(([v, l]) => h('option', { value: v, selected: v === 'ACTIVE' }, l)),
    ) : null;
    const countsRow = h('div', { class: 'market-stats mono' });
    const hotRow = h('div', { class: 'hopium-hot' });
    const nearBtn = isMod('nearresolve') ? h('button', { class: 'btn btn-ghost btn-sm' }, '⚡ resolving < 24h') : null;
    if (nearBtn) nearBtn.addEventListener('click', () => { nearOnly = !nearOnly; nearBtn.classList.toggle('on', nearOnly); load(); });
    const list = h('div', { class: 'hopium-list' });
    root.appendChild(h('div', { class: 'market-toolbar' }, statusSel, nearBtn,
      isMod('hopiumcreate') ? h('button', { class: 'btn btn-ghost btn-sm', onclick: () => hopiumComposer(() => load()) }, icon('send', 13), ' Propose') : null,
    ));
    if (isMod('qcounts')) root.appendChild(countsRow);
    if (isMod('hotmarkets')) root.appendChild(hotRow);
    root.appendChild(list);

    function load() {
      list.innerHTML = '';
      list.appendChild(h('div', { class: 'skeleton-block' }, skeleton('100%', '200px')));
      const status = statusSel ? statusSel.value : 'ACTIVE';
      apiGet(`/api/hopium/questions?status=${status}&limit=100`, { ttl: 20000 })
        .then((d) => {
          let qs = asArray(d && d.questions);
          list.innerHTML = '';
          if (!qs.length) {
            list.appendChild(emptyState('No questions', 'Nothing in this status right now', 'trend'));
            return;
          }
          if (isMod('qcounts') || isMod('qvolume')) {
            const act = qs.filter((q) => q.status === 'ACTIVE').length;
            const res = qs.filter((q) => q.status === 'RESOLVED').length;
            const staked = qs.reduce((s, q) => s + num(q.totalYesAmount ?? q.totalYes, 0) + num(q.totalNoAmount ?? q.totalNo, 0), 0);
            const parts = [];
            if (isMod('qcounts')) parts.push(`${act} active · ${res} resolved · ${qs.length} total`);
            if (isMod('qvolume')) parts.push(`${fmtBuss(staked)} staked`);
            countsRow.textContent = parts.join(' · ');
          }
          if (isMod('hotmarkets')) {
            hotRow.innerHTML = '';
            const hot = [...qs].sort((a, b) => (num(b.totalYesAmount ?? b.totalYes, 0) + num(b.totalNoAmount ?? b.totalNo, 0)) - (num(a.totalYesAmount ?? a.totalYes, 0) + num(a.totalNoAmount ?? a.totalNo, 0))).slice(0, 3);
            hot.forEach((q) => {
              const staked = num(q.totalYesAmount ?? q.totalYes, 0) + num(q.totalNoAmount ?? q.totalNo, 0);
              hotRow.appendChild(h('button', { class: 'chip hot-chip', onclick: () => setView('hopium', q.id) },
                (q.question || '').slice(0, 42), ' · ', h('span', { class: 'mono' }, fmtBuss(staked)),
              ));
            });
          }
          if (nearOnly) {
            const now = Date.now() / 1000;
            qs = qs.filter((q) => {
              const e = q.endsAt ? (typeof q.endsAt === 'number' ? q.endsAt : new Date(q.endsAt).getTime() / 1000) : null;
              return e && e - now > 0 && e - now <= 86400;
            });
            if (!qs.length) {
              list.appendChild(emptyState('Nothing resolving soon', 'No markets end within 24h', 'clock'));
              return;
            }
          }
          if (isMod('resolvedlist') && status === 'ALL') {
            const act = qs.filter((q) => q.status === 'ACTIVE');
            const res = qs.filter((q) => q.status === 'RESOLVED');
            const group = (title, items) => {
              if (!items.length) return;
              list.appendChild(h('div', { class: 'hopium-group' }, title));
              items.forEach((q) => {
                const yesAmt = num(q.totalYesAmount ?? q.totalYes, 0);
                const noAmt = num(q.totalNoAmount ?? q.totalNo, 0);
                const total = yesAmt + noAmt;
                const yesPct = total > 0 ? (yesAmt / total) * 100 : 50;
                list.appendChild(h('button', { class: 'hopium-row', onclick: () => setView('hopium', q.id) },
                  h('div', { class: 'hopium-main' },
                    h('div', { class: 'hopium-q' }, q.question || q.text || 'Untitled question'),
                    h('div', { class: 'hopium-meta' },
                      isMod('qdepth') ? h('span', { class: 'mono' }, fmtBuss(total), ' staked') : null,
                      h('span', { class: 'status-pill' }, (q.status || '').toLowerCase()),
                    ),
                  ),
                  isMod('oddsbars') ? oddsBar(q) : null,
                ));
              });
            };
            list.innerHTML = '';
            group('ACTIVE', act);
            group('RESOLVED', res);
            if (!list.children.length) list.appendChild(emptyState('No questions', 'Nothing in this status right now', 'trend'));
            return;
          }
          qs.forEach((q) => {
            const endsAt = q.endsAt ? (typeof q.endsAt === 'number' ? q.endsAt : new Date(q.endsAt).getTime() / 1000) : null;
            const yesAmt = num(q.totalYesAmount ?? q.totalYes, 0);
            const noAmt = num(q.totalNoAmount ?? q.totalNo, 0);
            const total = yesAmt + noAmt;
            const yesPct = total > 0 ? (yesAmt / total) * 100 : 50;
            list.appendChild(h('button', {
              class: 'hopium-row',
              onclick: () => setView('hopium', q.id),
            },
              h('div', { class: 'hopium-main' },
                h('div', { class: 'hopium-q' }, q.question || q.text || 'Untitled question'),
                h('div', { class: 'hopium-meta' },
                  isMod('countdown') && endsAt ? h('span', { class: 'mono count-pill' }, icon('clock', 11), ' ', countdown(endsAt)) : null,
                  isMod('qdepth') ? h('span', { class: 'mono' }, fmtBuss(total), ' staked') : null,
                  isMod('qspread') ? h('span', { class: 'mono spread-pill' }, `${Math.abs(50 - yesPct).toFixed(0)}pt edge`) : null,
                  isMod('qev') ? h('span', { class: 'mono ev-pill' }, `YES est. ${hopiumEV(yesPct).toFixed(2)}x`) : null,
                  h('span', { class: 'status-pill' }, (q.status || 'ACTIVE').toLowerCase()),
                ),
              ),
              isMod('oddsbars') ? oddsBar(q) : null,
            ));
          });
        })
        .catch((e) => {
          list.innerHTML = '';
          list.appendChild(errorState(e.message, load));
        });
    }

    if (statusSel) statusSel.addEventListener('change', load);
    load();
    return root;
  }

  // pool-based EV estimate: fair odds vs implied YES% (labeled est.)
  function hopiumEV(yesPct) {
    const p = Math.max(0.01, Math.min(0.99, yesPct / 100));
    return 1 / p;
  }

  function hopiumDetail(id) {
    const root = h('div', { class: 'view' });
    root.appendChild(h('div', { class: 'view-toolbar' },
      h('button', { class: 'btn btn-ghost btn-sm', onclick: () => goBack() }, icon('back', 14), ' Questions'),
    ));
    const body = h('div', {});
    root.appendChild(body);

    function load() {
      body.innerHTML = '';
      body.appendChild(h('div', { class: 'skeleton-block' }, skeleton('100%', '160px')));
      apiGet(`/api/hopium/questions/${id}`, { ttl: 6000 })
        .then((d) => {
          const q = d && d.question;
          if (!q) throw new Error('Question not found');
          body.innerHTML = '';
          const endsAt = q.endsAt ? (typeof q.endsAt === 'number' ? q.endsAt : new Date(q.endsAt).getTime() / 1000) : null;
          const yesAmt = num(q.totalYesAmount ?? q.totalYes, 0);
          const noAmt = num(q.totalNoAmount ?? q.totalNo, 0);
          const yesPct = num(q.yesPercentage ?? q.yesPercent, yesAmt + noAmt > 0 ? (yesAmt / (yesAmt + noAmt)) * 100 : 0);

          body.appendChild(h('div', { class: 'card' },
            h('div', { class: 'hopium-q big' }, q.question || q.text),
            h('div', { class: 'hopium-meta' },
              isMod('countdown') && endsAt ? h('span', { class: 'mono count-pill' }, icon('clock', 11), ' ', countdown(endsAt)) : null,
              isMod('qdepth') ? h('span', { class: 'mono' }, fmtBuss(yesAmt + noAmt), ' staked') : null,
              h('span', { class: 'status-pill' }, (q.status || 'ACTIVE').toLowerCase()),
            ),
            isMod('oddsbars') ? oddsBar(q) : null,
          ));

          const hist = asArray(d && d.probabilityHistory);
          if (isMod('probchart') && hist.length > 1) {
            const pts = hist.map((p) => num(p.yesPercentage ?? p.yesPercent ?? p.probability, 0));
            body.appendChild(h('div', { class: 'card' },
              sectionTitle('YES% History', 'trend'),
              h('div', { class: 'prob-chart' }, sparkline(pts, { w: 620, h: 90, up: pts[pts.length - 1] >= pts[0] })),
            ));
          }

          if (isMod('betting') && authed) {
            const amount = h('input', { class: 'input', type: 'number', min: '0', step: 'any', placeholder: 'BUSS to bet' });
            const betBtn = (side) => h('button', {
              class: `btn ${side ? 'btn-primary' : 'btn-ghost'}`,
              onclick: async (ev) => {
                const amt = num(parseFloat(amount.value), 0);
                if (amt <= 0) { toast('error', 'Enter an amount', 'BUSS to bet'); return; }
                const btn = ev.currentTarget;
                btn.disabled = true;
                try {
                  await apiPost(`/api/hopium/questions/${id}/bet`, { side, amount: amt });
                  toast('success', 'Bet placed', side ? 'YES' : 'NO', 3200);
                  bus.emit('portfolio');
                  load();
                } catch (e) {
                  toast('error', 'Bet failed', e.message);
                  btn.disabled = false;
                }
              },
            }, side ? 'Bet YES' : 'Bet NO');
            body.appendChild(h('div', { class: 'card' },
              sectionTitle('Bet Terminal', 'coin'),
              h('div', { class: 'bet-row' }, amount, betBtn(true), betBtn(false)),
              h('div', { class: 'card-hint' }, 'YES pays out when the question resolves true. Odds shown above are live pool prices.'),
            ));
          }

          if (isMod('betting') && !authed) {
            body.appendChild(h('div', { class: 'card' }, emptyState('Sign in to bet', 'Bets run on your own RugPlay session', 'lock')));
          }
        })
        .catch((e) => {
          body.innerHTML = '';
          body.appendChild(errorState(e.message, load));
        });
    }

    load();
    return root;
  }

  // ════════════════════════════════════════════════════════════════════
  // Leaders
  // ════════════════════════════════════════════════════════════════════

  function leadersView() {
    const root = h('div', { class: 'view' });
    const tabs = h('div', { class: 'seg-row' },
      h('button', { class: 'seg-pill on', onclick: (ev) => { seg(ev, 'pull'); } }, 'Top Rugpullers'),
      h('button', { class: 'seg-pill', onclick: (ev) => { seg(ev, 'loss'); } }, 'Biggest Losers'),
    );
    root.appendChild(tabs);
    const list = h('div', { class: 'leader-list' });
    root.appendChild(list);

    let kind = 'pull';
    function seg(ev, k) {
      kind = k;
      tabs.querySelectorAll('.seg-pill').forEach((p) => p.classList.remove('on'));
      ev.currentTarget.classList.add('on');
      load();
    }

    function load() {
      list.innerHTML = '';
      list.appendChild(h('div', { class: 'skeleton-block' }, skeleton('100%', '240px')));
      apiGet('/api/leaderboard', { ttl: 30000 })
        .then((d) => {
          const all = kind === 'pull' ? asArray(d && d.topRugpullers) : asArray(d && d.biggestLosers);
          list.innerHTML = '';
          if (!all.length) {
            list.appendChild(emptyState('Nobody here yet', 'The leaderboard fills as seasons play out', 'skull'));
            return;
          }
          all.slice(0, 25).forEach((u, i) => {
            const name = u.username || u.user || 'anon';
            const val = num(u.rugpullValue ?? u.value ?? u.amount ?? u.losses ?? 0);
            const nc = u.nameColor && isMod('namecolorfeed') ? nameColorStyle(u.nameColor) : null;
            list.appendChild(h('div', { class: 'leader-row' },
              h('span', { class: 'holder-rank mono' }, String(i + 1).padStart(2, '0')),
              h('button', {
                class: 'holder-user',
                onclick: () => (isMod('profilepeek') ? profileModal(name) : null),
              }, avatar(name, 24), h('span', { style: nc || undefined }, name, u.founderBadge && isMod('founderbadge') ? ' 👑' : null)),
              h('span', { class: 'mono' }, kind === 'pull' ? fmtBuss(val) : fmtQty(num(u.quantity, val))),
            ));
          });
        })
        .catch((e) => {
          list.innerHTML = '';
          list.appendChild(errorState(e.message, load));
        });
    }

    load();
    return root;
  }

  // ════════════════════════════════════════════════════════════════════
  // Portfolio
  // ════════════════════════════════════════════════════════════════════

  function portfolioView() {
    const root = h('div', { class: 'view' });
    const totals = h('div', { class: 'stat-grid' });
    const holdings = h('div', { class: 'card' });
    const txCard = h('div', { class: 'card' });
    const transferCard = h('div', { class: 'card' });
    let firstHoldSym = '';
    root.appendChild(totals);
    root.appendChild(h('div', { class: 'grid-2' }, holdings, h('div', { class: 'right-col' }, transferCard, txCard)));

    // totals
    function loadTotals() {
      totals.innerHTML = '';
      totals.appendChild(h('div', { class: 'skeleton-block' }, skeleton('100%', '64px')));
      apiGet('/api/portfolio/total', { ttl: 10000 })
        .then((d) => {
          totals.innerHTML = '';
          if (!d || d.baseCurrencyBalance === undefined) {
            totals.appendChild(emptyState('Not signed in', 'Sign in on rugplay.com to see your portfolio', 'lock'));
            return;
          }
          totals.appendChild(statCell('Net Worth', fmtBuss(num(d.totalValue)), 'total'));
          totals.appendChild(statCell('Cash', fmtBuss(num(d.baseCurrencyBalance)), 'BUSS liquid'));
          totals.appendChild(statCell('In Coins', fmtBuss(num(d.totalCoinValue)), `${asArray(d.coinHoldings).length} positions`));
          if (isMod('holdingcount')) totals.appendChild(statCell('Positions', String(asArray(d.coinHoldings).length)));
          loadExtras();
          if (isMod('allocation')) {
            const cash = num(d.baseCurrencyBalance), coins = num(d.totalCoinValue), total = cash + coins;
            if (total > 0) {
              const cashPct = (cash / total) * 100;
              totals.appendChild(h('div', { class: 'alloc-wrap' },
                h('div', { class: 'alloc-bar' },
                  h('div', { class: 'alloc-cash', style: `width:${cashPct.toFixed(1)}%` }),
                  h('div', { class: 'alloc-coins', style: `width:${(100 - cashPct).toFixed(1)}%` }),
                ),
                h('div', { class: 'alloc-legend mono' }, `cash ${cashPct.toFixed(0)}% · coins ${(100 - cashPct).toFixed(0)}%`),
              ));
            }
          }
        })
        .catch((e) => {
          totals.innerHTML = '';
          totals.appendChild(errorState(e.message, loadTotals));
        });
    }
    function loadExtras() {
      if (isMod('gemswallet') || isMod('prestigestatus')) {
        Promise.all([
          isMod('gemswallet') ? apiGet('/api/shop/inventory', { ttl: 20000 }).catch(() => null) : Promise.resolve(null),
          isMod('prestigestatus') ? apiGet('/api/prestige', { ttl: 20000 }).catch(() => null) : Promise.resolve(null),
        ]).then(([inv, pg]) => {
          if (inv && inv.gems !== undefined) {
            totals.appendChild(statCell('Gems', String(num(inv.gems)), inv.founderBadge ? 'founder badge' : 'shop currency'));
          }
          if (pg && pg.profile) {
            const lvl = num(pg.profile.prestigeLevel, 0);
            const cost = PRESTIGE_COSTS[lvl + 1];
            totals.appendChild(statCell('Prestige', lvl > 0 ? (PRESTIGE_NAMES[lvl] || `Prestige ${lvl}`) : 'Level 0', cost ? `next: $${fmtShort(cost)}` : 'max level'));
          }
        });
      }
    }
    loadTotals();
    const offP = bus.on('portfolio', loadTotals);
    onCleanup(() => offP());

    // holdings
    function loadHoldings() {
      holdings.innerHTML = '';
      holdings.appendChild(h('div', { class: 'card-head' },
        h('div', { class: 'card-title' }, icon('grid', 14), h('span', {}, 'Holdings')),
      ));
      const body = h('div', { class: 'hold-list' });
      holdings.appendChild(body);
      body.appendChild(h('div', { class: 'skeleton-block' }, skeleton('100%', '140px')));
      apiGet('/api/portfolio/total', { ttl: 10000 })
        .then((d) => {
          const list = asArray(d && d.coinHoldings);
          body.innerHTML = '';
          if (!list.length) {
            body.appendChild(emptyState('No positions', 'Buy your first coin from the market', 'wallet'));
            return;
          }
          if (list[0] && list[0].symbol) firstHoldSym = list[0].symbol;
          const totalVal = list.reduce((s, c) => s + num(c.value), 0);
          const topQty = list.reduce((s, c) => s + num(c.quantity), 0);
          let biggest = list[0], topVal = list[0];
          list.forEach((c) => { if (num(c.value) > num(biggest.value)) biggest = c; if (num(c.value) > num(topVal.value)) topVal = c; });
          if (isMod('avgentry') && topQty > 0) {
            body.appendChild(h('div', { class: 'insight-row mono' }, `avg entry ${fmtPrice(totalVal / topQty)} per token · ${list.length} coins`));
          }
          list.forEach((c) => {
            const isBig = isMod('biggesthold') && c === biggest;
            const isTop = isMod('topvalue') && c === topVal;
            body.appendChild(h('button', { class: `mini-row ${isBig ? 'big' : ''} ${isTop ? 'topv' : ''}`, onclick: () => openCoin(c.symbol) },
              avatar(c.symbol, 24),
              h('div', { class: 'mini-main' },
                h('div', { class: 'mini-name' }, c.symbol, isBig ? h('span', { class: 'mini-tag' }, 'biggest') : null, isTop ? h('span', { class: 'mini-tag' }, 'top value') : null),
                h('div', { class: 'mini-sub' }, fmtQty(num(c.quantity)), ' tokens', isMod('holdingpct') && totalVal > 0 ? ` · ${((num(c.value) / totalVal) * 100).toFixed(1)}%` : ''),
              ),
              h('div', { class: 'mini-right' },
                h('div', { class: 'mono' }, fmtBuss(num(c.value))),
                h('div', { class: 'mini-sub' }, changeEl(num(c.percentageChange))),
              ),
            ));
          });
        })
        .catch((e) => {
          body.innerHTML = '';
          body.appendChild(errorState(e.message, loadHoldings));
        });
    }
    loadHoldings();

    // transactions (with real type filters + search from the API)
    let txType = 'all';
    let txQuery = '';
    const txBody = h('div', { class: 'tx-list' });
    txCard.appendChild(h('div', { class: 'card-head' },
      h('div', { class: 'card-title' }, icon('book', 14), h('span', {}, 'Transactions')),
    ));
    const txCtrl = h('div', { class: 'tx-ctrl' });
    if (isMod('txfilter')) {
      const sel = h('select', { class: 'select' },
        [['all', 'All types'], ['BUY', 'BUY'], ['SELL', 'SELL'], ['TRANSFER_IN', 'Cash in'], ['TRANSFER_OUT', 'Cash out']].map(([v, l]) => h('option', { value: v, selected: txType === v }, l)),
      );
      sel.addEventListener('change', () => { txType = sel.value; loadTx(); });
      txCtrl.appendChild(sel);
    }
    if (isMod('txsearch')) {
      const inp = h('input', { class: 'input tx-search', placeholder: 'Search transactions…' });
      inp.addEventListener('input', debounce((ev) => { txQuery = ev.target.value.trim(); loadTx(); }, 350));
      txCtrl.appendChild(inp);
    }
    if (txCtrl.children.length) txCard.appendChild(txCtrl);
    txCard.appendChild(txBody);
    function loadTx() {
      txBody.innerHTML = '';
      txBody.appendChild(h('div', { class: 'skeleton-block' }, skeleton('100%', '120px')));
      const q = new URLSearchParams({ limit: '15' });
      if (txType !== 'all') q.set('type', txType);
      if (txQuery) q.set('search', txQuery);
      apiGet(`/api/transactions?${q.toString()}`, { ttl: 12000 })
        .then((d) => {
          const list = asArray(d && d.transactions);
          txBody.innerHTML = '';
          if (!list.length) {
            txBody.appendChild(emptyState('No activity yet', 'Your trades and transfers show up here', 'book'));
            return;
          }
          if (isMod('txsummary')) {
            const buys = list.filter((t) => String(t.type || '').toUpperCase() === 'BUY').length;
            const sells = list.filter((t) => String(t.type || '').toUpperCase() === 'SELL').length;
            const outs = list.filter((t) => String(t.type || '').toUpperCase() === 'TRANSFER_OUT').length;
            txBody.appendChild(h('div', { class: 'tx-summary mono' }, `${buys} buys · ${sells} sells · ${outs} sent`));
          }
          list.forEach((t, i) => {
            const type = String(t.type || 'TRADE').toUpperCase();
            const isBuy = type === 'BUY';
            const sym = t.symbol || (t.coin && t.coin.symbol) || '';
            const val = num(t.totalBaseCurrencyAmount ?? t.amount ?? t.value);
            const ts = t.createdAt || t.timestamp;
            txBody.appendChild(h('div', { class: `feed-row ${isMod('txlatest') && i === 0 ? 'latest' : ''}` },
              h('span', { class: `tx-type ${isBuy ? 'up' : ''}`, style: `color:${type === 'TRANSFER' ? '#a78bfa' : ''}` }, type),
              h('div', { class: 'mini-main' },
                h('div', { class: 'mini-name' }, sym || (t.otherUser ? '@' + (t.otherUser.username || '') : '-'), i === 0 && isMod('txlatest') ? h('span', { class: 'mini-tag' }, 'latest') : null),
                h('div', { class: 'mini-sub' }, ts ? timeAgo(new Date(ts).getTime()) : ''),
              ),
              h('span', { class: 'mono' }, val ? fmtBuss(val) : ''),
            ));
          });
        })
        .catch((e) => {
          txBody.innerHTML = '';
          txBody.appendChild(errorState(e.message, loadTx));
        });
    }
    loadTx();

    // transfer
    if (isMod('transfer')) {
      transferCard.appendChild(sectionTitle('Cash Transfer', 'send'));
      const userIn = h('input', { class: 'input', placeholder: 'Recipient username' });
      const amtIn = h('input', { class: 'input', type: 'number', min: '10', step: 'any', placeholder: 'Amount (min $10)' });
      const goBtn = h('button', { class: 'btn btn-primary', onclick: async (ev) => {
        const username = (userIn.value || '').trim();
        const amt = num(parseFloat(amtIn.value), 0);
        if (!username || amt < 10) { toast('error', 'Invalid transfer', 'Username required, min $10 cash'); return; }
        const btn = ev.currentTarget;
        btn.disabled = true;
        try {
          await apiPost('/api/transfer', { recipientUsername: username, type: 'CASH', amount: amt, coinSymbol: null });
          toast('success', 'Transfer sent', `$${amt.toFixed(2)} to @${username}`, 3400);
          userIn.value = '';
          amtIn.value = '';
          bus.emit('portfolio');
          loadTotals();
        } catch (e) {
          toast('error', 'Transfer failed', e.message);
        } finally {
          btn.disabled = false;
        }
      } }, icon('send', 13), ' Send');
      transferCard.appendChild(userIn);
      transferCard.appendChild(amtIn);
      transferCard.appendChild(goBtn);
      const coinBtn = h('button', { class: 'btn btn-ghost', onclick: () => {
        transferModal('', firstHoldSym);
      } }, icon('send', 13), ' Send coins…');
      transferCard.appendChild(coinBtn);
      transferCard.appendChild(h('div', { class: 'card-hint' }, 'Cash min $10 · 1% fee. Coins: no fee, ~$10+ value - the site only exposes cash transfers.'));
    }

    return root;
  }

  // ════════════════════════════════════════════════════════════════════
  // Live feed
  // ════════════════════════════════════════════════════════════════════

  function liveView() {
    const root = h('div', { class: 'view' });
    const list = h('div', { class: 'live-list' });
    const status = h('span', { class: 'live-status' }, 'connecting…');
    root.appendChild(h('div', { class: 'card-head live-head' },
      h('div', { class: 'card-title' }, icon('zap', 14), h('span', {}, 'Every trade, as it lands')),
      status,
    ));
    root.appendChild(list);

    let timer = null;
    function load() {
      apiGet('/api/trades/recent?limit=60', { ttl: 4000 })
        .then((d) => {
          const trades = asArray(d && d.trades);
          status.textContent = `${trades.length} trades · live`;
          list.innerHTML = '';
          if (!trades.length) {
            list.appendChild(emptyState('Quiet market', 'Trades appear the moment they hit the pool', 'zap'));
            return;
          }
          trades.forEach((t) => {
            const isBuy = (t.type || '').toUpperCase() === 'BUY';
            const ts = t.createdAt || t.timestamp;
            list.appendChild(h('button', {
              class: 'feed-row',
              onclick: () => (t.symbol ? openCoin(t.symbol) : null),
            },
              avatar(t.username || t.symbol, 24),
              h('div', { class: 'mini-main' },
                h('div', { class: 'mini-name' }, t.symbol || '-', ' ', h('span', { class: isBuy ? 'up' : 'down' }, isBuy ? 'BUY' : 'SELL')),
                h('div', { class: 'mini-sub' }, (t.username || 'anon') + (ts ? ' · ' + timeAgo(new Date(ts).getTime()) : '')),
              ),
              h('span', { class: 'mono' }, fmtBuss(num(t.totalBaseCurrencyAmount ?? t.amount ?? t.value))),
            ));
          });
        })
        .catch(() => {
          status.textContent = 'offline - retrying';
        });
    }
    const offWs = [];
    if (isMod('realtime')) {
      const prependTrade = (t) => {
        if (!t) return;
        const isBuy = (t.type || '').toUpperCase() === 'BUY';
        const ts = t.timestamp ? Number(t.timestamp) * (t.timestamp < 1e12 ? 1000 : 1) : Date.now();
        list.prepend(h('button', { class: 'feed-row', onclick: () => openCoin(t.coinSymbol || t.symbol) },
          avatar(t.username || t.symbol, 24),
          h('div', { class: 'mini-main' },
            h('div', { class: 'mini-name' }, (t.coinSymbol || t.symbol || '-'), ' ', h('span', { class: isBuy ? 'up' : 'down' }, isBuy ? 'BUY' : 'SELL')),
            h('div', { class: 'mini-sub' }, (t.username || 'anon') + (ts ? ' - ' + timeAgo(ts) : '')),
          ),
          h('span', { class: 'mono' }, fmtBuss(num(t.totalValue ?? t.totalBaseCurrencyAmount ?? t.amount))),
        ));
        while (list.children.length > 60) list.lastChild.remove();
        status.textContent = 'live via socket';
      };
      offWs.push(bus.on('ws:live-trade', (m) => prependTrade(m && m.data)));
      offWs.push(bus.on('ws:all-trades', (m) => prependTrade(m && m.data)));
    }
    load();
    timer = setInterval(load, Math.max(4, num(settings.tickerSeconds, 8)) * 1000);
    onCleanup(() => { clearInterval(timer); offWs.forEach((fn) => fn()); });
    return root;
  }

  // ════════════════════════════════════════════════════════════════════
  // Progress (achievements)
  // ════════════════════════════════════════════════════════════════════

  function progressView() {
    const root = h('div', { class: 'view' });
    const head = h('div', { class: 'card-head prog-head' });
    let diff = 'all';
    let cat = 'all';
    let query = '';
    const grid = h('div', { class: 'ach-grid' });
    root.appendChild(head);

    // search (mod-gated)
    if (isMod('achsearch')) {
      const sInp = h('input', { class: 'input search-input', placeholder: 'Search achievements…' });
      sInp.addEventListener('input', debounce((ev) => { query = ev.target.value.trim().toLowerCase(); load(); }, 300));
      root.appendChild(sInp);
    }

    if (isMod('achwalls')) {
      const wallRow = h('div', { class: 'market-toolbar' },
        h('input', { class: 'input search-input', placeholder: 'Look up any trader...' }),
        h('button', { class: 'btn btn-ghost btn-sm', onclick: () => { const v = wallRow.querySelector('input').value.trim(); if (v) achievementWallModal(v); } }, icon('award', 13), ' Achievement wall'),
      );
      root.appendChild(wallRow);
    }

    // difficulty + category filters (mod-gated)
    const chips = h('div', { class: 'chip-row' });
    function chipSel(ev) {
      chips.querySelectorAll('.chip').forEach((x) => x.classList.remove('on'));
      ev.currentTarget.classList.add('on');
    }
    if (isMod('difficultyfilter')) {
      chips.appendChild(h('button', { class: 'chip on', onclick: (ev) => { diff = 'all'; chipSel(ev); load(); } }, 'All difficulties'));
      ACH_DIFFICULTY.forEach((d) => chips.appendChild(h('button', { class: 'chip', onclick: (ev) => { diff = d; chipSel(ev); load(); } }, d[0].toUpperCase() + d.slice(1))));
    }
    if (isMod('categoryfilter')) {
      chips.appendChild(h('button', { class: 'chip on', onclick: (ev) => { cat = 'all'; chipSel(ev); load(); } }, 'All categories'));
      ACH_CATEGORIES.forEach((c) => chips.appendChild(h('button', { class: 'chip', onclick: (ev) => { cat = c; chipSel(ev); load(); } }, c)));
    }
    if (chips.children.length) root.appendChild(chips);
    root.appendChild(grid);

    function load() {
      head.innerHTML = '';
      grid.innerHTML = '';
      grid.appendChild(h('div', { class: 'skeleton-block' }, skeleton('100%', '220px')));
      apiGet('/api/achievements', { ttl: 15000 })
        .then((d) => {
          const all = asArray(d && d.achievements);
          const unclaimed = num(d && d.unclaimedCount, 0);
          const unlocked = num(d && d.unlockedCount, 0);
          let list = all;
          if (diff !== 'all') list = list.filter((a) => a.difficulty === diff);
          if (cat !== 'all') list = list.filter((a) => a.category === cat);
          if (query) list = list.filter((a) => ((a.name || '') + ' ' + (a.description || '')).toLowerCase().includes(query));
          grid.innerHTML = '';
          if (isMod('recentunlock')) {
            const unlockedList = all.filter((a) => a.unlocked && a.unlockedAt).sort((a, b) => num(b.unlockedAt) - num(a.unlockedAt));
            if (unlockedList.length) {
              const r = unlockedList[0];
              grid.appendChild(h('div', { class: 'card recent-unlock' },
                sectionTitle('Recent Unlock', 'clock'),
                h('div', { class: 'ev' },
                  evRow(r.name, timeAgo(new Date(num(r.unlockedAt)).getTime())),
                ),
              ));
            }
          }
          if (!list.length) {
            grid.appendChild(emptyState('No achievements match', 'Try different filters', 'award'));
            return;
          }
          if (isMod('achcount')) {
            head.appendChild(h('span', { class: 'card-note mono' }, `${unlocked}/${all.length} unlocked`));
          }
          if (isMod('achievementdeck') || isMod('unclaimedbadge')) {
            head.appendChild(h('div', { class: 'card-title' }, icon('award', 14), h('span', {}, `${unlocked} unlocked · ${unclaimed} claimable · ${all.length} total`)));
            if (unclaimed > 0 && isMod('claimall')) {
              head.appendChild(h('button', { class: 'btn btn-primary btn-sm', onclick: async (ev) => {
                const btn = ev.currentTarget;
                btn.disabled = true;
                try {
                  await apiPost('/api/achievements/claim', {});
                  toast('success', 'Rewards claimed', `${unclaimed} achievement reward${unclaimed > 1 ? 's' : ''}`, 3400);
                  bus.emit('portfolio');
                  load();
                } catch (e) {
                  toast('error', 'Claim failed', e.message);
                  btn.disabled = false;
                }
              } }, 'Claim all', ' ', String(unclaimed)));
            }
          }
          list.forEach((a) => {
            const on = !!a.unlocked;
            const prog = num(a.progress, 0);
            const target = num(a.targetValue, 0);
            grid.appendChild(h('div', { class: `ach-card ${on ? 'unlocked' : ''} ${a.claimed ? 'claimed' : ''}` },
              h('div', { class: 'ach-icon' }, icon(on ? 'award' : 'lock', 18)),
              h('div', { class: 'ach-name' }, a.name || a.title || 'Achievement'),
              h('div', { class: 'ach-desc' }, a.description || a.desc || ''),
              isMod('rewardview') && num(a.cashReward, 0) > 0 ? h('div', { class: 'ach-reward mono' },
                h('span', { class: 'ar-cash' }, fmtBuss(num(a.cashReward))),
                num(a.gemReward, 0) > 0 ? h('span', { class: 'ar-gems' }, `+${num(a.gemReward)} gems`) : null,
              ) : null,
              isMod('progressbars') && target > 0 ? h('div', { class: 'ach-prog' },
                h('div', { class: 'ap-track' }, h('div', { class: 'ap-fill', style: `width:${Math.min(100, (prog / target) * 100).toFixed(1)}%` })),
                h('span', { class: 'ap-label mono' }, `${fmtShort(prog)} / ${fmtShort(target)}`),
              ) : null,
              h('div', { class: 'ach-state' },
                a.claimed ? h('span', { class: 'ach-pill done' }, 'claimed') :
                on ? h('span', { class: 'ach-pill on' }, 'unlocked') :
                h('span', { class: 'ach-pill' }, 'locked'),
              ),
            ));
          });
        })
        .catch((e) => {
          grid.innerHTML = '';
          grid.appendChild(errorState(e.message, load));
        });
    }

    load();
    return root;
  }

  // ════════════════════════════════════════════════════════════════════
  // Gamble Lab - EV from the exact server rules
  // ════════════════════════════════════════════════════════════════════

  function gambleView() {
    const root = h('div', { class: 'view' });

    const statsCard = h('div', { class: 'card' });
    statsCard.appendChild(sectionTitle('Arcade Stats', 'chart'));
    const sBody = h('div', {});
    statsCard.appendChild(sBody);
    sBody.appendChild(skeleton('100%', '40px'));
    apiGet('/api/user/arcade-stats', { ttl: 15000 })
      .then((d) => {
        sBody.innerHTML = '';
        if (!d || d.totalPlayed === undefined) {
          sBody.appendChild(emptyState('Not signed in', 'Your arcade record lives behind the login', 'lock'));
          return;
        }
        const wins = num(d.wins), losses = num(d.losses), total = num(d.totalPlayed);
        sBody.appendChild(h('div', { class: 'stat-grid' },
          statCell('Wins', String(wins)),
          statCell('Losses', String(losses)),
          statCell('Played', String(total)),
          statCell('Win Rate', total > 0 ? ((wins / total) * 100).toFixed(1) + '%' : '-'),
        ));
      })
      .catch((e) => {
        sBody.innerHTML = '';
        sBody.appendChild(errorState(e.message));
      });
    root.appendChild(statsCard);

    function evCard(title, iconName, rows, hint) {
      return h('div', { class: 'card' }, sectionTitle(title, iconName), h('div', { class: 'ev' }, rows), hint ? h('div', { class: 'card-hint' }, hint) : null);
    }
    const d = EV.dice();
    const c = EV.coinflip();
    const s = EV.slots();
    root.appendChild(h('div', { class: 'grid-3' },
      evCard('Dice', 'dice', [
        evRow('Win chance', (d.chance * 100).toFixed(1) + '%'),
        evRow('Payout', d.mult + '×'),
        evRow('EV per $1', '$' + d.ev.toFixed(2), 'bad'),
        evRow('House edge', (d.edge * 100).toFixed(0) + '%', 'bad'),
      ], 'Pick 1-6 and hit the number. The 50% house edge makes this the worst game on the platform.'),
      evCard('Coinflip', 'coin', [
        evRow('Win chance', (c.chance * 100).toFixed(1) + '%'),
        evRow('Payout', c.mult + '×'),
        evRow('EV per $1', '$' + c.ev.toFixed(2), 'good'),
        evRow('House edge', (c.edge * 100).toFixed(0) + '%', 'good'),
      ], 'The only fair game - $1 in, $1 expected back. If you must gamble, do it here.'),
      evCard('Slots', 'sparkle', [
        evRow('Triple match', '×5 · ' + ((s.p3 || 0) * 100).toFixed(2) + '%'),
        evRow('Pair match', '×2 · ' + ((s.p2 || 0) * 100).toFixed(2) + '%'),
        evRow('EV per $1', '$' + s.ev.toFixed(4), 'mid'),
        evRow('House edge', (s.edge * 100).toFixed(2) + '%', 'mid'),
      ], 'Six symbols on three reels. The 2.8% edge is the gentlest of the rigged games.'),
    ));

    // mines + tower calculators
    const mines = h('div', { class: 'card' });
    const tower = h('div', { class: 'card' });
    mines.appendChild(sectionTitle('Mines Calculator', 'bomb'));
    tower.appendChild(sectionTitle('Tower Calculator', 'layers'));

    const mPicks = h('input', { class: 'input', type: 'number', min: '1', max: '24', value: '2' });
    const mMines = h('input', { class: 'input', type: 'number', min: '1', max: '24', value: '3' });
    const mOut = h('div', { class: 'ev' });
    const tDiff = h('select', { class: 'select' },
      h('option', { value: 'easy' }, 'Easy · 3 tiles'),
      h('option', { value: 'medium' }, 'Medium · 4 tiles'),
      h('option', { value: 'hard' }, 'Hard · 5 tiles'),
    );
    const tFloor = h('input', { class: 'input', type: 'number', min: '1', max: '12', value: '4' });
    const tOut = h('div', { class: 'ev' });

    function calcMines() {
      const picks = Math.max(1, Math.min(24, Math.round(num(parseFloat(mPicks.value), 2))));
      const bombs = Math.max(1, Math.min(24, Math.round(num(parseFloat(mMines.value), 3))));
      const r = EV.mines(Math.min(picks, 25 - bombs), bombs);
      mOut.innerHTML = '';
      mOut.appendChild(evRow('Survive chance', (r.p * 100).toFixed(2) + '%'));
      mOut.appendChild(evRow('Multiplier', r.mult.toFixed(2) + '×'));
      mOut.appendChild(evRow('EV per $1', '$' + r.ev.toFixed(3), 'bad'));
      mOut.appendChild(evRow('House edge', (r.edge * 100).toFixed(1) + '%', 'bad'));
    }
    function calcTower() {
      const floor = Math.max(1, Math.min(12, Math.round(num(parseFloat(tFloor.value), 4))));
      const r = EV.tower(floor, tDiff.value);
      tOut.innerHTML = '';
      tOut.appendChild(evRow('Survive chance', (r.p * 100).toFixed(2) + '%'));
      tOut.appendChild(evRow('Multiplier', r.mult.toFixed(2) + '×'));
      tOut.appendChild(evRow('EV per $1', '$' + r.ev.toFixed(3), 'bad'));
      tOut.appendChild(evRow('House edge', (r.edge * 100).toFixed(1) + '%', 'bad'));
    }
    mPicks.addEventListener('input', calcMines);
    mMines.addEventListener('input', calcMines);
    tDiff.addEventListener('change', calcTower);
    tFloor.addEventListener('input', calcTower);
    calcMines();
    calcTower();

    mines.appendChild(h('div', { class: 'calc-row' }, mPicks, mMines));
    mines.appendChild(mOut);
    mines.appendChild(h('div', { class: 'card-hint' }, 'Pick count and bombs on the 25-tile grid. Multiplier targets 95% payout.'));
    tower.appendChild(h('div', { class: 'calc-row' }, tDiff, tFloor));
    tower.appendChild(tOut);
    tower.appendChild(h('div', { class: 'card-hint' }, 'Floors climbed at each difficulty. Every step compounds the 5% edge against you.'));
    root.appendChild(h('div', { class: 'grid-2' }, mines, tower));

    // ── expanded gamble mods ──
    const extra = h('div', { class: 'gamble-extra' });

    function tableCard(title, iconName, heads, rows) {
      return h('div', { class: 'card' },
        sectionTitle(title, iconName),
        h('div', { class: 'gt-table' },
          h('div', { class: 'gt-head' }, heads.map((x) => h('span', { class: 'mono' }, x))),
          rows.map((r) => h('div', { class: 'gt-row' }, r.map((x, i) => h('span', { class: `mono gt-c${i}` }, x)))),
        ),
      );
    }

    if (isMod('edgegauge')) {
      const games = [['Dice', 50, 'worst'], ['Slots', 2.8, 'mid'], ['Mines', 5, 'mid'], ['Tower', 5, 'mid'], ['Coinflip', 0, 'best']];
      extra.appendChild(h('div', { class: 'card' },
        sectionTitle('House Edge Gauge', 'gauge'),
        h('div', { class: 'ev' },
          games.map(([name, edge, tone]) => h('div', { class: 'edge-row' },
            h('span', { class: 'edge-name' }, name),
            h('div', { class: 'edge-track' }, h('div', { class: `edge-fill ${tone}`, style: `width:${Math.max(2, edge * 1.2)}%` })),
            h('span', { class: `mono ${tone === 'best' ? 'up' : tone === 'worst' ? 'down' : ''}` }, `${edge}%`),
          )),
        ),
        h('div', { class: 'card-hint' }, 'The platform keeps this on every bet. Lower is better for you.'),
      ));
    }

    if (isMod('fairness')) {
      const rows = [
        ['Coinflip', '50/50', '0%', 'fairest'],
        ['Slots', 'pair 5/12 · triple 1/36', '2.8%', ''],
        ['Mines', 'varies by picks', '5%', ''],
        ['Tower', 'varies by floor', '5%', ''],
        ['Dice', '1 in 6', '50%', 'rigged'],
      ];
      extra.appendChild(tableCard('Fairness Rank', 'trophy', ['Game', 'Odds', 'Edge', ''],
        rows.map(([g, o, e, tone]) => [g, o, h('span', { class: `mono ${tone === 'fairest' ? 'up' : tone === 'rigged' ? 'down' : ''}` }, e), tone === 'fairest' ? '✓ play' : tone === 'rigged' ? 'avoid' : '']),
      ));
    }

    if (isMod('towercalc')) {
      const TOWER_KEYS = ['easy', 'medium', 'hard'];
      const TOWER_LABELS = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
      const floors = [1, 2, 3, 5, 8, 10];
      extra.appendChild(tableCard('Tower Multiplier Table', 'layers', ['Floor', 'Easy', 'Medium', 'Hard'],
        floors.map((f) => {
          const cells = TOWER_KEYS.map((dk) => {
            const r = EV.tower(f, dk);
            return r ? r.mult.toFixed(2) + '×' : '-';
          });
          return [f, ...cells];
        }),
      ));
    }

    if (isMod('minescalc')) {
      const mineSets = [1, 3, 5, 10, 20];
      const picks = [1, 2, 3, 5, 8];
      extra.appendChild(tableCard('Mines Multiplier Table', 'bomb', ['Picks', ...mineSets.map((m) => m + '⛏')],
        picks.map((p) => {
          const cells = mineSets.map((m) => {
            if (p > 25 - m) return '-';
            const r = EV.mines(p, m);
            return r.mult.toFixed(1) + '×';
          });
          return [p, ...cells];
        }),
      ));
    }

    if (isMod('coinflipmath')) {
      const n = [1, 2, 3, 5, 10];
      extra.appendChild(tableCard('Coinflip Streak Odds', 'coin', ['Wins in a row', 'Chance', 'Payout if fair'],
        n.map((k) => [k, `${(Math.pow(0.5, k) * 100).toFixed(2)}%`, `${Math.pow(2, k).toLocaleString()}×`]),
      ));
    }

    if (isMod('slotscombo')) {
      const SYMBOLS = ['bussin', 'lyntr', 'subterfuge', 'twoblade', 'wattesigma', 'webx'];
      extra.appendChild(tableCard('Slots Combos', 'sparkle', ['Combo', 'Chance', 'Payout'],
        [
          ['3 of a kind', `${(6 / 216 * 100).toFixed(2)}%`, '×5'],
          ['Any pair', `${(90 / 216 * 100).toFixed(2)}%`, '×2'],
          ['Nothing', `${(120 / 216 * 100).toFixed(2)}%`, '×0'],
        ].concat(SYMBOLS.map((sym) => [`${sym}×3`, `${(1 / 216 * 100).toFixed(2)}%`, '×5'])),
      ));
    }

    if (isMod('betlimits')) {
      extra.appendChild(tableCard('Tower Bet Limits', 'shield', ['Difficulty', 'Tiles', 'Bombs', 'Max bet'],
        [['Easy', '3', '1', '$1,000,000'], ['Medium', '4', '2', '$100,000'], ['Hard', '5', '3', '$10,000']],
      ));
    }

    if (isMod('minesrules')) {
      extra.appendChild(h('div', { class: 'card' },
        sectionTitle('Mines Rules', 'info'),
        h('div', { class: 'ev' },
          evRow('Grid', '5 × 5 = 25 tiles'),
          evRow('Mines', '3 - 24 per game'),
          evRow('Win', 'Reveal safe tiles, cash out anytime'),
          evRow('Payout', '95% of fair odds per reveal'),
        ),
        h('div', { class: 'card-hint' }, 'The same rules the arcade enforces server-side.'),
      ));
    }

    if (isMod('minesgrid')) {
      const simCard = h('div', { class: 'card' });
      simCard.appendChild(sectionTitle('Mines Simulator', 'grid'));
      const info = h('div', { class: 'mono sim-info' });
      const grid = h('div', { class: 'mines-sim' });
      simCard.appendChild(info);
      simCard.appendChild(grid);
      const bombs = 3;
      const reset = () => {
        grid.innerHTML = '';
        info.textContent = 'click safe tiles · 3 mines hidden';
        const positions = new Set();
        while (positions.size < bombs) positions.add(Math.floor(Math.random() * 25));
        let safe = 0, over = false;
        for (let i = 0; i < 25; i++) {
          const tile = h('button', { class: 'ms-tile' });
          tile.onclick = () => {
            if (over || tile.classList.contains('open')) return;
            tile.classList.add('open');
            if (positions.has(i)) {
              tile.classList.add('boom');
              tile.textContent = '✕';
              over = true;
              info.textContent = 'Hit a mine. Try again - same 95% payout math.';
              grid.querySelectorAll('.ms-tile').forEach((t, j) => { if (positions.has(j) && !t.classList.contains('boom')) { t.classList.add('boom'); t.textContent = '✕'; } });
            } else {
              safe++;
              tile.classList.add('ok');
              const r = EV.mines(safe, bombs);
              info.textContent = `${safe} safe · cash out now for ${r.mult.toFixed(2)}×`;
            }
          };
          grid.appendChild(tile);
        }
      };
      reset();
      simCard.appendChild(h('div', { style: 'margin-top:10px' }, h('button', { class: 'btn btn-ghost btn-sm', onclick: reset }, icon('refresh', 13), ' New board')));
      extra.appendChild(simCard);
    }

    if (extra.children.length) root.appendChild(extra);
    return root;
  }

  // ════════════════════════════════════════════════════════════════════
  // Shop - real crate catalog, name colors, inventory
  // ════════════════════════════════════════════════════════════════════

  function shopView() {
    const root = h('div', { class: 'view' });
    const invCard = h('div', { class: 'card' });
    const crateCard = h('div', { class: 'card' });
    const colorCard = h('div', { class: 'card' });
    root.appendChild(invCard);
    root.appendChild(crateCard);
    root.appendChild(colorCard);
    if (isMod('gempackages')) {
      root.appendChild(h('div', { class: 'card' },
        sectionTitle('Gem Packages', 'diamond'),
        h('div', { class: 'gt-table' },
          h('div', { class: 'gt-head' }, ['Package', 'Price', 'Gems', 'Bonus'].map((x) => h('span', { class: 'mono' }, x))),
          GEM_PACKAGES.map((p) => h('div', { class: 'gt-row' },
            [p.id, `$${p.price.toFixed(2)}`, p.gems.toLocaleString(), p.bonusPct ? `+${p.bonusPct}%` : '-'].map((x, i) => h('span', { class: `mono gt-c${i}` }, x)),
          )),
        ),
        h('div', { class: 'card-hint' }, 'The real gem bundles sold on the site via Polar checkout.'),
      ));
    }
    let ownedColors = [];

    // inventory - real /api/shop/inventory
    function loadInv() {
      invCard.innerHTML = '';
      invCard.appendChild(sectionTitle('Inventory', 'grid'));
      const body = h('div', { class: 'ev' });
      invCard.appendChild(body);
      body.appendChild(h('div', { class: 'skeleton-block' }, skeleton('100%', '60px')));
      apiGet('/api/shop/inventory', { ttl: 15000 })
        .then((d) => {
          body.innerHTML = '';
          if (d && d.gems !== undefined) {
            ownedColors = asArray(d.nameColors);
            body.appendChild(evRow('Gems', `${num(d.gems, 0).toLocaleString()} 💎`));
            body.appendChild(evRow('Name colors owned', `${ownedColors.length} / ${NAME_COLORS.length}`));
            body.appendChild(evRow('Founder badge', d.founderBadge ? 'owned' : 'not owned'));
            renderColors();
          } else {
            body.appendChild(emptyState('Not signed in', 'The shop runs on your RugPlay session', 'lock'));
          }
        })
        .catch((e) => { body.innerHTML = ''; body.appendChild(errorState(e.message, loadInv)); });
    }

    function crateEV(tier) {
      const total = tier.rewards.reduce((s, r) => s + r.weight, 0);
      let ev = 0;
      tier.rewards.forEach((r) => {
        const p = r.weight / total;
        if (r.type === 'buss') ev += p * ((r.min + r.max) / 2);
        else ev += p * r.min;
      });
      return ev;
    }

    // crates - the real CRATE_TIERS from the source
    function renderCrates() {
      crateCard.innerHTML = '';
      crateCard.appendChild(sectionTitle('Crate Shop', 'box'));
      const grid = h('div', { class: 'crate-grid' });
      crateCard.appendChild(grid);
      CRATE_TIERS.forEach((tier) => {
        const total = tier.rewards.reduce((s, r) => s + r.weight, 0);
        const card = h('div', { class: 'crate-card', style: `border-color:${tier.accent}66` },
          h('div', { class: 'crate-top' },
            h('div', { class: 'crate-name' }, tier.label),
            h('span', { class: 'crate-cost mono' }, `${tier.cost} 💎`),
          ),
          isMod('crateodds') ? h('div', { class: 'crate-ev mono' }, `EV ≈ $${fmtShort(crateEV(tier))} · ${tier.cost} gems`) : null,
          isMod('cratecontents') ? h('div', { class: 'crate-odds' }, tier.rewards.map((r) => h('div', { class: 'crate-odd' },
            h('span', { class: 'co-w mono' }, `${Math.round((r.weight / total) * 100)}%`),
            h('span', { class: 'co-l' }, r.label),
          ))) : null,
          isMod('opencrate') ? confirmBtn('Open', async () => {
            const res = await apiPost('/api/shop/crate', { tier: tier.id });
            const r = res && res.reward;
            if (r && r.type === 'buss') {
              toast('success', 'Crate opened', `You won ${fmtBuss(num(r.bussAmount))}`, 4200);
            } else if (r) {
              toast('success', r.colorLabel || 'Crate opened', `${r.alreadyOwned ? 'Already owned - ' : ''}${r.colorLabel || 'color'} + ${fmtBuss(num(r.bussAmount))}`, 5200);
            }
            loadInv();
          }, { cls: 'btn btn-soft btn-sm', confirm: 'Spend gems?' }) : null,
        );
        grid.appendChild(card);
      });
      crateCard.appendChild(h('div', { class: 'card-hint' }, 'Costs and odds are the real catalog values from the server source.'));
    }

    // name colors - the real NAME_COLOR_CATALOG
    function renderColors() {
      colorCard.innerHTML = '';
      colorCard.appendChild(sectionTitle('Name Colors', 'palette'));
      const grid = h('div', { class: 'color-grid' });
      colorCard.appendChild(grid);
      NAME_COLORS.forEach((c) => {
        const owned = isMod('ownedcolors') && ownedColors.includes(c.key);
        grid.appendChild(h('div', { class: `color-card ${owned ? 'owned' : ''}` },
          isMod('colorpreview')
            ? h('span', { class: 'color-chip mono', style: c.style }, 'Chromites')
            : h('span', { class: 'color-chip mono' }, 'Chromites'),
          h('div', { class: 'color-meta' },
            h('div', { class: 'color-name' }, c.label, owned ? h('span', { class: 'mini-tag' }, 'owned') : null),
            isMod('colorrarity') ? h('span', { class: 'color-rarity mono', style: `color:${RARITY_COLOR[c.rarity]}` }, RARITY_LABEL[c.rarity]) : null,
          ),
          owned
            ? (isMod('equipper') ? confirmBtn('Equip', async () => {
                await apiPost('/api/shop/equip', { itemType: 'namecolor', itemKey: c.key });
                toast('success', 'Equipped', c.label, 3400);
              }, { cls: 'btn btn-soft btn-sm' }) : h('span', { class: 'owned-pill' }, 'owned'))
            : h('span', { class: 'color-price mono' }, `${c.price} 💎`),
        ));
      });
    }

    renderCrates();
    renderColors();
    loadInv();
    return root;
  }

  // ════════════════════════════════════════════════════════════════════
  // Rewards - the real daily reward system
  // ════════════════════════════════════════════════════════════════════

  function rewardsView() {
    const root = h('div', { class: 'view' });
    const statusCard = h('div', { class: 'card' });
    const bonusCard = h('div', { class: 'card' });
    const streakCard = h('div', { class: 'card' });
    const tiersCard = h('div', { class: 'card' });
    root.appendChild(h('div', { class: 'grid-2' }, statusCard, h('div', { class: 'right-col' }, bonusCard, streakCard)));
    root.appendChild(tiersCard);
    let streak = 0;
    let prestigeLevel = 0;

    function loadStatus() {
      statusCard.innerHTML = '';
      statusCard.appendChild(sectionTitle('Daily Rewards', 'gift'));
      const body = h('div', { class: 'ev' });
      statusCard.appendChild(body);
      body.appendChild(h('div', { class: 'skeleton-block' }, skeleton('100%', '90px')));
      apiGet('/api/rewards/claim', { ttl: 15000 })
        .then((d) => {
          body.innerHTML = '';
          if (!d || d.canClaim === undefined) {
            body.appendChild(emptyState('Not signed in', 'Daily rewards live behind the login', 'lock'));
            return;
          }
          streak = num(d.loginStreak, 0);
          prestigeLevel = num(d.prestigeLevel, 0);
          const next = d.nextClaimTime ? new Date(d.nextClaimTime).getTime() : null;
          body.appendChild(evRow('Login streak', `${streak} day${streak === 1 ? '' : 's'}`));
          body.appendChild(evRow('Next reward', fmtBuss(num(d.rewardAmount))));
          if (isMod('daymult')) body.appendChild(evRow('Today × mult', fmtBuss(num(d.rewardAmount) * (PRESTIGE_MULTIPLIERS[prestigeLevel] || 1)), 'good'));
          if (num(d.prestigeBonus, 0) > 0) body.appendChild(evRow('Prestige bonus', `+${fmtBuss(num(d.prestigeBonus))} (×${PRESTIGE_MULTIPLIERS[prestigeLevel] || 1})`));
          body.appendChild(evRow('Lifetime claimed', fmtBuss(num(d.totalRewardsClaimed))));
          if (d.canClaim && isMod('claimdaily')) {
            body.appendChild(h('div', { style: 'margin-top:10px' }, confirmBtn('Claim now', async () => {
              const r = await apiPost('/api/rewards/claim', {});
              toast('success', 'Daily reward claimed', `${fmtBuss(num(r && r.rewardAmount))} + ${num(r && r.gemsAwarded, 10)} gems · streak ${num(r && r.loginStreak)}`, 4800);
              bus.emit('portfolio');
              loadStatus();
            })));
          } else if (!d.canClaim && isMod('nextclaim') && next) {
            const cd = h('div', { class: 'card-hint mono' });
            body.appendChild(cd);
            const tick = () => {
              const s = Math.max(0, Math.ceil((next - Date.now()) / 1000));
              cd.textContent = `next claim in ${fmtDur(s)}`;
              if (s <= 0) { clearInterval(t); loadStatus(); }
            };
            tick();
            const t = setInterval(tick, 1000);
            onCleanup(() => clearInterval(t));
          }
        })
        .catch((e) => { body.innerHTML = ''; body.appendChild(errorState(e.message, loadStatus)); });
    }

    function renderBonus() {
      if (!isMod('prestigebonus')) return;
      bonusCard.innerHTML = '';
      bonusCard.appendChild(sectionTitle('Prestige Bonus', 'crown'));
      const rows = h('div', { class: 'ev' });
      bonusCard.appendChild(rows);
      Object.entries(PRESTIGE_MULTIPLIERS).forEach(([lvl, mult]) => {
        const n = Number(lvl);
        rows.appendChild(evRow(PRESTIGE_NAMES[n] || `Prestige ${n}`, `×${mult}`, n === prestigeLevel ? 'good' : ''));
      });
      bonusCard.appendChild(h('div', { class: 'card-hint' }, 'Multiplies the base daily reward before the +10 gem bonus.'));
    }

    function renderStreak() {
      if (!isMod('streakcalc')) return;
      streakCard.innerHTML = '';
      streakCard.appendChild(sectionTitle('Streak Math', 'activity'));
      streakCard.appendChild(h('div', { class: 'card-hint' }, 'The server keeps your streak when you claim between 12h and 36h after the last claim. Under 12h: no change. Over 36h: reset to 1.'));
      const inp = h('input', { class: 'input', type: 'number', min: '0', max: '48', step: '0.5', placeholder: 'Hours since last claim (0-48)' });
      const out = h('div', { class: 'ev', style: 'margin-top:8px' });
      inp.addEventListener('input', () => {
        const hrs = num(parseFloat(inp.value), -1);
        out.innerHTML = '';
        if (hrs < 0) return;
        const ms = hrs * 3600000;
        const nextStreak = ms > 36 * 3600000 ? 1 : (ms >= 12 * 3600000 ? streak + 1 : streak);
        out.appendChild(evRow('Result', nextStreak === streak ? 'streak unchanged' : nextStreak > streak ? `streak +1 → ${nextStreak}` : 'streak reset → 1'));
        out.appendChild(evRow('Window', hrs < 12 ? 'too soon - no change' : hrs <= 36 ? 'in window - increments' : 'missed - resets'));
      });
      streakCard.appendChild(inp);
      streakCard.appendChild(out);
    }

    function renderTiers() {
      if (!isMod('rewardtiers')) return;
      tiersCard.innerHTML = '';
      tiersCard.appendChild(sectionTitle('Reward Tiers', 'list'));
      const grid = h('div', { class: 'tier-grid' });
      tiersCard.appendChild(grid);
      DAILY_REWARD_TIERS.forEach((amt, i) => {
        const day = i + 1;
        const cur = isMod('streakday') && day === streak;
        grid.appendChild(h('div', { class: `tier-cell ${cur ? 'on' : ''} ${day < streak ? 'past' : ''}` },
          h('span', { class: 'tier-day mono' }, `D${day}`),
          h('span', { class: 'tier-amt mono' }, fmtBuss(amt)),
        ));
      });
      tiersCard.appendChild(h('div', { class: 'card-hint' }, 'Day 30+ keeps paying $8,500. Rewards scale with your prestige multiplier.'));
    }

    if (isMod('windowtable')) {
      root.appendChild(h('div', { class: 'card' },
        sectionTitle('Claim Window', 'book'),
        h('div', { class: 'gt-table' },
          h('div', { class: 'gt-head' }, ['Time since last claim', 'Result'].map((x) => h('span', { class: 'mono' }, x))),
          [['< 12 hours', 'streak unchanged'], ['12 - 36 hours', 'streak +1'], ['> 36 hours', 'streak resets to 1']].map(([a, b], i) => h('div', { class: 'gt-row' }, [a, b].map((x, j) => h('span', { class: `mono gt-c${j}` }, x)))),
        ),
        h('div', { class: 'card-hint' }, 'The exact window the server uses before it touches your streak.'),
      ));
    }
    renderBonus();
    renderStreak();
    renderTiers();
    loadStatus();
    return root;
  }

  // ════════════════════════════════════════════════════════════════════
  // Prestige - the real reset ladder
  // ════════════════════════════════════════════════════════════════════

  function prestigeView() {
    const root = h('div', { class: 'view' });
    const desk = h('div', { class: 'card' });
    const ladder = h('div', { class: 'card' });
    const info = h('div', { class: 'card' });
    root.appendChild(h('div', { class: 'grid-2' }, desk, h('div', { class: 'right-col' }, ladder, info)));
    let level = 0;

    function loadDesk() {
      desk.innerHTML = '';
      desk.appendChild(sectionTitle('Prestige Desk', 'crown'));
      const body = h('div', { class: 'ev' });
      desk.appendChild(body);
      body.appendChild(h('div', { class: 'skeleton-block' }, skeleton('100%', '100px')));
      apiGet('/api/prestige', { ttl: 15000 })
        .then((d) => {
          body.innerHTML = '';
          const p = d && d.profile;
          if (!p) { body.appendChild(emptyState('Not signed in', 'Prestige runs on your session', 'lock')); return; }
          level = num(p.prestigeLevel, 0);
          body.appendChild(evRow('Level', level > 0 ? (PRESTIGE_NAMES[level] || `Prestige ${level}`) : 'Level 0'));
          body.appendChild(evRow('Net worth', fmtBuss(num(p.totalPortfolioValue))));
          body.appendChild(evRow('Cash', fmtBuss(num(p.baseCurrencyBalance))));
          body.appendChild(evRow('Holdings', `${num(d.stats && d.stats.holdingsCount, 0)} coins`));
          const nextCost = PRESTIGE_COSTS[level + 1];
          if (nextCost && isMod('prestigeprogress')) {
            const nw = num(p.totalPortfolioValue, 0);
            const pct = Math.min(100, Math.max(0, (nw / nextCost) * 100));
            body.appendChild(h('div', { class: 'depth-bar-wrap' },
              h('div', { class: 'depth-bar-label' }, h('span', {}, `To next prestige · $${fmtShort(nw)} / $${fmtShort(nextCost)}`), h('span', { class: 'mono' }, pct.toFixed(1) + '%')),
              h('div', { class: 'depth-bar' }, h('div', { class: 'depth-bar-fill', style: `width:${pct.toFixed(1)}%` })),
            ));
          }
          if (nextCost && isMod('prestigepost')) {
            body.appendChild(h('div', { style: 'margin-top:10px' }, confirmBtn(`Prestige now · $${fmtShort(nextCost)}`, async () => {
              const r = await apiPost('/api/prestige', {});
              toast('success', 'Prestige increased', (r && r.message) || 'Welcome to the next level', 5600);
              bus.emit('portfolio');
              loadDesk();
            }, { confirm: 'Sell all + reset to $100?' })));
          } else if (!nextCost) {
            body.appendChild(h('div', { class: 'card-hint' }, 'Maximum prestige reached.'));
          }
        })
        .catch((e) => { body.innerHTML = ''; body.appendChild(errorState(e.message, loadDesk)); });
    }

    function renderLadder() {
      if (!isMod('prestigecosts')) return;
      ladder.innerHTML = '';
      ladder.appendChild(sectionTitle('Cost Ladder', 'tag'));
      const rows = h('div', { class: 'ev' });
      ladder.appendChild(rows);
      Object.entries(PRESTIGE_COSTS).forEach(([lvl, cost]) => {
        const n = Number(lvl);
        rows.appendChild(evRow(PRESTIGE_NAMES[n], '$' + fmtShort(cost), n === level + 1 ? 'good' : (n <= level ? 'done' : '')));
      });
      ladder.appendChild(h('div', { class: 'card-hint' }, 'Prestige costs cash only - coin holdings are sold at market on entry.'));
    }

    function renderInfo() {
      if (!isMod('prestigedesk') && !isMod('prestigeplan')) return;
      info.innerHTML = '';
      info.appendChild(sectionTitle('Prestige Plan', 'info'));
      const rows = h('div', { class: 'ev' });
      info.appendChild(rows);
      if (isMod('prestigeplan')) {
        rows.appendChild(h('div', { class: 'plan-col-label down' }, 'RESETS'));
        rows.appendChild(evRow('Holdings', 'sold at market price'));
        rows.appendChild(evRow('Cash', 'reset to $100'));
        rows.appendChild(evRow('Daily cooldown', 'cleared'));
        rows.appendChild(h('div', { class: 'plan-col-label up' }, 'SURVIVES'));
        rows.appendChild(evRow('Login streak', 'preserved'));
        rows.appendChild(evRow('Badge', 'shown on your profile'));
        rows.appendChild(evRow('Gems & colors', 'kept'));
        rows.appendChild(evRow('Daily rewards', `×${PRESTIGE_MULTIPLIERS[level + 1] || PRESTIGE_MULTIPLIERS[level] || 1}`));
      } else {
        rows.appendChild(evRow('Holdings', 'sold at market price'));
        rows.appendChild(evRow('Cash', 'reset to $100'));
        rows.appendChild(evRow('Daily cooldown', 'cleared'));
        rows.appendChild(evRow('Login streak', 'preserved'));
        rows.appendChild(evRow('Daily rewards', `×${PRESTIGE_MULTIPLIERS[level + 1] || PRESTIGE_MULTIPLIERS[level] || 1}`));
        rows.appendChild(evRow('Badge', 'shown on your profile'));
      }
    }

    if (isMod('prestigemult')) {
      root.appendChild(h('div', { class: 'card' },
        sectionTitle('Multiplier Ladder', 'chart'),
        h('div', { class: 'gt-table' },
          h('div', { class: 'gt-head' }, ['Prestige', 'Daily reward ×'].map((x) => h('span', { class: 'mono' }, x))),
          Object.entries(PRESTIGE_MULTIPLIERS).map(([lvl, m]) => h('div', { class: 'gt-row' },
            [lvl === '0' ? 'Level 0' : (PRESTIGE_NAMES[lvl] || `Prestige ${lvl}`), `×${m}`].map((x, i) => h('span', { class: `mono gt-c${i}` }, x)),
          )),
        ),
        h('div', { class: 'card-hint' }, 'The real multiplier applied to every daily claim at each level.'),
      ));
    }

    renderLadder();
    renderInfo();
    loadDesk();
    return root;
  }

  // ════════════════════════════════════════════════════════════════════
  // Account - promo, keys, blocks, mentions, site volume
  // ════════════════════════════════════════════════════════════════════

  function accountView() {
    const root = h('div', { class: 'view' });
    const promoCard = h('div', { class: 'card' });
    const keyCard = h('div', { class: 'card' });
    const volCard = h('div', { class: 'card' });
    const blockCard = h('div', { class: 'card' });
    const mentionCard = h('div', { class: 'card' });
    root.appendChild(h('div', { class: 'grid-2' },
      h('div', { class: 'right-col' }, promoCard, keyCard, volCard),
      h('div', { class: 'right-col' }, blockCard, mentionCard),
    ));

    if (isMod('promo')) {
      promoCard.appendChild(sectionTitle('Promo Codes', 'gift'));
      const inp = h('input', { class: 'input', placeholder: 'Enter promo code' });
      promoCard.appendChild(inp);
      promoCard.appendChild(confirmBtn('Redeem', async () => {
        const code = (inp.value || '').trim();
        if (!code) throw new Error('Enter a code first');
        const r = await apiPost('/api/promo/verify', { code });
        toast('success', 'Promo redeemed', (r && r.message) || `${fmtBuss(num(r && r.rewardAmount))} added`, 5600);
        inp.value = '';
        bus.emit('portfolio');
      }, { confirm: 'Redeem this code?' }));
      promoCard.appendChild(h('div', { class: 'card-hint' }, 'Codes are verified against the server. Max payout is $1,000,000.'));
    }

    if (isMod('keystatus')) {
      keyCard.appendChild(sectionTitle('API Key', 'key'));
      const body = h('div', { class: 'ev' });
      keyCard.appendChild(body);
      body.appendChild(h('div', { class: 'skeleton-block' }, skeleton('100%', '50px')));
      function loadKeys() {
        body.innerHTML = '';
        body.appendChild(h('div', { class: 'skeleton-block' }, skeleton('100%', '50px')));
        apiGet('/api/keys', { ttl: 20000 })
          .then((d) => {
            body.innerHTML = '';
            const keys = Array.isArray(d) ? d : asArray(d && d.keys);
            if (!keys.length) {
              body.appendChild(emptyState('No API key yet', 'Create one at rugplay.com/api', 'key'));
              if (isMod('keycreate')) {
                body.appendChild(confirmBtn('Create API key', async () => {
                  const r = await apiPost('/api/keys', {});
                  toast('success', 'API key created', `${num(r && r.remaining, 2000).toLocaleString()} requests · read-only`, 5600);
                  loadKeys();
                }));
              }
              return;
            }
            const k = keys[0];
            body.appendChild(evRow('Status', 'active'));
            if (k.remaining !== undefined) body.appendChild(evRow('Requests left', `${num(k.remaining, 0).toLocaleString()} / 2,000`));
            if (k.lastUsedAt) body.appendChild(evRow('Last used', timeAgo(new Date(k.lastUsedAt).getTime())));
            body.appendChild(evRow('Scope', 'read-only'));
            if (isMod('keyregenerate') && k.id) {
              body.appendChild(confirmBtn('Regenerate key', async () => {
                const r = await apiPost(`/api/keys/${encodeURIComponent(k.id)}/regenerate`, {});
                toast('success', 'Key regenerated', (r && r.message) || 'Old key invalidated', 5600);
                loadKeys();
              }, { confirm: 'Invalidate the old key?' }));
            }
          })
          .catch((e) => { body.innerHTML = ''; body.appendChild(errorState(e.message)); });
      }
      loadKeys();
    }

    if (isMod('volumecontrol')) {
      volCard.appendChild(sectionTitle('Site Volume', 'volume'));
      const body = h('div', { class: 'ev' });
      volCard.appendChild(body);
      body.appendChild(h('div', { class: 'skeleton-block' }, skeleton('100%', '50px')));
      const save = (master, muted) => apiPost('/api/settings/volume', { master, muted }).catch((e) => toast('error', 'Volume not saved', e.message));
      apiGet('/api/settings/volume', { ttl: 20000 })
        .then((d) => {
          body.innerHTML = '';
          if (d && d.master !== undefined) {
            const master = num(d.master, 0.5);
            const muted = !!d.muted;
            const slider = h('input', { class: 'range', type: 'range', min: '0', max: '100', step: '1', value: String(Math.round(master * 100)) });
            const val = h('span', { class: 'vol-val mono' }, `${Math.round(master * 100)}%`);
            slider.addEventListener('input', () => { val.textContent = slider.value + '%'; });
            slider.addEventListener('change', () => { save(num(parseInt(slider.value, 10), 50) / 100, muted); toast('success', 'Volume saved', `${slider.value}%`); });
            body.appendChild(h('div', { class: 'vol-row' }, h('span', { class: 'vol-label' }, 'Master'), slider, val));
            const sw = switchEl(muted, (on) => { save(master, on); toast('success', on ? 'Muted' : 'Unmuted', 'Site volume'); });
            body.appendChild(h('div', { class: 'vol-row' }, h('span', { class: 'vol-label' }, 'Muted'), sw));
          } else {
            body.appendChild(emptyState('Not signed in', 'Volume is tied to your session', 'lock'));
          }
        })
        .catch((e) => { body.innerHTML = ''; body.appendChild(errorState(e.message)); });
    }

    if (isMod('blocklist')) {
      blockCard.appendChild(sectionTitle('Block List', 'ban'));
      const body = h('div', { class: 'ev' });
      blockCard.appendChild(body);
      body.appendChild(h('div', { class: 'skeleton-block' }, skeleton('100%', '60px')));
      apiGet('/api/settings/blocked', { ttl: 20000 })
        .then((d) => {
          body.innerHTML = '';
          const list = asArray(d && d.blocks);
          if (!list.length) { body.appendChild(emptyState('No blocks', 'You have not blocked anyone', 'ban')); return; }
          list.forEach((b) => body.appendChild(evRow('@' + (b.username || 'user'), b.createdAt ? 'blocked ' + timeAgo(new Date(b.createdAt).getTime()) : '')));
        })
        .catch((e) => { body.innerHTML = ''; body.appendChild(errorState(e.message)); });
    }

    if (isMod('mentionprefs')) {
      mentionCard.appendChild(sectionTitle('Mention Settings', 'at'));
      const sw = switchEl(false, (on) => {
        apiPost('/api/settings/mentions', { disableMentions: on })
          .then(() => toast('success', on ? 'Mentions disabled' : 'Mentions enabled', 'Saved on your account'))
          .catch((e) => toast('error', 'Not saved', e.message));
      });
      mentionCard.appendChild(h('div', { class: 'vol-row' }, h('span', { class: 'vol-label' }, 'Disable @mentions'), sw));
      mentionCard.appendChild(h('div', { class: 'card-hint' }, 'Off = people can mention you. The server defaults to mentions on.'));
    }

    // username check - real availability endpoint
    if (isMod('usernamecheck')) {
      const unCard = h('div', { class: 'card' });
      unCard.appendChild(sectionTitle('Username Check', 'at'));
      const inp = h('input', { class: 'input', placeholder: 'Try a username…' });
      const out = h('div', { class: 'ev' });
      unCard.appendChild(inp);
      unCard.appendChild(out);
      inp.addEventListener('keydown', (ev) => {
        if (ev.key !== 'Enter' || !inp.value.trim()) return;
        out.innerHTML = '';
        out.appendChild(h('div', { class: 'skeleton-block' }, skeleton('100%', '30px')));
        apiGet(`/api/settings/check-username?username=${encodeURIComponent(inp.value.trim())}`, { ttl: 0 })
          .then((d) => {
            out.innerHTML = '';
            out.appendChild(evRow('Username', '@' + inp.value.trim()));
            if (d && d.available) out.appendChild(evRow('Available', '✓ yes', 'good'));
            else out.appendChild(evRow('Taken', (d && d.reason) || 'not available', 'bad'));
          })
          .catch((e) => { out.innerHTML = ''; out.appendChild(errorState(e.message)); });
      });
      root.appendChild(unCard);
    }

    // data export - the real account download
    if (isMod('dataexport')) {
      const exCard = h('div', { class: 'card' });
      exCard.appendChild(sectionTitle('Data Export', 'download'));
      exCard.appendChild(confirmBtn('Download my data', async () => {
        const res = await apiGet('/api/settings/data-download', { ttl: 0 });
        const text = JSON.stringify(res, null, 2);
        const blob = new Blob([text], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'rugplay-account-export.json';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        toast('success', 'Export downloaded', 'Your account data, straight from the server');
      }, { confirm: 'Download your full account data?' }));
      exCard.appendChild(h('div', { class: 'card-hint' }, 'The same GDPR export the site offers in settings.'));
      root.appendChild(exCard);
    }

    // block a user - real endpoint, double-confirmed
    if (isMod('blockuser')) {
      const blCard = h('div', { class: 'card' });
      blCard.appendChild(sectionTitle('Block User', 'ban'));
      const inp = h('input', { class: 'input', placeholder: 'Username to block' });
      blCard.appendChild(inp);
      blCard.appendChild(confirmBtn('Block', async () => {
        const name = (inp.value || '').trim();
        if (!name) throw new Error('Enter a username');
        await apiPost(`/api/user/${encodeURIComponent(name)}/block`, {});
        toast('success', 'Blocked', `@${name} is now blocked`, 3400);
        inp.value = '';
      }, { confirm: 'Really block?' }));
      blCard.appendChild(h('div', { class: 'card-hint' }, 'Blocked users can still see the site - they just can\'t reach you.'));
      root.appendChild(blCard);
    }

    return root;
  }

  // ════════════════════════════════════════════════════════════════════
  // Mods - the full registry, grouped by category
  // ════════════════════════════════════════════════════════════════════

  const MOD_CATS = ['Site', 'Trading', 'Market', 'Hopium', 'Gamble', 'Portfolio', 'Social', 'Shop', 'Achievements', 'Rewards', 'Prestige', 'Account', 'Client'];

  function modsView() {
    const root = h('div', { class: 'view' });
    let cat = 'All';

    const count = h('span', { class: 'mod-count mono' });
    const resetBtn = h('button', { class: 'btn btn-ghost btn-sm', onclick: () => {
      mods = defaultMods();
      storage.set('candle:mods', mods);
      bus.emit('mods');
      render();
      toast('success', 'Mods reset', `All ${MODS.length} mods restored to defaults`);
    } }, icon('refresh', 13), ' Reset');
    const chips = h('div', { class: 'chip-row' },
      ['All', ...MOD_CATS].map((c) => h('button', {
        class: `chip ${c === 'All' ? 'on' : ''}`,
        onclick: (ev) => {
          cat = c;
          chips.querySelectorAll('.chip').forEach((x) => x.classList.remove('on'));
          ev.currentTarget.classList.add('on');
          render();
        },
      }, c)),
    );
    root.appendChild(h('div', { class: 'mods-top' },
      h('div', { class: 'card-title' }, icon('sliders', 14), h('span', {}, 'Mods')),
      count,
      resetBtn,
    ));
    root.appendChild(h('div', { class: 'card-hint' }, 'Every mod is off until you switch it on. Mods marked ', h('span', { class: 'mod-site' }, '● site'), ' render directly on rugplay.com when enabled - the rest live inside the client.'));
    root.appendChild(chips);
    const grid = h('div', { class: 'mod-grid' });
    root.appendChild(grid);

    // client settings
    const pageSel = h('select', { class: 'select' },
      [10, 25, 50].map((n) => h('option', { value: String(n), selected: settings.marketPageSize === n }, `${n} per page`)),
    );
    pageSel.addEventListener('change', () => { settings.marketPageSize = num(parseInt(pageSel.value, 10), 25); saveSettings(); toast('success', 'Settings saved', 'Market page size updated'); });
    const tickSel = h('select', { class: 'select' },
      [6, 8, 12, 20].map((n) => h('option', { value: String(n), selected: settings.tickerSeconds === n }, `every ${n}s`)),
    );
    tickSel.addEventListener('change', () => { settings.tickerSeconds = num(parseInt(tickSel.value, 10), 8); saveSettings(); toast('success', 'Settings saved', 'Live feed refresh updated'); });

    // client look & feel (gated by their mods)
    const themeSel = h('select', { class: 'select' },
      [['auto', 'Theme · auto'], ['dark', 'Theme · dark'], ['light', 'Theme · light']].map(([v, l]) => h('option', { value: v, selected: (settings.theme || 'auto') === v }, l)),
    );
    themeSel.addEventListener('change', () => { settings.theme = themeSel.value; saveSettings(); applyClientLook(); toast('success', 'Theme set', settings.theme); });
    const accentSel = h('select', { class: 'select' },
      [['red', 'Accent · red'], ['ember', 'Accent · ember'], ['violet', 'Accent · violet'], ['emerald', 'Accent · emerald'], ['cyan', 'Accent · cyan']].map(([v, l]) => h('option', { value: v, selected: (settings.accent || 'red') === v }, l)),
    );
    accentSel.addEventListener('change', () => { settings.accent = accentSel.value; saveSettings(); applyClientLook(); toast('success', 'Accent set', settings.accent); });
    const fontSel = h('select', { class: 'select' },
      [85, 100, 115, 130].map((n) => h('option', { value: String(n), selected: num(settings.fontScale, 100) === n }, `Font · ${n}%`)),
    );
    fontSel.addEventListener('change', () => { settings.fontScale = num(parseInt(fontSel.value, 10), 100); saveSettings(); applyClientLook(); toast('success', 'Font scale set', `${settings.fontScale}%`); });
    const toastSel = h('select', { class: 'select' },
      [['br', 'Toasts · bottom-right'], ['tr', 'Toasts · top-right']].map(([v, l]) => h('option', { value: v, selected: (settings.toastPos || 'br') === v }, l)),
    );
    toastSel.addEventListener('change', () => { settings.toastPos = toastSel.value; saveSettings(); toast('success', 'Toast position set', settings.toastPos === 'tr' ? 'top-right' : 'bottom-right'); });
    root.appendChild(h('div', { class: 'card settings-row' },
      h('div', { class: 'settings-item' },
        h('div', { class: 'settings-label' }, 'Market page size'),
        pageSel,
      ),
      h('div', { class: 'settings-item' },
        h('div', { class: 'settings-label' }, 'Live feed refresh'),
        tickSel,
      ),
      isMod('themepick') ? h('div', { class: 'settings-item' }, h('div', { class: 'settings-label' }, 'Theme'), themeSel) : null,
      isMod('accentpick') ? h('div', { class: 'settings-item' }, h('div', { class: 'settings-label' }, 'Accent'), accentSel) : null,
      isMod('fontscale') ? h('div', { class: 'settings-item' }, h('div', { class: 'settings-label' }, 'Font'), fontSel) : null,
      isMod('toastpos') ? h('div', { class: 'settings-item' }, h('div', { class: 'settings-label' }, 'Toasts'), toastSel) : null,
    ));

    function render() {
      const list = MODS.filter((m) => cat === 'All' || m.cat === cat);
      const enabled = MODS.filter((m) => isMod(m.id)).length;
      count.textContent = `${enabled}/${MODS.length} enabled`;
      grid.innerHTML = '';
      if (!list.length) {
        grid.appendChild(emptyState('No mods in this category', 'Try another category', 'sliders'));
        return;
      }
      list.forEach((m) => {
        const on = isMod(m.id);
        grid.appendChild(h('div', { class: `mod-card ${on ? 'on' : ''}` },
          h('div', { class: 'mod-head' },
            h('span', { class: 'mod-ico' }, icon(m.icon, 15)),
            h('span', { class: 'mod-name' }, m.name),
            switchEl(on, () => { toggleMod(m.id); toast(on ? 'Mod disabled' : 'Mod enabled', m.name); render(); }),
          ),
          h('div', { class: 'mod-desc' }, m.desc),
          h('div', { class: 'mod-cat' }, m.cat, isOnsiteMod(m.id) ? h('span', { class: 'mod-site' }, '● site') : null),
        ));
      });
    }

    render();
    return root;
  }

  // ════════════════════════════════════════════════════════════════════
  // Notifications bell
  // ════════════════════════════════════════════════════════════════════

  function renderBell(bellBtn, badgeEl, panel) {
    apiGet('/api/notifications', { ttl: 20000 })
      .then((d) => {
        const list = asArray(d && d.notifications);
        const unread = num(d && d.unreadCount, list.filter((n) => !n.isRead && n.isRead !== undefined).length);
        badgeEl.textContent = unread > 99 ? '99+' : String(unread);
        badgeEl.style.display = unread > 0 ? 'flex' : 'none';
        panel.innerHTML = '';
        if (!list.length) {
          panel.appendChild(emptyState('All clear', 'No notifications yet', 'bell'));
          return;
        }
        list.slice(0, 12).forEach((n) => {
          const text = n.title || n.message || n.content || n.text || 'Notification';
          const ts = n.createdAt || n.timestamp;
          const un = n.isRead === false || (n.isRead === undefined && unread > 0);
          panel.appendChild(h('div', { class: `notif-row ${un ? 'unread' : ''}` },
            h('span', { class: 'notif-dot' }),
            h('div', { class: 'mini-main' },
              h('div', { class: 'mini-name' }, text),
              h('div', { class: 'mini-sub' }, ts ? timeAgo(new Date(ts).getTime()) : ''),
            ),
          ));
        });
        if (unread > 0) {
          const markBtn = h('button', { class: 'btn btn-primary btn-sm mark-btn', onclick: async () => {
            try {
              await apiPatch('/api/notifications', { markAsRead: true });
              toast('success', 'All marked read', 'Notifications');
              renderBell(bellBtn, badgeEl, panel);
            } catch (e) {
              toast('error', 'Could not update', e.message);
            }
          } }, 'Mark all as read');
          panel.appendChild(markBtn);
        }
      })
      .catch(() => { /* bell stays quiet on failure */ });
  }

  const CANDLE_CSS = `
    :host { all: initial; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    div,span,button,input,select,h1,aside,nav,header,main,svg { box-sizing: border-box; }

    .candle-backdrop {
      position: fixed; inset: 0;
      background:
        radial-gradient(720px 420px at 50% 42%, rgba(239,68,68,.12), transparent 65%),
        rgba(5,5,8,.7);
      backdrop-filter: blur(12px) saturate(1.25); -webkit-backdrop-filter: blur(12px) saturate(1.25);
      opacity: 0; pointer-events: none; transition: opacity .3s cubic-bezier(.4,0,.2,1);
      z-index: 2147483000;
    }
    .candle-backdrop.show { opacity: 1; pointer-events: auto; }
    .candle-backdrop::before {
      content: ''; position: absolute; inset: 0; pointer-events: none;
      background:
        radial-gradient(760px 440px at 50% 38%, rgba(239,68,68,.22), transparent 62%),
        radial-gradient(520px 300px at 78% 78%, rgba(239,68,68,.12), transparent 60%);
      opacity: .5; animation: candle-breathe 6.5s ease-in-out infinite alternate;
    }
    @keyframes candle-breathe {
      from { opacity: .42; transform: scale(.98); }
      to { opacity: 1; transform: scale(1.06); }
    }

    .candle-window {
      --bg0: #0f0f13; --bg1: #16161b; --bg2: #1d1d23; --bg3: #25252c;
      --bd: rgba(255,255,255,.08); --tx: #f4f4f5; --mut: #9ca3af; --dim: #6b7280;
      --red: #ef4444; --red-d: #dc2626; --red-h: #f87171; --up: #34d399; --down: #f87171; --amber: #fbbf24;
      position: fixed; top: 4.5%; left: 50%;
      transform: translate(-50%, -3%) scale(.97);
      width: min(1180px, 92vw); height: min(764px, 89vh);
      background:
        radial-gradient(1100px 520px at 50% -8%, rgba(239,68,68,.10), transparent 60%),
        radial-gradient(760px 420px at 112% 118%, rgba(239,68,68,.06), transparent 55%),
        radial-gradient(600px 300px at -8% 110%, rgba(239,68,68,.045), transparent 50%),
        linear-gradient(180deg, #141418, var(--bg0) 55%);
      border: 1px solid rgba(255,255,255,.1); border-radius: 18px;
      box-shadow:
        0 0 0 1px rgba(239,68,68,.15),
        0 44px 120px rgba(0,0,0,.82),
        0 0 100px rgba(239,68,68,.09),
        inset 0 1px 0 rgba(255,255,255,.07);
      opacity: 0; pointer-events: none;
      display: flex; flex-direction: column; overflow: hidden;
      z-index: 2147483001;
      will-change: transform, opacity;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Inter, 'Helvetica Neue', Arial, sans-serif;
      color: var(--tx); font-size: 13px; line-height: 1.45;
      transition: opacity .2s ease, transform .5s cubic-bezier(.16,1,.3,1);
    }
    .candle-window:not(.closed) { opacity: 1; pointer-events: auto; transform: translate(-50%, -3%) scale(1); }
    .candle-window.closed { opacity: 0; pointer-events: none; transform: translate(-50%, -2%) scale(.955); }
    .candle-window.min { opacity: 0; pointer-events: none; transform: translate(-50%, 34%) scale(.94); }
    .candle-window.max { width: min(1500px, 96vw); height: 93vh; top: 3vh; }
    .candle-window::before {
      content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
      background: linear-gradient(90deg, transparent, var(--red) 22%, var(--red-h) 50%, var(--red) 78%, transparent);
      background-size: 220% 100%;
      animation: candle-sheen 4.5s linear infinite;
      z-index: 20;
    }
    .candle-window::after {
      content: ''; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
      background: linear-gradient(180deg, rgba(255,255,255,.045), transparent 14%);
    }
    @keyframes candle-sheen { 0% { background-position: 220% 0; } 100% { background-position: -220% 0; } }
    @keyframes candle-shine { 0% { left: -70%; } 55%, 100% { left: 135%; } }

    .mono { font-family: ui-monospace, 'SF Mono', 'Cascadia Code', Consolas, 'JetBrains Mono', monospace; font-variant-numeric: tabular-nums; }
    .up { color: var(--up); }
    .down { color: var(--down); }
    .good { color: var(--up); } .mid { color: var(--amber); } .bad { color: var(--down); }

    /* ── title bar ─────────────────────────────────────────── */
    .candle-titlebar {
      height: 44px; flex: 0 0 auto; display: flex; align-items: center; justify-content: space-between;
      padding: 0 14px; background: linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,0) 70%), var(--bg1);
      border-bottom: 1px solid var(--bd); position: relative; z-index: 5;
      -webkit-user-select: none; user-select: none;
    }
    .tb-brand { display: flex; align-items: center; gap: 9px; font-size: 12px; font-weight: 700; color: var(--tx); letter-spacing: .03em; }
    .tb-brand span:not(.tb-ver) {
      background: linear-gradient(90deg, #fff 10%, var(--red-h));
      -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
    }
    .tb-brand .logo-mark { filter: drop-shadow(0 0 6px rgba(239,68,68,.5)); }
    .tb-ver {
      font-size: 10px; color: var(--red-h); background: rgba(239,68,68,.12);
      border: 1px solid rgba(239,68,68,.3); border-radius: 6px; padding: 1px 6px; letter-spacing: .05em;
    }
    .tl-cluster { display: flex; gap: 8px; align-items: center; }
    .tl { width: 13px; height: 13px; border-radius: 50%; border: 1px solid rgba(0,0,0,.35); cursor: pointer; transition: filter .15s ease, transform .15s ease; }
    .tl:hover { filter: brightness(1.3); transform: scale(1.18); }
    .tl-close { background: #ff5f57; box-shadow: 0 0 10px rgba(255,95,87,.45); }
    .tl-min { background: #febc2e; box-shadow: 0 0 10px rgba(254,188,46,.38); }
    .tl-max { background: #28c840; box-shadow: 0 0 10px rgba(40,200,64,.38); }

    /* ── body / sidebar ────────────────────────────────────── */
    .candle-body { flex: 1; display: flex; min-height: 0; }
    .candle-side {
      width: 200px; flex: 0 0 auto; background: linear-gradient(180deg, rgba(255,255,255,.022), transparent 30%), var(--bg1);
      border-right: 1px solid var(--bd); position: relative;
      display: flex; flex-direction: column; padding: 14px 10px 10px;
    }
    .brand {
      position: relative; overflow: hidden;
      display: flex; align-items: center; gap: 10px; padding: 10px 12px; margin-bottom: 14px;
      background: linear-gradient(135deg, rgba(239,68,68,.2), rgba(127,29,29,.09) 55%, rgba(239,68,68,.05));
      border: 1px solid rgba(239,68,68,.32); border-radius: 13px;
      box-shadow: inset 0 1px 0 rgba(255,255,255,.08), 0 0 26px rgba(239,68,68,.1);
    }
    .brand::after {
      content: ''; position: absolute; top: 0; left: -70%; width: 42%; height: 100%;
      background: linear-gradient(100deg, transparent, rgba(255,255,255,.14), transparent);
      transform: skewX(-20deg); animation: candle-shine 3.4s ease-in-out infinite;
    }
    .brand .logo-mark { filter: drop-shadow(0 0 8px rgba(239,68,68,.55)); }
    .brand-meta { display: flex; flex-direction: column; gap: 3px; }
    .brand-name {
      font-size: 18px; font-weight: 800; letter-spacing: -.4px;
      background: linear-gradient(90deg, #fff, var(--red-h) 130%);
      -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
    }
    .v-badge {
      align-self: flex-start; font-size: 9.5px; font-weight: 700; color: #fff;
      background: repeating-linear-gradient(45deg, rgba(255,255,255,.32) 0 3px, transparent 3px 7px), var(--red);
      border-radius: 4px; padding: 1px 6px; letter-spacing: .04em;
      box-shadow: 0 0 12px rgba(239,68,68,.4);
    }
    .nav { flex: 1; overflow-y: auto; padding-bottom: 8px; scrollbar-width: thin; }
    .candle-content, .modal-body { scrollbar-width: thin; }
    .nav::-webkit-scrollbar, .candle-content::-webkit-scrollbar, .modal-body::-webkit-scrollbar { width: 9px; height: 9px; }
    .nav::-webkit-scrollbar-track, .candle-content::-webkit-scrollbar-track, .modal-body::-webkit-scrollbar-track { background: transparent; }
    .nav::-webkit-scrollbar-thumb, .candle-content::-webkit-scrollbar-thumb, .modal-body::-webkit-scrollbar-thumb {
      background: linear-gradient(180deg, #3f3f46, #27272a); border-radius: 5px;
      border: 2px solid transparent; background-clip: padding-box;
    }
    .nav::-webkit-scrollbar-thumb:hover, .candle-content::-webkit-scrollbar-thumb:hover, .modal-body::-webkit-scrollbar-thumb:hover { background: var(--red-d); border: 2px solid transparent; background-clip: padding-box; }
    .nav-group {
      display: flex; align-items: center; gap: 8px;
      font-size: 9.5px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase;
      color: var(--dim); padding: 15px 12px 5px;
    }
    .nav-group::after { content: ''; flex: 1; height: 1px; background: linear-gradient(90deg, rgba(255,255,255,.08), transparent); }
    .nav-item {
      position: relative; overflow: hidden;
      display: flex; align-items: center; gap: 9px; width: 100%;
      padding: 8px 11px; margin: 1px 0; border: 0; border-radius: 9px;
      background: transparent; color: #cbcbd4; font-size: 12.5px; font-weight: 600;
      cursor: pointer; text-align: left; font-family: inherit;
      transition: background .13s ease, color .13s ease, box-shadow .13s ease, transform .13s ease;
    }
    .nav-item svg { flex: 0 0 auto; opacity: .82; transition: transform .16s ease; }
    .nav-item:hover { background: rgba(255,255,255,.06); color: #fff; }
    .nav-item:hover svg { transform: scale(1.12); color: var(--red-h); }
    .nav-item.on svg { color: #fff; filter: drop-shadow(0 0 4px rgba(255,255,255,.5)); }
    .nav-item.on {
      background: linear-gradient(90deg, rgba(239,68,68,.92), rgba(239,68,68,.62));
      color: #fff; box-shadow: 0 4px 20px rgba(239,68,68,.42), inset 0 1px 0 rgba(255,255,255,.2);
    }
    .nav-item.on::before {
      content: ''; position: absolute; left: 0; top: 22%; bottom: 22%; width: 3px; border-radius: 0 3px 3px 0;
      background: #fff; box-shadow: 0 0 10px rgba(255,255,255,.75);
    }
    .nav-item.on svg { opacity: 1; }
    .side-foot { border-top: 1px solid var(--bd); padding-top: 8px; }
    .side-credit { padding: 7px 12px 2px; font-size: 10.5px; color: var(--dim); }
    .credit-name { color: var(--red-h); font-weight: 700; }

    /* ── main ──────────────────────────────────────────────── */
    .candle-main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
    .candle-head {
      flex: 0 0 auto; display: flex; align-items: flex-end; justify-content: space-between;
      padding: 20px 24px 14px; gap: 12px;
      background: linear-gradient(180deg, rgba(239,68,68,.06), transparent 75%);
    }
    .head-block { padding-bottom: 6px; }
    .candle-h1 {
      font-size: 24px; font-weight: 800; letter-spacing: -.6px; position: relative; display: inline-block;
      background: linear-gradient(180deg, #fff, #cfcfd6);
      -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
    }
    .candle-h1::before {
      content: ''; position: absolute; left: 0; bottom: -6px; width: 36px; height: 3px;
      border-radius: 2px; background: linear-gradient(90deg, var(--red), var(--red-h));
      box-shadow: 0 0 14px rgba(239,68,68,.65);
    }
    .candle-sub { display: block; font-size: 11.5px; color: var(--mut); margin-top: 12px; }
    .candle-content { flex: 1; overflow-y: auto; padding: 14px 24px 28px; }

    .bell-btn {
      position: relative; width: 34px; height: 34px; flex: 0 0 auto; display: flex; align-items: center; justify-content: center;
      border: 1px solid var(--bd); border-radius: 9px; background: var(--bg2); color: var(--mut); cursor: pointer;
      transition: border-color .13s ease, color .13s ease;
    }
    .bell-btn:hover { border-color: rgba(239,68,68,.45); color: var(--tx); }
    .bell-badge {
      position: absolute; top: -5px; right: -5px; min-width: 16px; height: 16px; padding: 0 4px;
      border-radius: 8px; background: var(--red); color: #fff; font-size: 9px; font-weight: 700;
      display: none; align-items: center; justify-content: center; box-shadow: 0 0 8px rgba(239,68,68,.5);
    }
    .bell-panel {
      position: absolute; top: 52px; right: 22px; width: min(360px, calc(100% - 44px));
      background: var(--bg2); border: 1px solid var(--bd); border-radius: 12px;
      box-shadow: 0 18px 50px rgba(0,0,0,.6); overflow: hidden;
      opacity: 0; pointer-events: none; transform: translateY(-6px);
      transition: opacity .15s ease, transform .18s ease; z-index: 2147483010;
    }
    .bell-panel.show { opacity: 1; pointer-events: auto; transform: translateY(0); }
    .notif-row { display: flex; gap: 10px; align-items: center; padding: 10px 14px; border-bottom: 1px solid var(--bd); }
    .notif-row.unread { background: rgba(239,68,68,.06); }
    .notif-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--dim); flex: 0 0 auto; }
    .notif-row.unread .notif-dot { background: var(--red); box-shadow: 0 0 6px rgba(239,68,68,.7); }
    .mark-btn { margin: 12px 14px; width: calc(100% - 28px); }

    /* ── cards & layout ────────────────────────────────────── */
    .card {
      position: relative;
      background: linear-gradient(180deg, rgba(255,255,255,.028), rgba(255,255,255,0) 42%), var(--bg2);
      border: 1px solid var(--bd); border-radius: 13px;
      padding: 14px 16px; margin-bottom: 14px;
      box-shadow: inset 0 1px 0 rgba(255,255,255,.045);
      transition: border-color .18s ease, box-shadow .18s ease, transform .18s ease;
    }
    .card::before {
      content: ''; position: absolute; top: 0; left: 14px; right: 14px; height: 1px;
      background: linear-gradient(90deg, transparent, rgba(239,68,68,.4), transparent);
      opacity: 0; transition: opacity .2s ease;
    }
    .card:hover {
      border-color: rgba(239,68,68,.3);
      box-shadow: inset 0 1px 0 rgba(255,255,255,.05), 0 8px 26px rgba(0,0,0,.3), 0 0 18px rgba(239,68,68,.06);
    }
    .card:hover::before { opacity: 1; }
    .card-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 10px; }
    .card-title { display: flex; align-items: center; gap: 7px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #d4d4d8; }
    .card-title svg { color: var(--red-h); }
    .card-note { font-size: 10.5px; color: var(--dim); }
    .card-hint { font-size: 11px; color: var(--dim); margin-top: 8px; line-height: 1.5; }
    .card-hint.warn { color: var(--red-h); }
    .sec-head { display: flex; align-items: center; gap: 7px; margin-bottom: 8px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: #d4d4d8; }
    .sec-ico { display: flex; color: var(--red-h); }
    .sec-title { font-size: 11px; }

    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; align-items: start; }
    .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; align-items: start; }
    .right-col { display: flex; flex-direction: column; }
    .overview-grid { display: flex; flex-direction: column; gap: 14px; }

    .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(122px, 1fr)); gap: 10px; margin-bottom: 14px; }
    .stat {
      position: relative; background: linear-gradient(180deg, rgba(255,255,255,.035), rgba(255,255,255,0) 55%), var(--bg3);
      border: 1px solid var(--bd); border-radius: 11px; padding: 12px 14px;
      box-shadow: inset 0 1px 0 rgba(255,255,255,.05);
      transition: border-color .16s ease, box-shadow .16s ease, transform .16s ease;
    }
    .stat:hover { border-color: rgba(239,68,68,.32); transform: translateY(-1px); box-shadow: 0 5px 18px rgba(0,0,0,.28), 0 0 14px rgba(239,68,68,.07); }
    .stat-label { font-size: 10px; text-transform: uppercase; letter-spacing: .09em; color: var(--dim); }
    .stat-value {
      font-size: 17px; font-weight: 800; margin-top: 3px; letter-spacing: -.2px;
      background: linear-gradient(180deg, #fff, #d4d4da);
      -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
    }
    .stat-sub { font-size: 11px; color: var(--mut); margin-top: 2px; }

    .skeleton-block { padding: 2px 0; }
    .skel {
      display: block; border-radius: 6px;
      background: linear-gradient(90deg, #202020 25%, #2b2b2b 50%, #202020 75%);
      background-size: 200% 100%; animation: candle-shimmer 1.3s infinite linear;
    }
    .skel-off { background: #242424; animation: none; }
    @keyframes candle-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

    /* ── buttons / inputs ──────────────────────────────────── */
    .btn {
      display: inline-flex; align-items: center; justify-content: center; gap: 6px;
      padding: 8px 14px; border-radius: 8px; border: 1px solid transparent;
      font-size: 12.5px; font-weight: 600; cursor: pointer; font-family: inherit;
      transition: filter .12s ease, background .12s ease, transform .06s ease;
    }
    .btn:active { transform: translateY(1px); }
    .btn:disabled { opacity: .45; cursor: not-allowed; transform: none; }
    .btn-primary {
      position: relative; overflow: hidden;
      background: linear-gradient(135deg, var(--red-h), var(--red-d));
      color: #fff; box-shadow: 0 3px 18px rgba(239,68,68,.42);
    }
    .btn-primary::after {
      content: ''; position: absolute; top: 0; left: -70%; width: 40%; height: 100%;
      background: linear-gradient(100deg, transparent, rgba(255,255,255,.28), transparent);
      transform: skewX(-20deg); animation: candle-shine 3.4s ease-in-out infinite;
    }
    .btn-primary:hover:not(:disabled) { filter: brightness(1.12); }
    .btn-ghost { background: transparent; border-color: var(--bd); color: var(--mut); }
    .btn-ghost:hover:not(:disabled) { border-color: rgba(239,68,68,.45); color: var(--tx); }
    .btn-soft { background: rgba(239,68,68,.12); color: var(--red-h); border-color: rgba(239,68,68,.25); }
    .btn-soft:hover:not(:disabled) { background: rgba(239,68,68,.2); }
    .btn-sm { padding: 5px 10px; font-size: 11.5px; border-radius: 7px; }

    .input, .select {
      width: 100%; background: var(--bg3); border: 1px solid var(--bd); border-radius: 8px;
      color: var(--tx); font-size: 12.5px; font-family: inherit; padding: 8px 11px;
      outline: none; transition: border-color .13s ease, box-shadow .13s ease;
    }
    .input::placeholder { color: var(--dim); }
    .input:focus, .select:focus { border-color: rgba(239,68,68,.6); box-shadow: 0 0 0 3px rgba(239,68,68,.14); }
    .select { width: auto; cursor: pointer; }
    .select option { background: var(--bg1); }

    .sw {
      width: 34px; height: 18px; border-radius: 10px; border: 1px solid var(--bd);
      background: #2c2c2c; position: relative; cursor: pointer; flex: 0 0 auto;
      transition: background .15s ease;
    }
    .sw-thumb {
      position: absolute; top: 2px; left: 2px; width: 12px; height: 12px; border-radius: 50%;
      background: #b9b9bf; transition: transform .16s ease, background .16s ease;
    }
    .sw.on { background: linear-gradient(90deg, var(--red-d), var(--red)); border-color: transparent; box-shadow: 0 0 8px rgba(239,68,68,.4); }
    .sw.on .sw-thumb { transform: translateX(16px); background: #fff; }

    /* ── states ────────────────────────────────────────────── */
    .state { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 26px 16px; text-align: center; }
    .state-icon { color: var(--dim); }
    .state-icon.err { color: var(--red); }
    .state-title { font-size: 13px; font-weight: 700; color: #d4d4d8; }
    .state-hint { font-size: 11.5px; color: var(--dim); max-width: 320px; }
    .state .btn { margin-top: 6px; }

    .badge { display: inline-flex; align-items: center; font-size: 10px; font-weight: 700; letter-spacing: .04em; padding: 2px 7px; border-radius: 5px; background: rgba(255,255,255,.08); color: var(--mut); }
    .badge.warn { background: rgba(239,68,68,.16); color: var(--red-h); }

    .avatar {
      display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto;
      border-radius: 8px; font-weight: 800; color: #fff;
      background: linear-gradient(135deg, #3a3a3a, #262626);
      border: 1px solid rgba(255,255,255,.09);
      text-transform: uppercase; user-select: none;
    }

    /* ── toasts ────────────────────────────────────────────── */
    .candle-toasts {
      position: fixed; right: 18px; bottom: 18px; z-index: 2147483020;
      display: flex; flex-direction: column; gap: 8px; pointer-events: none; width: 300px;
    }
    .candle-toasts.toast-tr { top: 18px; bottom: auto; }
    .toast {
      display: flex; gap: 10px; align-items: flex-start;
      background: #1d1d1d; border: 1px solid var(--bd); border-left: 3px solid var(--red);
      border-radius: 10px; padding: 10px 12px; box-shadow: 0 10px 30px rgba(0,0,0,.55);
      opacity: 0; transform: translateX(16px); transition: opacity .18s ease, transform .18s ease;
      pointer-events: auto;
    }
    .toast.show { opacity: 1; transform: translateX(0); }
    .toast-success { border-left-color: var(--up); }
    .toast-error { border-left-color: var(--red); }
    .toast-icon { color: var(--red-h); display: flex; }
    .toast-success .toast-icon { color: var(--up); }
    .toast-title { font-size: 12px; font-weight: 700; }
    .toast-msg { font-size: 11px; color: var(--mut); margin-top: 1px; }

    /* ── modals ────────────────────────────────────────────── */
    .modal-back {
      position: absolute; inset: 0; background: rgba(5,5,7,.66);
      display: flex; align-items: center; justify-content: center; z-index: 2147483015;
      backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px);
    }
    .modal { width: min(400px, 94%); background: var(--bg2); border: 1px solid var(--bd); border-radius: 14px; overflow: hidden; box-shadow: 0 24px 70px rgba(0,0,0,.7); }
    .modal-head { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid var(--bd); }
    .modal-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: #d4d4d8; }
    .traffic-mini { width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; border: 0; border-radius: 7px; background: rgba(255,255,255,.07); color: var(--mut); cursor: pointer; }
    .traffic-mini:hover { background: var(--red); color: #fff; }
    .modal-body { padding: 16px; max-height: 60vh; overflow-y: auto; }
    .profile-row { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
    .profile-actions { display: flex; align-items: center; gap: 6px; margin-top: 10px; }
    .profile-name { font-size: 15px; font-weight: 750; }
    .profile-username { font-size: 12px; color: var(--mut); }
    .credits { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 28px 22px; text-align: center; }
    .credits-logo .logo-mark { filter: drop-shadow(0 0 12px rgba(239,68,68,.55)); }
    .credits-name { font-size: 21px; font-weight: 800; letter-spacing: -.5px; }
    .credits-ver { font-size: 11px; color: var(--dim); }
    .credits-line { font-size: 12px; color: var(--mut); }
    .credits-line.dim { color: var(--dim); font-size: 11px; }
    .credits .btn { margin-top: 12px; width: 120px; }

    /* ── chart ─────────────────────────────────────────────── */
    .chart-box { position: relative; width: 100%; }
    .chart-svg { width: 100%; height: 100%; display: block; }
    .chart-tip {
      display: none; position: absolute; min-width: 128px; padding: 7px 10px;
      background: #1d1d1d; border: 1px solid var(--bd); border-radius: 9px;
      box-shadow: 0 10px 30px rgba(0,0,0,.55); pointer-events: none; z-index: 6;
    }
    .chart-tip-t { font-size: 10.5px; color: var(--mut); margin-bottom: 4px; }
    .chart-tip .ev-row { padding: 2px 0; }
    .chart-cross { display: none; position: absolute; top: 0; bottom: 0; width: 1px; background: rgba(255,255,255,.28); pointer-events: none; z-index: 5; }

    /* ── coin view ─────────────────────────────────────────── */
    .view-toolbar { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; }
    .coin-head { margin-bottom: 14px; }
    .coin-name-row { display: flex; align-items: center; gap: 12px; }
    .coin-title { font-size: 25px; font-weight: 800; letter-spacing: -.6px; display: flex; align-items: baseline; gap: 10px; }
    .coin-sub { font-size: 14px; font-weight: 500; color: var(--mut); }
    .coin-tags { display: flex; gap: 7px; margin-top: 6px; align-items: center; }
    .dev-chip {
      display: inline-flex; align-items: center; gap: 5px; font-size: 10.5px; color: var(--amber);
      background: rgba(251,191,36,.1); border: 1px solid rgba(251,191,36,.25); border-radius: 6px; padding: 2px 8px; cursor: pointer;
    }
    .dev-chip:hover { background: rgba(251,191,36,.18); }
    .coin-cols { display: grid; grid-template-columns: minmax(0, 1.9fr) minmax(280px, 1fr); gap: 14px; align-items: start; }
    .coin-side { display: flex; flex-direction: column; }
    .tf-row { display: flex; gap: 3px; background: var(--bg3); border: 1px solid var(--bd); border-radius: 8px; padding: 2px; }
    .tf-pill { border: 0; background: transparent; color: var(--dim); font-size: 10.5px; font-weight: 700; padding: 4px 9px; border-radius: 6px; cursor: pointer; font-family: inherit; }
    .tf-pill:hover { color: var(--mut); }
    .tf-pill.on { background: var(--red-d); color: #fff; box-shadow: 0 1px 8px rgba(239,68,68,.4); }
    .chart-wrap { min-height: 250px; }
    .side-row { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 8px; }
    .side-pill { padding: 7px; border-radius: 8px; border: 1px solid var(--bd); background: transparent; color: var(--mut); font-weight: 750; font-size: 12px; cursor: pointer; font-family: inherit; transition: all .13s ease; }
    .side-pill.buy.on { background: var(--up); border-color: var(--up); color: #052e1b; }
    .side-pill.sell.on { background: var(--red); border-color: var(--red); color: #fff; }
    .trade-preview { margin: 10px 0; }
    .trade-preview .ev-row { padding: 4px 0; }
    .ev { display: flex; flex-direction: column; }
    .ev-row { display: flex; justify-content: space-between; gap: 10px; padding: 5px 0; font-size: 12px; border-bottom: 1px dashed rgba(255,255,255,.05); }
    .ev-row:last-child { border-bottom: 0; }
    .ev-k { color: var(--mut); }
    .ev-v { color: var(--tx); font-weight: 600; }
    .alert-row { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
    .holder-row, .leader-row { display: flex; align-items: center; gap: 10px; padding: 7px 4px; border-bottom: 1px solid rgba(255,255,255,.045); }
    .holder-rank { font-size: 11px; color: var(--dim); width: 22px; }
    .holder-user { display: flex; align-items: center; gap: 8px; background: none; border: 0; color: var(--tx); font-size: 12.5px; font-weight: 600; cursor: pointer; font-family: inherit; padding: 0; flex: 1; min-width: 0; text-align: left; }
    .holder-user:hover { color: var(--red-h); }
    .holder-qty { font-size: 11.5px; color: var(--mut); }
    .holder-pct { font-size: 11.5px; color: var(--mut); width: 52px; text-align: right; }
    .holder-liq { font-size: 11.5px; width: 84px; text-align: right; }
    .dev-card { border-color: rgba(251,191,36,.3); }
    .comment-list { max-height: 300px; overflow-y: auto; }
    .composer { display: flex; gap: 8px; margin-bottom: 10px; }
    .composer .input { flex: 1; }
    .comment-row { display: flex; gap: 10px; padding: 9px 2px; border-bottom: 1px solid rgba(255,255,255,.045); }
    .comment-main { flex: 1; min-width: 0; }
    .comment-meta { display: flex; gap: 8px; align-items: baseline; }
    .comment-user { font-size: 11.5px; font-weight: 700; }
    .comment-time { font-size: 10px; color: var(--dim); }
    .comment-text { font-size: 12.5px; color: #d4d4d8; margin-top: 2px; word-wrap: break-word; }
    .like-btn { display: flex; align-items: center; gap: 4px; align-self: flex-start; background: none; border: 0; color: var(--dim); font-size: 11px; cursor: pointer; padding: 3px 6px; border-radius: 6px; }
    .like-btn:hover { color: var(--red-h); background: rgba(239,68,68,.08); }

    /* ── market ────────────────────────────────────────────── */
    .market-toolbar { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
    .search-input { flex: 1; min-width: 180px; }
    .mkt-table { margin-bottom: 10px; }
    .mkt-grid { display: grid; grid-template-columns: 2.1fr 1fr 1fr 1.25fr 1.25fr 36px; gap: 8px; align-items: center; }
    .mkt-head { padding: 6px 12px; }
    .mkt-th { font-size: 10px; text-transform: uppercase; letter-spacing: .09em; color: var(--dim); font-weight: 700; }
    .mkt-row {
      width: 100%; border: 0; background: transparent; border-radius: 9px; padding: 6px 12px;
      cursor: pointer; font-family: inherit; color: var(--tx); text-align: left;
      transition: background .12s ease;
    }
    .mkt-row:hover { background: rgba(255,255,255,.045); }
    .mkt-cell { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
    .mkt-coin { display: flex; align-items: center; gap: 9px; }
    .mkt-sym { font-weight: 750; font-size: 12.5px; }
    .mkt-name { font-size: 10.5px; color: var(--dim); }
    .mkt-star { color: var(--dim); cursor: pointer; display: flex; align-items: center; justify-content: center; }
    .mkt-star:hover { color: var(--amber); }
    .pager { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 4px 0; }
    .pager-info { font-size: 11px; color: var(--dim); }

    /* ── watchlist ─────────────────────────────────────────── */
    .watch-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
    .watch-card { display: flex; flex-direction: column; gap: 8px; cursor: pointer; text-align: left; font-family: inherit; color: var(--tx); width: 100%; }
    .watch-head { display: flex; align-items: center; gap: 9px; }
    .watch-chart svg { display: block; }
    .watch-stats { display: flex; align-items: center; justify-content: space-between; }
    .watch-price { font-size: 14px; font-weight: 700; }

    /* ── overview ──────────────────────────────────────────── */
    .nw-row { display: flex; gap: 10px; }
    .nw-row .stat { flex: 1; }
    .mini-row {
      display: flex; align-items: center; gap: 9px; width: 100%; padding: 6px 2px;
      border: 0; background: none; color: var(--tx); cursor: pointer; font-family: inherit; text-align: left;
      border-bottom: 1px solid rgba(255,255,255,.045);
    }
    .mini-row:hover { background: rgba(255,255,255,.03); }
    .mini-main { flex: 1; min-width: 0; }
    .mini-name { font-size: 12px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .mini-sub { font-size: 10.5px; color: var(--dim); }
    .mini-right { text-align: right; }
    .movers-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .mini-col-title { font-size: 10px; text-transform: uppercase; letter-spacing: .09em; color: var(--dim); font-weight: 700; margin-bottom: 4px; }
    .feed-row { display: flex; align-items: center; gap: 9px; padding: 6px 2px; border-bottom: 1px solid rgba(255,255,255,.045); width: 100%; border: 0; background: none; color: var(--tx); cursor: pointer; font-family: inherit; text-align: left; }
    .feed-row:hover { background: rgba(255,255,255,.03); }
    .season-name { font-size: 14px; font-weight: 750; }
    .season-count { font-size: 12px; color: var(--mut); margin-top: 3px; }
    .season-rank { font-size: 11px; color: var(--red-h); margin-top: 3px; }

    /* ── hopium ────────────────────────────────────────────── */
    .hopium-list { display: flex; flex-direction: column; gap: 8px; }
    .hopium-row {
      display: flex; flex-direction: column; gap: 8px; width: 100%; padding: 12px 14px;
      background: var(--bg2); border: 1px solid var(--bd); border-radius: 10px;
      color: var(--tx); cursor: pointer; font-family: inherit; text-align: left;
      transition: border-color .13s ease, background .13s ease;
    }
    .hopium-row:hover { border-color: rgba(239,68,68,.4); background: var(--bg3); }
    .hopium-main { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
    .hopium-q { font-size: 13px; font-weight: 600; }
    .hopium-q.big { font-size: 16px; font-weight: 750; margin-bottom: 6px; }
    .hopium-meta { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .count-pill { display: inline-flex; align-items: center; gap: 4px; font-size: 10.5px; color: var(--amber); background: rgba(251,191,36,.09); border: 1px solid rgba(251,191,36,.22); padding: 2px 8px; border-radius: 6px; }
    .status-pill { font-size: 10px; text-transform: uppercase; letter-spacing: .05em; color: var(--mut); background: rgba(255,255,255,.07); padding: 2px 8px; border-radius: 6px; }
    .odds { display: flex; flex-direction: column; gap: 4px; }
    .odds-track { height: 6px; border-radius: 3px; background: #2c2c2c; overflow: hidden; }
    .odds-fill { height: 100%; background: linear-gradient(90deg, var(--red-d), var(--red)); border-radius: 3px; transition: width .3s ease; }
    .odds-labels { display: flex; justify-content: space-between; font-size: 10.5px; }
    .bet-row { display: flex; gap: 8px; }
    .bet-row .input { flex: 1; }
    .prob-chart { padding: 6px 0 0; }

    /* ── gamble ────────────────────────────────────────────── */
    .calc-row { display: flex; gap: 8px; margin-bottom: 8px; }
    .calc-row .input, .calc-row .select { flex: 1; }

    /* ── mods ──────────────────────────────────────────────── */
    .mods-top { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
    .mod-count { font-size: 11px; color: var(--mut); }
    .chip-row { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 14px; }
    .chip {
      padding: 5px 12px; border-radius: 8px; border: 1px solid var(--bd); background: transparent;
      color: var(--mut); font-size: 11.5px; font-weight: 600; cursor: pointer; font-family: inherit;
      transition: all .13s ease;
    }
    .chip:hover { color: var(--tx); border-color: rgba(255,255,255,.16); }
    .chip.on { background: linear-gradient(90deg, var(--red-d), var(--red)); color: #fff; border-color: transparent; box-shadow: 0 2px 10px rgba(239,68,68,.3); }
    .mod-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 10px; }
    .mod-card {
      background: var(--bg2); border: 1px solid var(--bd); border-radius: 11px; padding: 11px 13px;
      display: flex; flex-direction: column; gap: 6px; transition: border-color .13s ease;
    }
    .mod-card.on {
      border-color: rgba(239,68,68,.45);
      box-shadow: inset 0 1px 0 rgba(255,255,255,.05), 0 0 18px rgba(239,68,68,.1);
    }
    .mod-card .sw { transition: background .16s ease, box-shadow .16s ease, border-color .16s ease; }
    .mod-head { display: flex; align-items: center; gap: 8px; }
    .mod-ico { color: var(--red-h); display: flex; }
    .mod-name { font-size: 12.5px; font-weight: 700; flex: 1; }
    .mod-desc { font-size: 11px; color: var(--mut); line-height: 1.45; min-height: 30px; }
    .mod-cat { font-size: 9.5px; text-transform: uppercase; letter-spacing: .1em; color: var(--dim); display: flex; align-items: center; gap: 6px; }
    .mod-site { color: var(--up); font-weight: 800; letter-spacing: .04em; }
    .settings-row { display: flex; gap: 22px; flex-wrap: wrap; align-items: center; }
    .settings-item { display: flex; align-items: center; gap: 10px; }
    .settings-label { font-size: 12px; color: var(--mut); }

    /* ── live / progress / leaders ─────────────────────────── */
    .live-head { margin-bottom: 6px; }
    .live-status { font-size: 10.5px; color: var(--up); display: inline-flex; align-items: center; gap: 5px; }
    .live-status::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: var(--up); box-shadow: 0 0 6px rgba(52,211,153,.7); }
    .live-list { display: flex; flex-direction: column; }
    .tx-type { font-size: 9.5px; font-weight: 800; letter-spacing: .05em; background: rgba(255,255,255,.08); color: var(--red-h); padding: 2px 7px; border-radius: 5px; }
    .seg-row { display: flex; gap: 4px; margin-bottom: 12px; background: var(--bg2); border: 1px solid var(--bd); border-radius: 9px; padding: 3px; width: fit-content; }
    .seg-pill { padding: 6px 14px; border: 0; border-radius: 7px; background: transparent; color: var(--mut); font-size: 12px; font-weight: 650; cursor: pointer; font-family: inherit; }
    .seg-pill.on { background: linear-gradient(90deg, var(--red-d), var(--red)); color: #fff; box-shadow: 0 1px 8px rgba(239,68,68,.35); }
    .prog-head { margin-bottom: 12px; }
    .ach-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 10px; }
    .ach-card {
      background: var(--bg2); border: 1px solid var(--bd); border-radius: 11px; padding: 13px;
      display: flex; flex-direction: column; gap: 6px; opacity: .55;
    }
    .ach-card.unlocked { opacity: 1; border-color: rgba(52,211,153,.35); }
    .ach-card.claimed { border-color: rgba(251,191,36,.3); }
    .ach-icon { color: var(--dim); display: flex; }
    .ach-card.unlocked .ach-icon { color: var(--up); }
    .ach-name { font-size: 12.5px; font-weight: 750; }
    .ach-desc { font-size: 11px; color: var(--mut); line-height: 1.4; flex: 1; }
    .ach-state { margin-top: 2px; }
    .ach-pill { font-size: 9.5px; text-transform: uppercase; letter-spacing: .08em; color: var(--dim); background: rgba(255,255,255,.06); padding: 2px 8px; border-radius: 5px; }
    .ach-pill.on { color: var(--up); background: rgba(52,211,153,.1); }
    .ach-pill.done { color: var(--amber); background: rgba(251,191,36,.1); }
    .leader-list { display: flex; flex-direction: column; }
    .hold-list { display: flex; flex-direction: column; }

    /* ── minimized pill ────────────────────────────────────── */
    .candle-pill {
      position: fixed; left: 50%; bottom: 22px; transform: translate(-50%, 24px);
      display: flex; align-items: center; gap: 8px; padding: 8px 16px 8px 10px;
      background: linear-gradient(135deg, var(--red-d), #991b1b);
      border: 1px solid rgba(255,255,255,.14); border-radius: 999px; color: #fff;
      font-size: 12.5px; font-weight: 750; font-family: inherit; cursor: pointer;
      box-shadow: 0 10px 34px rgba(0,0,0,.6), 0 0 22px rgba(239,68,68,.35);
      opacity: 0; pointer-events: none; transition: opacity .18s ease, transform .24s cubic-bezier(.2,.9,.3,1.2);
      z-index: 2147483002;
    }
    .candle-pill.show { opacity: 1; pointer-events: auto; transform: translate(-50%, 0); }
    .candle-pill:hover { filter: brightness(1.12); }
    .candle-pill .logo-mark { filter: drop-shadow(0 0 5px rgba(255,255,255,.35)); }

    /* ── market: snapshot + treemap ────────────────────────── */
    .market-stats {
      font-size: 10.5px; color: var(--mut); background: var(--bg2); border: 1px solid var(--bd);
      border-radius: 9px; padding: 7px 12px; margin-bottom: 10px; overflow: hidden;
      text-overflow: ellipsis; white-space: nowrap;
    }
    .treemap-head { margin-bottom: 8px; }
    .treemap { position: relative; width: 100%; height: 300px; border-radius: 10px; overflow: hidden; background: var(--bg3); }
    .treemap-cell {
      position: absolute; border: 1px solid rgba(0,0,0,.25); border-radius: 3px;
      color: #fff; font-family: inherit; cursor: pointer; text-align: left;
      display: flex; flex-direction: column; justify-content: flex-end; padding: 4px 6px;
      overflow: hidden; text-shadow: 0 1px 2px rgba(0,0,0,.6); font-weight: 700;
      transition: filter .12s ease, z-index .12s ease;
    }
    .treemap-cell:hover { filter: brightness(1.18); z-index: 3; }
    .tc-sym { font-size: 10px; line-height: 1.2; }
    .tc-cap { font-size: 9px; opacity: .85; }

    /* ── coin: quick sell + lock badge ─────────────────────── */
    .quick-sell-row { display: flex; align-items: center; gap: 6px; margin: 8px 0 2px; }
    .qs-label { font-size: 10px; text-transform: uppercase; letter-spacing: .08em; color: var(--dim); margin-right: 2px; }
    .quick-sell-row .btn { padding: 4px 8px; font-size: 10.5px; }
    .lock-badge { font-variant-numeric: tabular-nums; }

    /* ── portfolio: tx controls ────────────────────────────── */
    .tx-ctrl { display: flex; gap: 8px; margin-bottom: 8px; }
    .tx-search { flex: 1; }

    /* ── achievements: rewards + progress ──────────────────── */
    .ach-reward { display: flex; align-items: center; gap: 8px; font-size: 11px; }
    .ar-cash { color: var(--up); font-weight: 700; }
    .ar-gems { color: #facc15; }
    .ach-prog { display: flex; align-items: center; gap: 8px; }
    .ap-track { flex: 1; height: 5px; border-radius: 3px; background: #2c2c2c; overflow: hidden; }
    .ap-fill { height: 100%; background: linear-gradient(90deg, var(--red-d), var(--red)); border-radius: 3px; }
    .ap-label { font-size: 9.5px; color: var(--dim); }

    /* ── shop: crates + colors ─────────────────────────────── */
    .crate-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(215px, 1fr)); gap: 10px; }
    .crate-card {
      background: var(--bg3); border: 1px solid var(--bd); border-radius: 11px; padding: 12px;
      display: flex; flex-direction: column; gap: 8px;
    }
    .crate-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .crate-name { font-size: 13px; font-weight: 750; }
    .crate-cost { font-size: 11px; color: #facc15; }
    .crate-ev { font-size: 10.5px; color: var(--mut); }
    .crate-odds { display: flex; flex-direction: column; gap: 3px; flex: 1; }
    .crate-odd { display: flex; align-items: center; gap: 8px; font-size: 10.5px; }
    .co-w { color: var(--dim); width: 34px; text-align: right; }
    .co-l { color: var(--mut); }
    .color-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 9px; }
    .color-card {
      display: flex; align-items: center; gap: 10px; padding: 10px 12px;
      background: var(--bg3); border: 1px solid var(--bd); border-radius: 10px;
    }
    .color-card.owned { border-color: rgba(52,211,153,.35); }
    .color-chip { font-size: 13px; font-weight: 800; }
    .color-meta { flex: 1; min-width: 0; }
    .color-name { font-size: 12px; font-weight: 700; }
    .color-rarity { font-size: 9.5px; text-transform: uppercase; letter-spacing: .06em; }
    .color-price { font-size: 10.5px; color: #facc15; }
    .owned-pill { font-size: 9.5px; text-transform: uppercase; letter-spacing: .07em; color: var(--up); }

    /* ── rewards: tiers ────────────────────────────────────── */
    .tier-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 6px; }
    .tier-cell {
      display: flex; flex-direction: column; gap: 2px; padding: 7px 9px;
      background: var(--bg3); border: 1px solid var(--bd); border-radius: 8px; opacity: .62;
    }
    .tier-cell.past { opacity: .85; }
    .tier-cell.on { opacity: 1; border-color: rgba(239,68,68,.55); box-shadow: 0 0 12px rgba(239,68,68,.18); }
    .tier-day { font-size: 9.5px; color: var(--dim); }
    .tier-amt { font-size: 11px; font-weight: 700; }

    /* ── account: volume + switches ────────────────────────── */
    .vol-row { display: flex; align-items: center; gap: 10px; padding: 7px 0; }
    .vol-label { font-size: 12px; color: var(--mut); flex: 1; }
    .vol-val { font-size: 11px; color: var(--tx); min-width: 40px; text-align: right; }
    .range {
      -webkit-appearance: none; appearance: none; width: 120px; height: 5px; border-radius: 3px;
      background: var(--bg3); outline: none; border: 1px solid var(--bd);
    }
    .range::-webkit-slider-thumb {
      -webkit-appearance: none; appearance: none; width: 14px; height: 14px; border-radius: 50%;
      background: var(--red); border: 2px solid #fff; cursor: pointer; box-shadow: 0 1px 6px rgba(0,0,0,.4);
    }

    /* ── two-step confirm ──────────────────────────────────── */
    .btn.armed { background: var(--red); border-color: var(--red); animation: candle-pulse 1s ease infinite; }
    @keyframes candle-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(239,68,68,.45); } 50% { box-shadow: 0 0 0 6px rgba(239,68,68,0); } }

    /* ── compact + glow toggles ────────────────────────────── */
    .compact .candle-content { padding: 10px 16px 18px; }
    .compact .card { padding: 10px 12px; margin-bottom: 10px; }
    .compact .candle-h1 { font-size: 20px; }
    .compact .stat { padding: 9px 11px; }
    .no-glow .candle-window { box-shadow: 0 24px 70px rgba(0,0,0,.6); }
    .no-glow .candle-window::before { display: none; }
    .no-glow .btn-primary, .no-glow .nav-item.on, .no-glow .chip.on, .no-glow .seg-pill.on { box-shadow: none; }
    .no-glow .brand .logo-mark, .no-glow .tb-brand .logo-mark, .no-glow .candle-pill .logo-mark { filter: none; }

    /* ── light theme ───────────────────────────────────────── */
    :host([data-candle-theme="light"]) .candle-window {
      background: var(--bg0); box-shadow: 0 24px 70px rgba(0,0,0,.28);
    }
    :host([data-candle-theme="light"]) .candle-window::after { display: none; }
    :host([data-candle-theme="light"]) .candle-titlebar { background: var(--bg1); }
    :host([data-candle-theme="light"]) .tb-brand span:not(.tb-ver) { background: linear-gradient(90deg, #18181b, var(--red-d)); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
    :host([data-candle-theme="light"]) .brand-name { background: linear-gradient(90deg, #18181b, var(--red-d)); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
    :host([data-candle-theme="light"]) .candle-h1 { background: linear-gradient(180deg, #18181b, #52525b); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
    :host([data-candle-theme="light"]) .brand { box-shadow: none; }
    :host([data-candle-theme="light"]) .card { background: var(--bg2); box-shadow: none; }
    :host([data-candle-theme="light"]) .card:hover { box-shadow: 0 6px 20px rgba(0,0,0,.1); }
    :host([data-candle-theme="light"]) .candle-side { background: var(--bg1); }
    :host([data-candle-theme="light"]) .stat { background: var(--bg2); box-shadow: none; }
    :host([data-candle-theme="light"]) .stat-value { background: linear-gradient(180deg, #18181b, #52525b); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
    :host([data-candle-theme="light"]) .card-title,
    :host([data-candle-theme="light"]) .sec-title,
    :host([data-candle-theme="light"]) .state-title,
    :host([data-candle-theme="light"]) .mod-name,
    :host([data-candle-theme="light"]) .mini-name,
    :host([data-candle-theme="light"]) .ach-name,
    :host([data-candle-theme="light"]) .hopium-q,
    :host([data-candle-theme="light"]) .crate-name,
    :host([data-candle-theme="light"]) .color-name,
    :host([data-candle-theme="light"]) .comment-user,
    :host([data-candle-theme="light"]) .profile-name { color: #27272a; }
    :host([data-candle-theme="light"]) .nav-item { color: #52525b; }
    :host([data-candle-theme="light"]) .nav-item:hover { background: rgba(0,0,0,.05); color: #18181b; }
    :host([data-candle-theme="light"]) .skel { background: linear-gradient(90deg, #e4e4e7 25%, #f0f0f2 50%, #e4e4e7 75%); background-size: 200% 100%; }
    :host([data-candle-theme="light"]) .mkt-row:hover,
    :host([data-candle-theme="light"]) .mini-row:hover,
    :host([data-candle-theme="light"]) .feed-row:hover { background: rgba(0,0,0,.035); }
    :host([data-candle-theme="light"]) .ev-row,
    :host([data-candle-theme="light"]) .holder-row,
    :host([data-candle-theme="light"]) .leader-row,
    :host([data-candle-theme="light"]) .comment-row,
    :host([data-candle-theme="light"]) .feed-row,
    :host([data-candle-theme="light"]) .mini-row { border-color: rgba(0,0,0,.07); }
    :host([data-candle-theme="light"]) .ap-track,
    :host([data-candle-theme="light"]) .odds-track { background: #d4d4d8; }
    :host([data-candle-theme="light"]) .sw { background: #d4d4d8; }
    :host([data-candle-theme="light"]) .chart-tip { border-color: rgba(0,0,0,.14); }
    :host([data-candle-theme="light"]) .tl { border-color: rgba(0,0,0,.2); }

    /* ── premium motion ────────────────────────────────────── */
    .view { animation: candle-view-in .3s cubic-bezier(.16,1,.3,1) both; }
    @keyframes candle-view-in {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .candle-pill, .bell-btn, .tl, .btn, .nav-item, .chip, .seg-pill, .tf-pill, .side-pill, .mkt-row, .mini-row, .feed-row, .hopium-row, .leader-row, .crate-card, .color-card, .tier-cell, .treemap-cell, .mod-card { transition: transform .16s cubic-bezier(.2,.9,.3,1.2), box-shadow .16s ease, border-color .16s ease, background .16s ease, color .16s ease, opacity .16s ease, filter .16s ease; }
    .mkt-row:hover, .mini-row:hover, .feed-row:hover, .hopium-row:hover, .leader-row:hover { background: rgba(255,255,255,.035); }
    .card { transition: border-color .18s ease, box-shadow .18s ease, transform .18s ease; }
    .card:hover { transform: translateY(-1px); }
    .no-anim *, .no-anim *::before, .no-anim *::after { transition: none !important; animation: none !important; }
    .deep-shadow .candle-window { box-shadow: 0 0 0 1px rgba(239,68,68,.16), 0 48px 120px rgba(0,0,0,.9), 0 0 100px rgba(239,68,68,.12); }

    /* ── status bar ────────────────────────────────────────── */
    .candle-status {
      height: 28px; flex: 0 0 auto; display: none; align-items: center; justify-content: space-between;
      padding: 0 16px; background: linear-gradient(180deg, rgba(255,255,255,.03), transparent), var(--bg1);
      border-top: 1px solid var(--bd); position: relative; z-index: 5;
      font-size: 9.5px; color: var(--dim); letter-spacing: .06em; text-transform: uppercase;
    }
    .key-hints { margin-top: 8px; font-size: 9px; color: var(--dim); letter-spacing: .05em; padding: 5px 7px; border: 1px dashed var(--bd); border-radius: 6px; }

    /* ── trade intel / analytics ───────────────────────────── */
    .flow-bar { display: flex; height: 6px; border-radius: 3px; overflow: hidden; margin: 4px 0 2px; background: #2c2c2c; }
    .flow-buy { background: var(--up); }
    .flow-sell { background: var(--down); }
    .flow-legend { font-size: 9px; color: var(--dim); }
    .wallet-track { font-size: 10px; color: var(--mut); padding: 2px 0 8px; border-bottom: 1px dashed var(--bd); margin-bottom: 8px; }
    .last-candle { display: flex; flex-wrap: wrap; gap: 12px; font-size: 10.5px; color: var(--mut); margin-top: 8px; padding: 7px 10px; background: var(--bg3); border-radius: 8px; border: 1px solid var(--bd); }
    .last-candle .lc-t { color: var(--dim); font-weight: 800; letter-spacing: .06em; }
    .last-candle .lc-vol { color: var(--dim); }
    .depth-bar-wrap { grid-column: 1 / -1; padding: 2px 4px 0; }
    .depth-bar-label { display: flex; justify-content: space-between; font-size: 10px; color: var(--mut); margin-bottom: 4px; }
    .depth-bar { height: 6px; border-radius: 3px; background: #2c2c2c; overflow: hidden; }
    .depth-bar-fill { height: 100%; background: linear-gradient(90deg, var(--red-d), var(--red)); border-radius: 3px; }
    .insight-row { font-size: 10.5px; color: var(--mut); padding: 6px 10px; margin-bottom: 6px; background: var(--bg3); border-radius: 8px; border: 1px solid var(--bd); }
    .mini-tag { font-size: 8.5px; font-weight: 800; text-transform: uppercase; letter-spacing: .05em; color: var(--red-h); border: 1px solid rgba(239,68,68,.35); border-radius: 4px; padding: 1px 4px; margin-left: 6px; vertical-align: 1px; }
    .mini-row.big { border-color: rgba(239,68,68,.4); }
    .mini-row.topv { border-color: rgba(52,211,153,.35); }
    .feed-row.latest { border-left: 2px solid var(--red); }
    .tx-summary { font-size: 10px; color: var(--mut); padding: 4px 2px 8px; }
    .alloc-wrap { grid-column: 1 / -1; }
    .alloc-bar { display: flex; height: 8px; border-radius: 4px; overflow: hidden; background: #2c2c2c; }
    .alloc-cash { background: linear-gradient(90deg, var(--red-d), var(--red)); }
    .alloc-coins { background: linear-gradient(90deg, #059669, var(--up)); }
    .alloc-legend { font-size: 9.5px; color: var(--dim); margin-top: 3px; }
    .plan-col-label { font-size: 9px; font-weight: 800; letter-spacing: .1em; margin: 8px 0 2px; }
    .plan-col-label.up { color: var(--up); }
    .plan-col-label.down { color: var(--down); }

    /* ── market analytics ──────────────────────────────────── */
    .market-clock { display: block; font-size: 9.5px; color: var(--dim); margin: 0 0 6px 2px; }
    .chip-label { font-size: 10px; text-transform: uppercase; letter-spacing: .08em; color: var(--dim); display: inline-flex; align-items: center; margin-right: 2px; }
    .chip-row { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; margin-bottom: 12px; }
    .chip { border: 1px solid var(--bd); background: var(--bg2); color: var(--mut); border-radius: 999px; padding: 4px 11px; font-size: 10.5px; font-weight: 600; cursor: pointer; }
    .chip:hover { color: var(--tx); border-color: rgba(255,255,255,.16); }
    .chip.on { background: linear-gradient(90deg, var(--red-d), var(--red)); color: #fff; border-color: transparent; box-shadow: 0 2px 10px rgba(239,68,68,.3); }
    .mkt-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; margin-bottom: 10px; }
    .mkt-card { padding: 10px 12px; }
    .mkt-card-label { font-size: 9px; font-weight: 800; letter-spacing: .1em; color: var(--dim); }
    .mkt-card-sym { font-size: 14px; font-weight: 800; margin: 3px 0 1px; }
    .mkt-card-sub { font-size: 9.5px; color: var(--dim); }
    .mkt-dists { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 8px; margin-bottom: 10px; }
    .dist-card { padding: 10px 12px; }
    .dist-label { font-size: 9px; font-weight: 800; letter-spacing: .1em; color: var(--dim); margin-bottom: 6px; }
    .dist-bars { display: flex; align-items: flex-end; gap: 6px; height: 54px; }
    .dist-col { display: flex; flex-direction: column; align-items: center; gap: 3px; flex: 1; }
    .dist-bar { width: 100%; background: linear-gradient(180deg, var(--red), var(--red-d)); border-radius: 3px 3px 1px 1px; min-height: 3px; }
    .dist-lbl { font-size: 8px; color: var(--dim); }
    .price-dot { display: inline-block; width: 5px; height: 5px; border-radius: 50%; margin-right: 5px; vertical-align: 1px; box-shadow: 0 0 4px currentColor; }
    .mkt-row.micro { border-left: 2px solid #facc15; }
    .mkt-row.mega { border-left: 2px solid var(--up); }

    /* ── hopium extras ─────────────────────────────────────── */
    .hopium-hot { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; }
    .hot-chip { border: 1px solid rgba(239,68,68,.3); background: rgba(239,68,68,.07); }
    .hot-chip:hover { background: rgba(239,68,68,.16); }
    .spread-pill { color: var(--amber); font-size: 10px; }
    .ev-pill { color: var(--up); font-size: 10px; }
    .hopium-group { font-size: 10px; font-weight: 800; letter-spacing: .12em; color: var(--dim); margin: 14px 0 6px; }

    /* ── gamble extras ─────────────────────────────────────── */
    .gamble-extra { display: flex; flex-direction: column; gap: 10px; margin-top: 12px; }
    .gt-table { display: flex; flex-direction: column; font-size: 10.5px; }
    .gt-head, .gt-row { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; padding: 6px 10px; }
    .gt-head { color: var(--dim); font-size: 9px; letter-spacing: .08em; text-transform: uppercase; border-bottom: 1px solid var(--bd); }
    .gt-row { border-bottom: 1px solid rgba(255,255,255,.04); }
    .gt-row:last-child { border-bottom: 0; }
    .gt-c1, .gt-c2 { color: var(--mut); }
    .edge-row { display: flex; align-items: center; gap: 10px; padding: 4px 0; }
    .edge-name { font-size: 11px; font-weight: 700; width: 70px; }
    .edge-track { flex: 1; height: 6px; border-radius: 3px; background: #2c2c2c; overflow: hidden; }
    .edge-fill { height: 100%; border-radius: 3px; }
    .edge-fill.best { background: linear-gradient(90deg, #059669, var(--up)); }
    .edge-fill.mid { background: linear-gradient(90deg, #b45309, var(--amber)); }
    .edge-fill.worst { background: linear-gradient(90deg, #7f1d1d, var(--red)); }
    .mines-sim { display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px; margin-top: 8px; }
    .ms-tile { aspect-ratio: 1; border-radius: 7px; border: 1px solid var(--bd); background: var(--bg3); color: var(--mut); font-size: 12px; font-weight: 800; cursor: pointer; transition: transform .12s ease, background .12s ease, border-color .12s ease; }
    .ms-tile:hover { transform: scale(1.06); border-color: rgba(255,255,255,.2); }
    .ms-tile.open { cursor: default; transform: none; }
    .ms-tile.ok { background: rgba(52,211,153,.16); border-color: rgba(52,211,153,.4); color: var(--up); }
    .ms-tile.boom { background: rgba(239,68,68,.2); border-color: rgba(239,68,68,.5); color: var(--red-h); }
    .sim-info { font-size: 10.5px; color: var(--mut); }

    /* ── social (v1.1.0) ──────────────────────────────────── */
    .rank-chip { display: inline-flex; align-items: center; margin-left: 5px; padding: 0 5px; border-radius: 5px; font-size: 8.5px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; vertical-align: middle; }
    .rank-chip.tag-friend { background: rgba(52,211,153,.14); color: var(--up); border: 1px solid rgba(52,211,153,.35); }
    .rank-chip.tag-whale { background: rgba(251,191,36,.12); color: #fbbf24; border: 1px solid rgba(251,191,36,.35); }
    .rank-chip.tag-watch { background: rgba(96,165,250,.12); color: #60a5fa; border: 1px solid rgba(96,165,250,.35); }
    .rank-chip.tag-rival { background: rgba(239,68,68,.14); color: var(--red-h); border: 1px solid rgba(239,68,68,.4); }
    .at-menu { position: absolute; z-index: 50; min-width: 180px; max-height: 210px; overflow-y: auto; margin-top: 2px; background: var(--bg2); border: 1px solid var(--bd); border-radius: 10px; box-shadow: 0 12px 32px rgba(0,0,0,.5); padding: 4px; }
    .at-item { display: flex; align-items: center; gap: 7px; width: 100%; text-align: left; padding: 6px 8px; border-radius: 7px; border: 0; background: none; color: var(--tx); font: 600 12px inherit; cursor: pointer; }
    .at-item:hover, .at-item.on { background: rgba(239,68,68,.14); }
    .at-item svg { color: var(--red); }
    .composer, .msg-compose { position: relative; display: flex; gap: 6px; }
    .msg-compose { margin-bottom: 8px; }
    .msg-compose .input { flex: 1; min-width: 0; }
    .field { margin-bottom: 10px; }
    .field-label { display: block; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .09em; color: var(--mut); margin-bottom: 4px; }
    .btn.full { width: 100%; justify-content: center; }
    .select-sm { padding: 3px 6px; font-size: 11px; }
    .rank-add { display: flex; gap: 6px; margin: 8px 0; }
    .rank-add .input { flex: 1; min-width: 0; }
    .rank-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 10px; margin-top: 12px; }
    .rank-card { display: flex; align-items: center; gap: 10px; padding: 11px 12px; border: 1px solid var(--bd); border-radius: 12px; background: linear-gradient(180deg, var(--bg3), var(--bg2)); }
    .rank-card:hover { border-color: rgba(239,68,68,.4); }
    .rank-main { flex: 1; min-width: 0; }
    .rank-user { display: flex; align-items: center; font-weight: 700; font-size: 13px; }
    .rank-sub { font-size: 10px; color: var(--mut); margin-top: 1px; }
    .rank-actions { display: flex; gap: 4px; }
    .rank-actions .btn { padding: 4px 6px; }
    .mention-list { display: flex; flex-direction: column; gap: 2px; }
    .mention-row { display: flex; align-items: flex-start; gap: 9px; padding: 8px 4px; border-bottom: 1px solid rgba(255,255,255,.05); }
    .mention-row:last-child { border-bottom: 0; }
    .mention-row .avatar { flex: none; margin-top: 1px; }
    .mention-dot { width: 7px; height: 7px; border-radius: 50%; flex: none; margin-top: 6px; background: #3f3f46; }
    .mention-row.unread .mention-dot { background: var(--red); box-shadow: 0 0 8px rgba(239,68,68,.8); }
    .mention-row.unread .mention-title { color: var(--tx); }
    .mention-main { flex: 1; min-width: 0; }
    .mention-title { font-weight: 700; font-size: 12.5px; color: var(--mut); display: flex; align-items: center; flex-wrap: wrap; }
    .mention-msg { font-size: 12.5px; color: var(--tx); margin-top: 1px; word-break: break-word; }
    .mention-meta { font-size: 10px; color: var(--mut); margin-top: 2px; }

    /* ── misc ──────────────────────────────────────────────── */
    .btn-danger { background: rgba(239,68,68,.14); border-color: rgba(239,68,68,.45); color: var(--red-h); }
    .btn-danger:hover { background: var(--red); color: #fff; }
    .recent-unlock { margin-bottom: 10px; }

    /* ── v2.0: realtime engine + explorer + walls ─────────────────── */
    .ws-dot { display: inline-flex; align-items: center; gap: 4px; color: var(--dim); }
    .ws-dot.on { color: var(--up); }
    .ws-dot.on svg { filter: drop-shadow(0 0 5px rgba(52,211,153,.8)); }
    .ws-dot.off { color: var(--dim); }
    .route-count { font-size: 11px; color: var(--mut); margin-left: auto; }
    .route-list { display: flex; flex-direction: column; gap: 6px; margin-top: 10px; }
    .route-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; border: 1px solid var(--bd); background: var(--bg2); border-radius: 10px; padding: 8px 12px; }
    .route-row.open { border-color: rgba(239,68,68,.4); }
    .route-method { font-size: 9.5px; font-weight: 800; letter-spacing: .08em; padding: 2px 7px; border-radius: 5px; }
    .m-get { background: rgba(52,211,153,.13); color: #34d399; }
    .m-post { background: rgba(96,165,250,.13); color: #60a5fa; }
    .m-patch { background: rgba(251,191,36,.13); color: #fbbf24; }
    .route-path { font-size: 11.5px; color: var(--tx); flex: 1; min-width: 180px; }
    .route-desc { font-size: 11px; color: var(--mut); }
    .route-auth { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: #fbbf24; }
    .route-auth.pub { color: var(--up); }
    .route-expand { border: 1px solid var(--bd); background: transparent; color: var(--mut); border-radius: 6px; padding: 2px 9px; cursor: pointer; font-size: 11px; }
    .route-detail { flex-basis: 100%; display: none; flex-direction: column; gap: 8px; padding-top: 8px; }
    .route-detail.open { display: flex; }
    .route-in { flex: 1; min-width: 120px; }
    .route-actions { display: flex; gap: 8px; align-items: center; }
    .route-hint { font-size: 11px; color: var(--dim); font-style: italic; }
    .route-out { background: rgba(0,0,0,.35); border: 1px solid var(--bd); border-radius: 8px; padding: 10px 12px; font: 11px/1.5 ui-monospace, 'SF Mono', Consolas, monospace; color: #d4d4d8; white-space: pre-wrap; word-break: break-word; max-height: 240px; overflow: auto; margin: 0; }
    .modal-lg { width: min(620px, 94%) !important; }
    .composer-ta { width: 100%; min-height: 88px; background: rgba(0,0,0,.3); border: 1px solid var(--bd); border-radius: 10px; color: var(--tx); padding: 10px 12px; font: inherit; resize: vertical; outline: none; }
    .composer-ta:focus { border-color: rgba(239,68,68,.5); }
    .composer-err { font-size: 12px; color: var(--red-h); margin-top: 8px; min-height: 14px; }
    .ach-wall-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; margin-top: 10px; }
    .ach-wall-card { border: 1px solid var(--bd); background: var(--bg2); border-radius: 10px; padding: 10px 12px; }
    .ach-wall-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
    .ach-wall-ico { display: inline-flex; }
    .ach-wall-diff { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; }
    .ach-wall-name { font-weight: 700; font-size: 12.5px; color: var(--tx); }
    .ach-wall-desc { font-size: 11px; color: var(--mut); margin-top: 2px; line-height: 1.4; }
    .wall-sum { font-size: 11px; color: var(--mut); }
  `;

  // ════════════════════════════════════════════════════════════════════
  // Onsite HUD - enabled mods render on rugplay.com itself
  // ════════════════════════════════════════════════════════════════════

  // page-level styles (injected once into the site's <head>)
  const HUD_CSS = `
    .cc-hud { position: fixed; top: 70px; right: 16px; z-index: 2147482800; display: flex; flex-direction: column; gap: 8px; width: 236px; pointer-events: none; }
    .cc-hud > * { pointer-events: auto; }
    .cc-chip {
      background: rgba(21,21,21,.92); border: 1px solid rgba(255,255,255,.10); border-radius: 11px;
      padding: 8px 11px; color: #e4e4e7; font: 600 11.5px/1.45 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Inter, sans-serif;
      box-shadow: 0 10px 28px rgba(0,0,0,.4); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
    }
    .cc-chip-label { display: block; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .11em; color: #9ca3af; margin-bottom: 2px; }
    .cc-chip-body { color: #f4f4f5; font-weight: 600; word-break: break-word; }
    .cc-chip .mono { font-family: ui-monospace, 'SF Mono', Consolas, monospace; font-variant-numeric: tabular-nums; }
    .cc-chip .up { color: #34d399; } .cc-chip .down { color: #f87171; }
    .cc-chip.warn { border-color: rgba(239,68,68,.45); }
    .cc-alert-row { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-top: 6px; }
    .cc-abtn {
      border: 1px solid rgba(255,255,255,.14); background: rgba(255,255,255,.06); color: #e4e4e7;
      border-radius: 7px; padding: 3px 4px; font: 600 10px inherit; cursor: pointer;
    }
    .cc-abtn:hover { background: rgba(239,68,68,.25); border-color: rgba(239,68,68,.5); }
    .cc-holder { font-size: 11px; padding: 1px 0; display: flex; justify-content: space-between; gap: 8px; }
    .cc-holder .mono { color: #9ca3af; }
    .cc-treemap { margin-top: 6px; width: 100%; height: 170px; position: relative; border-radius: 8px; overflow: hidden; }
    .cc-treemap .cc-tcell { position: absolute; border: 1px solid rgba(0,0,0,.3); border-radius: 2px; color: #fff; font-size: 8.5px; font-weight: 700; text-shadow: 0 1px 2px rgba(0,0,0,.7); padding: 2px 3px; overflow: hidden; cursor: pointer; }
    .cc-hud-live {
      position: fixed; left: 16px; bottom: 16px; z-index: 2147482800; width: 300px; max-height: 190px;
      background: rgba(21,21,21,.92); border: 1px solid rgba(255,255,255,.10); border-radius: 11px;
      box-shadow: 0 10px 28px rgba(0,0,0,.4); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
      padding: 8px 11px; overflow: hidden; font: 600 11px/1.5 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Inter, sans-serif;
    }
    .cc-live-head { display: flex; align-items: center; justify-content: space-between; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .11em; color: #9ca3af; margin-bottom: 4px; }
    .cc-live-head .dot { width: 6px; height: 6px; border-radius: 50%; background: #34d399; box-shadow: 0 0 6px rgba(52,211,153,.8); display: inline-block; margin-right: 5px; }
    .cc-live-row { display: flex; gap: 8px; align-items: center; padding: 2px 0; border-bottom: 1px solid rgba(255,255,255,.05); font-size: 11px; }
    .cc-live-row:last-child { border-bottom: 0; }
    .cc-live-row .t { font-size: 9px; font-weight: 800; letter-spacing: .04em; padding: 1px 5px; border-radius: 4px; }
    .cc-live-row .t.buy { background: rgba(52,211,153,.14); color: #34d399; }
    .cc-live-row .t.sell { background: rgba(239,68,68,.16); color: #f87171; }
    .cc-live-row .s { flex: 1; color: #f4f4f5; }
    .cc-live-row .v { color: #d4d4d8; }
    .cc-tape { display: flex; flex-direction: column; gap: 2px; margin-top: 3px; }
    .cc-tape-row { display: flex; gap: 8px; align-items: center; font-size: 11px; padding: 1px 0; }
    .cc-tape-row .t { font-size: 9px; font-weight: 800; padding: 1px 5px; border-radius: 4px; }
    .cc-tape-row .t.buy { background: rgba(52,211,153,.14); color: #34d399; }
    .cc-tape-row .t.sell { background: rgba(239,68,68,.16); color: #f87171; }
    .cc-tape-row .u { flex: 1; color: #d4d4d8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .cc-tape-row .v { color: #f4f4f5; }
    .cc-comment { font-size: 11px; padding: 2px 0; border-bottom: 1px solid rgba(255,255,255,.05); }
    .cc-comment:last-child { border-bottom: 0; }
    .cc-comment .u { color: #f87171; font-weight: 700; margin-right: 6px; }
    .cc-comment .tx { color: #d4d4d8; }
    .cc-hopium-row { display: flex; gap: 8px; align-items: center; font-size: 11px; padding: 2px 0; }
    .cc-hopium-row .q { flex: 1; color: #d4d4d8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .cc-hopium-row .yes { color: #34d399; }
    .cc-leader-row { display: flex; gap: 8px; align-items: center; font-size: 11px; padding: 2px 0; }
    .cc-leader-row .rk { color: #9ca3af; width: 14px; text-align: right; }
    .cc-leader-row .u { flex: 1; color: #f4f4f5; }
    .cc-leader-row .v { color: #f87171; }
    .cc-uname-inp {
      width: 100%; box-sizing: border-box; margin-top: 4px; background: rgba(0,0,0,.35); color: #f4f4f5;
      border: 1px solid rgba(255,255,255,.14); border-radius: 7px; padding: 5px 8px; font: 600 11px inherit; outline: none;
    }
    .cc-uname-inp:focus { border-color: rgba(239,68,68,.5); }
    .cc-rank-tag { display: inline-flex; align-items: center; margin-left: 5px; padding: 0 5px; border-radius: 5px; font-size: 8.5px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; vertical-align: middle; }
    .cc-rank-tag.tag-friend { background: rgba(52,211,153,.16); color: #34d399; border: 1px solid rgba(52,211,153,.4); }
    .cc-rank-tag.tag-whale { background: rgba(251,191,36,.14); color: #fbbf24; border: 1px solid rgba(251,191,36,.4); }
    .cc-rank-tag.tag-watch { background: rgba(96,165,250,.14); color: #60a5fa; border: 1px solid rgba(96,165,250,.4); }
    .cc-rank-tag.tag-rival { background: rgba(239,68,68,.16); color: #f87171; border: 1px solid rgba(239,68,68,.45); }
    .cc-friendtags { font-size: 11px; }
    .cc-chip.live { border-color: rgba(52,211,153,.5); box-shadow: 0 0 16px rgba(52,211,153,.22), 0 10px 28px rgba(0,0,0,.4); }
    .cc-chip.live .cc-chip-label::before { content: ''; display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #34d399; box-shadow: 0 0 6px rgba(52,211,153,.9); margin-right: 5px; }
    @media (max-width: 720px) { .cc-hud { display: none; } .cc-hud-live { display: none; } }
  `;

  let hudRoot = null;
  let hudLive = null;
  const hudWidgets = new Map(); // mod -> { el, timer }

  function coinSymFromPath(p) {
    const m = p.match(/^\/coin\/([A-Za-z0-9]+)/);
    return m ? m[1].toUpperCase() : null;
  }

  function hudChip(label, body, warn) {
    const el = document.createElement('div');
    el.className = 'cc-chip' + (warn ? ' warn' : '');
    const l = document.createElement('span');
    l.className = 'cc-chip-label';
    l.textContent = label;
    el.appendChild(l);
    if (typeof body === 'string') {
      const b = document.createElement('span');
      b.className = 'cc-chip-body';
      b.textContent = body;
      el.appendChild(b);
    } else if (body) {
      el.appendChild(body);
    }
    return el;
  }

  function hudEnsure() {
    if (hudRoot && hudRoot.isConnected) return;
    if (!document.getElementById('cc-hud-style')) {
      const st = document.createElement('style');
      st.id = 'cc-hud-style';
      st.textContent = HUD_CSS;
      document.head.appendChild(st);
    }
    hudRoot = document.createElement('div');
    hudRoot.className = 'cc-hud';
    document.body.appendChild(hudRoot);
    hudLive = document.createElement('div');
    hudLive.className = 'cc-hud-live';
    document.body.appendChild(hudLive);
  }

  function hudRemove() {
    if (hudRoot) { hudRoot.remove(); hudRoot = null; }
    if (hudLive) { hudLive.remove(); hudLive = null; }
    hudWidgets.forEach((w) => { if (w.timer) clearInterval(w.timer); });
    hudWidgets.clear();
  }

  // ── coin page widgets ────────────────────────────────────────────────
  function coinData() {
    const sym = coinSymFromPath(location.pathname);
    return sym ? apiGet(`/api/coin/${sym}`, { ttl: 6000 }) : Promise.resolve(null);
  }

  function onsiteWidget(mod) {
    switch (mod) {
      case 'locktimer': {
        const body = document.createElement('span');
        body.className = 'cc-chip-body mono';
        const el = hudChip('Creator Lock', body);
        const update = () => {
          coinData().then((d) => {
            const c = d && d.coin;
            if (!c || !el.isConnected) return;
            const unlock = c.tradingUnlocksAt ? new Date(c.tradingUnlocksAt).getTime() : null;
            body.textContent = (!unlock || Date.now() >= unlock) ? (c.isLocked ? 'active' : 'open') : 'lock · ' + fmtDur(Math.max(0, (unlock - Date.now()) / 1000));
          }).catch(() => { /* keep last */ });
        };
        update();
        const t = setInterval(update, 1000);
        return { el, timer: t };
      }
      case 'coinage': {
        const b = document.createElement('span');
        b.className = 'cc-chip-body';
        const el = hudChip('Coin Age', b);
        coinData().then((d) => { const c = d && d.coin; if (c && c.createdAt) b.textContent = 'launched ' + timeAgo(new Date(c.createdAt).getTime()); }).catch(() => {});
        return { el };
      }
      case 'athmarker': {
        const sym = coinSymFromPath(location.pathname);
        const b = document.createElement('span');
        b.className = 'cc-chip-body mono';
        const el = hudChip('All-Time High', b);
        if (sym) {
          const before = Math.floor(Date.now() / 1000);
          apiGet(`/api/coin/${sym}/chart-history?timeframe=1d&before=${before}`, { ttl: 20000 }).then((d) => {
            const candles = asArray(d && d.candlestickData);
            if (candles.length) b.textContent = fmtPrice(Math.max(...candles.map((x) => num(x.high ?? x.h))));
          }).catch(() => {});
        }
        return { el };
      }
      case 'poolwatch': {
        const b = document.createElement('span');
        b.className = 'cc-chip-body mono';
        const el = hudChip('Liquidity Pool', b);
        coinData().then((d) => {
          const c = d && d.coin;
          if (c) b.textContent = `${fmtBuss(num(c.poolBaseCurrencyAmount))} · ${fmtShort(num(c.poolCoinAmount))} tok`;
        }).catch(() => {});
        return { el };
      }
      case 'devdom': {
        const sym = coinSymFromPath(location.pathname);
        const b = document.createElement('span');
        b.className = 'cc-chip-body';
        const el = hudChip('Dev Dominance', b);
        if (sym) {
          apiGet(`/api/coin/${sym}/holders?limit=3`, { ttl: 15000 }).then((d) => {
            const list = asArray(d && d.holders);
            const c = list[0];
            if (c) {
              const share = num(c.percentage, 0);
              b.textContent = `@${c.username || 'dev'} ${share.toFixed(1)}%`;
              if (share > 50) { b.textContent += ' - extreme rug risk'; el.classList.add('warn'); }
            } else b.textContent = 'no holders yet';
          }).catch(() => {});
        }
        return { el };
      }
      case 'pricealerts': {
        const sym = coinSymFromPath(location.pathname);
        const b = document.createElement('div');
        b.className = 'cc-chip-body';
        const el = hudChip('Price Alerts', b);
        if (sym) {
          coinData().then((d) => {
            const c = d && d.coin;
            if (!c) return;
            const price = num(c.currentPrice);
            const row = document.createElement('div');
            row.className = 'cc-alert-row';
            [[1, 10], [-1, 10], [1, 50], [-1, 50]].forEach(([dir, pct]) => {
              const btn = document.createElement('button');
              btn.className = 'cc-abtn';
              btn.textContent = `${dir > 0 ? '▲' : '▼'} ${pct}%`;
              btn.onclick = () => {
                addAlert({ id: Date.now() + Math.random(), symbol: sym, target: price * (1 + (dir * pct) / 100), dir, pct });
                toast('success', 'Alert set', `${sym} ${dir > 0 ? '+' : '−'}${pct}% ${dir > 0 ? 'above' : 'below'} ${fmtPrice(price)}`);
              };
              row.appendChild(btn);
            });
            b.appendChild(row);
          }).catch(() => {});
        }
        return { el };
      }
      case 'holderradar': {
        const sym = coinSymFromPath(location.pathname);
        const b = document.createElement('div');
        b.className = 'cc-chip-body';
        const el = hudChip('Top Holders', b);
        if (sym) {
          apiGet(`/api/coin/${sym}/holders?limit=3`, { ttl: 15000 }).then((d) => {
            const list = asArray(d && d.holders).slice(0, 3);
            b.innerHTML = '';
            if (!list.length) { b.textContent = 'no holders yet'; return; }
            list.forEach((c) => {
              const r = document.createElement('div');
              r.className = 'cc-holder';
              r.innerHTML = `<span>@${c.username || 'anon'}</span><span class="mono">${num(c.percentage, 0).toFixed(1)}%</span>`;
              b.appendChild(r);
            });
          }).catch(() => {});
        }
        return { el };
      }
      case 'livefeed': return onsiteLive();
      case 'seasoncard': return onsiteSeason();
      case 'treemap': return onsiteTreemap();
      case 'marketstats': return onsiteMarketStats();
      case 'movers': return onsiteMovers();
      case 'launchkit': return onsiteLaunch();
      case 'gemswallet': return onsiteAccount('gemswallet');
      case 'networth': return onsiteAccount('networth');
      case 'prestigestatus': return onsiteAccount('prestigestatus');
      case 'crateodds': return onsiteShop();
      case 'riskmeter': return onsiteArcade();
      case 'qdepth': return onsiteHopium('qdepth');
      case 'countdown': return onsiteHopium('countdown');
      case 'siteprice': return onsiteCoinStat('Price', 'mono', (c) => fmtPrice(num(c.currentPrice)));
      case 'sitechange': return onsiteCoinStat('24h Change', 'mono', (c) => `${c.change24h >= 0 ? '▲' : '▼'} ${fmtPct(num(c.change24h))}`, (c) => c.change24h < 0);
      case 'sitemcap': return onsiteCoinStat('Market Cap', 'mono', (c) => fmtBuss(num(c.marketCap)));
      case 'sitevol': return onsiteCoinStat('Volume 24h', 'mono', (c) => fmtBuss(num(c.volume24h)));
      case 'sitefeed': return onsiteTape();
      case 'sitecomments': return onsiteComments();
      case 'sitehopium': return onsiteHopiumList();
      case 'siteleader': return onsiteLeaderList();
      case 'siteach': return onsiteAccount('siteach');
      case 'siterewards': return onsiteAccount('siterewards');
      case 'sitekeys': return onsiteAccount('sitekeys');
      case 'sitearcade': return onsiteArcadeStats();
      case 'sitetransfers': return onsiteTransfers();
      case 'siteseasonjoin': return onsiteSeasonJoin();
      case 'siteusername': return onsiteUsername();
      case 'mentionradar': return onsiteMentionRadar();
      case 'friendtags': return onsiteFriendTags();
      case 'quicktransfer': return onsiteQuickTransfer();
      case 'siteliveprice': return onsiteLivePrice();
      case 'sitelivearcade': return onsiteLiveArcade();
      case 'sitelargetrades': return onsiteLargeTrades();
      default: return null;
    }
  }

  // ── live socket widgets (v2.0) ──────────────────────────────────────
  function onsiteLivePrice() {
    const sym = coinSymFromPath(location.pathname);
    const b = document.createElement('span');
    b.className = 'cc-chip-body mono';
    const el = hudChip('Live Price', b);
    const off = bus.on('ws:price_update', (m) => {
      if (!m || m.coinSymbol !== sym || !el.isConnected) return;
      if (m.currentPrice !== undefined) {
        b.textContent = fmtPrice(num(m.currentPrice)) + (m.change24h !== undefined ? ' - ' + fmtPct(num(m.change24h)) : '');
        el.classList.add('live');
      }
    });
    coinData().then((d) => {
      const c = d && d.coin;
      if (c && c.currentPrice !== undefined) b.textContent = fmtPrice(num(c.currentPrice));
    }).catch(() => {});
    return { el, cleanup: off };
  }

  function onsiteLiveArcade() {
    const b = document.createElement('span');
    b.className = 'cc-chip-body';
    const el = hudChip('Live Arcade', b);
    const off = bus.on('ws:arcade_activity', (m) => {
      const a = m && m.arcadeActivity;
      if (!a || !el.isConnected) return;
      b.textContent = (a.username || '?') + ' - ' + (a.game || '?') + ' ' + (a.won ? 'won' : 'lost') + ' ' + fmtBuss(num(a.amount, 0));
      el.classList.add('live');
    });
    return { el, cleanup: off };
  }

  function onsiteLargeTrades() {
    const b = document.createElement('span');
    b.className = 'cc-chip-body mono';
    const el = hudChip('Large Trades', b);
    const pick = (m) => {
      const t = m && m.data;
      if (!t || !el.isConnected) return;
      const v = num(t.totalValue ?? t.totalBaseCurrencyAmount ?? t.amount, 0);
      if (v < 100000) return;
      b.textContent = (t.coinSymbol || t.symbol || '?') + ' ' + (t.type || '').toUpperCase() + ' ' + fmtBuss(v) + ' by @' + (t.username || '?');
      el.classList.add('live');
    };
    const offs = [
      bus.on('ws:live-trade', pick),
      bus.on('ws:all-trades', pick),
    ];
    return { el, cleanup: () => offs.forEach((fn) => fn()) };
  }

  // ── new site widgets (v1.0.0 · 200 mods) ────────────────────────────
  function onsiteCoinStat(label, cls, fmt, warn) {
    const b = document.createElement('span');
    b.className = `cc-chip-body ${cls || ''}`;
    const el = hudChip(label, b);
    coinData().then((d) => {
      const c = d && d.coin;
      if (!c) return;
      b.textContent = fmt(c);
      if (warn && warn(c)) el.classList.add('warn');
    }).catch(() => {});
    return { el };
  }

  function onsiteTape() {
    const sym = coinSymFromPath(location.pathname);
    const rows = document.createElement('div');
    rows.className = 'cc-tape';
    const el = hudChip('Trade Tape', rows);
    if (!sym) return { el };
    const load = () => {
      apiGet('/api/trades/recent?limit=24', { ttl: 5000 }).then((d) => {
        const list = asArray(d && d.trades).filter((t) => String(t.coinSymbol || '').toUpperCase() === sym).slice(0, 8);
        rows.innerHTML = '';
        if (!list.length) { rows.textContent = 'no recent trades'; return; }
        list.forEach((t) => {
          const type = String(t.type || 'BUY').toUpperCase();
          const r = document.createElement('div');
          r.className = 'cc-tape-row';
          r.innerHTML = `<span class="t ${type === 'SELL' ? 'sell' : 'buy'}">${type}</span><span class="u">@${t.username || '?'}</span><span class="mono v">${fmtBuss(num(t.totalValue))}</span>`;
          rows.appendChild(r);
        });
      }).catch(() => {});
    };
    load();
    const t = setInterval(load, 8000);
    return { el, timer: t };
  }

  function onsiteComments() {
    const sym = coinSymFromPath(location.pathname);
    const rows = document.createElement('div');
    const el = hudChip('Latest Comments', rows);
    if (!sym) return { el };
    apiGet(`/api/coin/${sym}/comments`, { ttl: 12000 }).then((d) => {
      const list = asArray(d && d.comments).slice(0, 4);
      if (!list.length) { rows.textContent = 'no comments yet'; return; }
      list.forEach((c) => {
        const r = document.createElement('div');
        r.className = 'cc-comment';
        r.innerHTML = `<span class="u">@${c.username || '?'}</span><span class="tx">${(c.content || '').slice(0, 64)}</span>`;
        rows.appendChild(r);
      });
    }).catch(() => { rows.textContent = '-'; });
    return { el };
  }

  function onsiteHopiumList() {
    const rows = document.createElement('div');
    const el = hudChip('Active Markets', rows);
    apiGet('/api/hopium/questions', { ttl: 15000 }).then((d) => {
      const list = asArray(d && d.questions).filter((q) => q.status === 'ACTIVE').slice(0, 3);
      if (!list.length) { rows.textContent = 'no active markets'; return; }
      list.forEach((q) => {
        const yes = num(q.totalYesAmount), no = num(q.totalNoAmount);
        const pct = yes + no > 0 ? Math.round((yes / (yes + no)) * 100) : 50;
        const r = document.createElement('div');
        r.className = 'cc-hopium-row';
        r.innerHTML = `<span class="q">${(q.question || '').slice(0, 44)}</span><span class="mono yes">${pct}%</span>`;
        rows.appendChild(r);
      });
    }).catch(() => { rows.textContent = '-'; });
    return { el };
  }

  function onsiteLeaderList() {
    const rows = document.createElement('div');
    const el = hudChip('Rugpullers 24h', rows);
    apiGet('/api/leaderboard', { ttl: 30000 }).then((d) => {
      const list = asArray(d && d.topRugpullers).slice(0, 4);
      if (!list.length) { rows.textContent = 'no data'; return; }
      list.forEach((x, i) => {
        const r = document.createElement('div');
        r.className = 'cc-leader-row';
        r.innerHTML = `<span class="rk">${i + 1}</span><span class="u">@${x.username || '?'}</span><span class="mono v">${fmtBuss(num(x.totalSold))}</span>`;
        rows.appendChild(r);
      });
    }).catch(() => { rows.textContent = '-'; });
    return { el };
  }

  function onsiteArcadeStats() {
    const b = document.createElement('span');
    b.className = 'cc-chip-body mono';
    const el = hudChip('Arcade Record', b);
    apiGet('/api/user/arcade-stats', { ttl: 30000 }).then((d) => {
      const wins = num(d && d.wins), losses = num(d && d.losses);
      b.textContent = `${wins}W · ${losses}L`;
      if (wins + losses > 0 && wins / (wins + losses) < 0.4) el.classList.add('warn');
    }).catch(() => {});
    return { el };
  }

  function onsiteTransfers() {
    const rows = document.createElement('div');
    const el = hudChip('Recent Transfers', rows);
    apiGet('/api/transactions?type=TRANSFER_OUT', { ttl: 30000 }).then((d) => {
      const list = asArray(d && d.transactions).slice(0, 4);
      if (!list.length) { rows.textContent = 'no transfers'; return; }
      list.forEach((t) => {
        const r = document.createElement('div');
        r.className = 'cc-tape-row';
        const u = t.otherUser && t.otherUser.username;
        r.innerHTML = `<span class="t sell">OUT</span><span class="u">@${u || '?'}</span><span class="mono v">${fmtBuss(num(t.totalBaseCurrencyAmount))}</span>`;
        rows.appendChild(r);
      });
    }).catch(() => { rows.textContent = '-'; });
    return { el };
  }

  function onsiteSeasonJoin() {
    const b = document.createElement('span');
    b.className = 'cc-chip-body';
    const el = hudChip('Season', b);
    apiGet('/api/season', { ttl: 20000 }).then((d) => {
      const s = d && d.season;
      const me = d && d.me;
      if (!s) { b.textContent = 'no active season'; return; }
      if (me && me.joined) { b.textContent = `${s.name} · entered (rank ${me.rank || '-'})`; return; }
      const stake = fmtBuss(num(d && d.rankedStake, num(s.rankedStake)));
      const btn = document.createElement('button');
      btn.className = 'cc-abtn';
      btn.textContent = `Join for ${stake}`;
      btn.onclick = () => {
        if (!window.confirm(`Enter ${s.name} for ${stake}? Holdings are liquidated.`)) return;
        btn.disabled = true;
        btn.textContent = 'Entering…';
        apiPost('/api/season/join', {}).then((r) => {
          b.textContent = `${s.name} · entered`;
          toast('success', 'Season entered', s.name);
        }).catch((e) => { btn.disabled = false; btn.textContent = `Join for ${stake}`; toast('error', 'Season join failed', e.message); });
      };
      b.appendChild(btn);
    }).catch(() => { b.textContent = '-'; });
    return { el };
  }

  function onsiteUsername() {
    const wrap = document.createElement('div');
    wrap.className = 'cc-chip-body';
    const el = hudChip('Username Check', wrap);
    const inp = document.createElement('input');
    inp.className = 'cc-uname-inp';
    inp.placeholder = 'check availability…';
    const out = document.createElement('span');
    out.className = 'mono';
    inp.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Enter' || !inp.value.trim()) return;
      apiGet(`/api/settings/check-username?username=${encodeURIComponent(inp.value.trim())}`, { ttl: 0 })
        .then((d) => { out.textContent = d && d.available ? '✓ available' : `✗ ${(d && d.reason) || 'taken'}`; })
        .catch(() => { out.textContent = '-'; });
    });
    wrap.appendChild(inp);
    wrap.appendChild(out);
    return { el };
  }

  // v1.1.0 social widgets
  function onsiteMentionRadar() {
    const b = document.createElement('span');
    b.className = 'cc-chip-body mono';
    const el = hudChip('Mentions', b);
    let lastCount = -1;
    const load = () => {
      apiGet('/api/notifications', { ttl: 15000 }).then((d) => {
        const list = asArray(d && d.notifications).filter((n) => n.type === 'MENTION');
        const unread = list.filter((n) => !n.isRead).length;
        if (!el.isConnected) return;
        b.textContent = unread ? `${unread} unread` : 'all clear';
        el.classList.toggle('warn', unread > 0);
        if (lastCount >= 0 && unread > lastCount && isMod('mentionping')) {
          const fresh = list[0];
          toast('info', 'New mention', fresh && fresh.title ? fresh.title : 'Someone mentioned you');
        }
        lastCount = unread;
      }).catch(() => { b.textContent = '-'; });
    };
    load();
    const t = setInterval(load, 20000);
    return { el, timer: t };
  }

  function onsiteFriendTags() {
    const wrap = document.createElement('div');
    wrap.className = 'cc-friendtags';
    const el = hudChip('Friend Tags', wrap);
    const friends = getFriends();
    const known = new Map(friends.map((f) => [f.username.toLowerCase(), f.tag]));
    if (!friends.length) { wrap.textContent = 'no ranks yet'; return { el }; }
    let tagged = 0;
    // tag usernames in the native comment section and anywhere else on the page
    document.querySelectorAll('a[href*="/user/"], [data-username]').forEach((a) => {
      const name = (a.getAttribute('data-username') || (a.textContent || '').trim()).replace(/^@/, '');
      const tag = known.get(String(name).toLowerCase());
      if (!tag) return;
      if (a.querySelector('.cc-rank-tag')) return;
      const chip = document.createElement('span');
      chip.className = 'cc-rank-tag tag-' + tag.toLowerCase();
      chip.textContent = tag;
      a.appendChild(chip);
      tagged++;
    });
    if (!tagged) wrap.textContent = friends.length + ' ranked · none on this page';
    else wrap.textContent = tagged + ' tagged on this page';
    const t = setInterval(() => {
      document.querySelectorAll('a[href*="/user/"], [data-username]').forEach((a) => {
        const name = (a.getAttribute('data-username') || (a.textContent || '').trim()).replace(/^@/, '');
        const tag = known.get(String(name).toLowerCase());
        if (!tag || a.querySelector('.cc-rank-tag')) return;
        const chip = document.createElement('span');
        chip.className = 'cc-rank-tag tag-' + tag.toLowerCase();
        chip.textContent = tag;
        a.appendChild(chip);
      });
    }, 3000);
    return { el, timer: t };
  }

  function onsiteQuickTransfer() {
    const m = location.pathname.match(/^\/user\/([^/]+)/);
    const b = document.createElement('div');
    b.className = 'cc-chip-body';
    const el = hudChip('Quick Transfer', b);
    if (m) {
      const btn = document.createElement('button');
      btn.className = 'cc-abtn';
      btn.textContent = 'Send BUSS to @' + m[1];
      btn.onclick = () => transferModal(m[1]);
      b.appendChild(btn);
    } else {
      b.textContent = '-';
    }
    return { el };
  }

  // global + page widgets
  function onsiteLive() {
    const b = document.createElement('div');
    b.className = 'cc-live-head';
    b.innerHTML = '<span><span class="dot"></span>Live Trades</span><span class="mono" style="font-size:9px">candle</span>';
    const rows = document.createElement('div');
    const el = document.createElement('div');
    el.appendChild(b);
    el.appendChild(rows);
    const load = () => {
      apiGet('/api/trades/recent?limit=6', { ttl: Math.max(4, num(settings.tickerSeconds, 8)) * 1000 })
        .then((d) => {
          const list = asArray(d && d.trades);
          rows.innerHTML = '';
          list.forEach((t) => {
            const type = String(t.type || '').toUpperCase();
            const r = document.createElement('div');
            r.className = 'cc-live-row';
            const side = type === 'SELL' ? 'sell' : 'buy';
            r.innerHTML = `<span class="t ${side}">${type || 'BUY'}</span><span class="s">${t.coinSymbol || ''}</span><span class="v mono">${fmtBuss(num(t.totalValue))}</span>`;
            rows.appendChild(r);
          });
        })
        .catch(() => {});
    };
    load();
    const t = setInterval(load, Math.max(4, num(settings.tickerSeconds, 8)) * 1000);
    return { el, timer: t, live: true };
  }

  function onsiteSeason() {
    const b = document.createElement('span');
    b.className = 'cc-chip-body';
    const el = hudChip('Season', b);
    apiGet('/api/season', { ttl: 30000 }).then((d) => {
      const s = d && d.season;
      if (!s) { b.textContent = 'no active season'; return; }
      const end = s.endsAt ? new Date(s.endsAt).getTime() : 0;
      b.textContent = `${s.name || 'Season'} · ${end ? fmtDur((end - Date.now()) / 1000) + ' left' : ''} · ${num(s.entrants, 0).toLocaleString()} in`;
    }).catch(() => {});
    return { el };
  }

  function onsiteTreemap() {
    const body = document.createElement('div');
    const el = hudChip('Market Treemap', body);
    const box = document.createElement('div');
    box.className = 'cc-treemap';
    body.appendChild(box);
    apiGet('/api/market?sortBy=marketCap&sortOrder=desc&limit=100', { ttl: 20000 }).then((d) => {
      const coins = asArray(d && d.coins);
      if (!coins.length) return;
      const cells = treemapLayout(coins.map((c) => ({ symbol: c.symbol, value: Math.max(num(c.marketCap), 1), change: num(c.change24h) })), box.clientWidth || 214, 170);
      cells.forEach((cl) => {
        const ch = cl.item.change;
        let bg = 'rgba(107,114,128,.4)';
        if (Math.abs(ch) >= 0.5) {
          const i = 0.4 + Math.min(Math.abs(ch) / 100, 1) * 0.6;
          bg = ch >= 0 ? `rgba(16,185,129,${i.toFixed(3)})` : `rgba(239,68,68,${i.toFixed(3)})`;
        }
        const cell = document.createElement('div');
        cell.className = 'cc-tcell';
        cell.style.cssText = `left:${cl.x.toFixed(1)}px;top:${cl.y.toFixed(1)}px;width:${cl.w.toFixed(1)}px;height:${cl.h.toFixed(1)}px;background:${bg}`;
        cell.textContent = cl.item.symbol;
        cell.title = `${cl.item.symbol} · ${fmtPct(ch)}`;
        box.appendChild(cell);
      });
    }).catch(() => {});
    return { el };
  }

  function onsiteMarketStats() {
    const b = document.createElement('span');
    b.className = 'cc-chip-body';
    const el = hudChip('Market', b);
    Promise.all([
      apiGet('/api/market?sortBy=change24h&sortOrder=desc&limit=100', { ttl: 60000 }),
      apiGet('/api/market?sortBy=change24h&sortOrder=asc&limit=100', { ttl: 60000 }),
    ]).then(([g, l]) => {
      const gs = asArray(g && g.coins).filter((c) => num(c.change24h) > 0);
      const ls = asArray(l && l.coins).filter((c) => num(c.change24h) < 0);
      const parts = [`${num(g && g.total, 0).toLocaleString()} listed`];
      if (gs[0]) parts.push(`hot ${gs[0].symbol} <span class="up">${fmtPct(num(gs[0].change24h))}</span>`);
      if (ls[0]) parts.push(`cold ${ls[0].symbol} <span class="down">${fmtPct(num(ls[0].change24h))}</span>`);
      b.innerHTML = parts.join(' · ');
    }).catch(() => {});
    return { el };
  }

  function onsiteMovers() {
    const b = document.createElement('span');
    b.className = 'cc-chip-body';
    const el = hudChip('Movers', b);
    Promise.all([
      apiGet('/api/market?sortBy=change24h&sortOrder=desc&limit=1', { ttl: 60000 }),
      apiGet('/api/market?sortBy=change24h&sortOrder=asc&limit=1', { ttl: 60000 }),
    ]).then(([g, l]) => {
      const gs = asArray(g && g.coins)[0];
      const ls = asArray(l && l.coins)[0];
      if (gs) b.innerHTML = `top <span class="up">${gs.symbol} ${fmtPct(num(gs.change24h))}</span>`;
      if (ls) b.innerHTML += ` · bottom <span class="down">${ls.symbol} ${fmtPct(num(ls.change24h))}</span>`;
    }).catch(() => {});
    return { el };
  }

  function onsiteLaunch() {
    const body = document.createElement('span');
    body.className = 'cc-chip-body mono';
    body.textContent = '$1,100 · $100 fee + $1,000 pool';
    return { el: hudChip('Launch Cost', body) };
  }

  function onsiteAccount(which) {
    const b = document.createElement('span');
    b.className = 'cc-chip-body mono';
    const LABELS = { gemswallet: 'Gems', networth: 'Net Worth', prestigestatus: 'Prestige', siteach: 'Achievements', siterewards: 'Claim', sitekeys: 'API Key' };
    const el = hudChip(LABELS[which] || 'Status', b);
    const p = which === 'gemswallet'
      ? apiGet('/api/shop/inventory', { ttl: 20000 }).then((d) => (d ? `${num(d.gems, 0).toLocaleString()} 💎` : null))
      : which === 'networth'
        ? apiGet('/api/portfolio/total', { ttl: 10000 }).then((d) => (d ? fmtBuss(num(d.totalValue)) : null))
        : which === 'prestigestatus'
          ? apiGet('/api/prestige', { ttl: 20000 }).then((d) => {
              const p2 = d && d.profile;
              if (!p2) return null;
              const lvl = num(p2.prestigeLevel, 0);
              const cost = PRESTIGE_COSTS[lvl + 1];
              return `${lvl > 0 ? PRESTIGE_NAMES[lvl] || ('Prestige ' + lvl) : 'Level 0'}${cost ? ' · next $' + fmtShort(cost) : ''}`;
            })
          : which === 'siteach'
            ? apiGet('/api/achievements', { ttl: 20000 }).then((d) => (d ? `${num(d.unlockedCount, 0)}/${num(d.totalCount, 0) || asArray(d.achievements).length} unlocked` : null))
            : which === 'siterewards'
              ? apiGet('/api/rewards/claim', { ttl: 20000 }).then((d) => (d && d.canClaim !== undefined ? (d.canClaim ? 'ready to claim' : `streak ${num(d.loginStreak, 0)}d`) : null))
              : apiGet('/api/keys', { ttl: 20000 }).then((d) => {
                  const k = asArray(d)[0];
                  return k ? `${num(k.remaining, 0).toLocaleString()} requests left` : 'no key created';
                });
    p.then((v) => { if (v !== null) b.textContent = v; }).catch(() => {});
    return { el };
  }

  function onsiteShop() {
    const b = document.createElement('span');
    b.className = 'cc-chip-body mono';
    const el = hudChip('Crate EV', b);
    let best = null;
    CRATE_TIERS.forEach((tier) => {
      const total = tier.rewards.reduce((s, r) => s + r.weight, 0);
      let ev = 0;
      tier.rewards.forEach((r) => { const p = r.weight / total; if (r.type === 'buss') ev += p * ((r.min + r.max) / 2); else ev += p * r.min; });
      const roi = ev / tier.cost;
      if (!best || roi > best.roi) best = { label: tier.label, ev, cost: tier.cost, roi };
    });
    if (best) b.textContent = `${best.label}: $${fmtShort(best.ev)} EV for ${best.cost}💎`;
    return { el };
  }

  function onsiteArcade() {
    const body = document.createElement('span');
    body.className = 'cc-chip-body mono';
    body.textContent = 'dice −50% · coinflip 0% · slots −2.8% · mines −5% · tower −5%';
    return { el: hudChip('House Edge', body) };
  }

  function onsiteHopium(which) {
    const b = document.createElement('span');
    b.className = 'cc-chip-body mono';
    const label = which === 'qdepth' ? 'Hopium Depth' : 'Resolves In';
    const el = hudChip(label, b);
    apiGet('/api/hopium/questions?status=ACTIVE&limit=100', { ttl: 20000 }).then((d) => {
      const qs = asArray(d && d.questions);
      if (which === 'qdepth') {
        const staked = qs.reduce((s, q) => s + num(q.totalYesAmount ?? q.totalYes, 0) + num(q.totalNoAmount ?? q.totalNo, 0), 0);
        b.textContent = `${fmtBuss(staked)} across ${qs.length} active`;
      } else {
        let soon = null;
        qs.forEach((q) => {
          const end = q.resolutionDate ? new Date(q.resolutionDate).getTime() : null;
          if (end && end > Date.now() && (!soon || end < soon)) soon = end;
        });
        b.textContent = soon ? fmtDur((soon - Date.now()) / 1000) : '-';
      }
    }).catch(() => {});
    return { el };
  }

  // ── mount/unmount ────────────────────────────────────────────────────
  const ONSITE_MODS = ['locktimer', 'coinage', 'athmarker', 'poolwatch', 'devdom', 'pricealerts', 'holderradar', 'livefeed', 'seasoncard', 'treemap', 'marketstats', 'movers', 'launchkit', 'gemswallet', 'networth', 'prestigestatus', 'crateodds', 'riskmeter', 'qdepth', 'countdown', 'siteprice', 'sitechange', 'sitemcap', 'sitevol', 'sitefeed', 'sitecomments', 'sitehopium', 'siteleader', 'siteach', 'siterewards', 'sitekeys', 'sitearcade', 'sitetransfers', 'siteseasonjoin', 'siteusername', 'mentionradar', 'friendtags', 'quicktransfer', 'siteliveprice', 'sitelivearcade', 'sitelargetrades'];

  function isOnsiteMod(id) {
    return ONSITE_MODS.includes(id);
  }

  function syncOnsite() {
    const wanted = ONSITE_MODS.filter((m) => isMod(m) && matchesOnsitePath(m));
    if (!wanted.length) { hudRemove(); return; }
    hudEnsure();
    const wantedSet = new Set(wanted);
    hudWidgets.forEach((w, mod) => {
      if (!wantedSet.has(mod)) {
        if (w.timer) clearInterval(w.timer);
        if (w.cleanup) w.cleanup();
        w.el.remove();
        hudWidgets.delete(mod);
      }
    });
    wanted.forEach((mod) => {
      if (hudWidgets.has(mod)) return;
      const w = onsiteWidget(mod);
      if (!w) return;
      hudWidgets.set(mod, w);
      if (w.live) hudLive.appendChild(w.el);
      else hudRoot.appendChild(w.el);
    });
  }

  function matchesOnsitePath(mod) {
    const p = location.pathname;
    if (['locktimer', 'coinage', 'athmarker', 'poolwatch', 'devdom', 'pricealerts', 'holderradar', 'siteprice', 'sitechange', 'sitemcap', 'sitevol', 'sitefeed', 'sitecomments'].includes(mod)) return /^\/coin\//.test(p);
    if (mod === 'treemap' || mod === 'marketstats' || mod === 'movers') return /^\/market/.test(p);
    if (mod === 'launchkit') return /^\/coin\/create/.test(p);
    if (mod === 'gemswallet' || mod === 'networth' || mod === 'sitetransfers') return /^\/portfolio/.test(p) || /^\/user\//.test(p);
    if (mod === 'prestigestatus') return /^\/(portfolio|user|prestige)/.test(p);
    if (mod === 'crateodds') return /^\/shop/.test(p);
    if (mod === 'riskmeter' || mod === 'sitearcade') return /^\/arcade/.test(p);
    if (mod === 'qdepth' || mod === 'countdown' || mod === 'sitehopium') return /^\/hopium/.test(p);
    if (mod === 'siteleader') return /^\/leaderboard/.test(p);
    if (mod === 'siteseasonjoin') return /^\/season/.test(p);
    if (mod === 'siteusername') return /^\/settings/.test(p);
    if (mod === 'siteach' || mod === 'siterewards' || mod === 'sitekeys') return true;
    if (mod === 'mentionradar') return true;
    if (mod === 'friendtags') return /^\/coin\//.test(p);
    if (mod === 'quicktransfer') return /^\/user\//.test(p) && !/^\/user\/(me|settings)/.test(p);
    if (mod === 'livefeed' || mod === 'seasoncard') return true;
    if (mod === 'siteliveprice') return /^\/coin\//.test(p);
    if (mod === 'sitelivearcade') return /^\/arcade/.test(p);
    if (mod === 'sitelargetrades') return true;
    return false;
  }

  // ════════════════════════════════════════════════════════════════════
  // Social - friends & ranks, mentions, messages
  // ════════════════════════════════════════════════════════════════════

  function transferModal(username, presym) {
    const wrap = h('div', { class: 'modal-back' },
      h('div', { class: 'modal' },
        h('div', { class: 'modal-head' },
          h('span', { class: 'modal-title' }, 'Send'),
          h('button', { class: 'traffic-mini', onclick: () => wrap.remove() }, icon('x', 13)),
        ),
        h('div', { class: 'modal-body' }),
      ),
    );
    wrap.addEventListener('click', (ev) => { if (ev.target === wrap) wrap.remove(); });
    $('.candle-window', shadow).appendChild(wrap);

    let type = 'CASH';
    let price = 0;
    const body = $('.modal-body', wrap);

    const typeRow = h('div', { class: 'chip-row' },
      ['CASH', 'COIN'].map((t) => h('button', {
        class: `chip ${t === type ? 'on' : ''}`,
        onclick: (ev) => {
          type = t;
          typeRow.querySelectorAll('.chip').forEach((x) => x.classList.toggle('on', x === ev.currentTarget));
          render();
        },
      }, t === 'CASH' ? 'Cash · BUSS' : 'Coin · tokens')),
    );

    const toIn = h('input', { class: 'input', value: username || '', readonly: !!username, placeholder: 'username' });
    const amtIn = h('input', { class: 'input', type: 'number', min: '0', step: 'any', placeholder: '0' });
    const symWrap = h('div', { class: 'field' });
    const symIn = h('input', { class: 'input', value: presym || '', placeholder: 'Coin symbol (e.g. MOONCAT)' });
    const priceLine = h('div', { class: 'card-hint' });
    const goBtn = h('button', { class: 'btn btn-primary full', onclick: async (ev) => {
      const to = (toIn.value || '').trim();
      const amt = num(parseFloat(amtIn.value), 0);
      const btn = ev.currentTarget;
      if (type === 'CASH') {
        if (!to || amt < 10) { toast('error', 'Invalid transfer', 'Username required, min $10 cash'); return; }
        btn.disabled = true;
        try {
          await apiPost('/api/transfer', { recipientUsername: to, type: 'CASH', amount: amt, coinSymbol: null });
          toast('success', 'Transfer sent', `$${amt.toFixed(2)} to @${to}`, 3400);
          wrap.remove();
          bus.emit('portfolio');
        } catch (e) { toast('error', 'Transfer failed', e.message); btn.disabled = false; }
        return;
      }
      // COIN - amount is in tokens, min estimated value $10, no fee
      const sym = (symIn.value || '').trim().toUpperCase();
      if (!to || !sym || amt <= 0) { toast('error', 'Invalid transfer', 'Username, coin and amount required'); return; }
      if (price > 0 && amt * price < 10) { toast('error', 'Too small', `That bag is worth ~$${(amt * price).toFixed(2)} - needs $10 minimum`); return; }
      btn.disabled = true;
      try {
        const res = await apiPost('/api/transfer', { recipientUsername: to, type: 'COIN', amount: amt, coinSymbol: sym });
        toast('success', 'Coins sent', `${amt.toLocaleString()} ${sym} to @${to}`, 3400);
        wrap.remove();
        bus.emit('portfolio');
      } catch (e) { toast('error', 'Transfer failed', e.message); btn.disabled = false; }
    } }, icon('send', 13), ' Send');

    symIn.addEventListener('input', () => {
      const sym = (symIn.value || '').trim().toUpperCase();
      if (!sym) { price = 0; priceLine.textContent = 'Enter a coin to see its price'; return; }
      apiGet(`/api/coin/${sym}`, { ttl: 6000 })
        .then((d) => {
          const c = d && d.coin;
          if (!c) { price = 0; priceLine.textContent = `${sym} not found`; return; }
          price = num(c.currentPrice);
          const amt = num(parseFloat(amtIn.value), 0);
          priceLine.textContent = `${sym} = ${fmtPrice(price)} · ${amt > 0 ? 'bag worth ~' + fmtBuss(amt * price) + ' · ' : ''}min bag $10 worth`;
        })
        .catch(() => { price = 0; priceLine.textContent = 'Could not fetch price'; });
    });
    amtIn.addEventListener('input', () => {
      if (type !== 'COIN' || !price) return;
      const amt = num(parseFloat(amtIn.value), 0);
      priceLine.textContent = `${symIn.value.trim().toUpperCase() || 'COIN'} = ${fmtPrice(price)} · ${amt > 0 ? 'bag worth ~' + fmtBuss(amt * price) + ' · ' : ''}min bag $10 worth`;
    });

    function render() {
      body.innerHTML = '';
      body.appendChild(typeRow);
      body.appendChild(h('div', { class: 'field' }, h('label', { class: 'field-label' }, 'Recipient'), toIn));
      if (type === 'COIN') {
        symWrap.innerHTML = '';
        symWrap.appendChild(h('label', { class: 'field-label' }, 'Coin'));
        symWrap.appendChild(symIn);
        body.appendChild(symWrap);
        body.appendChild(h('div', { class: 'field' }, h('label', { class: 'field-label' }, 'Amount · tokens'), amtIn));
        body.appendChild(priceLine);
        body.appendChild(h('div', { class: 'card-hint' }, 'Hidden route: the site UI only exposes cash. Coin transfers carry no fee, need ~$10+ in value, and are blocked if the recipient is in an active season.'));
      } else {
        amtIn.placeholder = '0.00';
        body.appendChild(h('div', { class: 'field' }, h('label', { class: 'field-label' }, 'Amount · min $10'), amtIn));
        body.appendChild(h('div', { class: 'card-hint' }, '1% transfer fee · lands instantly · the real /api/transfer endpoint.'));
      }
      body.appendChild(goBtn);
      if (type === 'COIN') symIn.dispatchEvent(new Event('input', { bubbles: true }));
    }
    render();
  }

  // @mention autocomplete - suggests real usernames, inserts the token
  function attachMentionAutocomplete(inputEl, suggestFn) {
    let menu = null;
    let items = [];
    let active = -1;
    const close = () => { if (menu) { menu.remove(); menu = null; items = []; active = -1; } };
    const apply = (u) => {
      const val = inputEl.value;
      const at = val.lastIndexOf('@');
      inputEl.value = (at >= 0 ? val.slice(0, at) : val) + '@' + u + ' ';
      close();
      inputEl.focus();
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    };
    inputEl.addEventListener('input', () => {
      const val = inputEl.value;
      const at = val.lastIndexOf('@');
      if (at < 0 || at === val.length - 1) { close(); return; }
      const q = val.slice(at + 1).toLowerCase();
      if (/\s/.test(q)) { close(); return; }
      const found = (suggestFn() || []).filter((u) => u.toLowerCase().startsWith(q)).slice(0, 6);
      if (!found.length) { close(); return; }
      items = found; active = -1;
      if (!menu) {
        menu = h('div', { class: 'at-menu' });
        inputEl.parentNode.appendChild(menu);
      }
      menu.innerHTML = '';
      found.forEach((u, i) => {
        menu.appendChild(h('button', { class: 'at-item', onclick: () => apply(u) }, icon('at', 12), h('span', {}, '@' + u), rankChip(u)));
      });
      menu.querySelectorAll('.at-item')[0]?.classList.add('on');
      active = 0;
    });
    inputEl.addEventListener('keydown', (ev) => {
      if (!menu) return;
      if (ev.key === 'ArrowDown') { ev.preventDefault(); active = (active + 1) % items.length; highlight(); }
      else if (ev.key === 'ArrowUp') { ev.preventDefault(); active = (active - 1 + items.length) % items.length; highlight(); }
      else if (ev.key === 'Enter' && active >= 0) { ev.preventDefault(); apply(items[active]); }
      else if (ev.key === 'Escape') { close(); }
    });
    inputEl.addEventListener('blur', () => setTimeout(close, 150));
    function highlight() {
      menu.querySelectorAll('.at-item').forEach((el, i) => el.classList.toggle('on', i === active));
    }
  }

  function socialView() {
    const root = h('div', { class: 'view' });
    let tab = 'ranks';

    const tabs = h('div', { class: 'chip-row' },
      ['ranks', 'mentions', 'messages'].map((t) => h('button', {
        class: `chip ${t === tab ? 'on' : ''}`,
        onclick: () => { tab = t; render(); },
      }, t)),
    );
    const body = h('div', { class: 'social-body' });
    root.appendChild(tabs);
    root.appendChild(body);

    function render() {
      tabs.querySelectorAll('.chip').forEach((c, i) => c.classList.toggle('on', i === ['ranks', 'mentions', 'messages'].indexOf(tab)));
      body.innerHTML = '';
      if (tab === 'ranks') renderRanks();
      else if (tab === 'mentions') renderMentions();
      else renderMessages();
    }

    function renderRanks() {
      const addRow = h('div', { class: 'rank-add' },
        h('input', { class: 'input', id: 'rank-user', placeholder: '@username' }),
        h('select', { class: 'select', id: 'rank-tag' }, RANK_TAGS.map((t) => h('option', { value: t }, t))),
        h('button', { class: 'btn btn-primary btn-sm', onclick: async (ev) => {
          const u = ($('#rank-user', body)?.value || '').trim();
          const tag = $('#rank-tag', body)?.value || 'Friend';
          if (!u) { toast('error', 'No username', 'Type a username to add'); return; }
          const btn = ev.currentTarget;
          btn.disabled = true;
          try {
            const d = await apiGet(`/api/user/${encodeURIComponent(u)}`, { ttl: 0 });
            const real = d && (d.user || d);
            if (!real || !real.username) throw new Error('User not found');
            const list = getFriends();
            if (list.some((x) => x.username.toLowerCase() === real.username.toLowerCase())) throw new Error('Already in your ranks');
            list.push({ username: real.username, tag, addedAt: Date.now() });
            saveFriends(list);
            toast('success', 'Rank added', `@${real.username} → ${tag}`);
            render();
          } catch (e) {
            toast('error', 'Could not add', e.message || 'Check the username');
            btn.disabled = false;
          }
        } }, icon('plus', 13), ' Add'),
      );
      body.appendChild(h('div', { class: 'card' },
        sectionTitle('Ranks', 'at', h('span', { class: 'card-note' }, 'local labels · nothing forged server-side')),
        addRow,
        h('div', { class: 'card-hint' }, 'Tag traders you care about. Rank chips render across the client and, with Friend Tags enabled, on rugplay.com comments too.'),
      ));

      const list = getFriends();
      const grid = h('div', { class: 'rank-grid' });
      body.appendChild(grid);
      if (!list.length) {
        grid.appendChild(emptyState('No ranks yet', 'Add a trader to start tagging', 'at'));
        return;
      }
      list.forEach((f) => {
        const sel = h('select', { class: 'select select-sm', onchange: () => {
          const l = getFriends();
          const hit = l.find((x) => x.username === f.username);
          if (hit) { hit.tag = sel.value; saveFriends(l); render(); }
        } }, RANK_TAGS.map((t) => h('option', { value: t, selected: f.tag === t }, t)));
        const card = h('div', { class: 'rank-card' },
          avatar(f.username, 30),
          h('div', { class: 'rank-main' },
            h('div', { class: 'rank-user' }, '@' + f.username, rankChip(f.username)),
            h('div', { class: 'rank-sub mono' }, 'tagged ' + timeAgo(f.addedAt)),
          ),
          h('div', { class: 'rank-actions' },
            h('button', { class: 'btn btn-ghost btn-sm', title: 'Profile', onclick: () => profileModal(f.username) }, icon('user', 12)),
            h('button', { class: 'btn btn-ghost btn-sm', title: 'Send BUSS', onclick: () => transferModal(f.username) }, icon('send', 12)),
            h('button', { class: 'btn btn-ghost btn-sm', title: 'Block on site', onclick: async () => {
              try { await apiPost(`/api/user/${encodeURIComponent(f.username)}/block`, {}); toast('success', 'Blocked', `@${f.username} added to your block list`); } catch (e) { toast('error', 'Block failed', e.message); }
            } }, icon('ban', 12)),
            h('button', { class: 'btn btn-ghost btn-sm', title: 'Remove rank', onclick: () => {
              saveFriends(getFriends().filter((x) => x.username !== f.username));
              toast('info', 'Rank removed', '@' + f.username);
              render();
            } }, icon('x', 12)),
          ),
          sel,
        );
        grid.appendChild(card);
      });
    }

    function renderMentions() {
      const listEl = h('div', { class: 'mention-list' });
      const markBtn = h('button', { class: 'btn btn-ghost btn-sm', onclick: async () => {
        try { await apiPatch('/api/notifications', { markAsRead: true }); toast('success', 'Mentions read', 'All marked as read'); render(); } catch (e) { toast('error', 'Failed', e.message); }
      } }, icon('check', 12), ' Mark all read');
      body.appendChild(h('div', { class: 'card' },
        sectionTitle('Mentions', 'at', markBtn),
        h('div', { class: 'card-hint' }, 'Real MENTION notifications - when someone @mentions you in a comment, the server pings you here.'),
        listEl,
      ));
      listEl.appendChild(h('div', { class: 'skeleton-block' }, skeleton('100%', '60px')));
      apiGet('/api/notifications', { ttl: 8000 })
        .then((d) => {
          const all = asArray(d && d.notifications);
          const list = all.filter((n) => n.type === 'MENTION');
          listEl.innerHTML = '';
          if (!list.length) { listEl.appendChild(emptyState('No mentions yet', 'Get @mentioned in a comment and it lands here', 'at')); return; }
          list.slice(0, 40).forEach((n) => {
            const link = n.link || '';
            const sym = (link.match(/\/coin\/([A-Za-z0-9]+)/) || [])[1];
            listEl.appendChild(h('div', { class: `mention-row ${n.isRead ? '' : 'unread'}` },
              h('span', { class: 'mention-dot' }),
              h('div', { class: 'mention-main' },
                h('div', { class: 'mention-title' }, n.title || 'Mention'),
                h('div', { class: 'mention-msg' }, n.message || ''),
                h('div', { class: 'mention-meta mono' }, (n.isRead ? 'read' : 'unread') + ' · ' + timeAgo(new Date(n.createdAt).getTime())),
              ),
              sym ? h('button', { class: 'btn btn-ghost btn-sm', onclick: () => openCoin(sym) }, 'Open ' + sym) : null,
            ));
          });
        })
        .catch((e) => { listEl.innerHTML = ''; listEl.appendChild(errorState(e.message)); });
    }

    function renderMessages() {
      const symIn = h('input', { class: 'input', placeholder: 'Coin symbol (e.g. BUSS)', value: (getWatchlist()[0] || 'BUSS') });
      const msgIn = h('input', { class: 'input', placeholder: '@mention someone or just talk…' });
      attachMentionAutocomplete(msgIn, () => [...new Set([...getFriends().map((f) => f.username), 'BUSS'])].filter(Boolean));
      const feed = h('div', { class: 'mention-list' });
      let lastSym = '';

      const loadFeed = () => {
        const sym = (symIn.value || '').trim().toUpperCase();
        if (!sym) return;
        lastSym = sym;
        feed.innerHTML = '';
        feed.appendChild(h('div', { class: 'skeleton-block' }, skeleton('100%', '60px')));
        apiGet(`/api/coin/${sym}/comments`, { ttl: 8000 })
          .then((d) => {
            const list = asArray(d && d.comments);
            feed.innerHTML = '';
            if (!list.length) { feed.appendChild(emptyState('No comments on ' + sym, 'Be the first to speak', 'send')); return; }
            list.slice(0, 20).forEach((cm) => {
              const uname = cm.username || cm.userUsername;
              feed.appendChild(h('div', { class: 'mention-row' },
                avatar(uname || 'anon', 24),
                h('div', { class: 'mention-main' },
                  h('div', { class: 'mention-title' }, '@' + (uname || 'anon'), rankChip(uname)),
                  h('div', { class: 'mention-msg' }, cm.content || ''),
                  h('div', { class: 'mention-meta mono' }, cm.createdAt ? timeAgo(new Date(cm.createdAt).getTime()) : ''),
                ),
                isMod('likes') && cm.id ? h('button', { class: 'like-btn', onclick: async () => {
                  try { await apiPost(`/api/coin/${sym}/comments/${cm.id}/like`, {}); loadFeed(); } catch (e) { toast('error', 'Could not like', e.message); }
                } }, icon('heart', 12), h('span', {}, String(num(cm.likeCount ?? cm.likesCount ?? cm.likes ?? cm.like_count, 0)))) : null,
              ));
            });
          })
          .catch((e) => { feed.innerHTML = ''; feed.appendChild(errorState(e.message)); });
      };

      body.appendChild(h('div', { class: 'card' },
        sectionTitle('Messages', 'send'),
        h('div', { class: 'card-hint' }, 'Coin comments are RugPlay\'s chat. Write here, @mention a friend, and they get a real notification. Uses the real comment endpoint.'),
        h('div', { class: 'msg-compose' },
          symIn,
          msgIn,
          h('button', { class: 'btn btn-primary btn-sm', onclick: async (ev) => {
            const sym = (symIn.value || '').trim().toUpperCase();
            const content = (msgIn.value || '').trim();
            if (!sym || !content) { toast('error', 'Message incomplete', 'Coin symbol and message required'); return; }
            const btn = ev.currentTarget;
            btn.disabled = true;
            try {
              await apiPost(`/api/coin/${sym}/comments`, { content });
              msgIn.value = '';
              toast('success', 'Message sent', `posted on ${sym}`);
              loadFeed();
            } catch (e) {
              toast('error', 'Could not send', e.message);
              btn.disabled = false;
            }
          } }, icon('send', 13), ' Send'),
        ),
        h('button', { class: 'btn btn-ghost btn-sm', onclick: loadFeed }, icon('refresh', 12), ' Reload thread'),
        feed,
      ));
      loadFeed();
    }

    render();
    return root;
  }

  // ════════════════════════════════════════════════════════════════════
  // Shell - window, sidebar, title bar, router
  // ════════════════════════════════════════════════════════════════════

  let shadow = null;
  let windowEl = null;
  let backdropEl = null;
  let pillEl = null;
  let contentEl = null;
  let headTitleEl = null;
  let headSubEl = null;
  let navEl = null;
  let statusBar = null;
  let statusClock = null;
  let statusDot = null;
  let viewStack = [];
  let viewCleanups = [];
  let minimized = false;
  let maximized = false;

  function onCleanup(fn) {
    viewCleanups.push(fn);
  }

  function clearCleanups() {
    viewCleanups.forEach((fn) => { try { fn(); } catch (e) { /* ignore */ } });
    viewCleanups = [];
  }

  const NAV = [
    { group: 'Market' },
    { id: 'overview', label: 'Overview', icon: 'candle' },
    { id: 'market', label: 'Market', icon: 'bars' },
    { id: 'watchlist', label: 'Watchlist', icon: 'star' },
    { id: 'live', label: 'Live Feed', icon: 'zap' },
    { id: 'leaders', label: 'Leaders', icon: 'skull' },
    { group: 'Bet' },
    { id: 'hopium', label: 'Hopium', icon: 'trend' },
    { id: 'gamble', label: 'Gamble Lab', icon: 'dice' },
    { id: 'arcade', label: 'Arcade', icon: 'dice' },
    { group: 'Account' },
    { id: 'portfolio', label: 'Portfolio', icon: 'wallet' },
    { id: 'achievements', label: 'Achievements', icon: 'award' },
    { id: 'rewards', label: 'Rewards', icon: 'gift' },
    { id: 'prestige', label: 'Prestige', icon: 'crown' },
    { id: 'shop', label: 'Shop', icon: 'box' },
    { id: 'account', label: 'Account', icon: 'user' },
    { group: 'Social' },
    { id: 'social', label: 'Social', icon: 'at' },
    { group: 'Client' },
    { id: 'routes', label: 'Routes', icon: 'book' },
    { id: 'mods', label: 'Mods', icon: 'sliders' },
  ];

  const VIEW_META = {
    overview: ['Overview', 'your terminal on rugplay'],
    market: ['Market', 'every listed coin · server-side sorted'],
    watchlist: ['Watchlist', 'coins you track · sparklines included'],
    live: ['Live Feed', 'trades the moment they hit the pool'],
    leaders: ['Leaders', 'the 24h extraction leaderboard'],
    hopium: ['Hopium', 'prediction markets · real pool odds'],
    gamble: ['Gamble Lab', 'EV calculators built from the real rules'],
    arcade: ['Arcade', 'live activity · your lifetime record'],
    routes: ['Routes', 'the platform API, searchable'],
    portfolio: ['Portfolio', 'your bag · your cash · your gems'],
    achievements: ['Achievements', 'the full catalog with real rewards'],
    rewards: ['Daily Rewards', 'streaks, tiers and prestige bonuses'],
    prestige: ['Prestige', 'the real $100k → $25M reset ladder'],
    shop: ['Shop', 'crates · name colors · gems'],
    account: ['Account', 'promo codes · API key · blocks · volume'],
    social: ['Social', 'friends · ranks · mentions · messages'],
    mods: ['Mods', MODS.length + ' mods · every one runs on real endpoints'],
    coin: ['Coin Terminal', ''],
  };

  function viewFactory(id, param) {
    switch (id) {
      case 'overview': return overviewView();
      case 'market': return marketView();
      case 'watchlist': return watchlistView();
      case 'live': return liveView();
      case 'leaders': return leadersView();
      case 'portfolio': return portfolioView();
      case 'achievements': return progressView();
      case 'rewards': return rewardsView();
      case 'prestige': return prestigeView();
      case 'shop': return shopView();
      case 'account': return accountView();
      case 'social': return socialView();
      case 'hopium': return param ? hopiumDetail(param) : hopiumView();
      case 'gamble': return gambleView();
      case 'arcade': return arcadeView();
      case 'routes': return routesView();
      case 'mods': return modsView();
      case 'coin': return coinView(param);
      default: return overviewView();
    }
  }

  function navActive() {
    const cur = viewStack[viewStack.length - 1];
    if (!cur || !navEl) return;
    navEl.querySelectorAll('[data-nav]').forEach((b) => {
      b.classList.toggle('on', b.dataset.nav === cur.id);
    });
  }

  function render() {
    clearCleanups();
    const cur = viewStack[viewStack.length - 1];
    if (!cur) { closeWindow(); return; }
    const [title, sub] = VIEW_META[cur.id] || [cur.id, ''];
    headTitleEl.textContent = title;
    headSubEl.textContent = cur.id === 'coin' ? (cur.param || '') : sub;
    contentEl.innerHTML = '';
    const el = viewFactory(cur.id, cur.param);
    contentEl.appendChild(el);
    navActive();
  }

  function setView(id, param) {
    if (windowEl) windowEl.classList.remove('closed');
    backdropEl.classList.add('show');
    if (pillEl) pillEl.classList.remove('show');
    minimized = false;
    viewStack.push({ id, param });
    if (isMod('viewmemory')) {
      settings.lastView = id;
      storage.set('candle:settings', settings);
    }
    render();
  }

  function goBack() {
    if (viewStack.length > 1) {
      viewStack.pop();
      render();
    } else {
      closeWindow();
    }
  }

  function openCoin(sym) {
    setView('coin', String(sym).toUpperCase());
  }

  function showWindow() {
    windowEl.classList.remove('closed', 'min');
    backdropEl.classList.add('show');
    pillEl.classList.remove('show');
    minimized = false;
  }

  function hideWindow() {
    windowEl.classList.add('closed');
    backdropEl.classList.remove('show');
  }

  function closeWindow() {
    viewStack = [];
    hideWindow();
  }

  function minimizeWindow() {
    windowEl.classList.add('min');
    backdropEl.classList.remove('show');
    pillEl.classList.add('show');
    minimized = true;
  }

  function toggleWindow() {
    if (minimized) { showWindow(); return; }
    if (windowEl.classList.contains('closed')) {
      if (viewStack.length === 0) setView('overview');
      else showWindow();
    } else {
      hideWindow();
    }
  }

  function toggleMaximize() {
    maximized = !maximized;
    windowEl.classList.toggle('max', maximized);
  }

  // ════════════════════════════════════════════════════════════════════
  // Arcade - live activity + lifetime record
  // ════════════════════════════════════════════════════════════════════

  function arcadeView() {
    const root = h('div', { class: 'view' });

    if (isMod('arcadestats')) {
      const rec = h('div', { class: 'card' });
      root.appendChild(rec);
      const statsRow = h('div', { class: 'market-stats mono' });
      rec.appendChild(statsRow);
      apiGet('/api/user/arcade-stats', { ttl: 30000 })
        .then((d) => {
          const wins = num(d && d.wins, 0);
          const losses = num(d && d.losses, 0);
          const total = num(d && d.totalPlayed, wins + losses);
          const wr = total > 0 ? (wins / total) * 100 : 0;
          statsRow.innerHTML = '';
          statsRow.appendChild(h('span', {}, icon('dice', 11), ' lifetime record - ', h('span', { class: 'up' }, wins + ' wins'), ' - ', h('span', { class: 'down' }, losses + ' losses'), ' - ', h('span', {}, total + ' played'), ' - ', h('span', {}, 'win rate ' + wr.toFixed(1) + '%')));
        })
        .catch((e) => {
          statsRow.innerHTML = '';
          statsRow.appendChild(h('span', {}, e instanceof ApiError && e.status === 401 ? 'sign in to see your arcade record' : 'record unavailable'));
        });
    }

    if (isMod('arcadelive')) {
      const status = h('span', { class: 'live-status' }, 'waiting for socket');
      root.appendChild(h('div', { class: 'card-head live-head' },
        h('div', { class: 'card-title' }, icon('dice', 14), h('span', {}, 'Live arcade activity')),
        status,
      ));
      const list = h('div', { class: 'live-list' });
      root.appendChild(list);
      const offs = [];
      const prepend = (a) => {
        if (!a || !a.username) return;
        const won = !!a.won;
        const ts = a.timestamp ? Number(a.timestamp) * (a.timestamp < 1e12 ? 1000 : 1) : Date.now();
        list.prepend(h('button', { class: 'feed-row', onclick: () => profileModal(a.username) },
          avatar(a.username, 24),
          h('div', { class: 'mini-main' },
            h('div', { class: 'mini-name' }, a.game || 'arcade', ' ', h('span', { class: won ? 'up' : 'down' }, won ? 'WON' : 'LOST')),
            h('div', { class: 'mini-sub' }, '@' + a.username + (ts ? ' - ' + timeAgo(ts) : '')),
          ),
          h('span', { class: 'mono' }, fmtBuss(num(a.amount, 0))),
        ));
        while (list.children.length > 80) list.lastChild.remove();
        status.textContent = 'live via socket';
      };
      offs.push(bus.on('ws:arcade_activity', (m) => prepend(m && m.arcadeActivity)));
      onCleanup(() => offs.forEach((fn) => fn()));
    } else {
      root.appendChild(emptyState('Arcade Live is off', 'Enable the Arcade Live mod to watch real-time activity from the socket', 'dice'));
    }

    if (!isMod('arcadestats') && !isMod('arcadelive')) {
      root.appendChild(emptyState('Arcade view', 'Enable Arcade Record and Arcade Live mods to fill this view', 'dice'));
    }
    return root;
  }

  // ════════════════════════════════════════════════════════════════════
  // Routes explorer - the platform API, searchable, try-it runner
  // ════════════════════════════════════════════════════════════════════

  const ROUTES = [
    ['GET', '/api/market', 'The full market list, server-side sorted.', 'public'],
    ['GET', '/api/coins/top', 'Top coins by market cap.', 'public'],
    ['GET', '/api/coin/{symbol}', 'One coin: price, cap, pool, creator, lock.', 'public'],
    ['GET', '/api/coin/{symbol}/chart-history', 'Candles for a timeframe (1m to 1d).', 'public'],
    ['GET', '/api/coin/{symbol}/holders', 'Top holders with share of supply.', 'public'],
    ['GET', '/api/coin/{symbol}/comments', 'Comments on a coin, newest first.', 'public'],
    ['POST', '/api/coin/{symbol}/comments', 'Post a comment. An @mention pings that user.', 'session'],
    ['POST', '/api/coin/{symbol}/comments/{id}/like', 'Like a comment.', 'session'],
    ['POST', '/api/coin/{symbol}/trade', 'Swap base currency for coins (0.3% fee).', 'session'],
    ['GET', '/api/trades/recent', 'Recent trades, with minValue + limit filters.', 'public'],
    ['GET', '/api/leaderboard', '24h extraction leaderboard.', 'public'],
    ['GET', '/api/hopium/questions', 'Prediction questions by status.', 'public'],
    ['GET', '/api/hopium/questions/{id}', 'One question with both sides staked.', 'public'],
    ['POST', '/api/hopium/questions/{id}/bet', 'Place a YES/NO stake.', 'session'],
    ['POST', '/api/hopium/questions/create', 'Propose a question ($100k+ balance, 2 per hour).', 'session'],
    ['GET', '/api/portfolio/total', 'Your cash and coin value.', 'session'],
    ['GET', '/api/portfolio/summary', 'Your balances and holdings.', 'session'],
    ['GET', '/api/transactions', 'Your transaction history.', 'session'],
    ['GET', '/api/achievements', 'Full achievement catalog with progress.', 'session'],
    ['POST', '/api/achievements/claim', 'Claim a completed achievement reward.', 'session'],
    ['GET', '/api/user/arcade-stats', 'Your lifetime arcade wins and losses.', 'session'],
    ['GET', '/api/user/{username}', 'A trader public profile.', 'public'],
    ['GET', '/api/user/{username}/achievements', 'A trader unlocked achievements.', 'public'],
    ['POST', '/api/user/{username}/block', 'Block a user (DELETE to unblock).', 'session'],
    ['POST', '/api/transfer', 'Send cash (1% fee) or coins (no fee) to a user.', 'session'],
    ['GET', '/api/season', 'Current season, your rank, join stake.', 'session'],
    ['POST', '/api/season/join', 'Enter the season (holdings liquidated).', 'session'],
    ['GET', '/api/notifications', 'Your notifications.', 'session'],
    ['PATCH', '/api/notifications', 'Mark notifications as read.', 'session'],
    ['POST', '/api/shop/crate', 'Open a crate for gems.', 'session'],
    ['GET', '/api/shop/inventory', 'Your crates, name colors, gems.', 'session'],
    ['POST', '/api/shop/equip', 'Equip a name color you own.', 'session'],
    ['GET', '/api/rewards/claim', 'Daily reward status.', 'session'],
    ['POST', '/api/rewards/claim', 'Claim the daily reward.', 'session'],
    ['GET', '/api/prestige', 'Your prestige ladder state.', 'session'],
    ['POST', '/api/prestige', 'Reset for the next prestige tier.', 'session'],
    ['POST', '/api/promo/verify', 'Redeem a promo code.', 'session'],
    ['GET', '/api/keys', 'Your rgpl_ API key and budget.', 'session'],
    ['POST', '/api/keys/{id}/regenerate', 'Rotate your API key.', 'session'],
    ['GET', '/api/v1/market', 'Public v1 API market (uses your rgpl_ key).', 'public'],
    ['GET', '/api/v1/top', 'Public v1 API top coins.', 'public'],
    ['GET', '/api/v1/coin/{symbol}', 'Public v1 API single coin.', 'public'],
    ['GET', '/api/v1/holders/{symbol}', 'Public v1 API holders.', 'public'],
    ['GET', '/api/v1/hopium', 'Public v1 API hopium questions.', 'public'],
  ];

  function routesView() {
    const root = h('div', { class: 'view' });
    if (!isMod('routers')) {
      root.appendChild(emptyState('Routes Explorer is off', 'Enable the Routes Explorer mod to browse every real API route', 'book'));
      return root;
    }
    const search = h('input', { class: 'input search-input', placeholder: 'Search routes...' });
    const count = h('span', { class: 'mono route-count' }, ROUTES.length + ' routes - all real');
    const list = h('div', { class: 'route-list' });
    root.appendChild(h('div', { class: 'market-toolbar' }, search, count));
    root.appendChild(list);

    function build(query) {
      list.innerHTML = '';
      const q = (query || '').trim().toLowerCase();
      ROUTES.filter((r) => !q || (r[0] + ' ' + r[1] + ' ' + r[2] + ' ' + r[3]).toLowerCase().includes(q))
        .forEach((r) => {
          const detail = h('div', { class: 'route-detail' });
          const wrap = h('div', { class: 'route-row' },
            h('span', { class: 'route-method m-' + r[0].toLowerCase() }, r[0]),
            h('span', { class: 'route-path mono' }, r[1]),
            h('span', { class: 'route-desc' }, r[2]),
            h('span', { class: 'route-auth' + (r[3] === 'session' ? '' : ' pub') }, r[3]),
            h('button', { class: 'route-expand', onclick: () => { detail.classList.toggle('open'); wrap.classList.toggle('open'); } }, '...'),
          );
          const isWrite = r[0] !== 'GET';
          const out = h('pre', { class: 'route-out' });
          if (isWrite) {
            detail.appendChild(h('div', { class: 'route-hint' }, 'write route - not callable from the explorer, the client features use it'));
          } else {
            const inputs = [];
            (r[1].match(/\{[^}]+\}/g) || []).forEach((ph) => {
              const inp = h('input', { class: 'input route-in', placeholder: ph.slice(1, -1), dataset: { token: ph } });
              inputs.push(inp);
              detail.appendChild(inp);
            });
            const runBtn = h('button', { class: 'btn btn-ghost btn-sm' }, icon('refresh', 12), ' Try it');
            const run = async () => {
              let path = r[1];
              inputs.forEach((inp) => { path = path.replace(inp.dataset.token, inp.value.trim() || inp.dataset.token); });
              out.textContent = 'fetching...';
              runBtn.disabled = true;
              try {
                const res = await fetch(path, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
                const text = await res.text();
                let body = text;
                try { body = JSON.stringify(JSON.parse(text), null, 2); } catch (e) { /* plain text */ }
                out.textContent = res.status + ' ' + res.statusText + '\n\n' + body;
              } catch (e) {
                out.textContent = 'failed: ' + (e && e.message ? e.message : String(e));
              } finally {
                runBtn.disabled = false;
              }
            };
            runBtn.addEventListener('click', run);
            const copyBtn = h('button', { class: 'btn btn-ghost btn-sm' }, icon('tag', 12), ' Copy path');
            copyBtn.addEventListener('click', () => {
              const p = r[1].replace(/\{[^}]+\}/g, (ph) => ph);
              if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(p).catch(() => {});
              toast('success', 'Copied', p);
            });
            detail.appendChild(h('div', { class: 'route-actions' }, runBtn, copyBtn));
            detail.appendChild(out);
          }
          wrap.appendChild(detail);
          list.appendChild(wrap);
        });
      if (!list.children.length) list.appendChild(emptyState('No routes', 'Try a different search', 'search'));
    }

    search.addEventListener('input', debounce((ev) => build(ev.target.value), 250));
    build('');
    return root;
  }

  // ════════════════════════════════════════════════════════════════════
  // Achievement walls - any trader unlocked achievements (public)
  // ════════════════════════════════════════════════════════════════════

  function achievementWallModal(username) {
    const wrap = h('div', { class: 'modal-back' },
      h('div', { class: 'modal modal-lg' },
        h('div', { class: 'modal-head' },
          h('span', { class: 'modal-title' }, 'Achievements - @' + username),
          h('button', { class: 'traffic-mini', onclick: () => wrap.remove() }, icon('x', 13)),
        ),
        h('div', { class: 'modal-body' }, skeleton()),
      ),
    );
    wrap.addEventListener('click', (ev) => { if (ev.target === wrap) wrap.remove(); });
    $('.candle-window', shadow).appendChild(wrap);
    const body = $('.modal-body', wrap);
    const diffColor = (x) => ({ easy: '#34d399', medium: '#60a5fa', hard: '#c084fc', legendary: '#facc15' }[(x || '').toLowerCase()] || '#9ca3af');
    apiGet('/api/user/' + encodeURIComponent(username) + '/achievements', { ttl: 30000 })
      .then((d) => {
        const list = asArray(d && d.achievements);
        const unlocked = list.filter((a) => a.unlocked);
        body.innerHTML = '';
        body.appendChild(h('div', { class: 'wall-sum mono' }, unlocked.length + ' unlocked - ' + list.length + ' total'));
        if (!unlocked.length) {
          body.appendChild(emptyState('Nothing unlocked yet', 'This trader has no achievements yet', 'award'));
          return;
        }
        const grid = h('div', { class: 'ach-wall-grid' });
        unlocked.forEach((a) => {
          grid.appendChild(h('div', { class: 'ach-wall-card' },
            h('div', { class: 'ach-wall-top' },
              h('span', { class: 'ach-wall-ico', style: 'color:' + diffColor(a.difficulty) }, icon('award', 16)),
              h('span', { class: 'ach-wall-diff', style: 'color:' + diffColor(a.difficulty) }, (a.difficulty || '').toLowerCase()),
            ),
            h('div', { class: 'ach-wall-name' }, a.name || 'Achievement'),
            h('div', { class: 'ach-wall-desc' }, a.description || ''),
          ));
        });
        body.appendChild(grid);
      })
      .catch((e) => {
        body.innerHTML = '';
        body.appendChild(emptyState('Wall unavailable', e.message || 'Could not load this trader achievements', 'award'));
      });
  }

  // ════════════════════════════════════════════════════════════════════
  // Hopium composer - propose questions with the real rules
  // ════════════════════════════════════════════════════════════════════

  function hopiumComposer(onDone) {
    const wrap = h('div', { class: 'modal-back' },
      h('div', { class: 'modal' },
        h('div', { class: 'modal-head' },
          h('span', { class: 'modal-title' }, 'Propose a question'),
          h('button', { class: 'traffic-mini', onclick: () => wrap.remove() }, icon('x', 13)),
        ),
        h('div', { class: 'modal-body' },
          h('textarea', { class: 'composer-ta', placeholder: 'Will MOONCAT hit $0.01 before Friday?', maxlength: '200' }),
          h('div', { class: 'card-hint' }, 'Real rules: $100k+ balance to post, max 2 per hour, 10-200 characters, auto-resolution with web search when needed.'),
          h('div', { class: 'route-actions' },
            h('button', { class: 'btn btn-primary', onclick: submit }, 'Submit'),
            h('button', { class: 'btn btn-ghost', onclick: () => wrap.remove() }, 'Cancel'),
          ),
        ),
      ),
    );
    wrap.addEventListener('click', (ev) => { if (ev.target === wrap) wrap.remove(); });
    $('.candle-window', shadow).appendChild(wrap);
    const body = $('.modal-body', wrap);
    const err = h('div', { class: 'composer-err' });
    body.appendChild(err);
    const ta = $('.composer-ta', wrap);
    ta.focus();

    async function submit() {
      const q = (ta.value || '').trim();
      if (q.length < 10 || q.length > 200) {
        err.textContent = 'Question must be between 10 and 200 characters';
        return;
      }
      err.textContent = '';
      try {
        const d = await apiPost('/api/hopium/questions/create', { question: q });
        toast('success', 'Question posted', d && d.question && d.question.requiresWebSearch ? 'auto-resolves with web search' : 'It is live on Hopium');
        wrap.remove();
        if (onDone) onDone();
      } catch (e) {
        err.textContent = e.message || 'Could not post';
      }
    }
  }

  // mod-gated chrome - rebuilt live so enabling a mod shows its chrome immediately
  let bellSlot = null, footSlot = null, brandSlot = null;
  let bellBtn = null, badgeEl = null, bellPanel = null;

  function renderBrand() {
    if (!brandSlot) return;
    brandSlot.innerHTML = '';
    brandSlot.appendChild(h('div', { class: 'brand' },
      logoMark(38),
      h('div', { class: 'brand-meta' },
        h('div', { class: 'brand-name' }, 'Candle'),
        isMod('versiontag') ? h('span', { class: 'v-badge mono' }, 'v' + VERSION) : null,
      ),
    ));
  }

  function renderChrome() {
    if (!bellSlot || !footSlot) return;
    renderBrand();
    if (bellBtn) bellBtn.remove();
    if (bellPanel) bellPanel.remove();
    badgeEl = h('span', { class: 'bell-badge mono' });
    bellPanel = h('div', { class: 'bell-panel' });
    bellBtn = isMod('bell') ? h('button', {
      class: 'bell-btn',
      onclick: (ev) => {
        ev.stopPropagation();
        const open = bellPanel.classList.contains('show');
        shadow.querySelectorAll('.bell-panel').forEach((p) => p.classList.remove('show'));
        if (!open) {
          bellPanel.classList.add('show');
          renderBell(bellBtn, badgeEl, bellPanel);
        }
      },
    }, icon('bell', 16), badgeEl) : null;
    if (bellBtn) bellSlot.appendChild(bellBtn);
    shadow.appendChild(bellPanel);

    footSlot.innerHTML = '';
    footSlot.appendChild(h('div', { class: 'side-foot' },
      isMod('credits') ? h('button', { class: 'nav-item', onclick: () => openCredits() }, icon('info', 15), h('span', {}, 'Credits')) : null,
      h('div', { class: 'side-credit' },
        isMod('credits') ? h('span', {}, 'by ', h('span', { class: 'credit-name' }, DEVELOPER), ' · ') : null,
        h('span', {}, 'candle v', VERSION),
      ),
      isMod('keyhints') ? h('div', { class: 'key-hints mono' }, 'RShift menu · Esc close') : null,
    ));
  }

  function buildShell() {
    const host = document.createElement('div');
    host.id = 'candle-host';
    shadow = host.attachShadow({ mode: 'open' });
    document.body.appendChild(host);

    shadow.appendChild(h('style', { html: CANDLE_CSS }));

    backdropEl = h('div', { class: 'candle-backdrop' });
    backdropEl.addEventListener('click', () => { if (isMod('autoclose')) closeWindow(); });
    shadow.appendChild(backdropEl);

    // traffic lights
    const closeBtn = h('button', { class: 'tl tl-close', title: 'Close', onclick: closeWindow });
    const minBtn = h('button', { class: 'tl tl-min', title: 'Minimize', onclick: minimizeWindow });
    const maxBtn = h('button', { class: 'tl tl-max', title: 'Maximize', onclick: toggleMaximize });

    // title bar
    const titlebar = h('div', { class: 'candle-titlebar' },
      h('div', { class: 'tb-brand' }, logoMark(18), h('span', {}, 'Candle Client'), h('span', { class: 'tb-ver mono' }, 'v' + VERSION)),
      h('div', { class: 'tl-cluster' }, closeBtn, minBtn, maxBtn),
    );

    // sidebar brand (versiontag badge is mod-gated chrome too)
    brandSlot = h('div', {});
    renderBrand();

    // nav
    navEl = h('nav', { class: 'nav' });
    NAV.forEach((item) => {
      if (item.group) {
        navEl.appendChild(h('div', { class: 'nav-group' }, item.group));
      } else {
        navEl.appendChild(h('button', {
          class: 'nav-item',
          'data-nav': item.id,
          onclick: () => setView(item.id),
        }, icon(item.icon, 15), h('span', {}, item.label)));
      }
    });

    // mod-gated chrome - bell + credits rebuild live when mods toggle
    bellSlot = h('span', { class: 'bell-slot' });
    footSlot = h('div', { class: 'foot-slot' });
    renderChrome();

    // content head
    headTitleEl = h('h1', { class: 'candle-h1' });
    headSubEl = h('span', { class: 'candle-sub' });

    const sidebar = h('aside', { class: 'candle-side' }, brandSlot, navEl, footSlot);
    const head = h('header', { class: 'candle-head' },
      h('div', { class: 'head-block' }, headTitleEl, headSubEl),
      bellSlot,
    );
    contentEl = h('div', { class: 'candle-content' });
    const main = h('main', { class: 'candle-main' }, head, contentEl);

    statusClock = h('span', { class: 'mono' }, '--:--');
    statusDot = h('span', { class: 'ws-dot off' }, icon('zap', 10), ' ', h('span', { class: 'ws-txt' }, 'offline'));
    statusBar = h('div', { class: 'candle-status' },
      h('span', { class: 'mono' }, 'candle · v' + VERSION),
      h('span', { class: 'mono' }, icon('clock', 10), ' ', statusClock),
      statusDot,
    );
    windowEl = h('div', { class: 'candle-window closed' }, titlebar, h('div', { class: 'candle-body' }, sidebar, main), statusBar);
    shadow.appendChild(windowEl);

    pillEl = h('button', { class: 'candle-pill', onclick: showWindow, title: 'Open Candle Client' },
      logoMark(22),
      h('span', {}, 'Candle'),
    );
    shadow.appendChild(pillEl);

    const toasts = h('div', { class: 'candle-toasts' });
    shadow.appendChild(toasts);
  }

  // credits modal
  function openCredits() {
    if (!windowEl) return;
    const wrap = h('div', { class: 'modal-back' },
      h('div', { class: 'modal credits' },
        h('div', { class: 'credits-logo' }, logoMark(56)),
        h('div', { class: 'credits-name' }, 'Candle Client'),
        h('div', { class: 'credits-ver mono' }, 'v' + VERSION),
        h('div', { class: 'credits-line' }, 'built by ', h('span', { class: 'credit-name' }, DEVELOPER)),
        h('div', { class: 'credits-line dim' }, `a client for rugplay · ${MODS.length} mods · zero fakes`),
        h('button', { class: 'btn btn-primary', onclick: () => wrap.remove() }, 'Close'),
      ),
    );
    wrap.addEventListener('click', (ev) => { if (ev.target === wrap) wrap.remove(); });
    windowEl.appendChild(wrap);
  }

  // keyboard
  function onKeydown(ev) {
    // Right Shift is the launcher - always available, it is not a mod
    if (ev.code === 'ShiftRight') {
      ev.preventDefault();
      toggleWindow();
      return;
    }
    if (ev.code === 'Escape' && !windowEl.classList.contains('closed')) {
      ev.preventDefault();
      const modal = $('.modal-back', windowEl);
      if (modal) { modal.remove(); return; }
      goBack();
    }
  }

  // price alerts
  let alertTimer = null;
  function startAlerts() {
    alertTimer = setInterval(async () => {
      const alerts = getAlerts();
      if (!alerts.length) return;
      const uniq = [...new Set(alerts.map((a) => a.symbol))];
      for (const sym of uniq) {
        try {
          const d = await apiGet(`/api/coin/${sym}`, { ttl: 9000 });
          const price = num(d && d.coin && d.coin.currentPrice);
          const hit = alerts.filter((a) => a.symbol === sym && ((a.dir === 1 && price >= a.target) || (a.dir === -1 && price <= a.target)));
          if (hit.length) {
            hit.forEach((a) => {
              toast('success', `Price alert · ${a.symbol}`, `${a.dir === 1 ? 'pumped to' : 'dipped to'} ${fmtPrice(price)} (target ${fmtPrice(a.target)})`, 5200);
              removeAlert(a.id);
            });
          }
        } catch (e) { /* skip symbol on failure */ }
      }
    }, 30000);
  }

  // SPA-aware: keep the terminal and HUD in sync with rugplay's navigation
  function startSpaSync() {
    const check = () => {
      syncOnsite();
      const path = location.pathname;
      const m = path.match(/^\/coin\/([A-Za-z0-9]+)/);
      if (m) {
        const sym = m[1].toUpperCase();
        const cur = viewStack[viewStack.length - 1];
        if (windowEl.classList.contains('closed')) return;
        if (cur && cur.id === 'coin' && cur.param === sym) return;
        setView('coin', sym);
      }
    };
    window.addEventListener('popstate', check);
    const origPush = history.pushState;
    history.pushState = function (...args) {
      const r = origPush.apply(this, args);
      check();
      return r;
    };
    return () => {
      window.removeEventListener('popstate', check);
      history.pushState = origPush;
    };
  }

  // boot
  const ACCENTS = {
    red: ['#ef4444', '#dc2626', '#f87171'],
    ember: ['#f97316', '#ea580c', '#fb923c'],
    violet: ['#8b5cf6', '#7c3aed', '#a78bfa'],
    emerald: ['#10b981', '#059669', '#34d399'],
    cyan: ['#06b6d4', '#0891b2', '#22d3ee'],
  };
  const LIGHT_VARS = {
    '--bg0': '#f4f4f5', '--bg1': '#ececef', '--bg2': '#ffffff', '--bg3': '#e6e6ea',
    '--bd': 'rgba(0,0,0,.10)', '--tx': '#18181b', '--mut': '#52525b', '--dim': '#8b8b94',
  };

  function applyClientClasses() {
    const host = document.getElementById('candle-host');
    if (!host) return;
    host.classList.toggle('no-glow', !isMod('glowfx'));
    host.classList.toggle('compact', isMod('compact'));
    host.classList.toggle('no-anim', !isMod('animation'));
    host.classList.toggle('deep-shadow', isMod('shadowfx'));
    if (statusBar) statusBar.style.display = isMod('statusbar') ? 'flex' : 'none';
    applyClientLook();
  }

  function applyClientLook() {
    const host = document.getElementById('candle-host');
    if (!host || !windowEl) return;
    const s = windowEl.style;
    // accent
    const acc = ACCENTS[settings.accent] || ACCENTS.red;
    s.setProperty('--red', acc[0]);
    s.setProperty('--red-d', acc[1]);
    s.setProperty('--red-h', acc[2]);
    // theme
    const want = settings.theme === 'auto'
      ? (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
      : settings.theme;
    host.dataset.candleTheme = want;
    if (want === 'light') {
      Object.entries(LIGHT_VARS).forEach(([k, v]) => s.setProperty(k, v));
    } else {
      Object.entries(LIGHT_VARS).forEach(([k]) => s.removeProperty(k));
    }
    // font scale
    const scale = Math.min(130, Math.max(85, num(settings.fontScale, 100))) / 100;
    if ('zoom' in document.documentElement.style) host.style.zoom = String(scale);
    else host.style.fontSize = (13 * scale) + 'px';
  }

  function boot() {
    buildShell();
    if (statusDot) statusDot.style.display = isMod('realtime') ? '' : 'none';
    applyClientClasses();
    bus.on('mods', applyClientClasses);
    bus.on('mods', renderChrome);
    bus.on('settings', applyClientLook);
    bus.on('mods', syncOnsite);
    bus.on('mods', (id) => {
      if (id !== 'realtime') return;
      if (statusDot) statusDot.style.display = isMod('realtime') ? '' : 'none';
      if (isMod('realtime')) wsStart(); else wsStop();
    });
    bus.on('ws', (v) => {
      if (!statusDot) return;
      statusDot.classList.toggle('on', !!v);
      statusDot.classList.toggle('off', !v);
      const t = statusDot.querySelector('.ws-txt');
      if (t) t.textContent = v ? 'live' : 'offline';
    });
    // large trade alerts straight off the socket (realtime + largetrade mods)
    let lastLargeToast = 0;
    const largePick = (m) => {
      if (!isMod('largetrade') || !isMod('toasts')) return;
      const t = m && m.data;
      if (!t) return;
      const v = num(t.totalValue ?? t.totalBaseCurrencyAmount ?? t.amount, 0);
      if (v < 100000) return;
      const now = Date.now();
      if (now - lastLargeToast < 5000) return;
      lastLargeToast = now;
      toast('info', 'Large ' + (t.type || '').toUpperCase(), (t.coinSymbol || t.symbol || '?') + ' - ' + fmtBuss(v) + ' by @' + (t.username || '?'));
    };
    bus.on('ws:live-trade', largePick);
    bus.on('ws:all-trades', largePick);
    if (isMod('realtime')) wsStart();
    document.addEventListener('keydown', onKeydown, true);
    const offSpa = startSpaSync();
    startAlerts();
    setInterval(() => {
      if (statusClock) statusClock.textContent = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }, 1000);
    checkAuth();
    syncOnsite();
    if (isMod('viewmemory') && settings.lastView && VIEW_META[settings.lastView]) {
      viewStack.push({ id: settings.lastView });
      render();
    }

    window.__CANDLE__ = {
      version: VERSION,
      developer: DEVELOPER,
      open: () => showWindow(),
      close: closeWindow,
      toggle: toggleWindow,
      setView,
      goBack,
      setMod(id, on) {
        mods[id] = !!on;
        storage.set('candle:mods', mods);
        bus.emit('mods', id);
      },
      isMod,
      modsSnapshot: () => ({ ...mods }),
      destroy() {
        document.removeEventListener('keydown', onKeydown, true);
        offSpa();
        wsStop();
        if (alertTimer) clearInterval(alertTimer);
        clearCleanups();
        hudRemove();
        const st = document.getElementById('cc-hud-style');
        if (st) st.remove();
        const host = document.getElementById('candle-host');
        if (host) host.remove();
        shadow = windowEl = backdropEl = pillEl = contentEl = headTitleEl = headSubEl = navEl = null;
        bellSlot = footSlot = brandSlot = bellBtn = badgeEl = bellPanel = null;
        delete window.__CANDLE__;
      },
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
