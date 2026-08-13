'use strict';
// Builds preview.html: the REAL userscript inlined into a fake rugplay page with mocked API data,
// booted with a showcase set of mods enabled and the menu open. Lets us SEE the redesign live.
const fs = require('fs');
const src = fs.readFileSync('candle-client.user.js', 'utf8');

// strip the Tampermonkey header (up to ==/UserScript==)
const body = src.slice(src.indexOf('==/UserScript==') + '==/UserScript=='.length);

const NOW = Date.now();
const COINS = [
  { symbol: 'MOONCAT', name: 'Moon Cat', currentPrice: 0.0012, marketCap: 1200000, volume24h: 99000, change24h: 482.0, createdAt: (NOW - 86400e3) / 1000, icon: null },
  { symbol: 'TEST', name: 'Test Coin', currentPrice: 0.005, marketCap: 5000000, volume24h: 123456, change24h: 42.5, createdAt: (NOW - 3600e3) / 1000, icon: null },
  { symbol: 'STONK', name: 'Stonk', currentPrice: 0.8, marketCap: 340000, volume24h: 41000, change24h: 18.9, createdAt: (NOW - 7200e3) / 1000, icon: null },
  { symbol: 'COPIUM', name: 'Copium', currentPrice: 0.02, marketCap: 98000, volume24h: 15200, change24h: 7.1, createdAt: (NOW - 5400e3) / 1000, icon: null },
  { symbol: 'BYT', name: 'Byte', currentPrice: 0.01, marketCap: 40000, volume24h: 22000, change24h: 12.3, createdAt: (NOW - 10800e3) / 1000, icon: null },
  { symbol: 'PIXEL', name: 'Pixel', currentPrice: 0.3, marketCap: 150000, volume24h: 8800, change24h: -21.4, createdAt: (NOW - 16000e3) / 1000, icon: null },
  { symbol: 'RUG', name: 'Rug Check', currentPrice: 0.5, marketCap: 800000, volume24h: 30000, change24h: -55.0, createdAt: (NOW - 40000e3) / 1000, icon: null },
  { symbol: 'ALPH4', name: 'Alpha IV', currentPrice: 0.9, marketCap: 6000000, volume24h: 18000, change24h: 9999.9, createdAt: (NOW - 12000e3) / 1000, icon: null },
];
const TRADES = [
  { type: 'BUY', username: 'slate', symbol: 'MOONCAT', coinSymbol: 'MOONCAT', totalValue: 2500, amount: 2100000, timestamp: (NOW - 4e3) / 1000 },
  { type: 'SELL', username: 'ruglord', symbol: 'TEST', coinSymbol: 'TEST', totalValue: 800, amount: 160000, timestamp: (NOW - 9e3) / 1000 },
  { type: 'BUY', username: 'apex', symbol: 'STONK', coinSymbol: 'STONK', totalValue: 1200, amount: 1500, timestamp: (NOW - 15e3) / 1000 },
  { type: 'BUY', username: 'diamondhand', symbol: 'COPIUM', coinSymbol: 'COPIUM', totalValue: 340, amount: 17000, timestamp: (NOW - 22e3) / 1000 },
  { type: 'SELL', username: 'paper', symbol: 'PIXEL', coinSymbol: 'PIXEL', totalValue: 210, amount: 700, timestamp: (NOW - 31e3) / 1000 },
  { type: 'BUY', username: 'whale69', symbol: 'ALPH4', coinSymbol: 'ALPH4', totalValue: 9000, amount: 10000, timestamp: (NOW - 40e3) / 1000 },
  { type: 'SELL', username: 'flipper', symbol: 'RUG', coinSymbol: 'RUG', totalValue: 1500, amount: 3000, timestamp: (NOW - 55e3) / 1000 },
  { type: 'BUY', username: 'chad', symbol: 'MOONCAT', coinSymbol: 'MOONCAT', totalValue: 620, amount: 516000, timestamp: (NOW - 70e3) / 1000 },
];

const mock = `
  window.__MOCK_DELAY = 40;
  const NOW = ${NOW};
  const COINS = ${JSON.stringify(COINS)};
  const TRADES = ${JSON.stringify(TRADES)};
  window.fetch = async (input, opts) => {
    const url = typeof input === 'string' ? input : input.url;
    const u = new URL(url, location.origin);
    const p = u.pathname;
    const q = u.searchParams;
    const delay = (ms) => new Promise((r) => setTimeout(r, ms));
    await delay(window.__MOCK_DELAY);
    const json = (d, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'Content-Type': 'application/json' } });
    if (p === '/api/market' || p === '/api/coins/top') {
      let list = COINS.slice();
      const sort = q.get('sortBy');
      if (sort === 'change24h' && q.get('sortOrder') === 'desc') list = list.filter((c) => c.change24h > 0).sort((a, b) => b.change24h - a.change24h);
      if (sort === 'change24h' && q.get('sortOrder') === 'asc') list = list.filter((c) => c.change24h < 0).sort((a, b) => a.change24h - b.change24h);
      if (sort === 'marketCap') list = list.slice().sort((a, b) => b.marketCap - a.marketCap);
      return json({ coins: list });
    }
    if (p === '/api/trades/recent') return json({ trades: TRADES.slice(0, 8) });
    if (p === '/api/portfolio/total') return json({ baseCurrencyBalance: 4200.5, totalCoinValue: 13300, totalValue: 17500.5, coinHoldings: [
      { symbol: 'MOONCAT', name: 'Moon Cat', quantity: 2100000, value: 2520, percentageChange: 482.0 },
      { symbol: 'TEST', name: 'Test Coin', quantity: 2500000, value: 12500, percentageChange: 42.5 },
    ] });
    if (p === '/api/portfolio/summary') return json({ baseCurrencyBalance: 4200.5, totalCoinValue: 13300, totalValue: 17500.5 });
    if (p === '/api/transactions') return json({ transactions: [
      { id: 1, type: 'BUY', symbol: 'MOONCAT', coinAmount: 2100000, totalBaseCurrencyAmount: 2500, createdAt: (NOW - 3600e3) / 1000 },
      { id: 2, type: 'BUY', symbol: 'TEST', coinAmount: 2500000, totalBaseCurrencyAmount: 12500, createdAt: (NOW - 7200e3) / 1000 },
    ] });
    if (p === '/api/season') return json({ archived: false, season: { name: 'Season 4 · Moonrise', endsAt: (NOW + 6 * 86400e3) / 1000 }, me: { rank: 128, points: 4410 } });
    if (p === '/api/achievements') return json({ unlockedCount: 14, unclaimedCount: 2, achievements: [
      { id: 'first-trade', name: 'First Blood', description: 'Make your first trade', difficulty: 'EASY', cashReward: 250, gemReward: 10, targetValue: 1, progress: 1, unlocked: true, claimed: false },
      { id: 'hodler', name: 'Paper Hands Reject', description: 'Hold a coin for 24 hours', difficulty: 'MEDIUM', cashReward: 1000, gemReward: 50, targetValue: 86400, progress: 86400, unlocked: true, claimed: true },
      { id: 'whale', name: 'Whale Watch', description: 'Buy 1M BUSS of a single coin', difficulty: 'HARD', cashReward: 5000, gemReward: 250, targetValue: 1000000, progress: 2500, unlocked: false, claimed: false },
    ] });
    if (p === '/api/notifications') return json({ unreadCount: 3, notifications: [
      { id: 1, type: 'MENTION', title: 'apex mentioned you', message: '"@slate check this rug before you buy"', link: '/coin/MOONCAT', isRead: false, createdAt: (NOW - 1800e3) / 1000 },
      { id: 2, type: 'MENTION', title: 'whale69 mentioned you', message: '"@slate nice bag, holding mine"', link: '/coin/TEST', isRead: false, createdAt: (NOW - 5400e3) / 1000 },
      { id: 3, type: 'TRANSFER', title: 'Transfer received', message: '+$500.00 from whale69', link: null, isRead: false, createdAt: (NOW - 10800e3) / 1000 },
    ] });
    if (p === '/api/hopium/questions') return json({ questions: [
      { id: 1, question: 'Will MOONCAT hit 0.01 before Friday?', status: 'OPEN', yesOdds: 62, noOdds: 38, yesBets: 142, noBets: 88, endsAt: (NOW + 2 * 86400e3) / 1000 },
      { id: 2, question: 'Will a new coin pump 100x this week?', status: 'RESOLVED', yesOdds: 71, noOdds: 29, yesBets: 300, noBets: 120, endsAt: (NOW - 86400e3) / 1000, resolution: 'YES' },
    ] });
    if (p === '/api/leaderboard') return json({ topRugpullers: [
      { username: 'ruglord', netWorth: 420000, rugCount: 12, cashBalance: 250000, coinValue: 170000 },
      { username: 'whale69', netWorth: 380000, rugCount: 8, cashBalance: 200000, coinValue: 180000 },
      { username: 'slate', netWorth: 17500, rugCount: 3, cashBalance: 4200, coinValue: 13300 },
    ] });
    if (p === '/api/shop/inventory') return json({ gems: 12500, founderBadge: true, nameColors: ['crimson'] });
    if (p === '/api/user/arcade-stats') return json({ gamesPlayed: 84, winnings: 12500, losses: 9600, totalBets: 22100, bestWin: 2400, slots: { spins: 40, wins: 12 }, mines: { games: 22, wins: 8 }, coinflip: { games: 16, wins: 9 }, dice: { games: 6, wins: 1 } });
    if (p === '/api/rewards/claim') return json({ canClaim: true, streakDay: 7, streak: 7, todayAmount: 2200, windowClosesAt: (NOW + 3600e3) / 1000, nextDayAmount: 2600 });
    if (p === '/api/prestige') return json({ level: 1, netWorth: 17500.5, cash: 4200.5, nextCost: 100000, multiplier: 1.0 });
    if (p === '/api/keys') return json({ key: 'rgpl_abc123', remainingRequests: 842, limit: 1000, createdAt: (NOW - 86400e3 * 3) / 1000 });
    if (p.startsWith('/api/user/')) {
      const u = p.split('/')[3];
      const KNOWN = {
        slate: { id: 7, username: 'slate', name: 'Slate', bio: 'trader', prestigeLevel: 1, totalPortfolioValue: 17500.5, totalCoinsCreated: 3, founderBadge: true, createdAt: (NOW - 86400e3 * 90) / 1000 },
        apex: { id: 9, username: 'apex', name: 'Apex', bio: 'moon hunter', prestigeLevel: 0, totalPortfolioValue: 8800, totalCoinsCreated: 1, createdAt: (NOW - 86400e3 * 40) / 1000 },
        whale69: { id: 3, username: 'whale69', name: 'Whale', bio: 'big bags', prestigeLevel: 2, totalPortfolioValue: 380000, totalCoinsCreated: 8, createdAt: (NOW - 86400e3 * 200) / 1000 },
        paper: { id: 5, username: 'paper', name: 'Paper', bio: 'diamond hands, paper heart', prestigeLevel: 0, totalPortfolioValue: 2100, totalCoinsCreated: 0, createdAt: (NOW - 86400e3 * 10) / 1000 },
      };
      if (KNOWN[u]) return json({ user: KNOWN[u] });
      return json({ user: null });
    }
    if (p === '/api/user/arcade-stats' || p === '/api/user/settings') return json({});
    if (p === '/api/transfer' && opts && opts.method === 'POST') {
      const body = JSON.parse(opts.body || '{}');
      if (body.type === 'COIN') {
        return json({ success: true, type: 'COIN', amount: body.amount, coinSymbol: (body.coinSymbol || '').toUpperCase(), coinName: 'Moon Cat', recipient: body.recipientUsername, newQuantity: 2099999 });
      }
      return json({ success: true, type: 'CASH', amount: body.amount, feePaid: body.amount * 0.01, feeRate: 0.01, amountReceived: body.amount * 0.99, recipient: body.recipientUsername, newBalance: 4200.5 - body.amount });
    }
    if (p.startsWith('/api/coin/')) {
      const sym = p.split('/')[3];
      if (p.endsWith('/holders')) return json({ holders: [
        { username: 'slate', quantity: 2100000, percentage: 21.0, liquidationValue: 2520 },
        { username: 'whale69', quantity: 1200000, percentage: 12.0, liquidationValue: 1440 },
        { username: 'apex', quantity: 600000, percentage: 6.0, liquidationValue: 720 },
      ] });
      if (p.endsWith('/comments')) return json({ comments: [
        { id: 1, username: 'apex', content: 'launching to the moon 🚀', likesCount: 42, createdAt: (NOW - 600e3) / 1000 },
        { id: 2, username: 'paper', content: 'this is a rug, run', likesCount: 9, createdAt: (NOW - 1200e3) / 1000 },
        { id: 3, username: 'slate', content: '@whale69 thanks, holding too', likesCount: 3, createdAt: (NOW - 900e3) / 1000 },
      ] });
      if (p.endsWith('/chart-history')) return json({ candlestickData: Array.from({ length: 48 }, (_, i) => ({ time: NOW / 1000 - (48 - i) * 60, open: 0.004 + i * 0.00002, high: 0.0042 + i * 0.000022, low: 0.0039 + i * 0.000019, close: 0.0041 + i * 0.000021, volume: 900 + i * 30 })), volumeData: Array.from({ length: 48 }, (_, i) => 900 + i * 30) });
      const coin = COINS.find((c) => c.symbol === sym);
      return json({ coin: coin || { symbol: sym, name: sym, currentPrice: 0.001, marketCap: 10000, volume24h: 500, change24h: 5, poolCoinAmount: 1000000, poolBaseCurrencyAmount: 1000, circulatingSupply: 1000000000, initialSupply: 1000000000, createdAt: NOW / 1000 - 3600, tradingUnlocksAt: NOW / 1000 + 600, isLocked: true, creatorUsername: 'slate', icon: null } });
    }
    return json({});
  };
`;

const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>rugplay.com | Candle Client preview</title>
<style>
  html, body { margin: 0; background: #0b0b0e; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Inter, sans-serif; }
  /* fake rugplay page behind the client */
  .fake-site { padding: 20px 28px; color: #e4e4e7; }
  .fake-nav { display: flex; align-items: center; gap: 18px; border-bottom: 1px solid rgba(255,255,255,.08); padding-bottom: 14px; }
  .fake-logo { font-weight: 900; font-size: 18px; letter-spacing: .02em; color: #f87171; }
  .fake-link { font-size: 12px; color: #71717a; }
  .fake-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; margin-top: 18px; }
  .fake-card { background: #141417; border: 1px solid rgba(255,255,255,.07); border-radius: 10px; padding: 12px 14px; }
  .fake-card .s { font-weight: 750; font-size: 13px; }
  .fake-card .p { font-size: 11px; color: #a1a1aa; margin-top: 2px; }
</style>
</head>
<body>
  <div class="fake-site">
    <div class="fake-nav">
      <div class="fake-logo">RUGPLAY</div>
      <span class="fake-link">Market</span>
      <span class="fake-link">Create Coin</span>
      <span class="fake-link">Hopium</span>
      <span class="fake-link">Arcade</span>
      <span class="fake-link">Profile</span>
    </div>
    <div class="fake-grid" id="fake-grid"></div>
  </div>

<script>
${mock}
const grid = document.getElementById('fake-grid');
COINS.forEach((c) => {
  const el = document.createElement('div');
  el.className = 'fake-card';
  const up = c.change24h >= 0;
  el.innerHTML = '<div class="s">' + c.symbol + '</div><div class="p">$' + c.currentPrice + ' · <span style="color:' + (up ? '#34d399' : '#f87171') + '">' + (up ? '+' : '') + c.change24h + '%</span></div>';
  grid.appendChild(el);
});
</script>

<script>
${body}
</script>

<script>
  window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      const C = window.__CANDLE__;
      if (!C) return;
      // showcase mods so the premium chrome + HUD are visible
      ['glowfx', 'animation', 'shadowfx', 'statusbar', 'keyhints', 'versiontag', 'credits', 'viewmemory',
       'bell', 'pricealerts', 'profilepeek', 'holderradar', 'comments', 'treemap', 'marketstats', 'movers',
       'seasoncard', 'gemswallet', 'networth', 'livefeed', 'siteprice', 'sitechange', 'sitemcap', 'sitevol',
       'sitefeed', 'sitehopium', 'siteleader', 'siteach', 'siterewards', 'sitekeys', 'sitearcade', 'sitetransfers']
        .forEach((m) => C.setMod(m, true));
      C.open();
      const v = new URLSearchParams(location.search).get('view') || 'overview';
      if (C.setView) C.setView(v);
    }, 150);
  });
</script>
</body>
</html>
`;

fs.writeFileSync('preview.html', page);
console.log('preview.html written:', page.length, 'bytes');
