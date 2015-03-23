
DROP TABLE IF EXISTS `forex`.`obv55kvo_export`;

CREATE TABLE `obv55kvo_export` (
	`date` DATETIME NOT NULL,
	`ask_open` FLOAT NULL DEFAULT NULL,
	`ask_high` FLOAT NULL DEFAULT NULL,
	`ask_low` FLOAT NULL DEFAULT NULL,
	`ask_close` FLOAT NULL DEFAULT NULL,
	`bid_open` FLOAT NULL DEFAULT NULL,
	`bid_high` FLOAT NULL DEFAULT NULL,
	`bid_low` FLOAT NULL DEFAULT NULL,
	`bid_close` FLOAT NULL DEFAULT NULL,
	`volume` INT(11) UNSIGNED NULL DEFAULT NULL,
	`sdl78_up` FLOAT NULL DEFAULT NULL,
	`sdl78_down` FLOAT NULL DEFAULT NULL,
	`sdl48_up` FLOAT NULL DEFAULT NULL,
	`sdl48_down` FLOAT NULL DEFAULT NULL,
	`obv` FLOAT NULL DEFAULT NULL,
	`obvsdl_up` FLOAT NULL DEFAULT NULL,
	`obvsdl_down` FLOAT NULL DEFAULT NULL,
	`kvo345521_k` FLOAT NULL DEFAULT NULL,
	`kvo345521_t` FLOAT NULL DEFAULT NULL,
	`kvosdl_up` FLOAT NULL DEFAULT NULL,
	`kvosdl_down` FLOAT NULL DEFAULT NULL,
	`stochrsi8532_k_up` FLOAT NULL DEFAULT NULL,
	`stochrsi8532_k_down` FLOAT NULL DEFAULT NULL,
	`stochrsi8532_k_up2` FLOAT NULL DEFAULT NULL,
	`stochrsi8532_d` FLOAT NULL DEFAULT NULL,
	`stochrsi3332_k_up` FLOAT NULL DEFAULT NULL,
	`stochrsi3332_k_down` FLOAT NULL DEFAULT NULL,
	`stochrsi3332_k_up2` FLOAT NULL DEFAULT NULL,
	`stochrsi3332_d` FLOAT NULL DEFAULT NULL,
	`sdl10_up` FLOAT NULL DEFAULT NULL,
	`sdl10_down` FLOAT NULL DEFAULT NULL,
	UNIQUE INDEX `date` (`date`)
)
COLLATE='latin1_swedish_ci'
ENGINE=MyISAM;

LOAD DATA LOCAL INFILE 'C:\\Users\\cfont\\Desktop\\obv55kvo_ask.csv' INTO TABLE `forex`.`obv55kvo_export` FIELDS TERMINATED BY ',' OPTIONALLY ENCLOSED BY '"' ESCAPED BY '"' LINES TERMINATED BY '\r\n' (`date`, `ask_open`, `ask_high`, `ask_low`, `ask_close`, `bid_open`, `bid_high`, `bid_low`, `bid_close`, `volume`, `sdl78_up`, `sdl78_down`, `sdl48_up`, `sdl48_down`, `obv`, `obvsdl_up`, `obvsdl_down`, `kvo345521_k`, `kvo345521_t`, `kvosdl_up`, `kvosdl_down`, `stochrsi8532_k_up`, `stochrsi8532_k_down`, `stochrsi8532_k_up2`, `stochrsi8532_d`, `stochrsi3332_k_up`, `stochrsi3332_k_down`, `stochrsi3332_k_up2`, `stochrsi3332_d`, `sdl10_up`, `sdl10_down`);
/* 8,348 rows imported in 0.218 seconds. */

drop table if exists obv55kvo;
create table obv55kvo
select
	date,
	ask_open,
	ask_high,
	ask_low,
	ask_close,
	bid_open,
	bid_high,
	bid_low,
	bid_close,
	volume,
	round(if(sdl78_up!=0,sdl78_up,sdl78_down),5) sdl78,
	round(if(sdl48_up!=0,sdl48_up,sdl48_down),5) sdl48,
	obv,
	round(if(obvsdl_up!=0,obvsdl_up,obvsdl_down),5) obvsdl,
	kvo345521_k,
	kvo345521_t,
	round(if(kvosdl_up!=0,kvosdl_up,kvosdl_down),5) kvosdl,
	round(if(stochrsi8532_k_up!=0,stochrsi8532_k_up,if(stochrsi8532_k_down!=0,stochrsi8532_k_down,stochrsi8532_k_up2)),5) stochrsi8532_k,
	stochrsi8532_d,
	round(if(stochrsi3332_k_up!=0,stochrsi3332_k_up,if(stochrsi3332_k_down!=0,stochrsi3332_k_down,stochrsi3332_k_up2)),5) stochrsi3332_k,
	stochrsi3332_d,
	round(if(sdl10_up!=0,sdl10_up,sdl10_down),5) sdl10
from obv55kvo_export
order by date
;

DELETE FROM `forex`.`obv55kvo` WHERE  `date`='0000-00-00 00:00:00' LIMIT 1;

DROP TABLE obv55kvo_export;
