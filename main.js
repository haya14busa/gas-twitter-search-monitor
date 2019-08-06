// Dependencies: https://github.com/airhadoken/twitter-lib

// Set below constants in script properties.
var TWITTER_SEARCH_QUERY = getProperty('TWITTER_SEARCH_QUERY');
var SLACK_WEBHOOK_URL = getProperty('SLACK_WEBHOOK_URL');
// TWITTER_CONSUMER_KEY
// TWITTER_CONSUMER_SECRET
// TWITTER_ACCESS_TOKEN
// TWITTER_ACCESS_SECRET

// Internal script constants.
var TWITTER_LAST_TWEET_ID = 'TWITTER_LAST_TWEET_ID';
var TWITTER_USER_ID = 'TWITTER_USER_ID';

// For debugging.
var USE_SINCE_ID = true;
var SEND_ONLY_LATEST = false;

function main() {
  Logger.log('hello');

  var oauth = new Twitterlib.OAuth(PropertiesService.getScriptProperties());
  oauth.checkAccess();

  if (!TWITTER_SEARCH_QUERY) {
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
  var tweets = oauth.fetchTweets(TWITTER_SEARCH_QUERY, /*tweet_processor*/null , options);
  for (var i = 0; i < tweets.length; i++) {
    var t = tweets[i];
    // Logger.log(JSON.stringify(t));
    if (i === 0) {
      var id = t.id;
      if (id === last_tweet_id && USE_SINCE_ID) {
        Logger.log('No new tweets found.');
        break;
      }
      setProperty(TWITTER_LAST_TWEET_ID, id.toString());
    }
    notify(t, oauth);
    if (SEND_ONLY_LATEST) {
      break;
    }
    wait();
  }
}

function buildTweetURL(tweet) {
  return 'https://twitter.com/' + tweet.user.screen_name + '/status/' + tweet.id_str;
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

function notify(tweet, oauth) {
  // sendTwitterDM(tweet, oauth);
  notifySlack(tweet, SLACK_WEBHOOK_URL);
}

function notifySlack(tweet, webhook) {
  var text = buildTweetURL(tweet);
  if (tweet.user.following) {
    text = '<!channel> ' + text;
  }
  var data = {
    'text': text,
    'unfurl_links': true,
  };
  var options = {
    'method' : 'post',
    'contentType': 'application/json',
    'payload' : JSON.stringify(data)
  };
  UrlFetchApp.fetch(webhook, options);
}

function sendTwitterDM(tweet, oauth) {
  var tweet_url = buildTweetURL(tweet);
  var user_id = getCachedUserId(oauth);
  oauth.send_direct_message(user_id, tweet_url);
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

// wait waits for short time to avoid API limit.
function wait() {
  Utilities.sleep(500);
}
