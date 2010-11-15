var TWITTERBAR_CLIENT = {
	load : function () {
		removeEventListener("load", TWITTERBAR_CLIENT.load, false);
		
		TWITTERBAR_CLIENT.populateAccountsList();
		
		TWITTERBAR_CLIENT.deckChange( document.getElementById("twitterbar-client-deck").selectedPanel.getAttribute("id") );
		
		gTwitterBar.updateToolbarIcon();
		
		TWITTERBAR_CLIENT.prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("extensions.twitter.");	
		TWITTERBAR_CLIENT.prefs.QueryInterface(Components.interfaces.nsIPrefBranch2);
		TWITTERBAR_CLIENT.prefs.addObserver("", TWITTERBAR_CLIENT, false);
		
		addEventListener("unload", TWITTERBAR_CLIENT.unload, false);
		addEventListener("resize", TWITTERBAR_CLIENT.resize, false);
	},
	
	observe : function(subject, topic, data) {
		if (topic != "nsPref:changed") {
			return;
		}
		
		switch(data) {
			case "notifierHacks.new":
				TWITTERBAR_CLIENT.checkTwitter();
			break;
		}
	},
	
	unload : function () {
		removeEventListener("unload", TWITTERBAR_CLIENT.unload, false);
		removeEventListener("resize", TWITTERBAR_CLIENT.resize, false);
		
		TWITTERBAR_CLIENT.prefs.removeObserver("", TWITTERBAR_CLIENT);
	},
	
	populateAccountsList : function () {
		var list = document.getElementById("twitterbar-accounts");
		
		if (list.value) var lastAccount = list.value;
		else var lastAccount = TWITTERBAR.prefs.getCharPref("sidebarAccount");
		
		while (list.firstChild) list.removeChild(list.firstChild);
		
		var accounts = TWITTERBAR.accounts;
		
		var index = 0;
		var j = 0;
		
		for (var i in accounts) {
			var username = i;
			var account = accounts[username];
			
			if (account.token && account.token_secret) {
				list.appendItem(username, username);
				
				if (username == lastAccount) {
					index = j;
				}
			}
			
			j++;
		}
		
		list.selectedIndex = index;
	},
	
	deckChange : function (panelId) {
		document.getElementById("twitterbar-client-deck").selectedPanel = document.getElementById(panelId);
		
		var buttons = document.getElementById("nav-bar").getElementsByTagName("toolbarbutton");
		
		for (var i = 0; i < buttons.length; i++) {
			if (buttons[i].getAttribute("panel") == panelId) {
				buttons[i].setAttribute("checked", "true");
			}
			else {
				buttons[i].setAttribute("checked", "false");
			}
		}
		
		TWITTERBAR_CLIENT.ui();
		
		TWITTERBAR_CLIENT.checkTwitter();
	},
	
	accountChange : function (username) {
		TWITTERBAR.prefs.setCharPref('sidebarAccount', username);
		
		var panels = document.getElementById("twitterbar-client-deck").getElementsByTagName("richlistbox");
		
		for (var i = 0; i < panels.length; i++) {
			while (panels[i].firstChild) panels[i].removeChild(panels[i].firstChild);
		}
		
		TWITTERBAR_CLIENT.ui();
		TWITTERBAR_CLIENT.checkTwitterManually();
	},
	
	resize : function () {
		var sidebarWidth = document.getElementById("nav-bar").boxObject.width;
		
		var descs = document.getElementById("twitterbar-client-deck").getElementsByTagName("description");
		
		for (var i = 0; i < descs.length; i++) {
			descs[i].style.maxWidth = (sidebarWidth - 48 - 10 - 5 - 18 - 20) + "px";
			descs[i].style.width = descs[i].style.maxWidth;
		}
	},
	
	ui : function () {
		var panel = document.getElementById("twitterbar-client-deck").selectedPanel;
		var db = gTwitterBar.getDB();
		var tweets = [];
		
		var method = panel.getAttribute("method");
		
		var table = "messages_home";
		var field = "";
		
		switch (method) {
			case "mentions":
				table = "messages_mentions";
				field = "last_view_mentions";
			break;
			case "direct":
				table = "messages_direct";
				field = "last_view_dm";
			break;
			case "home":
				table = "messages_home";
				field = "last_view_home";
			break;
		}
		
		var lastCreated = 0;
		
		if (panel.firstChild) {
			lastCreated = panel.firstChild.getAttribute("created");
		}
		
		lastCreated += ".0";
		
		var select = db.createStatement("SELECT twitter_id, created, text, user_screen_name, user_profile_image_url, in_reply_to_status_id, in_reply_to_screen_name, via_user_screen_name FROM "+table+" WHERE account=:account AND created > :created ORDER BY created DESC LIMIT 100");
		select.params.account = document.getElementById("twitterbar-accounts").value;
		select.params.created = lastCreated;
		
		try {
			while (select.executeStep()) {
				var tweet = {
					id : select.row.twitter_id,
					created : select.row.created,
					text : select.row.text,
					user : {
						screen_name : select.row.user_screen_name,
						profile_image_url : select.row.user_profile_image_url
					}
				};
				
				if (select.row.in_reply_to_status_id) {
					tweet.in_reply_to = {
						status_id : select.row.in_reply_to_status_id,
						screen_name : select.row.in_reply_to_screen_name
					};
				}
				
				if (select.row.via_user_screen_name) {
					tweet.via = select.row.via_user_screen_name;
				}
				
				tweets.push(tweet);
			}
		} catch (e) {
			TWITTERBAR.log(e);
		} finally {
			select.reset();
		}
	
		select.finalize();
		
		gTwitterBar.closeDB();
		
		if (tweets.length > 0) {
			TWITTERBAR_CLIENT.showTweets(tweets);
		}
		
		if (field) {
			TWITTERBAR.setAccountField(document.getElementById("twitterbar-accounts").value, field, Math.round((new Date().getTime()) / 1000));
		}
		
		TWITTERBAR_CLIENT.notifyPending(0);
		
		gTwitterBar.updateToolbarIcon();
	},
	
	notifyPending : function (count) {
		var nb = document.getElementById("sidebar-notify");
		nb.removeAllNotifications(true);
		
		if (count > 0) {
			nb.appendNotification("New messages", "", "chrome://twitterbar/skin/bird-16-full.png", nb.PRIORITY_INFO_HIGH, [ { accessKey : "V", callback : TWITTERBAR_CLIENT.showPending, label : "View", popup : null } ]);
		}
	},
	
	showPending : function () {
		TWITTERBAR_CLIENT.ui();
	},
	
	showTweets : function (tweets) {
		/*
		
		<hbox>
			<vbox>
				<spacer flex="1" />
				<image />
				<spacer flex="1" />
			</vbox>
			<vbox>
				<description>
					<label />
					text
				</description>
				<label />
			</vbox>
		</hbox>
		
		*/
		
		var lastLook = false;
		
		var panel = document.getElementById("twitterbar-client-deck").selectedPanel;
		
		var username = document.getElementById("twitterbar-accounts").value;
		switch (panel.getAttribute("id")) {
			case "twitterbar-home":
				lastLook = TWITTERBAR.getAccountField(username, "last_view_home");
			break;
			case "twitterbar-mentions":
				lastLook = TWITTERBAR.getAccountField(username, "last_view_mentions");
			break;
			case "twitterbar-dm":
				lastLook = TWITTERBAR.getAccountField(username, "last_view_dm");
			break;
		}
		
		if (!lastLook) {
			lastLook = Math.round((new Date().getTime()) / 1000);
		}
		
		for (var i = 0; i < panel.childNodes.length; i++) {
			panel.childNodes[i].removeAttribute("new");
		}
		
		for (var i = tweets.length -1; i >= 0; i--) {
			var tweet = tweets[i];
			
			var item = document.createElement("richlistitem");
			item.setAttribute("created", tweet.created);
			item.style.padding = "5px";
			item.style.borderBottom = "solid 1px #aaa";
			item.setAttribute('href', 'http://twitter.com/' + tweet.user.screen_name + '/statuses/' + tweet.id);
			item.setAttribute("ondblclick", "window.parent.openUILink(this.getAttribute('href'), event, false, true); return false;");
			
			var vbox = document.createElement("vbox");
			var flexer = document.createElement("spacer");
			flexer.setAttribute("flex", "1");
			
			var vtext = document.createElement("vbox");
			
			var image = document.createElement("image");
			image.setAttribute("src", tweet.user.profile_image_url);
			image.style.height = "48px";
			image.style.width = "48px";
			image.style.maxHeight = "48px";
			image.style.minHeight = "48px";
			image.style.marginRight = "5px";
			image.style.cursor = "pointer";
			image.setAttribute('href', "http://twitter.com/" + tweet.user.screen_name);
			image.setAttribute("onclick", "window.parent.openUILink(this.getAttribute('href'), event, false, true); return false;");
			
			vbox.appendChild(image);
			vbox.appendChild(flexer);
			
			item.appendChild(vbox);
			
			var desc = document.createElement("description");
			
			var link = document.createElement("label");
			link.setAttribute("value", tweet.user.screen_name);
			link.className = "twitter-url";
			link.setAttribute("href", "http://twitter.com/" + tweet.user.screen_name);
			link.style.marginLeft = "0";
			link.style.marginRight = "0";
			link.style.fontWeight = "bold";
			link.setAttribute("onclick", "window.parent.openUILink(this.getAttribute('href'), event, false, true); return false;");
			
			desc.appendChild(link);
			
			tweet.text = tweet.text.replace(/(\b(([\w-]+:\/\/?|www[.])[^\s()<>]+(?:\([\w\d]+\)|([^!'#%&\(\)\*\+,\-\.\/:;<=>\?@\[\]^_{\|}\~\s]|\/))))/gi, '<a>$1</a>');
			tweet.text = tweet.text.replace(/@([a-z0-9_]+)/ig, '<a>@$1</a>');
			tweet.text = tweet.text.replace(/((\s+)(\#([a-z0-9_]+)))/ig, '$2<a>$3</a>');
			tweet.text = " " + tweet.text;
			
			// Convert HTML to XUL here.
			var parts = tweet.text.split("<a>");
			
			for (var j = 0; j < parts.length; j++) {
				var part = parts[j];
				
				if (j > 0) {
					var newParts = part.split("</a>");
					var part = newParts[0];
					
					var label = document.createElement("label");
					
					var val = part.replace(/<[^>]+>/g, "");
					var href = val;
					
					if (val.length > 30) {
						val = val.substring(0, 30) + "...";
					}
					
					label.setAttribute("value", val);
					
					switch (part[0]) {
						case "@":
							label.setAttribute("href", "http://twitter.com/" + href.replace("@", ""))
						break;
						case "#":
							label.setAttribute("href", "http://twitter.com/#search?q=" + href.replace("#", ""))
						break;
						default:
							label.setAttribute("href", href)
						break;
					}
					
					label.setAttribute("tooltiptext", label.getAttribute("href"));
					label.className = "twitter-url";
					label.style.marginLeft = "0";
					label.style.marginRight = "0";
					label.setAttribute("onclick", "window.parent.openUILink(this.getAttribute('href'), event, false, true); return false;");
					
					desc.appendChild(label);
					
					if (newParts.length > 1) {
						part = newParts[1];
					}
					else {
						part = "";
					}
				}
				
				if (part == " "){
					var t = document.createElement("text");
					t.setAttribute("value", " ");
					
					desc.appendChild(t);
				}
				else {
					desc.appendChild(document.createTextNode(part.replace(/&lt;/g, "<").replace(/&gt;/g, ">")));
				}
			}
			
			vtext.appendChild(desc);
			
			var htext = document.createElement("description");
			htext.style.fontSize = "7pt";
			
			var time = document.createElement("label");
			time.setAttribute("timestamp", tweet.created);
			time.setAttribute("value", tweet.created);
			time.className = "fuzzy";
			time.style.marginLeft = "0";
			time.style.marginRight = "0";
			
			htext.appendChild(time);
			
			if ("in_reply_to" in tweet) {
				var reply = document.createElement("label");
				reply.setAttribute("value", " in reply to ");
				reply.style.marginLeft = "0";
				reply.style.marginRight = "0";
				htext.appendChild(reply);
				
				var replyUser = document.createElement("label");
				replyUser.setAttribute("value", tweet.in_reply_to.screen_name);
				replyUser.setAttribute("href", "http://twitter.com/" + tweet.in_reply_to.screen_name + "/statuses/" + tweet.in_reply_to.status_id);
				replyUser.className = "twitter-url";
				replyUser.setAttribute("onclick", "window.parent.openUILink(this.getAttribute('href'), event, false, true); return false;");
				replyUser.style.marginLeft = "0";
				replyUser.style.marginRight = "0";
				htext.appendChild(replyUser);
			}
			
			if ("via" in tweet) {
				var via = document.createElement("label");
				via.setAttribute("value", " via ");
				via.style.marginLeft = "0";
				via.style.marginRight = "0";
				
				htext.appendChild(via);
				
				var via_name = document.createElement("label");
				via_name.setAttribute("value", tweet.via);
				via_name.setAttribute("href", "http://twitter.com/" + tweet.via);
				via_name.className = "twitter-url";
				via_name.setAttribute("onclick", "window.parent.openUILink(this.getAttribute('href'), event, false, true); return false;");
				via_name.style.marginLeft = "0";
				via_name.style.marginRight = "0";
				htext.appendChild(via_name);
			}
			
			vtext.appendChild(htext);
			
			item.appendChild(vtext);
			
			if (tweet.created > lastLook) {
				item.setAttribute("new", "true");
			}
			
			panel.insertBefore(item, panel.firstChild);
		}
		
		TWITTERBAR_CLIENT.fuzzyTime();
		TWITTERBAR_CLIENT.resize();
	},
	
	showBusy : function (msg) {
		if (!msg) {
			document.getElementById("twitterbar-loading-text").setAttribute("value", ".");
		}
		else {
			document.getElementById("twitterbar-loading-text").setAttribute("value", msg);
		}
	},
	
	fuzzyTimeout : null,
	
	fuzzyTime : function () {
		clearTimeout(TWITTERBAR_CLIENT.fuzzyTimeout);
		
		var labels = document.getElementsByClassName("fuzzy");
		
		var now = new Date();
		var now_ms = now.getTime();
		var offset = now.getTimezoneOffset();
		
		for (var i = 0; i < labels.length; i++) {
			var timestamp = parseInt(labels[i].getAttribute("timestamp"), 10) * 1000;
			
			var newDate = new Date();
			newDate.setTime(timestamp);
			
			var ms = newDate.getTime();
			ms -= offset;
			newDate.setTime(ms);
			
			var difference = now_ms - newDate.getTime();
			var dateString = "";

			if (difference >= (1000 * 60 * 60 * 24 * 60)) {
				dateString = newDate.toDateString()
			}
			else if (difference >= (1000 * 60 * 60 * 24)) {
				var days = Math.floor(difference / (1000 * 60 * 60 * 24));
				dateString = days + " day";
				if (days != 1) dateString += "s"
				dateString += " ago";
			}
			else if (difference >= (1000 * 60 * 60)) {
				var hours = Math.floor(difference / (1000 * 60 * 60));
				dateString = hours + " hour";
				if (hours != 1) dateString += "s";
				dateString += " ago";
			}
			else {
				var minutes = Math.floor(difference / (1000 * 60));

				if (minutes < 1) {
					dateString = "Less than a minute ago";
				}
				else {
					dateString = minutes + " minute";
					if (minutes != 1) dateString += "s";
					dateString += " ago";
				}
			}
			
			labels[i].setAttribute("value", dateString);
		}
		
		TWITTERBAR_CLIENT.fuzzyTimeout = setInterval(TWITTERBAR_CLIENT.fuzzyTime, 60 * 1000);
	},
	
	checkTwitterManually : function () {
		TWITTERBAR_CLIENT.showBusy("Talking to Twitter...");
		
		var username = document.getElementById("twitterbar-accounts").value;
		var method = document.getElementById("twitterbar-client-deck").selectedPanel.getAttribute("method");
		
		function cb(status) {
			TWITTERBAR_CLIENT.showBusy(".");
			TWITTERBAR_CLIENT.ui();
		}
		
		gTwitterBar.checkTwitter(username, method, cb);
	},
	
	checkTwitter : function () {
		var panel = document.getElementById("twitterbar-client-deck").selectedPanel;
		var db = gTwitterBar.getDB();
		
		var method = panel.getAttribute("method");
		
		var table = "messages_home";
		
		switch (method) {
			case "mentions":
				table = "messages_mentions";
			break;
			case "direct":
				table = "messages_direct";
			break;
		}
		
		var lastCreated = 0;
		
		if (panel.firstChild) {
			lastCreated = panel.firstChild.getAttribute("created");
		}
		
		lastCreated += ".0";
		
		var select = db.createStatement("SELECT COUNT(*) c FROM "+table+" WHERE account=:account AND created > :created");
		select.params.account = document.getElementById("twitterbar-accounts").value;
		select.params.created = lastCreated;
		
		try {
			while (select.executeStep()) {
				var count = select.row.c;
				
				if (count > 0) {
					if (panel.firstChild) {
						TWITTERBAR_CLIENT.notifyPending(count);
					}
					else {
						TWITTERBAR_CLIENT.ui();
					}
				}
				
				break;
			}
		} catch (e) {
			alert(e);
		}
		
		select.reset();
		select.finalize();
		gTwitterBar.closeDB();
	},
	
	tweet : function (status) {
		var args = [
				["source","twitterbar"],
				["status", status]
			];
		
		function callback(req) {
			alert("done");
		}
		
		gTwitterBar.apiRequest("http://twitter.com/statuses/update.json", callback, args, "POST");
	}
};