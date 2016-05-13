'use strict';

// JSONOC - JSON with Object Constructors

define(['lodash', 'jsonoc_schema', 'jsonoc_tools'], function(_, schema, jt) {

    var jsonoc = {
        get_schema: get_schema,
        get_parser: get_parser,
        stringify: stringify,
        instance_of: jt.instance_of
    };

    /////////////////////////////////////////////////////////////////////////////////////

    // Base constructor from which all object constructors extend
    function Base() {
    }

    // Set "_" to be base constructor
    schema._ = Base;

    Base.prototype._stringify = function(stringify) {
        var values = _.map(_.filter(_.toPairs(this), pair => _.head(pair[0]) !== '_'), p => p[1]);
        return _.last(this._path) + '(' + values.map(stringify).join(', ') + ')';
    };

    // ----------------------------------------------------------------------------------

    function get_key_value(context, path) {
        return _.reduce(path, function(memo, tok) {
            if (!_.has(memo, tok)) throw new Error('Token "' + tok + '" not found in path string: ' + path.join('.'));
            return memo[tok];
        }, context);
    }

    var dep_edges = [];

    // Create array of edges for dependency graph
    function create_dep_edges(context, path) {
        context = context || schema;
        path = path || [];
        _.each(context, function(val, key) {
            var newpath = path.concat(key);
            if (_.head(key) >= 'A' && _.head(key) <= 'Z') {
                if (_.isFunction(val)) {
                    dep_edges.push(['_', newpath.join('.'), 'extends']);
                } else if (_.isString(val) && _.head(val) === '@') {
                    dep_edges.push([val.slice(1), newpath.join('.'), 'extends']);
                } else if (_.isArray(val)) {
                    if (!_.isFunction(val[0])) throw new Error('First element of array must be a function');
                    if (val[1] && !_.isObject(val[1])) throw new Error('Second element of array must be an object');
                    var options = val[1] || {};
                    if (options.extends) {
                        dep_edges.push([options.extends, newpath.join('.'), 'extends']);
                        // link contexts as well
                        var ext_path = options.extends.split('.');
                        var ext_ctx = _.initial(ext_path).concat('$' + _.last(ext_path)).join('.');
                        dep_edges.push([ext_ctx, path.concat('$' + key).join('.'), 'extends']);
                    } else {
                        dep_edges.push(['_', newpath.join('.'), 'extends']);
                    }
                    if (options.pre) {
                        var pres = _.isArray(options.pre) ? options.pre : [options.pre];
                        _.each(pres, pre => dep_edges.push([pre, newpath.join('.'), 'pre']));
                    }
                    if (options.post) {
                        var posts = _.isArray(options.post) ? options.post : [options.post];
                        _.each(posts, post => dep_edges.push([post, newpath.join('.'), 'post']));
                    }
                } else {
                    throw new Error('Unexpected format for schema key: ' + newpath.join('.'));
                }
            } else if (_.head(key) >= 'a' && _.head(key) <= 'z') {
                if (_.isString(val)) {
                    if (_.head(val) !== '@') {
                        throw new Error('Unexpected string value for "' + path.concat(key).join('.') + '": ' + val);
                    }
                } else if (_.isObject(val)) {
                    create_dep_edges(context[key], path.concat(key));
                } else {
                    throw new Error('Value for "' + path.concat(key).join('.') + "' path must be an object");
                }
            } else if (_.head(key) === '$') {
                if (_.isObject(val)) {
                    if (context.$_ && !_.includes(path.concat(key), '$_')) {
                        _.each(context.$_, function(v, k) {
                            if (k === key || _.head(k) === '$') return;
                            if (_.isFunction(v) || _.isArray(v)) {
                                val[k] = v;
                            } else {
                                val[k] = _.clone(v);
                            }
                        });
                        val.$_ = _.assign({}, context.$_, val.$_);
                     }
                    _.each(_.filter(_.keys(val), function(subkey) {
                        return subkey !== '_' && _.head(subkey) !== '$';
                    }), function(subkey) {
                        dep_edges.push([newpath.concat(subkey).join('.'), newpath.join('.'), 'contained']);
                    });
                    create_dep_edges(context[key], path.concat(key));
                } else {
                    throw new Error('Value for "' + newpath.join('.') + "' subcontext must be an object");
                }
            } else if (key === '_' || _.head(key) === '@') {
                // Do nothing
            } else {
                throw new Error('Unexpected format for schema key: ' + path.concat(key).join('.'));
            }
        });
    }

    create_dep_edges();

    var dep_topo_sorted = toposort(dep_edges); // Get array of topologically sorted items
    var dep_topo_sorted_inv = _.invert(dep_topo_sorted);

    var dep_edges_sorted = _.sortBy(dep_edges, edge => dep_topo_sorted_inv[edge[0]]);

    var ext_edges_sorted = _.map(_.filter(dep_edges_sorted, function(edge) {
        return edge[0] !== '_' && edge[2] === 'extends';
    }), function(edge) {
        return [edge[0], edge[1]];
    });

    // Initialize schema
    _.each(dep_topo_sorted, function(pathstr) {
        var ref, constr, ances, path, context, key, val;
        try {
            path = pathstr.split('.');
            context = get_key_value(schema, _.initial(path));
            key = _.last(path);
            val = get_key_value(schema, path);
        } catch (e) {}
        if (_.head(key) === '@') { // meta-methods
            // do nothing
        } else if (_.isFunction(val)) {
            context[key] = [get_wrapped_constr(val, path, context, {}), {}, val];
            val.prototype = _.create(Base.prototype, {'_super': Base.prototype, 'constructor': val});
            val.prototype._path = path;
        } else if (_.isArray(val)) {
            constr = _.isFunction(val[2]) ? val[2] : val[0];
            var options = val[1] || {};
            if (options.extends) {
                var parent = get_key_value(schema, options.extends.split('.'))[2];
                constr.prototype = _.create(parent.prototype, {'_super': parent.prototype, 'constructor': constr});
            } else {
                constr.prototype = _.create(Base.prototype, {'_super': Base.prototype, 'constructor': constr});
            }
            constr.prototype._path = path;
            context[key] = [get_wrapped_constr(constr, path, context, options), options, constr];
        } else if (_.head(key) === '$') {
            var constr_context = context[key] || {};
            ances = get_ancestors(pathstr);
            _.each(ances, function(ans) {
                try {
                    var ans_context = get_key_value(schema, ans.split('.'));
                    _.each(ans_context, function(val, key) {
                        if (!_.has(constr_context, key)) constr_context[key] = val;
                    });
                    context[key] = constr_context;
                } catch (e) {}
            });
        } else if (_.head(key) >= 'a' && _.head(key) <= 'z') {
            if (_.isString(val) && _.head(val) === '@') {
                ref = val.slice(1);
                try {
                    var ref_context = get_key_value(schema, ref.split('.'));
                    context[key] = _.clone(ref_context);
                } catch (e) {
                    throw new Error('Reference not found: ' + ref);
                }
            }
        // string references
        } else if (_.isString(val) && _.head(val) === '@') {
            var ref_path = val.slice(1).split('.');
            ref = get_key_value(schema, ref_path)[2];
            constr = function() {}; // empty function for constructor
            constr.prototype = _.create(ref.prototype, {'_super': ref.prototype, 'constructor': constr});
            constr.prototype._path = path;
            context[key] = [get_wrapped_constr(constr, path, context, {extends: val.slice(1)}), {extends: val.slice(1)}, constr];
            try {
                var ref_ctx = get_key_value(schema, _.initial(ref_path).concat('$' + _.last(ref_path)));
                context['$' + key] = ref_ctx;
            } catch (e) {}
            // collect descendants that are within the same context of current item or any of its ancestors
            var descs = get_descendants(ref_path.join('.'));
            ances = get_ancestors(ref_path.join('.')).concat(ref_path);
            _.each(ances, function(ans) {
                var ans_path = ans.split('.');
                _.each(descs, function(desc) {
                    var desc_path = desc.split('.');
                    if (_.initial(ans_path).join('.') === _.initial(desc_path).join('.') && _.last(ans_path) !== _.last(desc_path)) {
                        if (!_.has(context, desc)) context[desc] = get_key_value(schema, desc_path);
                    };
                });
            });
        } else {
            throw new Error('Unexpected type found while initializing "' + pathstr + '" in schema: ' + JSON.stringify(val));
        }
    });

    function get_ancestors(pathstr) {
        var ances = {};
        ances[pathstr] = true;
        _.each(ext_edges_sorted, function(edge) {
            if (_.has(ances, edge[1])) ances[edge[0]] = true;
        });
        return _.drop(_.keys(ances));
    }

    function get_descendants(pathstr) {
        var descs = {};
        descs[pathstr] = true;
        _.each(ext_edges_sorted, function(edge) {
            if (_.has(descs, edge[0])) descs[edge[1]] = true;
        });
        return _.drop(_.keys(descs));
    }

    // Wrap and return real constructor in order to do pre and post processing based on the options
    function get_wrapped_constr(constr, path, context, options) {
        var ances = _.map(get_ancestors(path.join('.')), function(ans) {
            var val = get_key_value(schema, ans.split('.'));
            val = _.isArray(val) ? val[0] : val;
            return val;
        });
        var wrapper = function() {
            var obj = this;
            var args = arguments;
            Base.apply(obj, args); // Apply base constructor
            if (options.pre) {
                var pres = _.isArray(options.pre) ? options.pre : [options.pre];
                _.each(pres, function(pre) {
                    var val = get_key_value(schema, pre.split('.'));
                    var pre_constr = _.isArray(val) ? (val[2] || val[0]) : val;
                    pre_constr.apply(obj, args);
                });
            }
            // Apply constructors of any ancestors in order
            var retval;
            for (var i = 0; i <= ances.length - 1; i++) {
                retval = ances[i].apply(obj, args);
                if (_.isObject(retval) && retval !== obj) return retval;
            }
            retval = constr.apply(obj, args);
            if (_.isObject(retval) && retval !== obj) return retval;
            if (options.post) {
                var posts = _.isArray(options.post) ? options.post : [options.post];
                _.each(posts, function(post) {
                    var val = get_key_value(schema, post.split('.'));
                    var post_constr = _.isArray(val) ? (val[2] || val[0]) : val;
                    post_constr.apply(obj, args);
                });
            }
            obj._args = args;
            return obj;
        };

        return wrapper;
    }

    /////////////////////////////////////////////////////////////////////////////////////

    function get_schema() {
        return schema;
    }

    function get_parser(config, path) {
        var context;
        if (path) {
            context = path.split('.').reduce(function(memo, ctx) {
                if (!_.has(memo, ctx)) throw new Error('Invalid schema path: ' + path);
                return memo[ctx];
            }, schema);
            if (schema._ && context !== schema) context._ = schema._;
        } else {
            context = schema;
        }
        return get_jsonoc_parser(config, context);
    }

    function stringify(jsnc) {
        if (jt.instance_of(jsnc, '_')) {
            return jsnc._stringify(stringify);
        } else if (_.isArray(jsnc)) {
            return '[' + jsnc.map(stringify).join(', ') + ']';
        } else if (_.isObject(jsnc)) {
            var obj = _.toPairs(jsnc).filter(p => _.head(p[0]) !== '_');
            return '{' + obj.map(p => JSON.stringify(p[0]) + ': ' + stringify(p[1])).join(', ') + '}';
        } else {
            return JSON.stringify(jsnc);
        }
    }

    return jsonoc;

    /////////////////////////////////////////////////////////////////////////////////////////

    // Modified version of Douglas Crockford's json_parse function to support jsonoc syntax:
    // https://github.com/douglascrockford/JSON-js/blob/master/json_parse.js

    // - support for nested object constructors that adhere to a schema
    // - allow for // and /* */ style comments
    // - allow quoteless keys in object literals
    // - improved error reporting

    function get_jsonoc_parser(config, context) {

        var parser_config = config || {};
        var ctxstack = [context || {}];
        var line = 1;
        var col = 1;

        var at,     // The index of the current character
            ch,     // The current character
            escapee = {
                '"': '"',
                '\\': '\\',
                '/': '/',
                b: '\b',
                f: '\f',
                n: '\n',
                r: '\r',
                t: '\t'
            },
            text,

            error = function (m) {
                throw {
                    name: 'SyntaxError',
                    message: m,
                    at: at,
                    text: text
                };
            },

            next = function (c) {
                if (c && c !== ch) {
                    error("Expected '" + c + "' instead of '" + ch + "' at " + line + ':' + col);
                }
                ch = text.charAt(at);
                at += 1;
                col += 1;
                return ch;
            },

            newline = function () {
                next('\n');
                line += 1;
                col = 1;
            },

            number = function () {

                var number,
                    string = '';

                if (ch === '-') {
                    string = '-';
                    next('-');
                }
                while (ch >= '0' && ch <= '9') {
                    string += ch;
                    next();
                }
                if (ch === '.') {
                    string += '.';
                    while (next() && ch >= '0' && ch <= '9') {
                        string += ch;
                    }
                }
                if (ch === 'e' || ch === 'E') {
                    string += ch;
                    next();
                    if (ch === '-' || ch === '+') {
                        string += ch;
                        next();
                    }
                    while (ch >= '0' && ch <= '9') {
                        string += ch;
                        next();
                    }
                }
                number = +string;
                if (!isFinite(number)) {
                    error('Bad number at ' + line + ':' + col);
                } else {
                    return number;
                }
            },

            string = function () {

                var hex,
                    i,
                    string = '',
                    uffff;

                if (ch === '"') {
                    while (next()) {
                        if (ch === '"') {
                            next();
                            return string;
                        }
                        if (ch === '\\') {
                            next();
                            if (ch === 'u') {
                                uffff = 0;
                                for (i = 0; i < 4; i += 1) {
                                    hex = parseInt(next(), 16);
                                    if (!isFinite(hex)) {
                                        break;
                                    }
                                    uffff = uffff * 16 + hex;
                                }
                                string += String.fromCharCode(uffff);
                            } else if (typeof escapee[ch] === 'string') {
                                string += escapee[ch];
                            } else {
                                break;
                            }
                        } else if (ch === '\n') {
                            newline();
                            string += ch;
                        } else {
                            string += ch;
                        }
                    }
                } else if (ch === '`') {
                    while (next()) {
                        if (ch === '`') {
                            next();
                            return string;
                        }
                        if (ch === '\\') {
                            next();
                            if (ch === 'u') {
                                uffff = 0;
                                for (i = 0; i < 4; i += 1) {
                                    hex = parseInt(next(), 16);
                                    if (!isFinite(hex)) {
                                        break;
                                    }
                                    uffff = uffff * 16 + hex;
                                }
                                string += String.fromCharCode(uffff);
                            } else if (typeof escapee[ch] === 'string') {
                                string += escapee[ch];
                            } else {
                                break;
                            }
                        } else if (ch === '\n') {
                            newline();
                            string += ch;
                        } else {
                            string += ch;
                        }
                    }
                }
                error('Bad string at ' + line + ':' + col);
            },

            white = function () {

                while (ch && ch <= ' ') {
                    ch === '\n' ? newline() : next();
                }
                // support comments
                if (ch === '/') {
                    var firstcol = col;
                    next('/');
                    if (ch === '*') {
                        next('*');
                        while (ch) {
                            if (ch === '*') {
                                next('*');
                                if (ch === '/') {
                                    next('/');
                                    break;
                                }
                            } else if (ch === '\n') {
                                newline();
                            } else {
                                next();
                            }
                        }
                    } else if (ch === '/') {
                        next('/');
                        while (ch && ch !== '\n') {
                            next();
                        }
                        newline();
                    } else {
                        error('Unexpected token: "/' + ch + '" at ' + line + ':' + firstcol);
                    }
                    white();
                }
            },

            value,  // Place holder for the value function.

            params = function () {

                var result = [];
                next('(');
                white();
                if (ch === ')') {
                    next(')');
                    return [];
                }
                result.push(value());
                white();
                while (ch && ch === ',') {
                    next(',');
                    white();
                    result.push(value());
                    white();
                }
                next();

                return result;
            },

            word = function () {

                var path = [];
                var first = true;
                var startline = line;
                var startcol = col;
                var current = ctxstack[ctxstack.length - 1];
                var wordstr;

                while (ch) {
                    wordstr = '';
                    while (ch >= 'a' && ch <= 'z' || ch >= 'A' && ch <= 'Z' || ch === '$' || ch === '_' || ch >= '0' && ch <= '9') {
                        wordstr += ch;
                        next();
                    }
                    if (first) {
                        // check special keywords
                        if (wordstr === 'true') {
                            return true;
                        } else if (wordstr === 'false') {
                            return false;
                        } else if (wordstr === 'null') {
                            return null;
                        }
                    }
                    if (current.hasOwnProperty(wordstr)) {
                        current = current[wordstr];
                        path.push(wordstr);
                    } else {
                        error('Undefined token "' + path.concat(wordstr).join('.') + '" at ' + line + ':' + startcol);
                    }
                    white();
                    if (ch === '.') {
                        next('.');
                        white();
                    } else {
                        break;
                    }
                    first = false;
                }

                if (ch === '(') {
                    var constr, options;
                    if (_.isArray(current)) {
                        constr = current[2] || current[0];
                        options = current[1] || {};
                        current = current[0];
                    } else {
                        constr = current;
                        options = {};
                    }
                    if (options.virtual) error('Cannot instantiate virtual constructor: ' + wordstr);
                    if (_.isFunction(current)) {
                        var wrapped_constr = current;
                        var args, obj;
                        if (_.has(_.last(ctxstack), '$' + wordstr)) { // if constructor has a context defined, use it
                            ctxstack.push(_.last(ctxstack)['$' + wordstr]);
                            args = params();
                            ctxstack.pop();
                        } else {
                            args = params();
                        }
                        try {
                            obj = _.create(constr.prototype);
                            obj = wrapped_constr.apply(obj, args);
                        } catch (e) {
                            error('Error while calling constructor "' + path.join('.') + '" at ' + startline + ':' + startcol + ' -- ' + e.message + '\n' + e.stack);
                        }
                        return obj;
                    } else {
                        error('Token "' + path.join('.') + '" is used as a constructor at ' + startline + ':' + startcol + ', but is not a function in the schema: ' + JSON.stringify(current));
                    }
                    path.push(params());
                }
                return current;
            },

            objkey = function() {
                if (ch === '"' || ch === '`') {
                    return string();
                } else if (ch >= 'a' && ch <= 'z' || ch >= 'A' && ch <= 'Z' || ch === '$' || ch === '_') {
                    var wordstr = ch;
                    next();
                    while (ch >= 'a' && ch <= 'z' || ch >= 'A' && ch <= 'Z' || ch === '$' || ch === '_' || ch >= '0' && ch <= '9') {
                        wordstr += ch;
                        next();
                    }
                    return wordstr;
                } else if (ch >= '0' && ch <= '9' || ch === '.') {
                    return number();
                } else {
                    error('Unexpected character "' + ch + '" for object key at ' + line + ':' + col);
                }
            },

            array = function () {

                var array = [];

                if (ch === '[') {
                    next('[');
                    white();
                    if (ch === ']') {
                        next(']');
                        return array;   // empty array
                    }
                    while (ch) {
                        array.push(value());
                        white();
                        if (ch === ']') {
                            next(']');
                            return array;
                        }
                        next(',');
                        white();
                    }
                }
                error('Bad array at ' + line + ':' + col);
            },

            object = function () {

                var key,
                    object = {};

                if (ch === '{') {
                    next('{');
                    white();
                    if (ch === '}') {
                        next('}');
                        return object;   // empty object
                    }
                    while (ch) {
                        key = objkey();
                        white();
                        next(':');
                        if (Object.hasOwnProperty.call(object, key)) {
                            error('Duplicate key "' + key + '" at ' + line + ':' + col);
                        }
                        object[key] = value();
                        white();
                        if (ch === '}') {
                            next('}');
                            return object;
                        }
                        next(',');
                        white();
                    }
                }
                error('Bad object at ' + line + ':' + col);
            };

        value = function () {

    // Parse a JSONOC value. It could be an object, an array, a string, a number,
    // a word or an object constructor.

            white();
            if (ch === '{') {
                return object();
            } else if (ch === '[') {
                return array();
            } else if (ch === '"' || ch === '`') {
                return string();
            } else if (ch === '-') {
                return number();
            } else if (ch >= 'a' && ch <= 'z' || ch >= 'A' && ch <= 'Z' || ch === '$' || ch === '_') {
                return word();
            } else if (ch >= '0' && ch <= '9') {
                return number();
            } else {
                error('Unexpected character "' + ch + '" at ' + line + ':' + col);
            }
        };

    // Return the jsonoc_parse function. It will have access to all of the above
    // functions and variables.

        return function (source, reviver) {
            var result;

            // Prepare schema's config
            if (_.isFunction(schema['@setConfig'])) schema['@setConfig'](parser_config);

            text = source;
            at = 0;
            ch = ' ';
            result = value();
            white();
            if (ch) {
                error('Unexpected character "' + ch + '" at ' + line + ':' + col);
            }

    // If there is a reviver function, we recursively walk the new structure,
    // passing each name/value pair to the reviver function for possible
    // transformation, starting with a temporary root object that holds the result
    // in an empty key. If there is not a reviver function, we simply return the
    // result.

            return typeof reviver === 'function'
                ? (function walk(holder, key) {
                    var k, v, value = holder[key];
                    if (value && typeof value === 'object') {
                        for (k in value) {
                            if (Object.prototype.hasOwnProperty.call(value, k)) {
                                v = walk(value, k);
                                if (v !== undefined) {
                                    value[k] = v;
                                } else {
                                    delete value[k];
                                }
                            }
                        }
                    }
                    return reviver.call(holder, key, value);
                })({'': result}, '')
                : result;
        };

    }

    // Source: https://gist.github.com/shinout/1232505
    function toposort(edges) {
        var nodes   = {}, // hash: stringified id of the node => { id: id, afters: lisf of ids }
            sorted  = [], // sorted list of IDs ( returned value )
            visited = {}; // hash: id of already visited node => true

        var Node = function(id) {
            this.id = id;
            this.afters = [];
        };

        // 1. build data structures
        edges.forEach(function(v) {
            var from = v[0], to = v[1];
            if (!nodes[from]) nodes[from] = new Node(from);
            if (!nodes[to]) nodes[to]     = new Node(to);
            nodes[from].afters.push(to);
        });

        // 2. topological sort
        Object.keys(nodes).forEach(function visit(idstr, ancestors) {
            var node = nodes[idstr],
                id   = node.id;

            // if already exists, do nothing
            if (visited[idstr]) return;

            if (!Array.isArray(ancestors)) ancestors = [];

            ancestors.push(id);

            visited[idstr] = true;

            node.afters.forEach(function(afterID) {
                // if already in ancestors, a closed chain exists.
                if (ancestors.indexOf(afterID) >= 0) throw new Error('closed chain : ' +  afterID + ' is in ' + id);

                visit(afterID.toString(), ancestors.map(v => v)); // recursive call
            });

            sorted.unshift(id);
        });

        return sorted;
    }

});

