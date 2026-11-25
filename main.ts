import { runBars } from './vendor/makefun-bars.ts';

const FAST = 5;
const SLOW = 20;
const STOP_LOSS_BPS = 1500n;
const TAKE_PROFIT_BPS = 5000n;
const BPS = 10_000n;
const closes = new Map<string, number[]>();
const emaFast = new Map<string, number>();
const emaSlow = new Map<string, number>();
const previousSpread = new Map<string, number>();

await runBars({
  onBatch(state, batch) {
    const signals: { symbol: string; crossUp: boolean; crossDown: boolean }[] = [];
    for (const bar of batch.bars) {
      const symbol = bar.symbol;
      const price = Number(bar.c);
      const oldFast = emaFast.get(symbol);
      const oldSlow = emaSlow.get(symbol);
      const nextFast = oldFast === undefined ? price : oldFast + (2 / (FAST + 1)) * (price - oldFast);
      const nextSlow = oldSlow === undefined ? price : oldSlow + (2 / (SLOW + 1)) * (price - oldSlow);
      const spread = nextFast - nextSlow;
      const oldSpread = previousSpread.get(symbol);
      signals.push({ symbol, crossUp: oldSpread !== undefined && oldSpread <= 0 && spread > 0, crossDown: oldSpread !== undefined && oldSpread >= 0 && spread < 0 });
      emaFast.set(symbol, nextFast);
      emaSlow.set(symbol, nextSlow);
      previousSpread.set(symbol, spread);
      const history = closes.get(symbol) ?? [];
      history.push(price);
      if (history.length > SLOW + 2) history.shift();
      closes.set(symbol, history);
    }

    if (state.warmingUp) return [];
    const orders: any[] = [];
    const minNotional = BigInt(state.hello.fees.min_notional_quote_units);
    const openSymbols = new Set(state.positions.keys());
    let slots = Math.max(0, state.hello.caps.max_open_positions - openSymbols.size);
    const eligible = signals.filter((s) => s.crossUp && !openSymbols.has(s.symbol) && (closes.get(s.symbol)?.length ?? 0) >= SLOW);
    const divisor = BigInt(Math.max(1, eligible.length));
    for (const signal of signals) {
      const held = state.positions.get(signal.symbol);
      const close = state.close(signal.symbol);
      if (held && close !== null) {
        const mark = state.value(signal.symbol, held.qty, close);
        const loss = mark * BPS <= held.cost * (BPS - STOP_LOSS_BPS);
        const gain = mark * BPS >= held.cost * (BPS + TAKE_PROFIT_BPS);
        if (signal.crossDown || loss || gain) {
          orders.push({ side: 'sell', symbol: signal.symbol, qty: held.qty, max_slippage_bps: 10_000 });
        }
      }
    }
    for (const signal of signals) {
      if (!signal.crossUp || openSymbols.has(signal.symbol) || slots <= 0 || orders.length >= state.hello.caps.max_orders_per_bar) continue;
      if ((closes.get(signal.symbol)?.length ?? 0) < SLOW) continue;
      const weightRoom = state.weightRoom(signal.symbol);
      const cashShare = state.cash / divisor;
      const amount = [weightRoom, cashShare].reduce((a, b) => a < b ? a : b);
      if (amount < minNotional) continue;
      orders.push({ side: 'buy', symbol: signal.symbol, notional_quote_units: amount, max_slippage_bps: 10_000 });
      slots--;
    }
    return orders;
  },
});
