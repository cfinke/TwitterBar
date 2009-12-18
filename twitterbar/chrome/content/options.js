var TWITTERBAR_OPTIONS = {
	get prefs() { return Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).QueryInterface(Components.interfaces.nsIPrefBranch).getBranch("extensions.twitter."); },
	
	get strings() { return document.getElementById("twitterbar-strings"); },
	
	init : function () {
	    var authDate = this.prefs.getCharPref("oauth_timestamp");
	    var label = "";
	
	    if (authDate) {
	        var niceDate = new Date();
	        niceDate.setTime(authDate);
	        
	        label = TWITTERBAR_COMMON.strings.getFormattedString("twitterbar.newAuthString", [ niceDate.toLocaleString() ]);
        }
        else {
            label = TWITTERBAR_COMMON.strings.getString("twitterbar.noAuth");
        }
        
		this.shortenerChange();

		if (document.getElementById("auth-summary")) {
			document.getElementById("auth-summary").textContent = label;
        	sizeToContent();
		}
    },

	setShortener : function () {
		this.prefs.setCharPref("shortener", document.getElementById("twitterbar-shortener-menu").selectedItem.getAttribute("value"));
	},
	
	shortenerChange : function () {
		if (document.getElementById("twitterbar-shortener-menu").selectedItem.getAttribute("value") == "bitly") {
			document.getElementById("bitly-options").style.display = '';
		}
		else {
			document.getElementById("bitly-options").style.display = 'none';
		}
	},
	
	accept : function () {
	    if (!document.getElementById("twitterbar-preference-window").instantApply) {
		    this.prefs.setBoolPref("confirm", document.getElementById("pref-confirm").value);
		    this.prefs.setCharPref("web", document.getElementById("pref-prefix").value);
		    this.prefs.setBoolPref("tab", document.getElementById("pref-open-after").value);
		    this.prefs.setBoolPref("button", document.getElementById("pref-hide-button").value);
		    this.prefs.setBoolPref("oneriotButton", document.getElementById("pref-hide-oneriot").value);
		    this.prefs.setCharPref("shortener", document.getElementById("pref-shortener").value);
		    this.prefs.setBoolPref("showTrends", document.getElementById("pref-show-trends").value);
		}
		
		return true;
	},
	
	clearAuth : function () {
        this.prefs.setCharPref("access_token.oauth_token", "");
        this.prefs.setCharPref("access_token.oauth_token_secret", "");
        this.prefs.setCharPref("oauth_timestamp", "");
        
		var label = TWITTERBAR_COMMON.strings.getString("twitterbar.noAuth");
		
		if (document.getElementById("twitterbar-auth-summary")) {
			document.getElementById("twitterbar-auth-summary").setAttribute("title", label);
		}
		else {
			document.getElementById("auth-summary").textContent = label;
		}
    }
};