# AnyFetch Provider Library

[![Build Status](https://travis-ci.org/AnyFetch/anyfetch-provider.js.png?branch=master)](https://travis-ci.org/AnyFetch/anyfetch-provider.js)[![Dependency Status](https://gemnasium.com/AnyFetch/anyfetch-provider.js.png)](https://gemnasium.com/AnyFetch/anyfetch-provider.js)
[![Coverage Status](https://coveralls.io/repos/AnyFetch/anyfetch-provider.js/badge.png?branch=master)](https://coveralls.io/r/AnyFetch/anyfetch-provider.js?branch=master)
[![NPM version](https://badge.fury.io/js/anyfetch-provider.png)](http://badge.fury.io/js/anyfetch-provider)

Node.js toolkit for creating [AnyFetch](http://anyfetch.com) providers.

## Introduction

### What is it ?

AnyFetch provider is a library based on [AnyFetch.js](https://github.com/AnyFetch/anyfetch.js) giving enough boilerplate to create [Anyfetch providers](http://developers.anyfetch.com/#toc_1) easily

![AnyFetch workflow](http://developers.anyfetch.com/images/workflow.png)

This library provides a set of routes to add in a [restify](https://github.com/mcavage/node-restify) application spawning providing jobs in a redis job queue (managed with [kue](https://github.com/LearnBoost/kue)).

### Dependencies

* [Redis](http://redis.io/) for managing job queues
* [MongoDB](http://www.mongodb.org/) for storing token pairs

### Usage

Get a client id and a client secret [in the manager](http://manager.anyfetch.com/clients/new).

```js
var restify = require('restify');
var kue = require('kue');
var mongoose = require('mongoose');
var request = require('supertest');
var anyfetchProvider = require('anyfetch-provider');

var server = restify.createServer();
var jobs = kue.createQueue();

server.use(restify.acceptParser(server.acceptable));
server.use(restify.queryParser());
server.use(restify.bodyParser());

anyfetchProvider(server, {
  anyfetchClientId: "<your client id>",
  anyfetchClientSecret: "<your client secret>",
  anyfetchRedirectUri: "https://<my provider>/init/connect",
  jobQueue: jobs,
  mongoConnection: mongoose.createConnection('mongodb://localhost/test')
});

server.get('/init/connect', function(req, res, next) {
  /* redirect the user to the other's service grant page with a state parameter
     taking the following value: `req.params.code` */
});

server.get('/init/callback', function(req, res, next) {
  var serviceToken;
  var anyfetchCode; // <- state parameter
  /* get the token from the other service and get back the state parameter */
  req.anyfetch.associate(anyfetchCode, serviceToken, function(err) {
    if(err) {
      next(err);
    }
    res.send(302, 'https://manager.anyfetch.com/tokens');
  });
});

jobs.process('update', function(job, done) {
  var serviceToken = job.data.serviceToken;
  var cursor = job.data.cursor;

  /* Fetch the data you need that happend after the cursor (default is null for
     a fresh start */

  var document = {
    identifier: "https://<my provider>/unique",
    metadata: {
      foo: 'bar',
      hello: ['world']
    }
  };

  // See https://github.com/AnyFetch/anyfetch.js for more documentation
  job.anyfetch.sendDocument(document);

  // PRO TIP: create new jobs for sending multiple documents and delegate the
  //          work there
});

server.listen(3000);
```

## Bootstrap function

### `anyfetchProvider(restifyServer, options)`

This function takes the restify server to bootstrap (i.e. add new middleware, endpoints, and so on ...). It also takes a mandatory options object.

The options are the following :

* `anyfetchClientId` The anyfetch client id generated with the [manager](https://manager.anyfetch.com)
* `anyfetchClientSecret` The anyfetch client secret generated with the manager
* `anyfetchRedirectUri` The endpoint where anyfetch will give you the auth code
* `jobQueue` The kue job queue to use for sending `update` jobs
* `mongoConnection` A mongoose connection to MongoDB

## Restify endpoints

* `POST /update` Give the order to the provider to check for new data, this will spawn new `update` jobs.
* `DELETE /reset` Make the provider forget about everything of what already happened (it resets the `cursor` to `null`)
* `GET /status` Outputs status for a given user on his own account

## Contextual helpers

Inside any restify middleware you can find an AnyFetch.js (the binding for AnyFetch) instance bound to `req` (`req.anyfetch`) with an additional associated method `associate`. This context can also be found with jobs: `job.anyfetch`.

For more information on the `anyfetch` context, please see [anyfetch.js](https://github.com/AnyFetch/anyfetch.js).

### `anyfetch.associate(anyfetchCode, serviceToken, callback)`

Generates a new anyfetch access token with the `anyfetchCode` parameter and associates it to the `serviceToken` for future use inside the jobs.

This function uses a callback that can eventually return an error.
