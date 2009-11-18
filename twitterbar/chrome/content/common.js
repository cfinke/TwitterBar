var TWITTERBAR_COMMON = {
	get strings() { return document.getElementById("twitterbar-strings"); },
	prefs : Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("extensions.twitter."),
	
	oauth : {
		consumer_key : "lwVKpcTJM69MeYobWq3mg",
		consumer_secret : "TVjchnocdkVUcFtNhzCzVwOql5meAgbShN621r6bueE", 
		
		request_token : {
			oauth_token : "",
			oauth_token_secret : ""
		},
		
		serviceProvider : {
			signatureMethod : "HMAC-SHA1",
			requestTokenURL : "http://twitter.com/oauth/request_token",
			userAuthorizationURL : "http://twitter.com/oauth/authorize",
			accessTokenURL : "http://twitter.com/oauth/access_token",
			echoURL : "http://www.chrisfinke.com/oauth/twitterbar"
		}
	},
	
	alert : function (msg) {
		var title = TWITTERBAR_COMMON.strings.getString("twitterbar.alertTitle");
		
		var prompts = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
								.getService(Components.interfaces.nsIPromptService);
		prompts.alert(null, title, msg);
	},
	
	confirm : function (msg) {
		var title = TWITTERBAR_COMMON.strings.getString("twitterbar.alertTitle");
		
		var prompts = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
								.getService(Components.interfaces.nsIPromptService);
		return prompts.confirm(null, title, msg);
	},
	
	confirmPost : function () {
		var title = TWITTERBAR_COMMON.strings.getString("twitterbar.alertTitle");
		var msg = TWITTERBAR_COMMON.strings.getString("twitterbar.confirmPostToTwitter");
		var cbMsg = TWITTERBAR_COMMON.strings.getString("twitterbar.confirmPrefString");
		
		var prompts = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
								.getService(Components.interfaces.nsIPromptService);

		var check = { value : TWITTERBAR_COMMON.prefs.getBoolPref("confirm") };
		var result = prompts.confirmCheck(null, title, msg, cbMsg, check);
		
		if (result) {
			TWITTERBAR_COMMON.prefs.setBoolPref("confirm", check.value);
			return true;
		}
		
		return false;
	},

	getTrends : function () {
		var lastUpdate = TWITTERBAR_COMMON.prefs.getCharPref("trends.update");
		var trends = TWITTERBAR_COMMON.prefs.getCharPref("trends");

		if (trends == "" || (new Date().getTime()) - lastUpdate > (1000 * 60 * 60 * 1.8)) {
			var feedUrl = "http://www.oneriot.com/rss/trendingtopics";

			var req = new XMLHttpRequest();
			req.open("GET", feedUrl, true);

			req.onreadystatechange = function () {
				if (req.readyState == 4) {
					if (req.status == 200) {
						var ioService = Components.classes["@mozilla.org/network/io-service;1"]
										.getService(Components.interfaces.nsIIOService);
						var data = req.responseText;
						var uri = ioService.newURI(feedUrl, null, null);

						if (data.length) {
							var parser = Components.classes["@mozilla.org/feed-processor;1"]
											.createInstance(Components.interfaces.nsIFeedProcessor);
							var listener = TWITTERBAR_COMMON;

							try {
								parser.listener = listener;
								parser.parseFromString(data, uri);
							} catch (e) {
							}
						}
					}
				}
			};

			req.send(null);
		}
	},

	handleResult: function(result) {
		TWITTERBAR_COMMON.prefs.setCharPref("trends.update", new Date().getTime());

		if (result.bozo) {
			return;
		}

		var feed = result.doc;

		if (!feed) {
			return;
		}

		try {
			feed.QueryInterface(Components.interfaces.nsIFeed);
		} catch (e) {
			return;
		}

		var numItems = Math.min(10, feed.items.length);

		var trends = [];

		for (var i = 0; i < numItems; i++) {
			var item = feed.items.queryElementAt(i, Components.interfaces.nsIFeedEntry);
			trends.push(item.title.plainText());
		}

		delete result;

		TWITTERBAR_COMMON.prefs.setCharPref("trends", trends.join("\t"));
	},
	
	addTrends : function (page) {
		// Check for the trending topics.
		var trends = page.getElementById("trends");

		if (trends) {
			var topics = TWITTERBAR_COMMON.prefs.getCharPref("trends").split("\t");
	
			if (topics) {
				var str = '<h2 id="twitterbar-trends" class="sidebar-title" style="background: transparent !important;"><span title="'+this.strings.getString("twitterbar.trends.byline")+'">'+this.strings.getString("twitterbar.trends.title")+'</span></h2>';
				str += '<ul class="sidebar-menu more-trends-links">';
		
				var limit = Math.min(10, topics.length);
		
				for (var i = 0; i < topics.length; i++) {
					str += '<li class="link-title"><a target="_blank" title="'+topics[i]+'" href="'+TWITTERBAR_COMMON.getSearchURL(topics[i], "trends-sidebar")+'"><span>'+topics[i]+'</span></a></li>';
				}
	
				str += '<li><small style="display: block; padding: 5px 14px 5px 14px;">'+this.strings.getString("twitterbar.trends.explanation")+'</small></li>';
				str += '</ul>';
				str += '<hr />';

				trends.innerHTML += str;
			}
		}
	},
	
	getSearchURL : function (search_terms, source) {
		search_terms = encodeURIComponent(search_terms);
		search_terms = search_terms.replace(/%20/g, "+");
		
		if (!source) { 
			source = "browserBox";
		}
		
		return "http://www.oneriot.com/search?q=" + search_terms + "&format=html&ssrc="+source+"&spid=86f2f5da-3b24-4a87-bbb3-1ad47525359d&p=twitterbar-ff/"+TWITTERBAR.version;
	}
};