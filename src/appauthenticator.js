var Reference = require('./reference'),
  request = require('./utils/request'),
  makeUrl = require('./utils/make-url'),
  when = require('when');

/**
 * A promise that will resolve to an App Claims
 * @typedef {Object} AppClaimsPromise
 */

/**
 * The authentication ticket used to authenticate anything.
 * @class AuthTicket
 * @property {string} accessToken The token that stores an encrypted list of the application's configured behaviors and authenticates the application.
 * @property {Date} accessTokenExpiration Date and time the access token expires. After the access token expires, refresh the authentication ticket using the refresh token.
 * @property {string} refreshToken The token that refreshes the application's authentication ticket.
 * @property {Date} refreshTokenExpiration Date and time the refresh token expires. After the refresh token expires, generate a new authentication ticket.
 */
function AuthTicket(json) {
  var self = this;
  for (var p in json) {
    if (json.hasOwnProperty(p)) {
      self[p] = p.indexOf('Expiration') !== -1 ? new Date(json[p]) : json[p]; // dateify the dates, this'll break if the prop name changes
    }
  }
}

function getAuthTicket(client) {
  return request({
    method: 'POST', 
    url: client.host + "/api/platform/applications/authtickets", 
    body: {
      applicationId: client.appId,
      sharedSecret: client.sharedSecret
    }
  }).then(function(json) {
    return new AuthTicket(json);
  });
}

function refreshTicket(client, ticket) {
  return request({
    method: 'PUT',
    url: client.host + "/api/platform/applications/authtickets/refresh-ticket", 
    body: {
      refreshToken: ticket.refreshToken
    }
  }).then(function(json) {
    return new AuthTicket(json);
  })
}

var developerAuthTicketUrl = '{+homePod}/api/platform/developer/authtickets/{?developerAccountId}';

function getDeveloperAuthTicket(client) {
  return getAppClaims(client).then(function(claims) {
    return request({
      method: 'PUT',
      url: makeUrl(client, developerAuthTicketUrl, {}),
      body: {
        developerAccountId: client.developerAccountId,
        userAuthInfo: client.developerAccount,
      },
      contextHeaders: {
        'app-claims': claims
      }
    })
  }).then(function(json) {
    return new AuthTicket(json);
  })
}

function refreshDeveloperAuthTicket(client, ticket) {
  return request({
    method: 'PUT',
    url: makeUrl(client, developerAuthTicketUrl, {}),
    body: {
      developerAccountId: client.developerAccountId,
      existingAuthTicket: ticket
    }
  }).then(function(json) {
    return new AuthTicket(json);
  })
}

function makeClaimMemoizer(requester, refresher) {
  var claimCache = {};
  return function(client) {
    var now = new Date(),
        cached = claimCache[appId],
        cacheAndReturnAccessToken = function(ticket) {
          claimCache[appId] = ticket;
          return ticket.accessToken;
        };
    if (!cached || (cached.refreshTokenExpiration < now && cached.accessTokenExpiration < now)) {
      return requester(client).then(cacheAndReturnAccessToken);
    } else if (cached.accessTokenExpiration < now && cached.refreshTokenExpiration > now) {
      return refresher(client, cached).then(cacheAndReturnAccessToken);
    } else {
      return when(cached.accessToken);
    }
  };
}

var getAppClaims = makeClaimMemoizer(getAuthTicket, refreshTicket);

/**
 * Get app claims string. Returns a promise because if necessary this will re-authenticate to acquire the string.
 * @return {AppClaimsPromise}
 * @param {string} host The host to use to access the platform service, e.g. `http://home.mozu.com` for normal production environments
 * @param {string} appId Application Id
 * @param {string} sharedSecret Shared Secret
 */
module.exports = {
  getAppClaims: getAppClaims,
  getDeveloperUserClaims: makeClaimMemoizer(getDeveloperAuthTicket, refreshDeveloperAuthTicket)
};