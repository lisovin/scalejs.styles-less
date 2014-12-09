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

define(['require', 'normalize'], function(req, normalize) {
  var lessAPI = {};

  var isWindows = !!process.platform.match(/^win/);

  var baseParts = req.toUrl('base_url').split('/');
  baseParts[baseParts.length - 1] = '';
  var baseUrl = baseParts.join('/');

  function compress(css) {
    if (typeof process !== "undefined" && process.versions && !!process.versions.node && require.nodeRequire) {
      try {
        var csso = require.nodeRequire('csso');
        var csslen = css.length;
        css = csso.justDoIt(css);
        console.log('Compressed CSS output to ' + Math.round(css.length / csslen * 100) + '%.');
        return css;
      }
      catch(e) {
        console.log('Compression module not installed. Use "npm install csso -g" to enable.');
        return css;
      }
    }
    console.log('Compression not supported outside of nodejs environments.');
    return css;
  }
  function saveFile(path, data) {
    if (typeof process !== "undefined" && process.versions && !!process.versions.node && require.nodeRequire) {
      var fs = require.nodeRequire('fs');
      fs.writeFileSync(path, data, 'utf8');
    }
    else {
      var content = new java.lang.String(data);
      var output = new java.io.BufferedWriter(new java.io.OutputStreamWriter(new java.io.FileOutputStream(path), 'utf-8'));

      try {
        output.write(content, 0, content.length());
        output.flush();
      }
      finally {
        output.close();
      }
    }
  }

  function escape(content) {
    return content.replace(/(["'\\])/g, '\\$1')
      .replace(/[\f]/g, "\\f")
      .replace(/[\b]/g, "\\b")
      .replace(/[\n]/g, "\\n")
      .replace(/[\t]/g, "\\t")
      .replace(/[\r]/g, "\\r");
  }

  var config;
  var siteRoot;

  var less = require.nodeRequire('less');
  var path = require.nodeRequire('path');

  var layerBuffer = [];
  var lessBuffer = {};

  lessAPI.normalize = function(name, normalize) {
    if (name.substr(name.length - 5, 5) == '.less')
      name = name.substr(0, name.length - 5);
    return normalize(name);
  }

  var absUrlRegEx = /^([^\:\/]+:\/)?\//;

  lessAPI.load = function(name, req, load, _config) {
    //store config
    config = config || _config;

    if (!siteRoot) {
      siteRoot = path.resolve(config.dir || path.dirname(config.out), config.siteRoot || '.') + '/';
      if (isWindows)
        siteRoot = siteRoot.replace(/\\/g, '/');
    }

    if (name.match(absUrlRegEx))
      return load();

    var fileUrl = req.toUrl(name + '.less');

    //add to the buffer
    var parser = new less.Parser({
      paths: [baseUrl],
      filename: fileUrl,
      async: false,
      syncImport: true
    });
    parser.parse('@import (multiple) "' + path.relative(baseUrl, fileUrl) + '";', function(err, tree) {
      if (err) {
        return load.error(err);
      }

      var css = tree.toCSS(config.less);

      // normalize all imports relative to the siteRoot, itself relative to the output file / output dir
      lessBuffer[name] = normalize(css, isWindows ? fileUrl.replace(/\\/g, '/') : fileUrl, siteRoot);

      load();
    });
  }

  var layerBuffer = [];

  lessAPI.write = function(pluginName, moduleName, write) {
    if (moduleName.match(absUrlRegEx))
      return load();

    layerBuffer.push(lessBuffer[moduleName]);

    write.asModule(pluginName + '!' + moduleName, 'define(function(){})');
  }

  lessAPI.onLayerEnd = function(write, data) {

    //calculate layer css
    var css = layerBuffer.join('');

    if (config.separateCSS) {
      console.log('Writing CSS! file: ' + data.name + '\n');

      var outPath = config.appDir ? config.baseUrl + data.name + '.css' : config.out.replace(/\.js$/, '.css');

      saveFile(outPath, compress(css));
    }
    else {
      if (css == '')
        return;
      write(
        "(function(c){var d=document,a='appendChild',i='styleSheet',s=d.createElement('style');s.type='text/css';d.getElementsByTagName('head')[0][a](s);s[i]?s[i].cssText=c:s[a](d.createTextNode(c));})\n"
        + "('" + escape(compress(css)) + "');\n"
      );
    }

    //clear layer buffer for next layer
    layerBuffer = [];
  }

  return lessAPI;
});
