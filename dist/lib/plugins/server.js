"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.spawnServer = spawnServer;
exports.onDestroy = onDestroy;
exports["default"] = exports.overwritable = exports.hooks = exports.prototypes = exports.rxdb = void 0;

var _express = _interopRequireDefault(require("express"));

var _cors = _interopRequireDefault(require("cors"));

var _pouchDb = require("../pouch-db");

var _rxError = require("../rx-error");

var _core = _interopRequireDefault(require("../core"));

var _replication = _interopRequireDefault(require("./replication"));

var _watchForChanges = _interopRequireDefault(require("./watch-for-changes"));

_core["default"].plugin(_replication["default"]);

_core["default"].plugin(_watchForChanges["default"]);

var ExpressPouchDB;

try {
  ExpressPouchDB = require('express-pouchdb');
} catch (error) {
  console.error('Since version 8.4.0 the module \'express-pouchdb\' is not longer delivered with RxDB.\n' + 'You can install it with \'npm install express-pouchdb\'');
} // we have to clean up after tests so there is no stupid logging
// @link https://github.com/pouchdb/pouchdb-server/issues/226


var PouchdbAllDbs = require('pouchdb-all-dbs');

PouchdbAllDbs(_pouchDb.PouchDB);
var APP_OF_DB = new WeakMap();
var SERVERS_OF_DB = new WeakMap();
var DBS_WITH_SERVER = new WeakSet();

var normalizeDbName = function normalizeDbName(db) {
  var splitted = db.name.split('/').filter(function (str) {
    return str !== '';
  });
  return splitted.pop();
};

var getPrefix = function getPrefix(db) {
  var splitted = db.name.split('/').filter(function (str) {
    return str !== '';
  });
  splitted.pop(); // last was the name

  if (splitted.length === 0) return '';
  var ret = splitted.join('/') + '/';
  if (db.name.startsWith('/')) ret = '/' + ret;
  return ret;
};
/**
 * tunnel requests so collection-names can be used as paths
 */


function tunnelCollectionPath(db, path, app, colName) {
  db[colName].watchForChanges();
  var pathWithSlash = path.endsWith('/') ? path : path + '/';
  var collectionPath = pathWithSlash + colName;
  app.use(collectionPath, function (req, res, next) {
    if (req.baseUrl.endsWith(collectionPath)) {
      var to = normalizeDbName(db) + '-rxdb-0-' + colName;
      var toFull = req.originalUrl.replace(collectionPath, pathWithSlash + to);
      req.originalUrl = toFull;
    }

    next();
  });
}

function spawnServer(_ref) {
  var _ref$path = _ref.path,
      path = _ref$path === void 0 ? '/db' : _ref$path,
      _ref$port = _ref.port,
      port = _ref$port === void 0 ? 3000 : _ref$port,
      _ref$cors = _ref.cors,
      cors = _ref$cors === void 0 ? false : _ref$cors,
      _ref$startServer = _ref.startServer,
      startServer = _ref$startServer === void 0 ? true : _ref$startServer;
  var db = this;
  var collectionsPath = startServer ? path : '/';
  if (!SERVERS_OF_DB.has(db)) SERVERS_OF_DB.set(db, []);

  var pseudo = _pouchDb.PouchDB.defaults({
    adapter: db.adapter,
    prefix: getPrefix(db)
  });

  var app = (0, _express["default"])();
  APP_OF_DB.set(db, app); // tunnel requests so collection-names can be used as paths

  Object.keys(db.collections).forEach(function (colName) {
    return tunnelCollectionPath(db, collectionsPath, app, colName);
  }); // show error if collection is created afterwards

  DBS_WITH_SERVER.add(db);

  if (cors) {
    app.use((0, _cors["default"])({
      'origin': function origin(_origin, callback) {
        var originToSend = _origin || '*';
        callback(null, originToSend);
      },
      'credentials': true,
      'methods': 'DELETE,GET,HEAD,OPTIONS,PATCH,POST,PUT'
    }));
  }

  app.use(collectionsPath, ExpressPouchDB(pseudo));
  var server = null;

  if (startServer) {
    server = app.listen(port);
    SERVERS_OF_DB.get(db).push(server);
  }

  return {
    app: app,
    server: server
  };
}
/**
 * when a server is created, no more collections can be spawned
 */


function ensureNoMoreCollections(args) {
  if (DBS_WITH_SERVER.has(args.database)) {
    var err = (0, _rxError.newRxError)('S1', {
      collection: args.name,
      database: args.database.name
    });
    throw err;
  }
}
/**
 * runs when the database gets destroyed
 */


function onDestroy(db) {
  if (SERVERS_OF_DB.has(db)) SERVERS_OF_DB.get(db).forEach(function (server) {
    return server.close();
  });
}

var rxdb = true;
exports.rxdb = rxdb;
var prototypes = {
  RxDatabase: function RxDatabase(proto) {
    proto.server = spawnServer;
  }
};
exports.prototypes = prototypes;
var hooks = {
  preDestroyRxDatabase: onDestroy,
  preCreateRxCollection: ensureNoMoreCollections
};
exports.hooks = hooks;
var overwritable = {};
exports.overwritable = overwritable;
var _default = {
  rxdb: rxdb,
  prototypes: prototypes,
  overwritable: overwritable,
  hooks: hooks,
  spawnServer: spawnServer
};
exports["default"] = _default;

//# sourceMappingURL=server.js.map