'use strict';

// JSONOC - JSON with Object Constructors

define(['lodash', 'jsonoc_schema', 'jsonoc_tools'], function(_, schema, jt) {

    var jsonoc = {
        load: load,
        get_schema: get_schema,
        get_parser: get_parser,
        stringify: stringify
    };

    /////////////////////////////////////////////////////////////////////////////////////

    // Base constructor from which all object constructors extend
    function Constructor() {
    }

    // Set "_" to be base constructor
    schema._ = Constructor;

    Constructor.prototype._stringify = function(stringify) {
        var values = _.map(_.filter(_.pairs(this), function(pair) {
            return _.first(pair[0]) !== '_';
        }), function(p) {return p[1]});
        return _.last(this._path) + '(' + values.map(stringify).join(', ') + ')';
    }

    // ----------------------------------------------------------------------------------

    function get_key_value(context, key) {
        return _.reduce(key.split('.'), function(memo, tok) {
            if (!_.has(memo, tok)) throw new Error('Token "' + tok + '" not found in path string: ' + key);
            return memo[tok];
        }, context);
    }

    var inheritance_hierarchy = {_: [Constructor, {}]};

    // Add path to inheritance hierarchy
    function inheritance_hierarchy_add(path, constr, options) {
        console.log('-------', path);
        var inheritance_path = [];
        //while (_.isArray(item) && _.isObject(item[1]) && _.isString(item[1].extends)) {
        while (_.isObject(options) && _.isString(options.extends)) {
            inheritance_path.push([path.join('.'), constr]);
            path = options.extends.split('.');
            var arr = get_key_value(schema, options.extends);
            constr = _.isArray(arr) ? (arr[2] || arr[0]) : arr;
            options = _.isArray(arr) ? (arr[1] || {}) : {};
        }
        inheritance_path.push([path.join('.'), constr], ['_', Constructor]);
        // Apply path to hierarchy
        _.reduce(inheritance_path.reverse(), function(memo, item) {
            var pathstr = item[0];
            var constr = item[1];
            console.log('[[[', constr, ']]]]');

            if (_.has(memo, pathstr)) {
                return memo[pathstr][1];
            } else {
                memo[pathstr] = [constr, {}];
                return memo[pathstr][1];
            }
        }, inheritance_hierarchy);
    }

    /////////////////////////////////////////////////////////////////////////////////////

    // Initialize schema by following references and creating uniform structure, create inheritance hierarchy,
    // and validate schema definition
    function schema_init(ctxstack, path) {
        ctxstack = _.isArray(ctxstack) ? ctxstack : [schema];
        path = path || [];
        var context = _.last(ctxstack);
        _.each(context, function(val, key) {
            if (_.first(key) >= 'A' && _.first(key) <= 'Z' || key === '_') {
                if (_.isFunction(val)) {
                    context[key] = [get_wrapped_constr(val, path.concat(key), context, {}), {}, val];
                    inheritance_hierarchy_add(path.concat(key), val, {});
                } else if (_.isString(val) && _.first(val) === '@') {
                    var constr = get_key_value(schema, val.slice(1));
                    constr = _.isArray(constr) ? (_.isFunction(constr[2]) ? constr[2] : constr[0]) : constr;
                    context[key] = [get_wrapped_constr(constr, path.concat(key), context, {}), {}, constr];
                    inheritance_hierarchy_add(path.concat(key), constr, {});
                } else if (val === true) {
                    var base_context = _.reduce(_.initial(ctxstack), function(memo, ctx) {
                        return _.has(ctx, key) ? ctx : memo;
                    }, null);
                    if (base_context === null) throw new Error('Base constructor not found for: ' + path.concat(key).join('.'));
                    var val = base_context[key];
                    var constr = _.isArray(val) ? (_.isFunction(val[2]) ? val[2] : val[0]) : val;
                    context[key] = [get_wrapped_constr(constr, path.concat(key), context, {}), {}, constr];
                    if (_.has(base_context, '$' + key)) context['$' + key] = base_context['$' + key];
                    inheritance_hierarchy_add(path.concat(key), constr, {});
                } else if (_.isArray(val)) {
                    if (!_.isFunction(val[0])) throw new Error('First element of array must be a function');
                    if (!_.isObject(val[1])) throw new Error('Second element of array must be an object');
                    var constr = _.isArray(val) ? (_.isFunction(val[2]) ? val[2] : val[0]) : val;
                    context[key] = [get_wrapped_constr(constr, path.concat(key), context, val[1]), val[1], constr];
                    inheritance_hierarchy_add(path.concat(key), constr, val[1]);
                } else {
                    throw new Error('Unexpected format for schema key: ' + path.concat(key).join('.'));
                }
            } else if (_.first(key) >= 'a' && _.first(key) <= 'z') {
                if (_.isObject(val)) {
                    schema_init(ctxstack.concat(val), path.concat(key));
                } else {
                    throw new Error('Value for "' + path.concat(key).join('.') + "' path must be an object");
                }
            } else if (_.first(key) === '$') {
                if (_.isObject(val)) {
                    if (context.$ && key !== '$') {
                        if (!_.has(val, '$') || !_.isObject(val.$)) val.$ = {};
                        val.$ = _.assign(context.$, val.$);
                        _.each(val.$, function(v, k) {
                            if (!_.has(val, k)) val[k] = v;
                        });
                    }
                    schema_init(ctxstack.concat(val), path.concat(key));
                } else {
                    throw new Error('Value for "' + path.concat(key).join('.') + "' subcontext must be an object");
                }
            } else {
                throw new Error('Unexpected format for schema key: ' + key);
            }
        });
    }

    // Wrap and return real constructor in order to do pre and post processing based on the options
    function get_wrapped_constr(constr, path, context, options) {
        /*
        if (options.extends) {
            if (!_.isString(options.extends)) throw new Error('Constructor "extends" option must be a string');
            var parent_constr = _.reduce(options.extends.split('.'), function(memo, tok) {
                if (!_.has(memo, tok)) throw new Error('Token "' + tok + '" not found in path string: ' + options.extends);
                return memo[tok];
            }, schema);
            parent_constr = _.isArray(parent_constr) ? parent_constr[2] || parent_constr[0] : parent_constr;
            constr.prototype = _.create(parent_constr.prototype, {'_super': parent_constr.prototype, 'constructor': constr});
        } else {
            constr.prototype = _.create(Constructor.prototype, {'_super': Constructor.prototype, 'constructor': constr});
        }
        */
        var wrapper = function() {
            var obj = this;
            var args = arguments;
            Constructor.apply(obj, args); // Apply base constructor
            if (options.extends) { // Apply parent constructor
                var val = get_key_value(schema, options.extends);
                var extends_constr = _.isArray(val) ? (val[2] || val[0]) : val;
                extends_constr.apply(obj, args);
            }
            if (options.pre) {
                var pres = _.isArray(options.pre) ? options.pre : [options.pre];
                _.each(pres, function(pre) {
                    val = get_key_value(schema, pre);
                    var pre_constr = _.isArray(val) ? (val[2] || val[0]) : val;
                    pre_constr.apply(obj, args);
                });
            }
            var retval = constr.apply(obj, args);
            if (options.post) {
                var posts = _.isArray(options.post) ? options.post : [options.post];
                _.each(posts, function(post) {
                    var val = get_key_value(schema, post);
                    var post_constr = _.isArray(val) ? (val[2] || val[0]) : val;
                    post_constr.apply(obj, args);
                });
            }
            obj = _.isObject(retval) ? retval : obj;
            obj._args = args;
            obj._path = path;
            return obj;
        }

        //wrapper.prototype = _.create(constr.prototype, {'_super': constr.prototype, 'constructor': wrapper});

        return wrapper;
    }

    schema_init();

    /////////////////////////////////////////////////////////////////////////////////////

    console.log("INHERITANCE_HIERARCHY>>>\n", inheritance_hierarchy);

    // Use inheritance hierarchy to create prototype chains on contructors
    function build_prototype_chains(level, parent) {
        level = level || inheritance_hierarchy._[1];
        parent = parent || inheritance_hierarchy._[0];
        _.each(level, function(val, key) {
            var constr = val[0];
            constr.prototype = _.create(parent.prototype, {'_super': parent.prototype, 'constructor': constr});
            build_prototype_chains(val[1], constr);
        });
    }

    build_prototype_chains();

    console.log(1);

    // ==================================================================================

    /*
    var context_init = function(ctxstack, path) {
        ctxstack = _.isArray(ctxstack) ? ctxstack : (_.isObject(ctxstack) ? [ctxstack] : [{}]);
        path = path || [];
        var context = _.last(ctxstack);
        _.each(context, function(val, key) {
            if (key === '_') return;
            if (_.isString(val) && _.first(val) === '@') {
                var ref = val.slice(1);
                var constr = _.reduce(ref.split('.'), function(memo, tok) {
                    if (!_.has(memo, tok)) throw new Error('Token "' + tok + '" not found in path string: ' + ref);
                    return memo[tok];
                }, schema);
                wrap_constr(_.isArray(constr) ? constr[2] || constr[0] : constr, path.concat(key), context, {});
            } else if (_.isObject(val) && _.first(key) === '$') {
                if (!_.isObject(val)) throw new Error('Value for "' + path.concat(key).join('.') + "' subcontext must be an object");
                if (context.$ && key !== '$') {
                    if (!_.has(val, '$') || !_.isObject(val.$)) val.$ = {};
                    val.$ = _.assign(context.$, val.$);
                    _.each(val.$, function(v, k) {
                        if (!_.has(val, k)) val[k] = v;
                    });
                }
                context_init(ctxstack.concat(val), path.concat(key));
            } else if (_.first(key) >= 'a' && _.first(key) <= 'z') {
                if (!_.isObject(val)) throw new Error('Value for "' + path.concat(key).join('.') + "' subcontext must be an object");
                context_init(ctxstack.concat(val), path.concat(key));
            } else if (_.isFunction(val)) {
                wrap_constr(val, path.concat(key), context, {});
            } else if (_.isArray(val)) {
                if (!_.isFunction(val[0])) throw new Error('First element of array must be a function');
                if (!_.isObject(val[1])) throw new Error('Second element of array must be an object');
                wrap_constr(_.isFunction(val[2]) ? val[2] : val[0], path.concat(key), context, val[1]);
            } else if (val === true) {
                var base_context = _.reduce(_.initial(ctxstack), function(memo, ctx) {
                    return _.has(ctx, key) ? ctx : memo;
                }, null);
                if (base_context === null) throw new Error('Base constructor not found for: ' + path.concat(key).join('.'));
                context[key] = base_context[key];
                if (_.has(base_context, '$' + key)) context['$' + key] = base_context['$' + key];
            }
        });
    };

    context_init(schema);
    */

    /////////////////////////////////////////////////////////////////////////////////////

    function load() {

    }

    function get_schema() {
        return schema;
    }

    function get_parser(path) {
        var context;
        if (path) {
            var context = path.split('.').reduce(function(memo, ctx) {
                if (!_.has(memo, ctx)) throw new Error('Invalid schema path: ' + path);
                return memo[ctx];
            }, schema);
            if (schema._ && context !== schema) context._ = schema._;
        } else {
            context = schema;
        }
        return get_jsonoc_parser(context);
    }

    function stringify(jsnc) {
        if (jsnc instanceof Constructor) {
            return jsnc._stringify(stringify);
        } else if (_.isArray(jsnc)) {
            return '[' + jsnc.map(stringify).join(', ') + ']';
        } else if (_.isObject(jsnc)) {
            var obj = _.pairs(jsnc).filter(function(p) {return _.first(p[0]) !== '_'});
            return '{' + obj.map(function(p) {return JSON.stringify(p[0]) + ': ' + stringify(p[1])}).join(', ') + '}';
        } else {
            return JSON.stringify(jsnc);
        }
    }

    return jsonoc;

});

/////////////////////////////////////////////////////////////////////////////////////////

// Modified version of Douglas Crockford's json_parse function to support jsonoc syntax:
// https://github.com/douglascrockford/JSON-js/blob/master/json_parse.js

// - support for nested object constructors that adhere to a schema
// - allow for // and /* */ style comments
// - allow quoteless keys in object literals
// - improved error reporting

function get_jsonoc_parser(context, schema_path) {

    var ctxstack = [context || {}];
    schema_path = schema_path || [];
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
                error("Expected '" + c + "' instead of '" + ch + "' at " + line + ":" + col);
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
                error("Bad number at " + line + ":" + col);
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
                    } else {
                        string += ch;
                    }
                }
            }
            error("Bad string at " + line + ":" + col);
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
                    error('Unexpected token: "/' + ch + '" at ' + line + ":" + firstcol);
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
            var current = _.last(ctxstack);
            while (ch) {
                var wordstr = '';
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
                    error('Undefined word token "' + wordstr + '" at ' + line + ":" + startcol);
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
                current = _.isArray(current) ? _.first(current) : current;
                if (isFunction(current)) {
                    var constr = current;
                    var args;
                    if (_.has(_.last(ctxstack), '$' + wordstr)) { // if constructor has a context defined, use it
                        ctxstack.push(_.last(ctxstack)['$' + wordstr]);
                        args = params();
                        ctxstack.pop();
                    } else {
                        args = params();
                    }
                    var obj = Object.create(constr.prototype);

                    try {
                        var retval = constr.apply(obj, args);
                    } catch (e) {
                        error('Error while calling constructor "' + path.join('.') + '" at ' + startline + ":" + startcol + ' -- ' + e.message + '\n' + e.stack);
                    }
                    obj = _.isObject(retval) ? retval : obj;
                    return obj;

                    /////////////////////////////////////////////////////////////////////


                } else {
                    error('Token "' + path.join('.') + '" is used as a constructor at ' + startline + ":" + startcol + ", but is not a function in the schema: " + JSON.stringify(constr));
                }
                path.push(params());
            }

            return current;
        },

        objkey = function() {
            if (ch === '"') {
                return string();
            } else if (ch >= 'a' && ch <= 'z' || ch >= 'A' && ch <= 'Z' || ch === '$' || ch === '_') {
                var wordstr = ch;
                next();
                while (ch >= 'a' && ch <= 'z' || ch >= 'A' && ch <= 'Z' || ch === '$' || ch === '_' || ch >= '0' && ch <= '9') {
                    wordstr += ch;
                    next();
                }
                return wordstr;
            } else {
                error('Unexpected character "' + ch + '" for object key at ' + line + ":" + col);
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
            error("Bad array at " + line + ":" + col);
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
                        error('Duplicate key "' + key + '" at ' + line + ":" + col);
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
            error("Bad object at " + line + ":" + col);
        };

    value = function () {

// Parse a JSON value. It could be an object, an array, a string, a number,
// or a word.

        white();
        if (ch === '{') {
            return object();
        } else if (ch === '[') {
            return array();
        } else if (ch === '"') {
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

// Return the json_parse function. It will have access to all of the above
// functions and variables.

    return function (source, reviver) {
        var result;

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
            }({'': result}, ''))
            : result;
    };

};

// http://stackoverflow.com/questions/5999998/how-can-i-check-if-a-javascript-variable-is-function-type
function isFunction(functionToCheck) {
    var getType = {};
    return functionToCheck && getType.toString.call(functionToCheck) === '[object Function]';
}
