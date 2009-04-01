var TWITTERBAR_OPTIONS = {
	get prefs() { return Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).QueryInterface(Components.interfaces.nsIPrefBranch).getBranch("extensions.twitter."); },
	
	get strings() { return document.getElementById("twitterbar-strings"); },
	
	init : function () {
	    var authDate = this.prefs.getCharPref("oauth_timestamp");
	    var authUser = this.prefs.getCharPref("oauth_username");
	    
	    if (authDate && authUser) {
	        var niceDate = new Date();
	        niceDate.setTime(authDate);
	        
	        document.getElementById("auth-summary").textContent = this.strings.getFormattedString("twitterbar.authString", [ authUser, niceDate.toLocaleString() ]);
        }
        else {
            document.getElementById("auth-summary").textContent = this.strings.getString("twitterbar.noAuth");
        }
    },
	
	accept : function () {
	    if (!document.getElementById("twitterbar-preference-window").instantApply) {
		    this.prefs.setBoolPref("confirm", document.getElementById("pref-confirm").value);
		    this.prefs.setCharPref("web", document.getElementById("pref-prefix").value);
		    this.prefs.setBoolPref("pref-open-after", document.getElementById("pref-open-after").value);
		    this.prefs.setBoolPref("pref-hide-button", document.getElementById("pref-hide-button").value);
		}
		
		return true;
	},
	
	clearAuth : function () {
	    this.prefs.setCharPref("oauth_username", "");
        this.prefs.setCharPref("access_token.oauth_token", "");
        this.prefs.setCharPref("access_token.oauth_token_secret", "");
        this.prefs.setCharPref("oauth_timestamp", "");
        
        document.getElementById("auth-summary").textContent = this.strings.getString("twitterbar.noAuth");
    }
};