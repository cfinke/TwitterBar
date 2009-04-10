var TWITTERBAR = {
	get strings() { return document.getElementById("twitterbar-strings"); },
	
	lastUrl : null,
	
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
    
    getBrowser: function () {
        if (typeof Browser != 'undefined') {
            return Browser;
        }
        else {
            return getBrowser();
        }
    },
    
    alert : function (msg) {
        var title = TWITTERBAR.strings.getString("twitterbar.alertTitle");
        
        var prompts = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                                .getService(Components.interfaces.nsIPromptService);
        prompts.alert(null, title, msg);
    },
    
    confirm : function (msg) {
        var title = TWITTERBAR.strings.getString("twitterbar.alertTitle");
        
        var prompts = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                                .getService(Components.interfaces.nsIPromptService);
        return prompts.confirm(null, title, msg);
    },
	
	confirmPost : function () {
        var title = this.strings.getString("twitterbar.alertTitle");
        var msg = this.strings.getString("twitterbar.confirmPostToTwitter");
        var cbMsg = this.strings.getString("twitterbar.confirmPrefString");
        
        var prompts = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                                .getService(Components.interfaces.nsIPromptService);

        var check = { value : TWITTERBAR.prefs.getBoolPref("confirm") };
        var result = prompts.confirmCheck(null, title, msg, cbMsg, check);
        
        if (result) {
            this.prefs.setBoolPref("confirm", check.value);
            return true;
        }
        
        return false;
    },
	
	load : function () {
	    this.prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("extensions.twitter.");	
		this.prefs.QueryInterface(Components.interfaces.nsIPrefBranch2);
		this.prefs.addObserver("", this, false);
		
		var version = Components.classes["@mozilla.org/extensions/manager;1"].getService(Components.interfaces.nsIExtensionManager).getItemForID("{1a0c9ebe-ddf9-4b76-b8a3-675c77874d37}").version;
		
		if (this.prefs.getCharPref("version") != version) {
			this.prefs.setCharPref("version", version);
			
			TWITTERBAR.getBrowser().selectedTab = TWITTERBAR.getBrowser().addTab("http://www.chrisfinke.com/addons/twitterbar/");
		}
		
        (document.getElementById("urlbar") || document.getElementById("urlbar-edit")).addEventListener("keyup", function (event) { TWITTERBAR.postKey(event); }, false);
		(document.getElementById("urlbar") || document.getElementById("urlbar-edit")).addEventListener("focus", function () { TWITTERBAR.focus(); }, false);
		
		this.buttonCheck();
		
		if (this.prefs.getCharPref("access_token.oauth_token") == "" || this.prefs.getCharPref("access_token.oauth_token_secret") == "") {
            try {
                var browsers = document.getElementById("browsers");
                browsers.addEventListener("load", TWITTERBAR.getAccessToken, true);
            } catch (notFennec) {
        	    getBrowser().addEventListener("load", TWITTERBAR.getAccessToken, true);
            }
            
		    setTimeout(function () { TWITTERBAR.oAuthorize(); }, 3000);
		}
	},
	
	unload : function () {
	    this.prefs.removeObserver("", this);
		
	    try {
	        document.getElementById("browsers").removeEventListener("load", TWITTERBAR.getAccessToken, true);
	    } catch (notFennec) {
	        getBrowser().removeEventListener("load", TWITTERBAR.getAccessToken, true);
        }
    },
	
	observe : function(subject, topic, data) {
		if (topic != "nsPref:changed") {
			return;
		}
		
		switch(data) {
			case "button":
        		// Iterate over all the windows and show/hide the button based on pref-hide-button
        		var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                                   .getService(Components.interfaces.nsIWindowMediator);
                var enumerator = wm.getEnumerator(null);

                var buttonMode = this.prefs.getBoolPref("button").toString();

                while(enumerator.hasMoreElements()) {
                    var win = enumerator.getNext();

                    try {
                        win.document.getElementById("twitterBox").setAttribute("hidden", buttonMode);
            		} catch (e) { }
                }
			break;
		}
	},
	
	buttonCheck : function () {
		try {
			var mode = this.prefs.getBoolPref("button");
			var button = document.getElementById("twitterBox");
			
			button.setAttribute("hidden", mode.toString());
		} catch (e) { }
	},
	
	focus : function () {
		var status = (document.getElementById("urlbar") || document.getElementById("urlbar-edit")).value;
		
		if (status.match(/^https?:\/\//i)) {
			this.lastUrl = status;
		}
		
		this.toolbarCount();
	},
    
	reAuthorize : function () {
	    TWITTERBAR.prefs.setCharPref("oauth_username", "");
        TWITTERBAR.prefs.setCharPref("access_token.oauth_token", "");
        TWITTERBAR.prefs.setCharPref("access_token.oauth_token_secret", "");
        TWITTERBAR.prefs.setCharPref("oauth_timestamp", "");
	    
	    this.oAuthorize();
    },
	
	oAuthorize : function () {
	    var accessor = {
	        consumerSecret : TWITTERBAR.oauth.consumer_secret,
	        tokenSecret : ""
	    };
	    
	    var message = {
	        action : TWITTERBAR.oauth.serviceProvider.requestTokenURL,
	        method : "GET",
	        parameters : [
    	        ["oauth_consumer_key",TWITTERBAR.oauth.consumer_key],
    	        ["oauth_signature_method",TWITTERBAR.oauth.serviceProvider.signatureMethod],
    	        ["oauth_version","1.0"]
	        ]
	    };
	    
	    var OAuth = TWITTERBAR_OAUTH();
	    
	    OAuth.setTimestampAndNonce(message);
	    OAuth.SignatureMethod.sign(message, accessor);
	    
	    var oAuthArgs = OAuth.getParameterMap(message.parameters);
	    var authHeader = OAuth.getAuthorizationHeader("http://twitter.com/", oAuthArgs);
	    
	    var req = new XMLHttpRequest();
	    req.mozBackgroundRequest = true;
	    req.open(message.method, message.action, true);
	    req.setRequestHeader("Authorization", authHeader);
        
        req.onreadystatechange = function () {
	        if (req.readyState == 4) {
	            if (req.status == 200) {
    	            var parts = req.responseText.split("&");
	            
    	            try {
    		            TWITTERBAR.oauth.request_token.oauth_token = parts[0].split("=")[1];
    		            TWITTERBAR.oauth.request_token.oauth_token_secret = parts[1].split("=")[1];
	                
    	                if (TWITTERBAR.confirm(TWITTERBAR.strings.getString("twitterbar.oauthRequest1") + "\n\n" + TWITTERBAR.strings.getString("twitterbar.oauthRequest2"))) {
    		                TWITTERBAR.getBrowser().selectedTab = TWITTERBAR.getBrowser().addTab("http://twitter.com/oauth/authorize?oauth_token="+TWITTERBAR.oauth.request_token.oauth_token);
    		            }
    		        } catch (e) {
                        TWITTERBAR.alert(TWITTERBAR.strings.getString("twitterbar.oauthError1") + "\n\n" + e + "\n\n" + req.responseText);
    	            }
    	        }
    	        else if (req.status >= 500) {
		            TWITTERBAR.alert(TWITTERBAR.strings.getString("twitterbar.failWhale"));
	            }
    	        else {
    	            TWITTERBAR.alert(TWITTERBAR.strings.getFormattedString("twitterbar.otherError", [ req.status, req.responseText ]));
	            }
            }
        };
        
        req.send(null);
    },
	
	getAccessToken : function (event) {
	    if (event.originalTarget instanceof HTMLDocument) {
            var doc = event.originalTarget;
            
            if (doc.location.href.match(/chrisfinke.com\/oauth\/twitterbar/i)) {
                var token = doc.location.href.split("?")[1].split("=")[1];
                
                var accessor = {
        	        consumerSecret : TWITTERBAR.oauth.consumer_secret,
        	        tokenSecret : TWITTERBAR.oauth.request_token.oauth_token_secret
        	    };

        	    var message = {
        	        action : TWITTERBAR.oauth.serviceProvider.accessTokenURL,
        	        method : "GET",
        	        parameters : [
            	        ["oauth_consumer_key",TWITTERBAR.oauth.consumer_key],
            	        ["oauth_token", token],
            	        ["oauth_signature_method",TWITTERBAR.oauth.serviceProvider.signatureMethod],
            	        ["oauth_version","1.0"]
        	        ]
        	    };
                
                var OAuth = TWITTERBAR_OAUTH();
                
        	    OAuth.setTimestampAndNonce(message);
        	    OAuth.SignatureMethod.sign(message, accessor);
                
        	    var oAuthArgs = OAuth.getParameterMap(message.parameters);
        	    var authHeader = OAuth.getAuthorizationHeader("http://twitter.com/", oAuthArgs);
                
        	    var req = new XMLHttpRequest();
        	    req.mozBackgroundRequest = true;
        	    req.open(message.method, message.action, true);
        	    req.setRequestHeader("Authorization", authHeader);
        	    
        	    req.onreadystatechange = function () {
                    if (req.readyState == 4) {
                        if (req.status == 200) {
                            try {
                                var parts = req.responseText.split("&");
                        
                                TWITTERBAR.prefs.setCharPref("access_token.oauth_token", parts[0].split("=")[1]);
                                TWITTERBAR.prefs.setCharPref("access_token.oauth_token_secret", parts[1].split("=")[1]);

                                TWITTERBAR.prefs.setCharPref("oauth_timestamp", (new Date().getTime()));
                        
                                TWITTERBAR.verifyAuth();
                            } catch (e) {
                	            TWITTERBAR.alert(TWITTERBAR.strings.getFormattedString("twitterbar.otherError", [ e, req.responseText ]));
                            }
                        }
        		        else if (req.status >= 500) {
        		            TWITTERBAR.alert(TWITTERBAR.strings.getString("twitterbar.failWhale"));
        	            }
                        else {
            	            TWITTERBAR.alert(TWITTERBAR.strings.getFormattedString("twitterbar.otherError", [ req.status, req.responseText ]));
            	        }
                    }
                };

                req.send(null);
            }
        }
    },
	
	post : function (clickedOnButton) {
	    if (clickedOnButton && this.prefs.getBoolPref("confirm")) {
	        if (!this.confirmPost()) {
	            return;
	        }
        }
        
		var image = document.getElementById("twitter-statusbarbutton");
		image.src =  "chrome://twitterbar/skin/Throbber-small.gif";
		
		var urlbar = (document.getElementById("urlbar") || document.getElementById("urlbar-edit"));
		var status = urlbar.value;
		
		if (status.match(/^https?:\/\/[^\s]+$/i)) {
			this.lastUrl = status;
			
			var prefix = this.prefs.getCharPref("web");
			status = prefix + status;
		}
		
		urlbar.value = TWITTERBAR.strings.getString("twitterbar.posting");
		
		this.shortenUrls(status, function (status) { TWITTERBAR.postRequest(status); });
	},
	
	postRequest : function (status) {
        var accessor = {
	        consumerSecret : TWITTERBAR.oauth.consumer_secret,
	        tokenSecret : TWITTERBAR.prefs.getCharPref("access_token.oauth_token_secret")
	    };

	    var message = {
	        action : "http://twitter.com/statuses/update.xml",
	        method : "POST",
	        parameters : [
    	        ["oauth_consumer_key",TWITTERBAR.oauth.consumer_key],
    	        ["oauth_token", TWITTERBAR.prefs.getCharPref("access_token.oauth_token")],
    	        ["oauth_signature_method",TWITTERBAR.oauth.serviceProvider.signatureMethod],
    	        ["oauth_version","1.0"],
    	        ["source","twitterbar"],
    	        ["status", status]
	        ]
	    };
        
        var OAuth = TWITTERBAR_OAUTH();
        
	    OAuth.setTimestampAndNonce(message);
	    OAuth.SignatureMethod.sign(message, accessor);
        
		var argstring = "source=twitterbar&status=" + encodeURIComponent(status);

	    var oAuthArgs = OAuth.getParameterMap(message.parameters);
	    var authHeader = OAuth.getAuthorizationHeader("http://twitter.com/", oAuthArgs);
        
	    var req = new XMLHttpRequest();
	    req.mozBackgroundRequest = true;
	    req.open(message.method, message.action, true);
	    req.setRequestHeader("Authorization", authHeader);
		req.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
		req.setRequestHeader("Content-Length", argstring.length);
		
		req.onreadystatechange = function () {
			if (req.readyState == 4) {
			    if (req.status == 401) {
			        if (req.responseText.indexOf("expired") != -1) {
			            TWITTERBAR.alert(TWITTERBAR.strings.getString("twitterbar.oauthExpired"));
			            TWITTERBAR.reAuthorize();
		            }
		            else {
			            TWITTERBAR.alert(TWITTERBAR.strings.getFormattedString("twitterbar.twitterError", [ req.status, req.responseText ]));
			        }
			        
			        // I think TwitterBar sends a 401 when you've hit your rate limit.
			        // This is the reason so many people complained about being asked to reauthorize.
		        }
		        else if (req.status >= 500) {
		            TWITTERBAR.alert(TWITTERBAR.strings.getString("twitterbar.failWhale"));
	            }
				else if (req.status == 200) {
					var urlbar = (document.getElementById("urlbar") || document.getElementById("urlbar-edit"));
					urlbar.value = TWITTERBAR.strings.getString("twitterbar.success");
					
					var image = document.getElementById("twitter-statusbarbutton");
					image.src =  "chrome://twitterbar/skin/accept.png";
				
					setTimeout(function () { TWITTERBAR.afterPost(); }, 1000);
				}
				else {
    				var image = document.getElementById('twitter-statusbarbutton');
            		image.src =  "chrome://twitterbar/skin/twitter.ico";
            		
    	            TWITTERBAR.alert(TWITTERBAR.strings.getFormattedString("twitterbar.otherError", [ req.status, req.responseText ]));
				}
			}
		};
		
		req.send(argstring);
	},
	
	verifyAuth : function () {
	    var accessor = {
	        consumerSecret : TWITTERBAR.oauth.consumer_secret,
	        tokenSecret : TWITTERBAR.prefs.getCharPref("access_token.oauth_token_secret")
	    };

	    var message = {
	        action : "http://twitter.com/account/verify_credentials.xml",
	        method : "GET",
	        parameters : [
    	        ["oauth_consumer_key",TWITTERBAR.oauth.consumer_key],
    	        ["oauth_token", TWITTERBAR.prefs.getCharPref("access_token.oauth_token")],
    	        ["oauth_signature_method",TWITTERBAR.oauth.serviceProvider.signatureMethod],
    	        ["oauth_version","1.0"]
	        ]
	    };
        
        var OAuth = TWITTERBAR_OAUTH();
        
	    OAuth.setTimestampAndNonce(message);
	    OAuth.SignatureMethod.sign(message, accessor);
        
	    var oAuthArgs = OAuth.getParameterMap(message.parameters);
	    var authHeader = OAuth.getAuthorizationHeader("http://twitter.com/", oAuthArgs);
        
	    var req = new XMLHttpRequest();
	    req.mozBackgroundRequest = true;
	    req.open(message.method, message.action, true);
	    req.setRequestHeader("Authorization", authHeader);
		
		req.onreadystatechange = function () {
			if (req.readyState == 4) {
			    if (req.status == 200) {
				    var username = req.responseXML.getElementsByTagName("screen_name")[0].textContent;
				    TWITTERBAR.prefs.setCharPref("oauth_username", username);
				}
		        else if (req.status >= 500) {
		            TWITTERBAR.alert(TWITTERBAR.strings.getString("twitterbar.failWhale"));
	            }
				else {
    	            TWITTERBAR.alert(TWITTERBAR.strings.getFormattedString("twitterbar.otherError", [ req.status, req.responseText ]));
				    
				    TWITTERBAR.prefs.setCharPref("oauth_username", "");
                    TWITTERBAR.prefs.setCharPref("access_token.oauth_token", "");
                    TWITTERBAR.prefs.setCharPref("access_token.oauth_token_secret", "");
                    TWITTERBAR.prefs.setCharPref("oauth_timestamp", "");
                    
				    if (TWITTERBAR.confirm(TWITTERBAR.strings.getString("twitterbar.oauthError2") + "\n\n" + TWITTERBAR.strings.getString("twitterbar.oauthRetry"))) {
				        TWITTERBAR.oAuthorize();
			        }
				}
			}
		};
		
		req.send(null);
    },
	
	afterPost : function () {
		var urlbar = (document.getElementById("urlbar") || document.getElementById("urlbar-edit"));
		urlbar.value = this.lastUrl;	
		
		if (this.prefs.getBoolPref("tab")){
			TWITTERBAR.getBrowser().selectedTab = TWITTERBAR.getBrowser().addTab("http://twitter.com/" + this.prefs.getCharPref("oauth_username"));
		}
		
		var image = document.getElementById('twitter-statusbarbutton');
		image.src = "chrome://twitterbar/skin/twitter.ico";
	},
	
	count : function () {
		var imagest = document.getElementById('twitter-statusbarbutton');
		imagest.src = "chrome://twitterbar/skin/add.png"
		
		var count = document.getElementById('twitter-count');
		count.hidden = false;
		
	    var length = this.getCharCount();
        count.value = (140 - length) + " Left:";
        
        if (length > 140) {
            count.style.color = "red";
        }
        else {
            count.style.color = "green";
        }
	},
	
	countClear : function () {
		var image = document.getElementById('twitter-statusbarbutton');
		
		if (image.src.match(/add\.png/)) {
			image.src =  "chrome://twitterbar/skin/twitter.ico"
		}
		
		var count = document.getElementById('twitter-count');
		count.hidden = true;
	},
	
	getCharCount : function () {
	    var status = (document.getElementById("urlbar") || document.getElementById("urlbar-edit")).value;
		var length = status.length;
		
		var offset = 0;
		
		var urls = status.match(/(https?:\/\/[^\s]+)/ig);
	    
	    if (urls) {
	        for (var i = 0; i < urls.length; i++) {
	            if (urls[i].length > 18) {
	                offset += (urls[i].length - 18);
                }
            }
        }
        
        length -= offset;
        
		if (status.match(/^https?:\/\//i)) {
			var prefix = (this.prefs.getCharPref("web").replace(/^\s+|\s+$/) + " ");
			length += prefix.length;
		}
		
		return length;
    },
	
	toolbarCount : function () {
		var button = document.getElementById('twitter-toolbar-count');
		
		if (button) {
			button.setAttribute('value', 140 - this.getCharCount());
		}
	},
	
	postKey : function (e) {
		if (e.keyCode != e.DOM_VK_RETURN && e.keyCode != 117 && e.keyCode != 76 && e.keyCode != 68 && e.keyCode != 17 && e.keyCode != 18){
			var urlbar = (document.getElementById("urlbar") || document.getElementById("urlbar-edit"));
			var status = urlbar.value;

			if (status.indexOf(" --post") != -1){
				var status = status.split(" --post")[0];
				
				if (status.match(/^https?:\/\//i)) {
					var webtext = this.prefs.getCharPref("web");
					status = webtext + status;
				}
				
				urlbar.value = this.strings.getString("twitterbar.posting");
				
				this.shortenUrls(status, function (status) { TWITTERBAR.postRequest(status); });
				
				var imagest = document.getElementById('twitter-statusbarbutton');
				imagest.src = "chrome://twitterbar/skin/Throbber-small.gif";
			}
		    else if (status.indexOf("--options") != -1){
				this.openOptions();
			}
		}
		
		this.toolbarCount();
	},
	
	openOptions : function () {
		openDialog('chrome://twitterbar/content/optionsDialog.xul', 'options', 'modal,centerscreen');
	},
	
	shortenUrls : function (status, callback) {
	    status = status + " ";
	    
	    var urlsToShorten = [];
	    
	    function shortenNextUrl() {
	        if (urlsToShorten.length == 0) {
                callback(status.replace(/^\s+|\s+$/g, ""));
            }
            else {
                var nextUrl = urlsToShorten.shift();

                var req = new XMLHttpRequest();
                req.open("GET", "http://is.gd/api.php?longurl=" + nextUrl, true);

                req.onreadystatechange = function () {
                    if (req.readyState == 4) {
                        if (req.status == 200) {
                            status = status.replace(nextUrl + " ", req.responseText + " ");
                        }

                        shortenNextUrl();
                    }
                };

                req.send(null);
            }
        }
	    
	    var urlRE = /(https?:\/\/[\S]+)\s/ig;
	    var url;
	    
	    while ((url = urlRE.exec(status)) != null) {
	        urlsToShorten.push(url[1]);
	    }
        
        shortenNextUrl();
    }
};