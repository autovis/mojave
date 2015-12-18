define(['lodash', 'jsep'], function(_, jsep) {

    return {

        param_names: ['inputs', 'expression',],

        input: ['num+'],
        output: 'num',

        initialize: function(params, input_streams, output) {
            this.expr = jsep(params.expression);
            if (this.expr === null) throw new Error("Invalid expression: "+params.expression);
        },

        on_bar_update: function(params, input_streams, output) {

            var func = get_functions();
            var context = _.object(_.map(_.zip(params.inputs, input_streams), function(pair) {return [pair[0], {type:"stream", val:pair[1]}]}));

            output.set(evaluate(this.expr));

            function evaluate(node) {
                if (node.type == 'Literal') {
                    return node.value;
                } else if (node.type == 'Identifier') {
                    if (_.has(context, node.name)) {
                        var iden = context[node.name];
                        if (iden.type == 'stream') {
                            return iden.val.get(0);
                        }
                    } else {
                        throw new Error("Unknown identifier: "+node.name);
                    }
                } else if (node.type == 'BinaryExpression') {
                    if (node.operator == '+') {
                        return evaluate(node.left) + evaluate(node.right);
                    } else if (node.operator == '-') {
                        return evaluate(node.left) + evaluate(node.right);
                    } else if (node.operator == '*') {
                        return evaluate(node.left) * evaluate(node.right);
                    } else if (node.operator == '/') {
                        return evaluate(node.left) / evaluate(node.right);
                    } else if (node.operator == '^') {
                        return Math.pow(evaluate(node.left),evaluate(node.right));
                    } else if (node.operator == '&') {
                        return evaluate(node.left) & evaluate(node.right);
                    } else if (node.operator == '|') {
                        return evaluate(node.left) | evaluate(node.right);
                    } else if (node.operator == '%') {
                        return evaluate(node.left) % evaluate(node.right);
                    }
                } else if (node.type == 'LogicalExpression') {
                    if (node.operator == '&&') {
                        return evaluate(node.left) && evaluate(node.right);
                    } else if (node.operator == '||') {
                        return evaluate(node.left) || evaluate(node.right);
                    }
                } else if (node.type == 'CallExpression') {
                    if (node.callee && node.callee.type == 'Identifier') {
                        if (_.has(func, node.callee.name)) {
                            var args = _.map(node.arguments, function(arg) {return eval(arg)});
                            return func[node.callee.name].apply(this.context, args);
                        } else if (_.has(context, node.name)) {
                            var iden = context[node.name];
                            if (iden.type == 'stream') {
                                return iden.val.get(node.arguments[0]);
                            }
                        }
                    }
                }
            }

            function get_functions() {
                return {
                    'sqrt': function(x) {return Math.sqrt(x)}
                }
            }
        }
    };

})
