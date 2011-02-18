var TWITTERBAR_CONTENT = {
	domContentLoaded : function (event) {
		var page = event.originalTarget;
	
		if (page.location && page.location.href.match(/chrisfinke.com\/oauth\/twitterbar.*oauth_token/i)) {
			var urlArgs = page.location.href.split("?")[1].split("&");
		
			var token = "";
		
			for (var i = 0; i < urlArgs.length; i++) {
				var argParts = urlArgs[i].split("=");
			
				if (argParts[0] == "oauth_token"){
					token = argParts[1];
				}
			}
		
			sendAsyncMessage("TwitterBar:NewToken", { token : token });
		}
		
		sendAsyncMessage("TwitterBar:PageChange", { "title" : content.document.title, "url" : content.document.location.href });
	}
};

addEventListener("DOMContentLoaded", TWITTERBAR_CONTENT.domContentLoaded, false);