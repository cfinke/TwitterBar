var TWITTERBAR_SHORTENERS = {
	shortenUrls : function (status, callback) {
		var shortener = TWITTERBAR.prefs.getCharPref("shortener");
		
		if (shortener == "") {
			callback(status);
		}
		else if (shortener == "tinyurl") {
			TWITTERBAR_SHORTENERS.shortenUrlsTiny(status, callback);
		}
		else if (shortener == "bitly") {
			TWITTERBAR_SHORTENERS.shortenUrlsBitly(status, callback);
		}
		else {
			TWITTERBAR_SHORTENERS.shortenUrlsIsGd(status, callback);
		}
	},
	
	getUrlLength : function (url) {
		var shortener = TWITTERBAR.prefs.getCharPref("shortener");
		
		if (shortener == "tinyurl") {
			return 25;
		}
		else if (shortener == "bitly") {
			return 20;
		}
		else if (shortener == "") {
			return url.length;
		}
		else {
			// is.gd
			return 18;
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
								
								if (shortUrl.length < nextUrl.length) {
									status = status.replace(nextUrl + " ", shortUrl + " ");
								}
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
	
	shortenUrlsBitly : function (status, callback) {
		status = status + " ";
		
		var urlsToShorten = [];
		
		function shortenNextUrl() {
			if (urlsToShorten.length == 0) {
				callback(status.replace(/^\s+|\s+$/g, ""));
			}
			else {
				var nextUrl = urlsToShorten.shift();

				var req = new XMLHttpRequest();
				
				var apiKey = TWITTERBAR.prefs.getCharPref("bitlyApiKey");
				var login = TWITTERBAR.prefs.getCharPref("bitlyLogin");
				
				if (!apiKey || !login) {
					apiKey = "R_14789c4220ade2b5d8616d3bc5b955a7";
					login = "twitterbar";
				}
				
				var url = "http://api.bit.ly/shorten?version=2.0.1&longUrl=" + encodeURIComponent(nextUrl);
				url += "&login=" + encodeURIComponent(login) + "&apiKey=" + encodeURIComponent(apiKey);
				
				req.open("GET", url, true);

				req.onreadystatechange = function () {
					if (req.readyState == 4) {
						if (req.status == 200) {
							try {
								var json = JSON.parse(req.responseText);
								
								if (json.errorCode == 0) {
									var shortUrl = json.results[nextUrl].shortUrl;
									
									if (shortUrl.length < nextUrl.length) {
										status = status.replace(nextUrl + " ", shortUrl + " ");
									}
								}
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
							var shortUrl = req.responseText;
							
							if (shortUrl.length < nextUrl.length) {
								status = status.replace(nextUrl + " ", req.responseText + " ");
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
	}
};