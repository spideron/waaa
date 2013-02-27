Web Application and API (waaa)
=============================

Installation
------------
```bash
npm install waaa
```

The why and how
---------------
Problem 1: There are many cases where in the development process, the body which makes the html & css are not part of
 the team which actually need to embed the content into a project.
 There are times, when a developer takes the html content and change it to fit to the current project/framework/templates
  and strip different part of it to create dynamic generated content and master pages.
 This leads to pain in the arse when changes on the front end are needed and are made by the original html creator(s)
 which sometimes does not even remotely looks like the current html content on the project end and the developer have
  a very hard time figuring out what needs to be changed and where.

Problem 2: Many sites today have pages which act like applications using client code and ajax calls instead of browsing
    many pages. Some developers will create handler file(s) in order to support ajax calls to the server and then they
     will write the client side code to call these handlers. In some continuous projects there are many different handlers
     and matching javascript code to support it. Which lead to write over and over again the same code logic for different
     data and actions.

This module comes to try and solve these problems by offering a web server which is build over express and let you keep
 the original html files and make templates out of them without any significant changes.
The other solution this module offers, is the ability to write simple classes on the server side which can be automatically
exposed as API on the server and with auto generated javascript code to support this API.

This leads to healthy decoupling between the front end development to the backend development, where the front end development
only taking care of UI and UX, and the backend development only takes care of the project logic and data flows.


The pages and auto API features are enables by default but can easily turned off and the module exposes the express module
in cases you need to implement your own web server logic.


Basic usage
-----------
The following code will start a web server with the default parameters.

```javascript
var waaa = require('waaa');
waaa.start();
```

Web server parameters
---------------------
The following parameters can be supplied to the web server
appFolder (String) - the root folder of the site/application (i.e. /var/www/, /root/my_project/site, __dirname, etc.)
confFolder (String) - the folder of the configuration files (i.e. /var/www/conf, /root/my_project/site/conf, __dirname + '/conf/', etc.)
usePages (Boolean) - enable the pages handling. true by default. When using this feature, a valid pages.json must exist in the configuration folder
useModules (Boolean) - enable the auto API handling. true by default. When using this feature, a valid modules.json must exist in the configuration folder
port (Integer) - The web server port. default is 80.

```javascript
var waaa = require('waaa'),
    options = {appFolder: __dirname, confFolder: __dirname + '/config/', port:8080};

waaa.start(options);
```

Configuration files
-------------------
### pages.json
```javascript
{
    "master":{
        "default":{
            "template":"/templates/pages/master.html"
        },
        "special":{
            "template":"/templates/pages/master_special.html"
        }
    },
    "pages":{
        "master":"default",
        "home":{
            "title":"my site::home",
            "template":"/templates/pages/home.html",
            "resources":{
                "js":["/static/js/home.js"],
                "css":[
                    {
                        "url":"/static/css/home.css",
                        "attr":{
                            "media":"screen"
                        }
                    }
                ]
            }
        },
        "news":{
            "title":"my site::news",
            "template":"/templates/pages/news.html",
            "master":"special",
            "resources":{
                "js":["/service/module/news","/static/js/news.js"]
            }
        }
    }
}
```

master - [optional] list of master pages
    [master_name] - name of a master pages settings
        template - path to a relative master page template in the root of the app folder

pages - [required] list of pages
    master - [optional] default master pages name for all the pages
    [page_name] - [required] the page name as it will be fetched (i.e. http://www.mysite.com/pages/[page_name])
        title - [optional] text to set as the inside the page title element
        template - [required] path to a relative page template in the root of the app folder
        master - [optional] use a specific master page
        resources - [optional] - javascript and css to attach to this page
            js - [optional] - list of javascript paths to attach to page
            css - [optional] - list of css files to attach to page
                url - [required] - path to the css file
                attr - [optional] - list of key value collection to be used as attributes on the link element


### modules.js
```javascript
{
    "location":"/modules/",
    "modules":{
        "news":{
            "fileName":"news.js",
            "methods":["get","getAll"]
        }
    }
}
```

location - [required] a relative path inside the app folder to the javascript modules
modules - [required] list of modules to expose
    [module_name] - [required] the module name to be used in the auto API (i.e. http://www.mysite.com/modules/[module_name])
        location - [optional] override the modules location folder for this module
        fileName - [required] the module file name inside the modules folder
        methods - [optional] list of public methods in the module which should be exposed as part of the auto API
        properties - [optional] list of public properties in the module which should be exposed as part of the auto API



Templates
---------
Master pages are optional but when they are used, there are very basic rules to follow.
1. In the master page declare an element with the id of "content", that's where the content pages will be injected
2. When a page is merged with a master pages, all the content under the body element is used, and if only a partial part
of the page is needed, use the ".bodyContent" class on an element which wraps the desired content


