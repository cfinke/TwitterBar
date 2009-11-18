var TWITTERBAR_SHORTENERS = {
	prefs : Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("extensions.twitter."),
	
	shortenUrls : function (status, callback) {
		var shortener = this.prefs.getCharPref("shortener");
		
		if (shortener == "") {
			callback(status);
		}
		else if (shortener == "tinyurl") {
			this.shortenUrlsTiny(status, callback);
		}
		else {
			this.shortenUrlsIsGd(status, callback);
		}
	},
	
	shortenUrlsTiny : function (status, callback) {
		status = status + " ";
		
		var urlsToShorten = [];
		
		function shortenNextUrl() {
			if (urlsToShorten.length == 0) {
				callback(status.replace(/^\s+|\s+$/g, ""));
			}
			else {
				var nextUrl = urlsToShorten.shift();

				var req = new XMLHttpRequest();
				req.open("GET", "http://tinyurl.com/api-create.php?url=" + nextUrl, true);

				req.onreadystatechange = function () {
					if (req.readyState == 4) {
						if (req.status == 200) {
							try {
								var shortUrl = req.responseText;
							
								status = status.replace(nextUrl + " ", shortUrl + " ");
							} catch (e) {
							}
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
	},
	
	shortenUrlsIsGd : function (status, callback) {
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