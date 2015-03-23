set @row = 0;
select
  (@row := @row + 1) AS row,
  a.`close` close,
  a.date date,
  a.volume volume,
  round(a.ATR9 - b.atr9,5) atr9,
  round(a.ATR9 - b.tsatr9,5) tsatr9,
  round(a.SDL78 - b.sdl78,5) sdl78,
  round(a.SDL48 - b.sdl48,5) sdl48,
  round(a.KVO345521_KO - b.`kvo:klinger`,5) `nt_kvo:ko`,
  round(a.KVO345521_T - b.`kvo:signal`,5) `nt_kvo:t`,
  round(a.KVO345521_KO - b.`tskvo:KO`,5) `ts_kvo:ko`,
  round(a.KVO345521_T - b.`tskvo:T`,5) `ts_kvo:t`,
  round(a.OBV - b.obv,5) obv,
  round(a.EMA11 - b.ema11,5) ema11,
  round(a.EMA100 - b.ema100,5) ema100,
  round(a.MVA7 - b.tsmva7,5) mva7,
  round(a.MVA7 - b.sma7,5) sma7,
  round(a.RSI14 - b.rsi14,5) rsi14,
  round(a.StochRSI8532_K - b.`tsstochrsi8532:K`,5) `ts_srsi8532:K`,
  round(a.StochRSI8532_D - b.`tsstochrsi8532:D`,5) `ts_srsi8532:D`,
  round(a.StochRSI8532_K - b.`stochrsi8532:K`,5) `nt_srsi8532:K`,
  round(a.StochRSI8532_D - b.`stochrsi8532:D`,5) `nt_srsi8532:D`
  
from mojave_test.unit_test_0a a inner join mojave_test.unit_test_1b b
where a.date = b.date
order by a.date