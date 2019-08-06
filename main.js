// Dependencies: https://github.com/airhadoken/twitter-lib

var TWITTER_SEARCH_QUERY = 'TWITTER_SEARCH_QUERY';

// Internal script constants.
var TWITTER_LAST_TWEET_ID = 'TWITTER_LAST_TWEET_ID';
var TWITTER_USER_ID = 'TWITTER_USER_ID';

// For debugging.
var USE_SINCE_ID = false;
var SEND_ONLY_LATEST = true;

function main() {
  Logger.log('hello');

  var oauth = new Twitterlib.OAuth(PropertiesService.getScriptProperties());
  oauth.checkAccess();

  var query = getProperty(TWITTER_SEARCH_QUERY);
  if (!query) {
    throw 'TWITTER_SEARCH_QUERY is empty.'
  }

  var options = {
    multi: true,
    count: 5
  };

  var last_tweet_id = parseInt(getProperty(TWITTER_LAST_TWEET_ID));
  if (last_tweet_id && USE_SINCE_ID) {
    options.since_id = last_tweet_id;
  }
  var tweets = oauth.fetchTweets(query, /*tweet_processor*/null , options);
  for (var i = 0; i < tweets.length; i++) {
    var t = tweets[i];
    if (i === 0) {
      var id = t.id;
      if (id === last_tweet_id && USE_SINCE_ID) {
        Logger.log('No new tweets found.');
        break;
      }
      setProperty(TWITTER_LAST_TWEET_ID, id.toString());
    }
    var url = 'https://twitter.com/' + t.user.screen_name + '/status/' + t.id_str;
    var user_id = getCachedUserId(oauth);
    oauth.send_direct_message(user_id, url);
    if (SEND_ONLY_LATEST) {
      break;
    }
  }
}

function authCallback(request) {
  var OAuthConfig = new Twitterlib.OAuth(PropertiesService.getScriptProperties());
  OAuthConfig.handleCallback(request);
}

function getCachedUserId(oauth) {
  var user = oauth.verify_credential();
  var cached = getProperty(TWITTER_USER_ID);
  if (cached) {
    return cached;
  }
  setProperty(TWITTER_USER_ID, user.id_str);
  return user.id;
}

function getProperty(key) {
  return PropertiesService.getScriptProperties().getProperty(key);
}


function setProperty(key, value) {
  return PropertiesService.getScriptProperties().setProperty(key, value);
}

// https://developer.twitter.com/en/docs/direct-messages/sending-and-receiving/api-reference/new-event
Twitterlib.OAuth.prototype.send_direct_message = function(recipient_id_str, text) {
  this.checkAccess();

  var data = {
    event: {
      type: 'message_create',
      message_create: {
        target: {
          recipient_id: recipient_id_str
        },
        message_data: {
          text: text
        }
      }
    }
  };

  var options = {
    'method': 'POST',
    'contentType': 'application/json',
    'payload': JSON.stringify(data)
  };

  var url = 'https://api.twitter.com/1.1/direct_messages/events/new.json';

  try {
    var result = this.fetch(url, options);
    Logger.log("Sending Direct Message success. Response was:\n" + result.getContentText() + "\n\n");
    return JSON.parse(result.getContentText("UTF-8"));
  } catch (e) {
    Logger.log("Sending Direct Message failed. Error was:\n" + JSON.stringify(e) + "\n\noptions were:\n" + JSON.stringify(options) + "\n\n");
    return false;
  }

}

// https://developer.twitter.com/en/docs/accounts-and-users/manage-account-settings/api-reference/get-account-verify_credentials.html
Twitterlib.OAuth.prototype.verify_credential = function() {
  this.checkAccess();

  var options = {
    method: "GET",
    headers: {
      'Content-Type': 'application/json'
    }
  };

  var url = 'https://api.twitter.com/1.1/account/verify_credentials.json';

  try {
    var result = this.fetch(url, options);
    return JSON.parse(result.getContentText("UTF-8"));
  } catch (e) {
    Logger.log("verify_credential failed. Error was:\n" + JSON.stringify(e) + "\n\noptions were:\n" + JSON.stringify(options) + "\n\n");
    return false;
  }

}
