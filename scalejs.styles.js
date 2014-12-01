/*
 * css.normalize.js
 *
 * CSS Normalization
 *
 * CSS paths are normalized based on an optional basePath and the RequireJS config
 *
 * Usage:
 *   normalize(css, fromBasePath, toBasePath);
 *
 * css: the stylesheet content to normalize
 * fromBasePath: the absolute base path of the css relative to any root (but without ../ backtracking)
 * toBasePath: the absolute new base path of the css relative to the same root
 *
 * Absolute dependencies are left untouched.
 *
 * Urls in the CSS are picked up by regular expressions.
 * These will catch all statements of the form:
 *
 * url(*)
 * url('*')
 * url("*")
 *
 * @import '*'
 * @import "*"
 *
 * (and so also @import url(*) variations)
 *
 * For urls needing normalization
 *
 */

define('normalize', function() {

    // regular expression for removing double slashes
    // eg http://www.example.com//my///url/here -> http://www.example.com/my/url/here
    var slashes = /([^:])\/+/g
    var removeDoubleSlashes = function(uri) {
        return uri.replace(slashes, '$1/');
    }

    // given a relative URI, and two absolute base URIs, convert it from one base to another
    var protocolRegEx = /[^\:\/]*:\/\/([^\/])*/;
var absUrlRegEx = /^(\/|data:)/;
function convertURIBase(uri, fromBase, toBase) {
    if (uri.match(absUrlRegEx) || uri.match(protocolRegEx))
        return uri;
    uri = removeDoubleSlashes(uri);
    // if toBase specifies a protocol path, ensure this is the same protocol as fromBase, if not
    // use absolute path at fromBase
    var toBaseProtocol = toBase.match(protocolRegEx);
    var fromBaseProtocol = fromBase.match(protocolRegEx);
    if (fromBaseProtocol && (!toBaseProtocol || toBaseProtocol[1] != fromBaseProtocol[1] || toBaseProtocol[2] != fromBaseProtocol[2]))
        return absoluteURI(uri, fromBase);

    else {
        return relativeURI(absoluteURI(uri, fromBase), toBase);
    }
};

// given a relative URI, calculate the absolute URI
function absoluteURI(uri, base) {
    if (uri.substr(0, 2) == './')
        uri = uri.substr(2);

    // absolute urls are left in tact
    if (uri.match(absUrlRegEx) || uri.match(protocolRegEx))
        return uri;

    var baseParts = base.split('/');
    var uriParts = uri.split('/');

    baseParts.pop();

    while (curPart = uriParts.shift())
        if (curPart == '..')
            baseParts.pop();
    else
        baseParts.push(curPart);

    return baseParts.join('/');
};


// given an absolute URI, calculate the relative URI
function relativeURI(uri, base) {

    // reduce base and uri strings to just their difference string
    var baseParts = base.split('/');
    baseParts.pop();
    base = baseParts.join('/') + '/';
    i = 0;
    while (base.substr(i, 1) == uri.substr(i, 1))
        i++;
    while (base.substr(i, 1) != '/')
        i--;
    base = base.substr(i + 1);
    uri = uri.substr(i + 1);

    // each base folder difference is thus a backtrack
    baseParts = base.split('/');
    var uriParts = uri.split('/');
    out = '';
    while (baseParts.shift())
        out += '../';

    // finally add uri parts
    while (curPart = uriParts.shift())
        out += curPart + '/';

    return out.substr(0, out.length - 1);
};

var normalizeCSS = function(source, fromBase, toBase) {

    fromBase = removeDoubleSlashes(fromBase);
    toBase = removeDoubleSlashes(toBase);

    var urlRegEx = /@import\s*("([^"]*)"|'([^']*)')|url\s*\(\s*(\s*"([^"]*)"|'([^']*)'|[^\)]*\s*)\s*\)/ig;
    var result, url, source;

    while (result = urlRegEx.exec(source)) {
        url = result[3] || result[2] || result[5] || result[6] || result[4];
        var newUrl;
        newUrl = convertURIBase(url, fromBase, toBase);
        var quoteLen = result[5] || result[6] ? 1 : 0;
        source = source.substr(0, urlRegEx.lastIndex - url.length - quoteLen - 1) + newUrl + source.substr(urlRegEx.lastIndex - quoteLen - 1);
        urlRegEx.lastIndex = urlRegEx.lastIndex + (newUrl.length - url.length);
    }

    return source;
};

normalizeCSS.convertURIBase = convertURIBase;
normalizeCSS.absoluteURI = absoluteURI;
normalizeCSS.relativeURI = relativeURI;

return normalizeCSS;
});
define('lessc', ['require'], function(require) {

    var lessAPI = {};

    lessAPI.pluginBuilder = './less-builder';

    if (typeof window == 'undefined') {
        lessAPI.load = function(n, r, load) { load(); }
        return lessAPI;
    }

    lessAPI.normalize = function(name, normalize) {
        if (name.substr(name.length - 5, 5) == '.less')
            name = name.substr(0, name.length - 5);

        name = normalize(name);

        return name;
    }

    var head = document.getElementsByTagName('head')[0];

    var base = document.getElementsByTagName('base');
    base = base && base[0] && base[0] && base[0].href;
    var pagePath = (base || window.location.href.split('#')[0].split('?')[0]).split('/');
    pagePath[pagePath.length - 1] = '';
    pagePath = pagePath.join('/');

    // set initial default configuration
    window.less = window.less || {
        env: 'development'
    };

    var styleCnt = 0;
    var curStyle;
    lessAPI.inject = function(css) {
        if (styleCnt < 31) {
            curStyle = document.createElement('style');
            curStyle.type = 'text/css';
            head.appendChild(curStyle);
            styleCnt++;
        }
        if (curStyle.styleSheet)
            curStyle.styleSheet.cssText += css;
        else
            curStyle.appendChild(document.createTextNode(css));
    }

    lessAPI.load = function(lessId, req, load, config) {
        require(['lessc', 'normalize'], function(lessc, normalize) {

            var fileUrl = req.toUrl(lessId + '.less');
            fileUrl = normalize.absoluteURI(fileUrl, pagePath);

            var parser = new lessc.Parser(window.less);

            parser.parse('@import (multiple) "' + fileUrl + '";', function(err, tree) {
                if (err)
                    return load.error(err);

                lessAPI.inject(normalize(tree.toCSS(config.less), fileUrl, pagePath));

                setTimeout(load, 7);
            });

        });
    }

    return lessAPI;
});

/*global define*/
/*jslint unparam:true*/
define(function () {
    'use strict';

    return {
        load: function (name, req, onLoad, config) {
            var names = name.match(/([^,]+)/g) || [];

            names = names.map(function (n) {
                if (n.indexOf('/') === -1) {
                    n = './styles/' + n;
                }

                return 'lessc!' + n;
            });

            req(names, function () {
                onLoad(Array.prototype.slice.call(arguments, 0, arguments.length));
            });
        }
    };
});
