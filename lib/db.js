var util = require('util'),
    AppError = require('./app_error.js'),
    confManager = require('./config_manager.js'),
    dbConf = confManager.getDatabaseConfigSync(),
    instance;

/**
 * DB utility class
 * Implemented as singleton
 *
 * @class db
 * @constructor
 */
var db = function () {
    var that = this,
        _connectionPoolLimit = dbConf.connectionPool.limit || 20,
        _connections = {},
        _queryQueue = [],
        _queryQueueLimit = dbConf.connectionPool.queueLimit || 100,
        _queryQueueListener = {
            lock:false,
            running:false,
            intervalHandler:null,
            intervalMilliseconds:dbConf.connectionPool.queueHandleTime || 100
        },
        _mysql = require('mysql');


    /**
     * Add a query to queue when no connection is available, and try to run it again later
     * @param   {String}            connectionName  Name of connection string
     * @param   {String}            statement       SQL query
     * @param   {Null|Array|Object} params          List of params to sent as part of the query statement, use NULL when no params are needed
     * @param   {Function}  callback                A callback to invoke with the result - callback(err, result)
     * @method addQueryToQueue
     * @private
     */
    function addQueryToQueue(connectionName, statement, params, callback) {
        if (_queryQueue.length < _queryQueueLimit) {
            _queryQueue.push({connectionName:connectionName, statement:statement, params:params, callback:callback});
        }
        else {
            callback(new AppError('too many connections', 'CONNECTION_LIMIT', true));
        }

        if (!_queryQueueListener.running) {
            _queryQueueListener.running = true;
            _queryQueueListener.intervalHandler = setInterval(function () {
                if (_queryQueue.length == 0) {
                    clearInterval(_queryQueueListener.intervalHandler);
                    _queryQueueListener.running = false;
                }
                else {
                    if (!_queryQueueListener.lock) {
                        _queryQueueListener.lock = true;
                        var item = _queryQueue.shift();
                        that.query(item.connectionName, item.statement, item.params, item.callback);
                        _queryQueueListener.lock = false;
                    }

                }
            }, _queryQueueListener.intervalMilliseconds)
        }
    }

    /**
     * Prepare SQL statement
     * @param   {String}        table   DB table name
     * @param   {String|Array}  fields  A field name or a list of fields names to use
     * @param   {Object}        options [Optional]  List of options to use as part of the query, possible keys: where, group, order, having and limit
     * @return  {String|Boolean}    SQL statement or false on a problem to create the statement
     * @method  prepareSelectStatement
     * @private
     */
    function prepareSelectStatement(table, fields, options) {
        var _fields, _options = '';

        if (typeof fields == 'string') {
            _fields = (fields == '*') ? fields : _mysql.escape(fields).replace("'", "`");
        }
        else if (util.isArray(fields)) {
            _fields = fields.join(',');
        }
        else {
            return false;
            //todo 'Invalid fields type';
        }

        if (options) {
            if (options['where']) {
                _options += 'where ';
                var optionsArray = [];
                for (var whereKey in options['where']) {
                    if (options['where'].hasOwnProperty(whereKey)) {
                        optionsArray.push(util.format('%s=%s', whereKey, _mysql.escape(options['where'][whereKey])));
                    }
                }
                _options += optionsArray.join(' and ');
            }

            if (options['group']) {
                _options += ' group by ';
                if (typeof options['group'] == 'string') {
                    _options += options['group'];
                }
                else if (util.isArray(options['group'])) {
                    _options += options['group'].join(',');
                }
            }

            if (options['order']) {
                _options += ' order by ';
                if (typeof options['order'] == 'string') {
                    _options += options['order'];
                }
                else if (util.isArray(options['order'])) {
                    _options += options['order'].join(',');
                }
            }

            if (options['having']) {
                _options += ' having ';
                var havingArray = [];
                for (var havingKey in options['having']) {
                    if (options['having'].hasOwnProperty(havingKey)) {
                        havingArray.push(util.format('%s=%s', havingKey, _mysql.escape(options['having'][havingKey])));
                    }
                }
                _options += havingArray.join(',');
            }

            if (options['limit']) {
                _options += ' limit ' + options['limit'];
            }
        }

        return util.format('select %s from %s %s;', _fields, table, _options);
    }

    /**
     * Prepare SQL stored procedure statement
     * @param   {String}        procedureName   Stored procedure name
     * @param   {String|Array}  fields          [Optional] A field(s) value
     * @return  {String}        Stored procedure query statement
     * @method prepareSPStatement
     * @private
     */
    function prepareSPStatement(procedureName, fields) {
        var _fields = null;
        if (typeof fields != "undefined") {
            if (util.isArray(fields)) {
                _fields = [];
                for (var i = 0, len = fields.length; i < len; i++) {
                    _fields.push(_mysql.escape(fields[i]));
                }
                _fields = _fields.join(',');
            }
            else {
                _fields = _mysql.escape(fields.toString());
            }
        }
        return util.format('CALL %s(%s);', procedureName, _fields ? _fields : '');
    }

    /**
     * Reference to mysql module
     * @type {mysql}
     * @property
     * @public
     */
    this.mysql = _mysql;

    /**
     * Set a connection. This method need to be called before any queries to the specified connection name settings
     * @param   {String}    connectionName  Name of connection string(must exist in the db conf file)
     * @param   {Function}  callback        A callback to invoke with the result - callback(err, result)
     * @method setConnection
     * @public
     */
    this.setConnection = function (connectionName, callback) {
        if (!_connections[connectionName]) {
            if (!dbConf.connections[connectionName]) {
                callback(new AppError(util.format('connection string %s does not exists in db conf', connectionName), 'CONNECTION_DOES_NOT_EXISTS', true));
            }
            else {
                _connections[connectionName] = dbConf.connections[connectionName];
                _connections[connectionName].pool = [];
                _connections[connectionName].available = [];
                _connections[connectionName].inUse = [];

                for (var i = 0; i < _connectionPoolLimit; i++) {
                    _connections[connectionName].pool.push(_mysql.createConnection(
                        {
                            'host':_connections[connectionName].host,
                            'user':_connections[connectionName].user,
                            'password':_connections[connectionName].password,
                            'database':_connections[connectionName].database
                        })
                    );
                }

                callback(undefined);
            }
        }
    };

    /**
     * Run DB query, and invoke the callback with the result
     * @param   {String}            connectionName  Name of connection string
     * @param   {String}            statement       SQL query
     * @param   {Null|Array|Object} params          List of params to sent as part of the query statement, use NULL when no params are needed
     * @param   {Function}          callback        A callback to invoke with the result - callback(err, result)
     * @method  query
     * @public
     */
    this.query = function (connectionName, statement, params, callback) {
        if (!_connections[connectionName]) {
            callback(new AppError(util.format('connection %s is unknown', connectionName), 'CONNECTION_DOES_NOT_EXISTS', true));
        }
        else {
            var conn;

            /**
             * Handle DB result
             * @param   {Error}     err         Error object
             * @param   {Array}     results     DB result set
             * @method onResult
             * @private
             */
            function onResult(err, results) {
                if (err) {
                    callback(err);
                }
                else {
                    callback(undefined, results);
                }

                // recycle the connection and move it to the available connections list
                for (var c in _connections[connectionName].inUse) {
                    if (_connections[connectionName].inUse.hasOwnProperty(c)) {
                        if (_connections[connectionName].inUse[c] === conn) {
                            _connections[connectionName].available.push(_connections[connectionName].inUse[c]);
                            _connections[connectionName].inUse.splice(c, 1);
                            break;
                        }
                    }
                }
            }

            /**
             * Run the the query
             * @method runQuery
             * @private
             */
            function runQuery() {
                if (!params) {
                    conn.query(statement, onResult);
                }
                else {
                    conn.query(statement, params, onResult);
                }
            }

            /**
             * DB connect event handler
             * @param   {Error}     err         Error object
             * @method onConnect
             * @private
             */
            function onConnect(err) {
                if (err) {
                    callback(err);
                }
                else {
                    _connections[connectionName].inUse.push(conn);
                    runQuery();

                    conn.on('error', function (err) {
                        if (err.fatal) {
                            if (err.code !== 'PROTOCOL_CONNECTION_LOST') {
                                throw err;
                            }

                            conn = _mysql.createConnection(conn.config);
                            conn.connect();
                        }
                    });
                }
            }

            /*console.log('-------------------------------------------');
             console.log('pool: ' + _connections[connectionName].pool.length);
             console.log('available: ' + _connections[connectionName].available.length);
             console.log('inUse: ' + _connections[connectionName].inUse.length);
             console.log('-------------------------------------------');*/

            // check if there is available connection to use
            if (_connections[connectionName].available.length > 0) {
                conn = _connections[connectionName].available.shift();
                _connections[connectionName].inUse.push(conn);

                runQuery();
            }
            // check if there is available connection in the connection pool to be used
            else if (_connections[connectionName].pool.length > 0) {
                conn = _connections[connectionName].pool.shift();
                conn.connect(onConnect);
            }
            // when no connection is available, queue the query request
            else {
                addQueryToQueue(connectionName, statement, params, callback);
            }
        }
    };

    /**
     * Get a list of records from a DB table
     * @param   {String}        connectionName  Name of connection string
     * @param   {String}        table       The DB table
     * @param   {String|Array}  fields      A table field name or a list of fields
     * @param   {Function}      callback    A callback to invoke with the result - callback(err, result)
     * @param   {Object}        options     options [Optional]  List of options to use as part of the query, possible keys: where, group, order, having and limit
     * @method  getMany
     * @public
     */
    this.getMany = function (connectionName, table, fields, callback, options) {
        var statement = prepareSelectStatement(table, fields, options);
        if (statement === false) {
            callback(new AppError('could not prepare statement', 'BAD_STATEMENT', true), null);
        }
        else {
            this.query(connectionName, statement, null, callback);
        }
    };

    /**
     * Get one record from a DB table
     * @param   {String}        connectionName  Name of connection string
     * @param   {String}        table           The DB table
     * @param   {String|Array}  fields          A table field name or a list of fields
     * @param   {Function}      callback        A callback to invoke with the result - callback(err, result)
     * @param   {Object}        options         options [Optional]  List of options to use as part of the query, possible keys: where, group, order, having and limit
     * @method  getOne
     * @public
     */
    this.getOne = function (connectionName, table, fields, callback, options) {
        var _options = options || {};
        _options.limit = 1;
        var statement = prepareSelectStatement(table, fields, options);
        if (statement === false) {
            callback(new AppError('could not prepare statement', 'BAD_STATEMENT', true), null);
        }
        else {
            this.query(connectionName, statement, null, callback);
        }
    };

    /**
     * Add new record to the DB
     * @param   {String}        connectionName  Name of connection string
     * @param   {String}        table           The DB table
     * @param   {Object}        fields          List of fields and values ({column1: value1, column2: value2, ....})
     * @param   {Function}      callback        A callback to invoke with the result - callback(err, result)
     * @method add
     * @public
     */
    this.add = function (connectionName, table, fields, callback) {
        this.query(connectionName, util.format('insert into %s set ?', table), fields, callback);
    };

    /**
     * Update DB record(s)
     * @param   {String}        connectionName  Name of connection string
     * @param   {String}        table           The DB table
     * @param   {Object}        fields          List of fields and values ({column1: value1, column2: value2, ....})
     * @param   {Object}        where           The statement where filter (where column1 = 'some value')
     * @param   {Function}      callback        A callback to invoke with the result - callback(err, result)
     * @method update
     * @public
     */
    this.update = function (connectionName, table, fields, where, callback) {
        if (!where || typeof where != 'object' || where === {}) {
            callback(new AppError('could not run update query without valid where params', 'BAD_STATEMENT', false), null);
        }
        else {
            var whereStatement = '';
            for (var key in where) {
                if (where.hasOwnProperty(key)) {
                    if (whereStatement != '') {
                        whereStatement += ' and ';
                    }
                    whereStatement += util.format("%s='%s'", key, where[key]);
                }
            }

            if (whereStatement == '') {
                callback(new AppError('could not run update query without valid where params', 'BAD_STATEMENT', false), null);
            }
            else {
                this.query(connectionName, util.format('update %s set ? where %s', table, whereStatement), fields, callback);
            }

        }
    };

    /**
     * Delete DB record(s)
     * @param   {String}        connectionName  Name of connection string
     * @param   {String}        table           The DB table
     * @param   {Object}        where           The statement where filter (where column1 = 'some value')
     * @param   {Function}      callback        A callback to invoke with the result - callback(err, result)
     * @method delete
     * @public
     */
    this.delete = function (connectionName, table, where, callback) {
        if (!where || typeof where != 'object' || where === {}) {
            callback(new AppError('could not run delete query without valid where params', 'BAD_STATEMENT', false), null);
        }
        else {
            var whereStatement = '';
            for (var key in where) {
                if (where.hasOwnProperty(key)) {
                    if (whereStatement != '') {
                        whereStatement += ' and ';
                    }
                    whereStatement += util.format("%s='%s'", key, where[key]);
                }
            }

            if (whereStatement == '') {
                callback(new AppError('could not run update query without valid where params', 'BAD_STATEMENT', false), null);
            }
            else {
                this.query(connectionName, util.format('delete from %s where %s', table, whereStatement), null, callback);
            }
        }
    };

    /**
     * Run stored procedures and get one or more records if available
     * @param   {String}        connectionName  Name of connection string
     * @param   {String}        procedureName   Stored procedure name
     * @param   {String|Array}  fields          [Optional] A field(s) value
     * @param   {Function}      callback        A callback to invoke with the result - callback(err, result)
     * @public
     */
    this.SPGetMany = function (connectionName, procedureName, fields, callback) {
        this.query(connectionName, prepareSPStatement(procedureName, fields), null, callback);
    };

    /**
     * Run stored procedures and get one record if available
     * @param   {String}        connectionName  Name of connection string
     * @param   {String}        procedureName   Stored procedure name
     * @param   {String|Array}  fields          [Optional] A field(s) value
     * @param   {Function}      callback        A callback to invoke with the result - callback(err, result)
     * @public
     */
    this.SPGetOne = function (connectionName, procedureName, fields, callback) {

        /**
         * Handle DB result
         * @param   {Error}     err         Error object
         * @param   {Array}     records     DB result set
         */
        function onResult(err, records) {
            if (err) {
                callback(err, null);
            }
            else {
                callback(null, records[0] || {});
            }
        }

        this.SPGetMany(connectionName, procedureName, fields, onResult);
    };

    /**
     * Run stored procedures and return no data
     * @param   {String}        connectionName  Name of connection string
     * @param   {String}        procedureName   Stored procedure name
     * @param   {String|Array}  fields          [Optional] A field(s) value
     * @param   {Function}      callback        A callback to invoke with the result - callback(err, result)
     * @public
     */
    this.SPNonQuery = function (connectionName, procedureName, fields, callback) {

        /**
         * Handle DB result
         * @param   {Error}     err         Error object
         * @param   {Array}     records     DB result set
         */
        function onResult(err, records) {
            if (err) {
                callback(err, null);
            }
            else {
                callback(null, {});
            }
        }

        this.SPGetMany(connectionName, procedureName, fields, onResult);
    };

    /**
     * Get the class instance
     * @return  {db}    DB class instance
     * @method  getInstance
     * @public
     */
    this.getInstance = function () {
        if (!instance) {
            instance = this;
        }

        return instance;
    };
};


module.exports = instance || new db().getInstance();