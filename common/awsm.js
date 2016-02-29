define(['lodash', 'd3', 'stream', 'indicator_instance'], function(_, d3, Stream, IndicatorInstance) {

function Criterion(awsm, name) {
	if (!(this instanceof Criterion)) {return new Criterion(awsm, name);}
    if (!(awsm instanceof Awsm)) throw new Error("First parameter must be instance of Awsm")
    if (!name || !_.isString(name)) throw new Error("Second parameter must be name of criterion")

    this.awsm = awsm;
    this.name_ = name;
    this.value_ = 0;
    this.weight_ = 0;
    this.scale = d3.scale.linear().clamp(true);
    if (awsm.signed) this.scale.range([-1, 1]);
    this.enabled = true;
};

Criterion.prototype.weight = function(weight) {
    this.weight_ = weight;
    this.awsm.normalize();
    return this;
};

Criterion.prototype.value = function(value) {
    this.value_ = value;
    return this;
};

Criterion.prototype.decay = function(rate) {
    this.decay = rate;
    return this;
};

Criterion.prototype.eval = function() {
    if (!this.enabled) return null;
    // TODO: account for decay
    if (this.value_ instanceof stream) {
        return this.normalized_weight * this.scale(this.value_.get(0));
    } else if (_.isFinite(this.value_)) {
        return this.normalized_weight * this.scale(this.value_);
    } else {
        throw new Error("Unknown value type for criterion: "+(this.awsm.name ? this.awsm.name : "[AWSM]")+":"+this.name_);
    }
}

Criterion.prototype.kill = function() {
    this.enabled = false;
    delete awsm.criteria[this.name_];
    delete awsm[this.name_];
}

Criterion.prototype.killIf = function(condition) {
    if (_isFunction(condition) ? condition.apply(this) : condition) this.kill();
}

Criterion.prototype.dump = function() {
    var obj = {};
    obj.w = this.weight_;
    obj.nw = this.normalized_weight;
    obj.v = this.value_ instanceof stream ? this.value_.get(0) : this.value_;
    if (this.decay_) obj.d = this.decay_;
    obj.sv = {d: this.scale.domain(), r: this.scale.range()}
    obj.sv = this.scale(this.value_ instanceof stream ? this.value_.get(0) : this.value_);
    if (!this.enabled) obj.off = 1;
    return obj;
}

// Adjusted Weighted Sum Model
function Awsm(init, name) {
	if (!(this instanceof Awsm)) {return new Awsm(init, name);}

    var self = this;
    if (name) this.name = name;
    this.criteria = {};
    this.signed = false;

    if (_.isArray(init)) {
        _.each(init, function(critname) {
            self.crit(critname);
        });
        self.normalize();
    } else if (_.isObject(init)) {
        _.each(init, function(val, key) {
            var crit = this.crit(key);
            if (_.isObject(val)) {
              _.each(val, function(val, key) {
                switch (key) {
                    case 'w':
                    case 'weight':
                        crit.weight(val);
                        break;
                    case 'v':
                    case 'value':
                        crit.value(val);
                        break;
                    case 'd':
                    case 'decay':
                        crit.decay(val);
                        break;
                    case 's':
                    case 'scale':
                        crit.scale = val;
                        break;
                    default:
                }
              });
            } else if (_.isFinite(val)) {
                crit.weight(val);
            }
        });
    } // init instanceof Object
};

Awsm.prototype.tick = function() {

    // adjust decaying criteria
    _.each(this.criteria, function(crit) {
        if (crit.decay) {

            // ...

        }
    });
};

Awsm.prototype.crit = function(critname) {
    var crit = new Criterion(this, critname);
    this.criteria[critname] = crit;
    this[critname] = crit;
    return crit;
};

Awsm.prototype.normalize = function() {
    var weight_sum = _.reduce(_.map(this.criteria, function(crit) {return crit.weight_;}), function(w1, w2) {return w1+w2;}, 0);
    _.each(this.criteria, function(crit) {
        crit.normalized_weight = crit.weight_ / weight_sum;
    });
};

Awsm.prototype.eval = function() {
    return _.reduce(_.map(this.criteria, function(crit) {
        return crit.eval();
    }), function(n1, n2) {return n1+n2;}, 0);
};

Awsm.prototype.dump = function() {
    return _.fromPairs(_.map(this.criteria, function(crit, key) {
        return [key, crit.dump()];
    }));
};

Awsm.prototype.signed = function() {
    this.signed = true;
    _.each(this.criteria, function(crit) {
        crit.scale.range([-1, 1]);
    });
};

Awsm.prototype.unsigned = function() {
    this.signed = false;
    _.each(this.criteria, function(crit) {
        crit.scale.range([0, 1]);
    });
};

return Awsm;

})
