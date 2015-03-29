define(['underscore', 'eventemitter2'], function(_, EventEmitter2) {

    var data = [
      [''],
    ];

    function Account() {
	    if (!(this instanceof Account)) return Account.apply(Object.create(Account.prototype), arguments);

        this.id = arguments[0];
    }

    // Manage virtual accounts
    Account.prototype.virtual = function() {
        var sub = {};
        sub.root = this.root || this;
        return sub;
    };


    function AccountManagement() {
	    if (!(this instanceof AccountManagement)) return AccountManagement.apply(Object.create(AccountManagement.prototype), arguments);

        this.accounts = {};

        return this;
    }

    AccountManagement.Account = Account;

    return AccountManagement;

})
