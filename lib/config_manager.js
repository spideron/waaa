var fs = require('fs'),
    util = require('util'),
    AppError = require('./app_error.js'),
    appPath = global.appFolder,
    confPath = global.confFolder,
    config = {};

/**
 * Get the running application path
 * @return  {String}    Path to running application
 */
function getAppPath() {
    return appPath;
}

/**
 * Load a config file and get a config object
 * @param   {String}    name        Name of the config
 * @param   {String}    fileName    Filename of the config file
 * @param   {Function}  callback    Callback function - callback(err, config)
 */
function loadConfig(name, fileName, callback) {
    if (!fileName) {
        fileName = name + '.json';
    }

    fs.readFile(confPath + fileName, 'utf8', function (err, data) {
        if (err) {
            callback(err);
        }
        else {
            config[name] = JSON.parse(data);
            callback(undefined, config[name]);
        }
    });
}


/**
 * Load config file synchronously and get a config object
 * @param   {String}    name        Name of the config
 * @param   {String}    fileName    Filename of the config file
 * @return  {Object}    Config object
 */
function loadConfigSync(name, fileName) {
    if (!fileName) {
        fileName = name + '.json';
    }

    var filePath = confPath + fileName;
    if (!fs.existsSync(filePath)) {
        throw util.format('file %s does not exists', filePath);
    }
    else {
        config[name] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        return config[name];
    }
}

/**
 * Get config
 * @param   {String}    name        Name of the config
 * @param   {Function}  callback    Callback function - callback(err, config)
 */
function getConfig(name, callback) {
    function onLoadConfig(err, conf) {
        if (err) {
            callback(err);
        }
        else {
            callback(undefined, conf);
        }
    }

    if (!config[name]) {
        loadConfig(name, null, onLoadConfig);
    }
    else {
        callback(undefined, config[name]);
    }
}

/**
 * Get config synchronously
 * @param   {String}    name        Name of the config
 * @return  {Object}    Config object
 */
function getConfigSync(name) {
    return loadConfigSync(name);
}

/**
 * Get pages config
 * @param   {Function}  callback    Callback function - callback(err, config)
 */
function getPagesConfig(callback) {
    getConfig('pages', callback);
}

/**
 * Get pages config synchronously
 * @return  {Object}    Config object
 */
function getPagesConfigSync() {
    return getConfigSync('pages');
}

/**
 * Get database config
 * @param   {Function}  callback    Callback function - callback(err, config)
 */
function getDatabaseConfig(callback) {
    getConfig('db', callback);
}

/**
 * Get database config synchronously
 * @return  {Object}    Config object
 */
function getDatabaseConfigSync() {
    return getConfigSync('db');
}

/**
 * Get modules config
 * @param   {Function}  callback    Callback function - callback(err, config)
 */
function getModulesConfig(callback) {
    getConfig('modules', callback);
}

/**
 * Get modules config synchronously
 * @return  {Object}    Config object
 */
function getModulesConfigSync() {
    return getConfigSync('modules');
}

/**
 * Get a section from a config
 * @param   {String}    confName        Name of the config
 * @param   {String}    sectionName     The section name in the config
 * @param   {Function}  callback    Callback function - callback(err, configSection)
 */
function getConfigSection(confName, sectionName, callback) {
    function onGetConfig(err, conf) {
        if (err) {
            callback(err);
        }
        else {
            if (!conf[sectionName]) {
                callback(new AppError(util.format('section %s does not exists in conf %s', sectionName, confName), 'SECTION_DOES_NOT_EXISTS', false));
            }
            else {
                callback(undefined, conf);
            }
        }
    }

    getConfig(confName, onGetConfig);
}


exports.getAppPath = getAppPath;

exports.getConfig = getConfig;
exports.getConfigSync = getConfigSync;

exports.getPagesConfig = getPagesConfig;
exports.getPagesConfigSync = getPagesConfigSync;

exports.getDatabaseConfig = getDatabaseConfig;
exports.getDatabaseConfigSync = getDatabaseConfigSync;

exports.getModulesConfig = getModulesConfig;
exports.getModulesConfigSync = getModulesConfigSync;

exports.getConfigSection = getConfigSection;