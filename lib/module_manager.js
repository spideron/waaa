var util = require('util'),
    AppError = require('./app_error.js'),
    confManager = require('./config_manager.js'),
    modulesConf = confManager.getModulesConfigSync(),
    appMessageTemplate = '{"result":"%s","data":%s}';

/**
 * Module request handler. Generates javascript content representing the module
 * @param   req     Server request object wrapped with express lib
 * @param   res     Server response object wrapped with express lib
 * @public
 */
function onModuleRequest(req, res) {
    var baseLocation = confManager.getAppPath() + (modulesConf.location ? modulesConf.location : '');

    if (!req.route.params['module']) {
        res.send(400, "missing module name");
    }
    else if (!modulesConf.modules[req.route.params['module']]) {
        res.send(404, "unknown module " + req.route.params['module']);
    }
    else {
        // Override the default module location
        if (modulesConf.modules[req.route.params['module']].location) {
            baseLocation = confManager.getAppPath() + modulesConf.modules[req.route.params['module']].location;
        }

        var loaded = false,
            mod;

        try {
            mod = require(baseLocation + modulesConf.modules[req.route.params['module']].fileName);
            loaded = true;
        }
        catch (e) {
            res.send(500, e);
        }

        if (loaded) {
            var instance = new mod(),
                errors = false, i, len;

            instance.super_();
            instance.className = req.route.params['module'];
            if (modulesConf.modules[req.route.params['module']].methods) {
                if (!util.isArray(modulesConf.modules[req.route.params['module']].methods)) {
                    errors = true;
                    res.send(500, "module methods should be array in the config file");
                }
                else {
                    for (i = 0, len = modulesConf.modules[req.route.params['module']].methods.length; i < len; i++) {
                        if (!instance.registerMethod(modulesConf.modules[req.route.params['module']].methods[i])) {
                            res.send(500, "unable to register method "
                                + modulesConf.modules[req.route.params['module']].methods[i] + ". "
                                + JSON.stringify({errors: instance.getErrors()}));
                            errors = true;
                            break;
                        }
                    }
                }
            }

            if (!errors) {
                if (modulesConf.modules[req.route.params['module']].properties) {
                    if (!util.isArray(modulesConf.modules[req.route.params['module']].properties)) {
                        errors = true;
                        res.send(500, "module properties should be array in the config file");
                    }
                    else {
                        for (i = 0, len = modulesConf.modules[req.route.params['module']].properties.length; i < len; i++) {
                            if (!instance.registerProperty(modulesConf.modules[req.route.params['module']].properties[i])) {
                                res.send(500, "unable to register property "
                                    + modulesConf.modules[req.route.params['module']].properties[i] + ". "
                                    + JSON.stringify({errors: instance.getErrors()}));
                                errors = true;
                                break;
                            }
                        }
                    }
                }
            }

            if (!errors) {
                res.set('Content-Type', 'text/javascript');
                var output = util.format('waaa.%s={};%s', req.route.params['module'], instance.getProperties().join('') + instance.getMethods().join(''));
                res.send(output);
            }
        }
    }
}

/**
 * Module API request handler.
 *      Generates json content in the format of {"result":"success|failure","data":"CONTENT"}
 * @param   req     Server request object wrapped with express lib
 * @param   res     Server response object wrapped with express lib
 * @public
 */
function onModuleOperation(req, res) {
    var baseLocation = confManager.getAppPath() + (modulesConf.location ? modulesConf.location : '');

    if (!req.route.params['module']) {
        res.send(400, "missing module name");
    }
    else if (!req.route.params['operation']) {
        res.send(400, "missing operation");
    }
    else if (!modulesConf.modules[req.route.params['module']]) {
        res.send(404, "unknown module " + req.route.params['module']);
    }
    else if (!modulesConf.modules[req.route.params['module']].methods) {
        res.send(500, util.format('The module %s does not have any methods', req.route.params['module']));
    }
    else if (modulesConf.modules[req.route.params['module']].methods.indexOf(req.route.params['operation']) < 0) {
        res.send(500, util.format('The operation %s in module %s is not registered', req.route.params['operation'], req.route.params['module']));
    }
    else {
        // Override the default module location
        if (modulesConf.modules[req.route.params['module']].location) {
            baseLocation = confManager.getAppPath() + modulesConf.modules[req.route.params['module']].location;
        }

        var loaded = false,
            mod;

        try {
            mod = require(baseLocation + modulesConf.modules[req.route.params['module']].fileName);
            loaded = true;
        }
        catch (e) {
            res.send(500, e);
        }

        if (loaded) {
            res.set('Content-Type', 'application/json');
            var instance = new mod(req);
            instance.super_();

            /**
             * Operation result callback handler
             * @param   {AppError}  err         Error object
             * @param   {Object}    result      Object representing the operation result/response
             * @private
             */
            function onOperationResult(err, result) {
                if (err) {
                    res.send(!err.fatal ? 200 : 500, util.format(appMessageTemplate, 'failure', JSON.stringify(err)));
                }
                else {
                    res.send(util.format(appMessageTemplate, 'success', JSON.stringify(result)));
                }
            }

            if (instance[req.route.params['operation']] && instance[req.route.params['operation']].constructor === Function) {
                var params = req.body.data || [];
                params.push(onOperationResult);

                if (instance[req.route.params['operation']].length > params.length) {
                    onOperationResult(new AppError(
                        util.format('invalid argument count, expected %s and got %s',
                            instance[req.route.params['operation']].length,
                            params.length
                        ), 'INVALID_ARGUMENTS', true), null);
                }
                else {
                    instance[req.route.params['operation']].apply(undefined, params);
                }
            }
            else {
                var error = new appError('invalid operation ' + req.route.params['operation'] + ' at module' + req.route.params['module'], 'INVALID_OPERATION');
                res.send(400, JSON.stringify(error));
            }
        }
    }


}


exports.onModuleRequest = onModuleRequest;
exports.onModuleOperation = onModuleOperation;