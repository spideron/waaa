function AppError(message, code, fatal){
    this.message = message || '';
    this.code = code || '';
    this.fatal = fatal || false;
}

AppError.prototype = new Error();
AppError.prototype.constructor = AppError;

module.exports = AppError;