'use strict';

// JSONOC - JSON with Object Constructors

define(['lodash', 'jsonoc_schema'], function(_, schema) {

    var jsonoc = {
        load: load,
        get_schema: get_schema,
        get_parser: get_parser,
        stringify: stringify
    };

    // Base constructor from which all object constructors extend
    function Constructor() {
        return this;
    }

    // Set "_" to be base constructor
    schema._ = Constructor;

    Constructor.prototype._stringify = function(stringify) {
        var values = _.map(_.filter(_.pairs(this), function(pair) {
            return _.first(pair[0]) !== '_';
        }), function(p) {return p[1]});
        return this._type + '(' + values.map(stringify).join(', ') + ')';
    }

    var context_init = function(ctxstack, path) {
        ctxstack = _.isArray(ctxstack) ? ctxstack : (_.isObject(ctxstack) ? [ctxstack] : [{}]);
        path = path || [];
        var context = _.last(ctxstack);
        _.each(context, function(val, key) {
            if (key === '_') return;
            if (_.first(key) === '$') {
                if (!_.isObject(val)) throw new Error('Value for "' + path.concat(key).join('.') + "' subcontext must be an object");
                context_init(ctxstack.concat(val), path.concat(key));
            } else if (_.isFunction(val)) {
                val.prototype = _.create(Constructor.prototype, {
                  '_super': Constructor.prototype,
                  'constructor': val
                });
            } else if (val === true) {
                var sup = _.reduce(_.initial(ctxstack), function(memo, ctx) {
                    return _.has(ctx, key) ? ctx[key] : memo;
                }, null);
                context[key] = sup;
            }
        });
    };

    context_init(schema);

    /////////////////////////////////////////////////////////////////////////////////////

    function load() {

    }

    function get_schema() {
        return schema;
    }

    function get_parser(path) {
        var newschema = path.split('.').reduce(function(memo, ctx) {
            if (!_.has(memo, ctx)) throw new Error('Invalid schema path: ' + path);
            return memo[ctx];
        }, schema);
        if (schema._ && newschema !== schema) newschema._ = schema._;
        return get_jsonoc_parser(newschema);
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

function get_jsonoc_parser(context) {

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
                    if (context._) context._.apply(obj, args);
                    var retval = constr.apply(obj, args);
                    obj = _.isObject(retval) ? retval : obj;
                    obj._args = args;
                    obj._type = path.join('.');
                    return obj;
                } else {
                    error('Token "' + path.join('.') + '" is used as a constructor at ' + line + ":" + col + ", but is not a function in the schema: " + JSON.stringify(constr));
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
