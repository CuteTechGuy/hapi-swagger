const BearerToken = require('hapi-auth-bearer-token');
const H2o2 = require('@hapi/h2o2');
const Hapi = require('@hapi/hapi');
const Boom = require('@hapi/boom');
const Inert = require('@hapi/inert');
const Vision = require('@hapi/vision');
const Wreck = require('@hapi/wreck');
const HapiSwagger = require('../lib/index.js');

const helper = (module.exports = {});

/**
 * creates a Hapi server
 *
 * @param  {Object} swaggerOptions
 * @param  {Object} routes
 * @param  {Function} callback
 */
helper.createServer = async (swaggerOptions, routes, serverOptions = {}) => {
  const server = new Hapi.Server(serverOptions);

  await server.register([
    Inert,
    Vision,
    H2o2,
    {
      plugin: HapiSwagger,
      options: swaggerOptions
    }
  ]);

  if (routes) {
    server.route(routes);
  }

  await server.start();
  return server;
};

/**
 * creates a Hapi server with multiple plugins
 *
 * @param  {Object} swaggerOptions
 * @param  {Object} routes
 * @param  {Function} callback
 */
helper.createServerMultiple = async (swaggerOptions1, swaggerOptions2, routes, serverOptions = {}) => {
  const server = new Hapi.Server(serverOptions);

  await server.register([Inert, Vision, H2o2]);

  await server.register(
    {
      plugin: HapiSwagger,
      options: swaggerOptions1
    },
    {
      routes: { prefix: '/' + swaggerOptions1.routeTag || 'api1' }
    }
  );

  await server.register(
    {
      plugin: HapiSwagger,
      options: swaggerOptions2
    },
    {
      routes: { prefix: '/' + swaggerOptions2.routeTag || 'api2' }
    }
  );

  if (routes) {
    server.route(routes);
  }

  await server.start();
  return server;
};

/**
 * creates a Hapi server using bearer token auth
 *
 * @param  {Object} swaggerOptions
 * @param  {Object} routes
 * @param  {Function} callback
 */
helper.createAuthServer = async (swaggerOptions, routes, serverOptions = {}) => {
  const server = new Hapi.Server(serverOptions);

  await server.register([
    Inert,
    Vision,
    H2o2,
    BearerToken,
    {
      plugin: HapiSwagger,
      options: swaggerOptions
    }
  ]);

  server.auth.strategy('bearer', 'bearer-access-token', {
    accessTokenName: 'access_token',
    validate: helper.validateBearer
  });
  server.route(routes);

  await server.start();

  return server;
};

/**
 * creates a Hapi server using JWT auth
 *
 * @param  {Object} swaggerOptions
 * @param  {Object} routes
 * @param  {Function} callback
 */
helper.createJWTAuthServer = async (swaggerOptions, routes) => {
  const people = {
    56732: {
      id: 56732,
      name: 'Jen Jones',
      scope: ['a', 'b']
    }
  };
  const privateKey = 'hapi hapi joi joi';
  // const token = JWT.sign({ id: 56732 }, privateKey, { algorithm: 'HS256' });
  const validateJWT = (decoded) => {
    if (!people[decoded.id]) {
      return { valid: false };
    }

    return { valid: true };
  };

  const server = new Hapi.Server();

  await server.register([
    Inert,
    Vision,
    require('hapi-auth-jwt2'),
    {
      plugin: HapiSwagger,
      options: swaggerOptions
    }
  ]);

  server.auth.strategy('jwt', 'jwt', {
    key: privateKey,
    validate: validateJWT,
    verifyOptions: { algorithms: ['HS256'] }
  });

  server.auth.default('jwt');

  server.route(routes);
  await server.start();
  return server;
};

/**
 * a handler function used to mock a response
 *
 * @param  {Object} request
 * @param  {Object} reply
 */
helper.defaultHandler = () => {
  return 'ok';
};

/**
 * a handler function used to mock a response to a authorized request
 *
 * @param  {Object} request
 * @param  {Object} reply
 */
helper.defaultAuthHandler = (request) => {
  if (request.auth && request.auth.credentials && request.auth.credentials.user) {
    return request.auth.credentials.user;
  }

  return Boom.unauthorized(['unauthorized access'], [request.auth.strategy]);
};

/**
 * a validation function for bearer strategy
 *
 * @param  {String} token
 * @param  {Function} callback
 */
helper.validateBearer = (request, token) => ({
  isValid: token === '12345',

  credentials: {
    token,
    user: {
      username: 'glennjones',
      name: 'Glenn Jones',
      groups: ['admin', 'user']
    }
  }
});

/**
 * fires a Hapi reply with json payload - see h2o2 onResponse function signature
 *
 * @param  {Object} err
 * @param  {Object} res
 * @param  {Object} request
 * @param  {Object} reply
 * @param  {Object} settings
 * @param  {Int} ttl
 **/
helper.replyWithJSON = async (_, res) => {
  const { payload } = await Wreck.read(res, { json: true });
  return payload;
};

/**
 * creates an object with properties which are not its own
 *
 * @return {Object}
 */
helper.objWithNoOwnProperty = () => {
  const sides = { a: 1, b: 2, c: 3 };
  const Triangle = function () {};
  Triangle.prototype = sides;
  return new Triangle();
};

helper.getAssetsPaths = (html) => {
  const linkTag = '<link';
  const scriptTag = '<script src';

  return html
    .split('\n')
    .filter((line) => line.includes(linkTag) || line.includes(scriptTag))
    .map((line) => {
      let firstSplit;

      if (line.includes(linkTag)) {
        [, firstSplit] = line.split('href="');
      } else {
        [, firstSplit] = line.split('src="');
      }

      const [assetPath] = firstSplit.split('"');

      return assetPath;
    });
};
