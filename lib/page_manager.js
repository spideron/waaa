var fs = require('fs'),
    util = require('util'),
    jsdom = require('jsdom'),
    appError = require('./app_error.js'),
    confManager = require('./config_manager.js'),
    appDirectory = global.appFolder,
    pages = {},
    resources = {},
    pagesConf = confManager.getPagesConfigSync(),
    masterPageTemplates = {};


// Load master pages templates
if (pagesConf.master) {
    for (var templateName in pagesConf.master) {
        if (pagesConf.master.hasOwnProperty(templateName)) {
            if (pagesConf.master[templateName].template) {
                masterPageTemplates[templateName] = fs.readFileSync(appDirectory + pagesConf.master[templateName].template);
            }
        }
    }
}

/**
 * Get resource file content
 * @param   {String}    path    Relative path inside the resources folder
 * @return  {String}    Resource file content
 * @method getResource
 * @private
 */
function getResource(path){
    if(!resources[path]){
        resources[path] = fs.readFileSync(__dirname + '/../resources' + path);
    }

    return resources[path];
}


/**
 * Load page template based on the master page
 * @param   {String}    pageName    The page name
 * @param   {Function}  callback    Callback function - callback(err, content)
 * @private
 */
function loadTemplate(pageName, callback) {

    /**
     * Add resources (js/css) to the page head
     * @param   {String}    pageContent     HTML string representing the page content
     * @param   {Function}  callback        Callback function - callback(err, content)
     * @private
     */
    function addPageResources(pageContent, callback) {
        jsdom.env({
            html:pageContent,
            src:[getResource('/js/jquery-1.8.3.min.js')],
            done:function (errors, window) {
                if (errors) {
                    callback(new appError('template could not be parsed', 'PARSE_ERROR', true));
                }
                else {
                    var $ = window.$, document = window.document, head = $('head'), i, len, js;

                    js = document.createElement('script');
                    js.setAttribute('type', 'text/javascript');
                    js.setAttribute('src', '/waaa/js/lib.js');
                    head[0].appendChild(js);

                    js = document.createElement('script');
                    js.setAttribute('type', 'text/javascript');
                    js.setAttribute('src', '/waaa/js/jquery-1.8.3.min.js');
                    head[0].appendChild(js);

                    if(pageConf.resources){
                        if (pageConf.resources.css) {
                            var css = '';
                            for (i = 0, len = pageConf.resources.css.length; i < len; i++) {
                                var link = '<link rel="stylesheet" type="text/css" href="%s" %s />';
                                var attr = [];
                                if (pageConf.resources.css[i].attr) {
                                    for (var key in pageConf.resources.css[i].attr) {
                                        if (pageConf.resources.css[i].attr.hasOwnProperty(key)) {
                                            attr.push(util.format('%s=%s', key, pageConf.resources.css[i].attr[key]));
                                        }
                                    }
                                }
                                css += util.format('<link rel="stylesheet" type="text/css" href="%s" %s />', pageConf.resources.css[i].url, attr.join(' '));
                            }
                            head.append(css);
                        }

                        if (pageConf.resources.js) {
                            for (i = 0, len = pageConf.resources.js.length; i < len; i++) {
                                js = document.createElement('script');
                                js.setAttribute('type', 'text/javascript');
                                js.setAttribute('src', pageConf.resources.js[i]);
                                head[0].appendChild(js);
                            }
                        }
                    }

                    callback(undefined, document.outerHTML);
                }
            }});
    }

    /**
     * Combine the page template with the master page template
     * @param   {String}    bodyContent     HTML string representing the page content
     * @param   {Function}  callback        Callback function - callback(err, content)
     * @private
     */
    function loadMaster(bodyContent, callback) {
        jsdom.env({
            html:masterPageTemplates[masterTemplate],
            src:[getResource('/js/jquery-1.8.3.min.js')],
            done:function (errors, window) {
                if (errors) {
                    callback(new appError('master template could not be parsed', 'PARSE_ERROR', true));
                }
                else {
                    var $ = window.$, masterDocument = window.document, contentHolder = $('#content');
                    if(contentHolder.length == 0){
                        contentHolder = $('body');
                    }
                    contentHolder.append(bodyContent);

                    if(pageConf.title){
                        $('title').html(pageConf.title);
                    }

                    addPageResources(masterDocument.outerHTML, callback);
                }
            }
        });
    }

    /**
     * Get the template content. Looks for .codyContent wrapper or use the body element as wrapper
     * @param   {String}    templateContent     HTML string of the page template file
     * @param   {Function}  callback            Callback function - callback(err, content)
     * @private
     */
    function getPageBody(templateContent, callback) {
        jsdom.env({
            html:templateContent,
            src:[getResource('/js/jquery-1.8.3.min.js')],
            done:function (errors, window) {
                if (errors) {
                    callback(new appError('page template could not be parsed', 'PARSE_ERROR', true));
                }
                else {
                    var content;
                    if (masterTemplate) { // using master page, so get only body content from the template
                        content = window.$('.bodyContent');
                        if (content.length == 0) {
                            content = window.$('body');
                        }

                        callback(undefined, content.html());
                    }
                    else { // not using master, so get only the page template content
                        if(pageConf.title){
                            window.$('title').html(pageConf.title);
                        }

                        content = window.document.outerHTML;
                        addPageResources(content, callback);
                    }
                }
            }
        });
    }

    /**
     * Read template file callback handler
     * @param   {Error}     err     Error object
     * @param   {String}    data    utf8 encoded string representing the page template
     */
    function onReadFile(err, data) {
        if (err) {
            callback(new appError('could not read template file', 'FILE_READ', true));
        }
        else {
            // Get the template content
            getPageBody(data, function (err, pageTemplate) {
                if (err) {
                    callback(err);
                }
                else {
                    if (masterTemplate) { // using master page, get the template content combined with the master page
                        if (masterPageTemplates[masterTemplate]) {
                            loadMaster(pageTemplate, function (err, masterTemplate) {
                                if (err) {
                                    callback(err);
                                }
                                else {
                                    callback(undefined, masterTemplate);
                                }
                            });
                        }
                        else {
                            callback(new appError(util.format('master template %s could not be found', masterTemplate), 'TEMPLATE_UNKNOWN', true));
                        }
                    }
                    else { // use only the page template
                        callback(undefined, pageTemplate);
                    }
                }
            });
        }
    }

    var pageConf, masterTemplate;
    if (pagesConf.pages[pageName]) { // check if the page exists in the pages config
        pageConf = pagesConf.pages[pageName];
        if (pageConf.master) { // page specific master
            masterTemplate = pageConf.master;
        }
        else if (pagesConf.pages.master) { // default pages master
            masterTemplate = pagesConf.pages.master;
        }
        else { // no master
            masterTemplate = null;
        }

        fs.readFile(appDirectory + pageConf.template, 'utf8', onReadFile);
    }
    else {
        callback(new appError('page template could not be found', 'TEMPLATE_UNKNOWN', true));
    }
}

/**
 * Get page content. First try to fetch it from the cache, if it's not there,
 *      try to generate it and then save it to the cache
 * @param   {String}    pageName    The page name
 * @param   {Function}  callback    Callback function - callback(err, content)
 * @private
 */
function getPage(pageName, callback) {

    /**
     * Load template callback handler
     * @param   {AppError}  err         Error object
     * @param   {String}    template    The page template
     */
    function onLoadTemplate(err, template) {
        if (err) {
            callback(err);
        }
        else {
            pages[pageName] = template;
            callback(undefined, template);
        }
    }

    if (pages[pageName]) { // get the page content from cache
        callback(undefined, pages[pageName]);
    }
    else { // generate the page content
        loadTemplate(pageName, onLoadTemplate);
    }
}

/**
 * Page request handler
 * @param   req     Server request object wrapped with express lib
 * @param   res     Server response object wrapped with express lib
 * @public
 */
function onPageRequest(req, res) {

    /**
     * Get page callback handler
     * @param   {AppError}  err         Error object
     * @param   {String}    content     The page content
     */
    function onPageResponse(err, content) {
        if (err) {
            res.send(err.fatal ? 500 : 200, err.message);
        }
        else {
            res.send('<!DOCTYPE html>' + content);
        }
    }

    if (!req.route.params['page']) {
        res.send(400, "missing page name");
    }
    else {
        getPage(req.route.params['page'], onPageResponse);
    }
}

exports.onPageRequest = onPageRequest;