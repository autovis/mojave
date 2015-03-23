create table eurusd
select str_to_date(ask.exp_date,"%Y%m%d %k%i%s") as date,
  ask.open ask_open,
  ask.high ask_high,
  ask.low ask_low,
  ask.close ask_close,
  ask.volume ask_volume,
  bid.open bid_open,
  bid.high bid_high,
  bid.low bid_low,
  bid.close bid_close,
  bid.volume bid_volume
from eurusd_ask ask inner join eurusd_bid bid
where ask.exp_date = bid.exp_date
order by date
