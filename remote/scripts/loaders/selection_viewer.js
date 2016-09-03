'use strict';

requirejs(['lodash', 'async', 'd3', 'dataprovider', 'charting/scatterplot_matrix'],
    function(_, async, d3, dataprovider, ScatterplotMatrix) {

    var container = d3.select('#graph');
    var config = {
        selection_id: selection_id,
        data: []
    };
    var spmatrix;
    var dpclient = dataprovider.register('spmatrix:' + config.selection_id);

    async.series([
        cb => {
            var conn = dpclient.connect('get', {
                source: 'selection/' + config.selection_id
            });
            conn.on('data', payload => {
                if (!config.inputs) config.inputs = _.keys(payload.data.inputs);
                config.data.push(payload.data);
            });
            conn.on('end', cb);
            conn.on('error', cb);
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
