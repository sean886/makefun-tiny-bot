# Tiny SOL EMA crossover bot

A deterministic, long-only multi-asset bot that buys 5/20 EMA up-crosses and sells on down-crosses, a 15% stop, or a 50% take-profit. Orders are sized under the kit's position and weight caps and its minimum notional.

Grade it from the kit directory with `node cli/makefun.mjs grade-local --kit . --bot /data/home/makefun-tiny-bot --driver process`. Compare the result with `--bot baselines/buy-and-hold`.
