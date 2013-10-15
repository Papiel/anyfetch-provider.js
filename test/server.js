'use strict';

require('should');
var request = require('supertest');

var async = require('async');
var cleaner = require('./hooks.js').cleaner;
var ProviderServer = require('../lib/cluestr-provider');
var TempToken = require('../lib/cluestr-provider/models/temp-token.js');
var Token = require('../lib/cluestr-provider/models/token.js');

var accessGrant = "dqzknr54dzgd6f5";

var initAccount = function(req, res, next) {
  var preDatas = {
    accessGrant: accessGrant
  };
  next(null, preDatas);
};

var connectAccountRetrieveTempToken = function(req, res, TempToken, next) {
  // Retrieve temp token
  TempToken.findOne({'datas.accessGrant': accessGrant}, next);
};

var connectAccountRetrieveAuthDatas = function(req, res, preDatas, next) {
  var datas = preDatas.accessGrant + "_accessToken";
  next(null, datas, 'http://myprovider.example.org/config');
};

var updateAccount = function(datas, next) {
  // Update the account !
  next();
};

var queueWorker = function(task, cb) {
  // Upload document
  cb();
};

var config = {};

beforeEach(function() {
  // Reset config to pristine state
  config = {
    initAccount: initAccount,
    connectAccountRetrieveTempToken: connectAccountRetrieveTempToken,
    connectAccountRetrieveAuthDatas: connectAccountRetrieveAuthDatas,
    updateAccount: updateAccount,
    queueWorker: queueWorker,

    cluestrAppId: 'appId',
    cluestrAppSecret: 'appSecret',
    connectUrl: 'http://localhost:1337/init/connect'
  };
});


describe("ProviderServer.createServer() config", function() {
  it("should validate correct config", function(done) {
    var ret = ProviderServer.validateConfig(config);

    if(ret) {
      throw new Error("No error should be returned");
    }

    done();
  });

  it("should err on missing handler", function(done) {
    delete config.initAccount;
    ProviderServer.validateConfig(config).toString().should.include('Specify `initAccount');
    done();
  });

  it("should err on missing parameter", function(done) {
    delete config.cluestrAppId;
    ProviderServer.validateConfig(config).toString().should.include('Specify `cluestrAppId');
    done();
  });
});

describe("ProviderServer.createServer()", function() {
  beforeEach(cleaner);

  it("should require cluestr code", function(done) {
    var server = ProviderServer.createServer(config);

    request(server).get('/init/connect')
      .expect(409)
      .end(done);
  });

  it("should store datas returned by initAccount() in TempToken", function(done) {
    var initAccount = function(req, res, next) {
      var preDatas = {
        "foo": "bar"
      };

      res.send(204);
      next(null, preDatas);
    };

    config.initAccount = initAccount;

    var server = ProviderServer.createServer(config);

    request(server).get('/init/connect?code=cluestr_code')
      .expect(204)
      .end(function(err) {
        if(err) {
          throw err;
        }

        TempToken.findOne({'datas.foo': 'bar'}, function(err, tempToken) {
          if(err) {
            return done(err);
          }

          tempToken.should.have.property('cluestrCode', 'cluestr_code');

          done();
        });

      });
  });


  it("should retrieve datas on TempToken", function(done) {
    var originalPreDatas = {
      'key': 'retrieval',
      'something': 'data'
    };

    async.series([
      function(cb) {
        // Fake a call to /init/connect returned this datas
        var tempToken = new TempToken({
          cluestrCode: 'cluestr_token',
          datas: originalPreDatas
        });

        tempToken.save(cb);
      },
      function(cb) {
        var connectAccountRetrieveTempToken = function(req, res, TempToken, next) {
          // Retrieve temp token
          TempToken.findOne({'datas.key': req.params.code}, next);
        };

        var connectAccountRetrieveAuthDatas = function(req, res, preDatas, next) {
          preDatas.should.eql(originalPreDatas);
          next(null, {
            'final': 'my-code'
          });
        };

        config.connectAccountRetrieveTempToken = connectAccountRetrieveTempToken;
        config.connectAccountRetrieveAuthDatas = connectAccountRetrieveAuthDatas;

        var server = ProviderServer.createServer(config);

        request(server).get('/init/callback?code=retrieval')
          .expect(302)
          .end(function(err) {
          if(err) {
            throw err;
          }

          Token.findOne({'datas.final': 'my-code'}, function(err, token) {
            if(err) {
              return cb(err);
            }

            if(!token) {
              throw new Error("Token should be saved.");
            }

            cb();
          });
        });
      }
    ], done);
  });
});
