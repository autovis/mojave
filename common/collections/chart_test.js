'use strict';

define(['underscore', 'objects/collection'], function(_, col) {

    var Indicator = col.Indicator;
    var Collection = col.Collection;
    var Config = col.Config;

    return {

        // Define collection input sources

        inputs: [
            {id: 2, type: 'dual_candle_bar', tf: '@htf', ds: '@source:@instrument:@htf:@chart.maxsize'},
            {id: 1, type: 'dual_candle_bar', tf: '@ltf', ds: '@source:@instrument:@ltf:@chart.maxsize'},
            {id: 0, type: 'tick', tf: 'T', ds: '@source:@instrument', subscribe: true}
        ],

        network: {

            // Input streams
            'ask':                   [0,                Indicator('stream:AskBar')],
            'bid':                   [0,                Indicator('stream:BidBar')],
            'm30':                   ['ask',            Indicator('tf:Candle2Candle'),                  Config({tf:'m30'})],

            // Indicator definitions
            'test':                   ['ask.close',     Indicator('test:EmbeddedIndicator', 10)],
            'atr':                    ['ask',           Indicator('ATR', 9)],
            'sdl_s':                  ['ask.close',     Indicator('SDL', 78)],
            'sdl_f':                  ['ask.close',     Indicator('SDL', 10)],
            'srsi_m':                 ['ask.close',     Indicator('StochRSI', 14, 14, 5, 3)],
            'srsi_f':                 ['ask.close',     Indicator('StochRSI', 3, 3, 3, 2)],
            'kvo':                    ['ask',           Indicator('KVO', 34, 55, 21)],
            'kvo_sdl':                ['kvo.KO',        Indicator('SDL', 13)],
            'obv':                    ['ask',           Indicator('OBV')],
            'ema':                    ['ask.close',     Indicator('EMA', 10)],
            'm30ema':                 ['m30.close',     Indicator('EMA', 10)],
            'm30obv':                 ['m30',           Indicator('OBV')],
            'm30sdl':                 ['m30.close',     Indicator('SDL', 10)],
            'obv_t':                  ['obv',           Indicator('SDL', 13)],
            'obv_sdl':                ['obv',           Indicator('SDL', 55)]

        }

    };

});
