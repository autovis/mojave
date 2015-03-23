select floor(dirdiff_range/5)*5 piprange, count(*) from dirdiff_0 
where dirdiff_range is not null and hour(date) >= 5 and hour(date) <= 10
group by piprange
order by piprange
;

-- select sum(dirdiff_pnl) from dirdiff_0;