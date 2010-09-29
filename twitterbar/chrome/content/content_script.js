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
		else {
			try {
				if (!page.location.host.match(/^twitter\.com$/)) {
					return;
				}
			} catch (e) {
				return;
			}
			
			sendAsyncMessage("TwitterBar:TrendRequest", { });
		}
		
		sendAsyncMessage("TwitterBar:PageChange", { "title" : content.document.title, "url" : content.document.location.href });
	},
	
	injectTrends : function(message) {
		var page = content.document;
		
		if (page.getElementById("side")) {
			TWITTERBAR_CONTENT.injectTrendsSidebar(message);
		}
		else {
			if (page.getElementsByClassName("dashboard").length > 0) {
				TWITTERBAR_CONTENT.injectTrendsDashboard(message);
			}
		}
	},
	
	injectTrendsSidebar : function (message) {
		var page = content;
		
		var sidebar = page.getElementById("side");
		
		var links = message.json.links;

		if (links.length) {
			var byline = message.json.byline;
			var explanation = message.json.explanation;
		
			var container = page.createElement("div");
			container.setAttribute("id", "twitterbar-trends");

			var header = page.createElement("h2");
			header.setAttribute("class", "sidebar-title")
			header.style.backgroundColor = "transparent !important";

			var title = page.createElement("span");
			title.setAttribute("title", byline);
			title.appendChild(page.createTextNode(message.json.title));
		
			header.appendChild(title);

			container.appendChild(header);

			var list = page.createElement("ul");
			list.setAttribute("class", "sidebar-menu more-trends-links");

			for (var i = 0; i < links.length; i++) {
				var item = page.createElement("li");
				item.setAttribute("class", "link-title");
				item.style.background = 'url("' + links[i].bug + '") no-repeat';

				var a = page.createElement("a");
				a.setAttribute("target", "_blank");
				a.setAttribute("title", links[i].targetUrl);
				a.setAttribute("href", links[i].url);

				var span = page.createElement("span");
				
				span.appendChild(page.createTextNode(links[i].label.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#(\d+);/g, function(wholematch, parenmatch) { return String.fromCharCode(+parenmatch); })));

				a.appendChild(span);
				item.appendChild(a);
				list.appendChild(item);
			}

			var notice = page.createElement("li");

			var text = page.createElement("small");
			text.style.display = 'block';
			text.style.padding = '5px 14px';
			text.appendChild(page.createTextNode(explanation));
		
			notice.appendChild(text);
			list.appendChild(notice);

			container.appendChild(list);
			container.appendChild(page.createElement("hr"));

			var possibleSiblings = ["side_lists", "custom_search", "trends"];

			var sibling = null;

			for (var i = 0; i < possibleSiblings.length; i++) {
				var possibleSibling = page.getElementById(possibleSiblings[i]);

				if (possibleSibling) {
					possibleSibling.parentNode.insertBefore(container, possibleSibling);
					return;
				}
			}
		
			sidebar.appendChild(container);
		}
	},
	
	injectTrendsDashboard : function (message) {
		var page = content.document;
		
		if (page.getElementById("twitterbar-trends")) {
			return;
		}
		
		var dashboard = page.getElementsByTagName("dashboard").item(0);
		
		var links = message.json.links;
		
		if (links.length) {
			var byline = message.json.byline;
			var explanation = message.json.explanation;

			var container = page.createElement("div");
			container.setAttribute("id", "twitterbar-trends");
			container.setAttribute("class", "component");
			
			var subcontainer = page.createElement("div");
			subcontainer.setAttribute("class", "trends-inner wide-trends");

			container.appendChild(subcontainer);

			var header = page.createElement("h2");
			header.setAttribute("title", byline);
			header.appendChild(page.createTextNode(message.json.title));

			subcontainer.appendChild(header);
			
			var table = page.createElement("table");
			table.style.width = "100%";

			for (var i = 0; i < links.length; i++) {
				if (i % 2 == 0) {
					var row = page.createElement("tr");
					table.appendChild(row);
				}

				var item = page.createElement("td");
				item.style.width = "50%";
				item.style.paddingBottom = "10px";
				item.style.background = 'url("' + links[i].bug + '") no-repeat';

				var a = page.createElement("a");
				a.setAttribute("class", "trend-link");
				a.setAttribute("target", "_blank");
				a.setAttribute("title", links[i].targetUrl);
				a.setAttribute("href", links[i].url);
				a.appendChild(page.createTextNode(links[i].label.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#(\d+);/g, function(wholematch, parenmatch) { return String.fromCharCode(+parenmatch); })));

				item.appendChild(a);
				row.appendChild(item);
			}
			
			subcontainer.appendChild(table);

			var notice = page.createElement("p");

			var text = page.createElement("small");
			text.appendChild(page.createTextNode(explanation));

			notice.appendChild(text);
			subcontainer.appendChild(notice);
			
			var spacer = page.createElement("hr");
			spacer.setAttribute("class", "component-spacer");
			container.appendChild(spacer);

			dashboard.appendChild(container);//, dashboard.childNodes[3]);
		}
	}
};

addEventListener("DOMContentLoaded", TWITTERBAR_CONTENT.domContentLoaded, false);

addMessageListener("TwitterBar:Trends", TWITTERBAR_CONTENT.injectTrends);