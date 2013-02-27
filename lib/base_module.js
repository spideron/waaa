Object.prototype.empty = function () {
    return this === null || this === undefined || this === {} || (this.length && this.length == 0);
};

var util = require('util');

/**
 * Base class
 */
var BaseModule = function () {
    var _that = this,
        _errors = [],
        _serviceMethods = [],
        _serviceProperties = [],
        _projectNamespace = 'waaa',
        _registerMethodFormat = _projectNamespace + '.%s.%s=function%s{' + _projectNamespace + '.service.invoke("%s","%s",arguments);};',
        _registerPropertyFormat = _projectNamespace + '.%s.%s=%s;';

    /**
     * Get a list of errors
     * @return {Array}
     */
    this.getErrors = function () {
        return _errors;
    };

    /**
     * Add error
     * @param   {string}  errorMessage
     */
    this.addError = function (errorMessage) {
        _errors.push(errorMessage);
    };

    /**
     * Clear all errors
     */
    this.clearErrors = function () {
        _errors = [];
    };

    /**
     * Register one or more methods to be served as part of the service
     * @param {String}  methodName  The method name to register
     * @return {Boolean}
     */
    this.registerMethod = function (methodName) {
        var serviceName = _that.className || 'global',
            methods = arguments.length == 1 ? [methodName] : arguments;

        for (var i = 0; i < methods.length; i++) {
            if (!_that[methods[i]] || _that[methods[i]].constructor !== Function) {
                _that.addError('failed registering method ' + methods[i] + '. method could not be found');
                return false;
            }

            var matches = _that[methods[i]].toString().match(/^function\s\(([a-zA-Z0-9_\-,\s])*\)/);
            if (matches && !matches.empty()) {
                _serviceMethods.push(util.format(_registerMethodFormat, serviceName, methods[i], matches[0].substring(9, matches[0].length), serviceName, methods[i]));
            }
            else {
                _that.addError('failed registering method ' + methods[i] + '. function pattern match failed');
                return false;
            }
        }

        return true;
    };

    this.registerProperty = function (propertyName) {
        var serviceName = _that.className || 'global',
            properties = arguments.length == 1 ? [propertyName] : arguments;

        for (var i = 0; i < properties.length; i++) {
            if (!_that[properties[i]]) {
                _that.addError('failed registering property ' + properties[i] + '. property could not be found');
                return false;
            }

            if (_that[properties[i]].constructor === String) {
                _serviceProperties.push(util.format(_registerPropertyFormat, serviceName, properties[i], util.format("'%s'", _that[properties[i]])));
            }
            else if (util.isDate(_that[properties[i]])) {
                _serviceProperties.push(util.format(_registerPropertyFormat, serviceName, properties[i], util.format("new Date('%s')", _that[properties[i]])));
            }
            else if (util.isRegExp(_that[properties[i]])) {
                _serviceProperties.push(util.format(_registerPropertyFormat, serviceName, properties[i], _that[properties[i]]));
            }
            else {
                _serviceProperties.push(util.format(_registerPropertyFormat, serviceName, properties[i], JSON.stringify(_that[properties[i]])));
            }
        }

        return true;
    };

    this.getMethods = function(){
        return _serviceMethods;
    };

    this.getProperties = function(){
        return _serviceProperties;
    }

};


module.exports = BaseModule;