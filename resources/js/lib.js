String.prototype.waFormat = function () {
    var pattern = /\{\d+\}/g;
    var args = arguments;
    return this.replace(pattern, function (capture) {
        return args[capture.match(/\d+/)];
    });
};

window.waaa = window.waaa || {};
(function () {

    var serviceBaseUrl = '/service/';

    function serverCall(url, dataType, methodType, data, callback) {
        jQuery.ajax({
            url:url,
            type:methodType,
            dataType:dataType,
            data:JSON.stringify({"data": data}),
            contentType:'application/json; charset=UTF-8',
            success:callback,
            error:function (jqXHR, textStatus, errorThrown) {

            }
        })
    }
    waaa.service = {
        invoke:function (moduleName, methodName) {
            var params = [],
                callback,
                url = serviceBaseUrl + moduleName + '/' + methodName;

            if (arguments.length > 2) {
                for(var v in arguments[2]){
                    if(arguments[2].hasOwnProperty(v)){
                        if(arguments[2][v].constructor === Function){
                            callback = arguments[2][v];
                        }
                        else{
                            params.push(arguments[2][v]);
                        }
                    }
                }
            }

            serverCall(url, 'json', 'POST', params, callback || function () {
            });
        }
    };
})();