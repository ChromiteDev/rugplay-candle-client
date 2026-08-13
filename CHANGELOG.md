# Changelog

All notable changes to Candle Client are listed here. The format is plain on purpose.

## v1.1.1 - 2026-08-12

Hidden coin transfers.

- The transfer modal now sends coins, not just cash. The site UI only exposes cash transfers; the endpoint accepts `type: 'COIN'` with a coin symbol. Coin transfers carry no fee, require ~$10+ in value, and are blocked if the recipient is in an active season.
- Live price estimation: type a symbol, get the current price and the dollar value of your bag before you send.
- Available from the Social view, profile modals, and a Send coins button in the portfolio transfer card.

## v1.1.0 - 2026-08-12

The Social Update.


**New: Social view**
- Friends and ranks: tag traders as Friend, Whale, Watch, or Rival. Labels live in your client only, nothing is forged server-side.
- Rank chips render across comment rows, holders, and profiles, and with Friend Tags enabled, directly on rugplay.com comments.
- Mentions inbox: real MENTION notifications from the server, with mark-all-read.
- Messages: coin comments are RugPlay's chat. Compose with @mention autocomplete, post on any coin, and the recipient gets a real notification.
- Quick transfer modal and Send buttons in profiles and the social view, using the real transfer endpoint.

**New mods (205 total)**
- Mention Radar (Site): on-site unread @mention counter from your real notifications.
- Friend Tags (Site): on-site rank tags next to usernames in comments.
- Quick Transfer (Site): on-site Send button on profile pages.
- Rank Tags (Social): friend rank labels across client feeds.
- Mention Ping (Social): toast the moment a new mention lands.

**Notes**
- The admin endpoints in the RugPlay repo are gated server-side by an account flag; no client can reach them, so 1.1.0 ships the real social layer instead.

## v1.0.0 - 2026-08-12

Initial release.

**The client**
- Fourteen views: Overview, Market, Watchlist, Live Feed, Leaders, Hopium, Gamble Lab, Portfolio, Achievements, Rewards, Prestige, Shop, Account, Mods.
- Premium shell: sidebar navigation, live status bar, notifications, five accent colors, auto/dark/light themes, glow and animation toggles.
- Right Shift opens and closes the client. Escape goes back.

**The mods**
- 200 mods in 13 categories, every one off by default.
- Site category: 35 widgets rendered directly on rugplay.com, including price, 24h, market cap, and volume chips, trade tape, hopium, leaderboard, rewards, keys, arcade, and season join.
- Trading: order flow, average entry, dev watch, break-even, slippage, quick sell, volatility, x since launch.
- Market: treemap, distributions, market clock, heat rows, micro and mega cap highlights, trade pace.
- Gamble: real EV for dice, coinflip, slots, mines, and tower, plus an edge gauge and fairness ranking.
- Client: themes, accent colors, glow, animation, shadows, key hints, status bar.

**The math**
- Creator lock, 0.3% swap fee, 1% transfer fee, arcade house edges, the $1,200 to $8,500 reward ladder, prestige multipliers. All computed with the same rules the server uses.

**Notes**
- Closed source. Free for personal use on rugplay.com. See LICENSE.
- Every write action is deliberate and double-confirmed on your own session.
