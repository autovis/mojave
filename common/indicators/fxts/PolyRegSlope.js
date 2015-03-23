define(['underscore', 'simple_statistics', 'sylvester'], function(_, ss, syl) {

    return {

        param_names: ["period", "power"],

        input: 'num',
        output: 'num',

        initialize: function(params) {
            //this.range = _.range(0, params.period).reverse();
        },

        on_bar_update: function(params, input_streams, output) {

            var input = input_streams[0];

            if (this.current_index() >= params.period-1) {

                var i,j;
                var sumxvalue = {};
                var sumyvalue = {};
                var constant = {};
                var matrix = Array(params.power+1);
                var pos = this.current_index() - params.period + 1;
                var start, end;

                for (i=0;i<=params.power+1;i++) {
                    sumyvalue[i] = 0;
                    constant[i] = 0;
                    matrix[i] = Array(params.power+1);    
                    for (j=0;j<=params.power+1;j++) {
                        matrix[i][j] = 0;    
                    }
                }

                for (i=0;i<=2*params.power+1;i++) {
                    sumxvalue[i] = 0;    
                }
                sumxvalue[0] = params.period;

                var exp;
                for (exp=1;exp<=2*params.power;exp++) {
                    var sumx = 0;
                    var sumy = 0;
                    var k;
                    
                    for (k=1;k<=params.period;k++) {
                        sumx += Math.pow(k,exp);
                        if (exp==1) {
                            sumy += input.get_index(pos+k-1);    
                        } else if (exp <= params.power+1) {
                            sumy += input.get_index(pos+k-1)*Math.pow(k,exp-1);
                        }
                    }
                    sumxvalue[exp] = sumx;
                    if (sumy != 0) {
                        sumyvalue[exp-1] = sumy;    
                    }
                }

                var row;
                var col;

                for (row=0; row<=params.power; row++) {
                    for (col=0; col<=params.power; col++) {
                        matrix[row][col] = sumxvalue[row+col];
                    }
                }

                var initialRow = 1;
                var initialCol = 1;

                for (i=1;i<=params.power;i++) {
                    for (row=initialRow; row <= params.power; row++) {
                        sumyvalue[row] -= (matrix[row][i-1] / matrix[i-1][i-1]) * sumyvalue[i-1];
                        for (col = initialCol; col <= params.power; col++) {
                            matrix[row][col]  -= (matrix[row][i-1] / matrix[i-1][i-1]) * matrix[i-1][col];
                        }
                    }
                    initialCol++;
                    initialRow++;
                }

                j = 0;
                for (i = params.power; i >= 0; i--) {
                    if (j==0) {
                        constant[i] = sumyvalue[i] / matrix[i][i];    
                    } else {
                        var sum = 0;
                        var k;
                        for (k = j; k >= 1; k--) {
                            sum += constant[i+k] * matrix[i][i+k];    
                        }    
                        constant[i] = (sumyvalue[i] - sum) / matrix[i][i];
                    }
                    j++;
                }

                k = 1;
                for (i=this.current_index()-params.period+1; i<=this.current_index(); i++) {
                    sum = 0;
                    for (j = 0; j <= params.power; j++) {
                        sum += constant[j] * Math.pow(k,j);    
                    }
                    if (i == this.current_index()-params.period+1) {
                        start = sum;
                    }
                    k++;
                }
                end = sum;

                output.set(end - start);
            } else {
                output.set(null);
            }
        }
    }
})
