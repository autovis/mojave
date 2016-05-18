'use strict';

requirejs(['lodash', 'async', 'd3', 'svmjs', 'dataprovider', 'charting/scatterplot_matrix'],
    function(_, async, d3, svmjs, dataprovider, ScatterplotMatrix) {

    var container = d3.select('#graph');
    var config = {
        selection_id: selection_id,
        target: 'dir',
        data: [],
        model: 'svc_lin_dir',
        c_value: 100.0,
        rbfsigma: null
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
        // train model and tag data with predictions
        cb => {
            var features = _.map(config.data, d => {
                return _.map(config.inputs, inp => d.inputs[inp]);
            });
            var targets = _.map(config.data, d => {
                return d.tags[config.target];
            });
            var trainer = get_trainer();
            trainer.train(features, targets);
            var predictions = trainer.predict(features);
            for (var i = 0; i <= targets.length - 1; i++) {
                config.data[i].predict = predictions[i];
                config.data[i].outlier = targets[i] !== predictions[i];
            }
            cb();
        },
        // render spmatrix
        cb => {
            spmatrix.render();
            cb();
        }
    ], err => {
        if (err) throw err;
    });

    /////////////////////////////////////////////////////////////////////////////////////

    function get_trainer() {
        var trainer, svm, long_svm, short_svm;
        switch (config.model) {
            case 'svc_lin_bool':
            case 'svc_rbf_bool':
                svm = new svmjs.SVM();
                trainer = {
                    train: function(feats, targets) {
                        var opts = {
                            kernel: (config.model === 'svc_rbf_bool' ? 'rbf' : 'linear'),
                            C: config.c_value,
                            rbfsigma: config.rbfsigma
                        };
                        svm.train(feats, _.map(targets, d => d ? 1 : 0), opts);
                    },
                    predict: function(data) {
                        return _.map(svm.predict(data), d => d !== -1);
                    },
                    toJSON: function() {
                        return {model: config.model, svm: svm.toJSON()};
                    }
                };
                break;
            case 'svc_lin_dir':
            case 'svc_rbf_dir':
                long_svm = new svmjs.SVM();
                short_svm = new svmjs.SVM();
                trainer = {
                    train: function(feats, targets) {
                        var opts = {
                            kernel: (config.model === 'svc_rbf_dir' ? 'rbf' : 'linear'),
                            C: config.c_value,
                            rbfsigma: config.rbfsigma
                        };
                        long_svm.train(feats, _.map(targets, d => d === 1), opts);
                        short_svm.train(feats, _.map(targets, d => d === -1), opts);
                    },
                    predict: function(data) {
                        var long_vals = long_svm.predict(data);
                        var short_vals = short_svm.predict(data);
                        return _.map(_.zip(long_vals, short_vals), p => {
                            if (p[0] === 1 && p[1] !== 1) {
                                return 1;
                            } else if (p[1] === 1 && p[0] !== 1) {
                                return -1;
                            } else {
                                return 0;
                            }
                        });
                    },
                    toJSON: function() {
                        return {
                            model: config.model,
                            long_svm: long_svm.toJSON(),
                            short_svm: short_svm.toJSON()
                        };
                    }
                };
                break;
            default:
                throw new Error('Unrecognized model: ' + config.model);
        }
        if (trainer) return trainer;
    }

});
