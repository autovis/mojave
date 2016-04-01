'use strict';

requirejs(['lodash', 'async', 'd3', 'dataprovider', 'charting/scatterplot_matrix'],
    function(_, async, d3, dataprovider, ScatterplotMatrix) {

    var container = d3.select('#graph');
    var config = {
        selection_id: selection_id,
        inputs: ['var1', 'var2', 'var3']
    };
    var spmatrix;
    var dpclient = dataprovider.register('spmatrix:' + config.selection_id);

    async.series([
        cb => {
            config.data = [];
            /*
            var conn = dpclient.connect('get', {
                source: 'selection/' + config.selection_id
            });
            conn.on('data', rec => {
                config.data.push(rec);
            });
            conn.on('end', cb);
            conn.on('error', cb);
            */
            config.data.push({var1: 4.5, var2: 6.7, var3: 1.3});
            config.data.push({var1: 1.5, var2: 9.7, var3: 7.3});
            config.data.push({var1: 8.5, var2: 3.7, var3: 4.3});
            cb();
        },
        cb => {
            spmatrix = new ScatterplotMatrix(container, config);
            spmatrix.init();
            cb();
        },
        cb => {
            spmatrix.render();
            cb();
        }
    ], err => {
        if (err) throw err;
    });
});
