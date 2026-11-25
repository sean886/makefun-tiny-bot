# Tiny SOL EMA crossover bot

A deterministic, long-only multi-asset bot using an EMA 8/21 crossover. It buys only while the slow EMA is rising versus 3 bars ago, and exits at a 15% stop-loss or 50% take-profit. Slippage is capped at 100 bps.
