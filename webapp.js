var express = require('express'),
    fs = require('fs'),
    util = require('util'),
    pageManager,
    moduleManager,
    app = express(),
    webAppOptions = {
        appFolder:process.cwd(),
        confFolder: process.cwd() + '/conf/',
        usePages: true,
        useModules: true,
        port: 80
    };

/**
 * Start the web application
 * @param   {Object}    options     Web application options
 */
function start(options) {
    if (options) {
        for (var o in options) {
            if (options.hasOwnProperty(o)) {
                webAppOptions[o] = options[o];
            }
        }
    }

    if(!fs.existsSync(webAppOptions.appFolder)){
        throw util.format('web application folder %s does not exists', webAppOptions.appFolder);
    }

    if(!fs.existsSync(webAppOptions.confFolder)){
        throw util.format('web application configuration folder %s does not exists', webAppOptions.confFolder);
    }

    global.appFolder = webAppOptions.appFolder;
    global.confFolder = webAppOptions.confFolder;

    app.use(express.cookieParser());

    if(webAppOptions.cookieSecret){
        app.use(express.cookieSession({secret:webAppOptions.cookieSecret}));
    }

    app.use(express.bodyParser());
    if (webAppOptions.staticFolder) {
        app.use('/static', express.static(webAppOptions.staticFolder));
    }
    app.use('/waaa', express.static(__dirname + '/resources/'));

    if(webAppOptions.useModules){
        moduleManager = require('./lib/module_manager.js');

        app.get('/service/module/:module?', moduleManager.onModuleRequest);
        app.post('/service/:module/:operation', moduleManager.onModuleOperation);
    }

    if(webAppOptions.usePages){
        pageManager = require('./lib/page_manager.js');
        app.get('/pages/:page', pageManager.onPageRequest);
    }


    app.listen(webAppOptions.port);

    exports.db = require('./lib/db.js');
}

exports.express = express;
exports.app = app;
exports.start = start;
exports.BaseModule = require('./lib/base_module.js');
