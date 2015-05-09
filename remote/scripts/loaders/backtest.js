
requirejs(['socketio','underscore','async','d3', 'stream','indicator_collection'],
    function(io, _, async, d3, Stream) {

    var socket = io();

    d3.select('#backtest').text("Backtest stuff goes here");

}); // requirejs
