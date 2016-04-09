/**
 * @author: 	stef
 * @filename: 	persist_module_stef.js
 * @date: 		2016
 * @updated with version: 	0.1
 *
 * a conversion of node_persistent_admin.js to a module w/o user interaction
 *
 */

var fs = require("fs")					// fs used for file read/write
	, WebSocketClient = require('ws') 	// websocket used for conection to spacebrew
	, logger = require('./logger')		// logger used to log messages
	, stefPersister = exports			// set livePersister to be a node module
	, WS_OPEN = 1 						// websockets library open state constant 
	;


stefPersister.dieFunktion = function( opts ){ //the main function

	
		var defaultPort = 9000;
		var tempPort = parseInt(opts.port);
		//check that tempPort != NaN
		//and that the port is in the valid port range
		if (tempPort == tempPort &&
				tempPort >= 1 && tempPort <= 65535){
				defaultPort = tempPort;
		}
		
	//	var defaultServerPort = 9001;
		
		var defaultHost = opts.host;
		
		var forceClose = false;
		var doPing = true;
		
		// ERMAHGERD NODE.JS!!1
		// very javascript
		// many new
		// such lost
		
		//fs used for file read/write
		var fs = require("fs");
		//websocket used for conection to spacebrew
		var WebSocketClient = require('ws');
		//stdin used for user input
		var stdin = process.openStdin();
		
	// var WebSocketServer = require('ws').Server
	//   , wss = new WebSocketServer({port: defaultServerPort,host:'0.0.0.0'});

		 var l = console.log;
		 l("SUCH CODE! MANY DIRTY! VERY AMATEUR!");
		 
		 
		 var clients = [];
		 //var routes = [];//not used right now, the idea was to track acutal routes to compare against persistent routes, but we may not need to do that.
		 var persistentRoutes = [];

		 /**
		  * Utility function for stripping out whitespaces
		  * @param  {string} str The string input by stupid user
		  * @return {string}     The string without leading or trailing whitespace
		  */
		 var clean = function(str){
		     return str.replace(/(^\s*|\s*$)/g,'');
		 };
		 
		 // die regEx file fett loaden
		 
		 var loadConfig = function(expectFile){
		     try{
		         var config = fs.readFileSync("./data/persistent_config.json");
		         try{
		             persistentRoutes = JSON.parse(config);
		             //for each persistent route, re-define the RexEx
		             //we need to do this because, when we stringify/parse the RegEx, 
		             //it becomes an Object, not a RegEx
		             for (var i = persistentRoutes.length - 1; i >= 0; i--) {
		                 var curr = persistentRoutes[i];
		                 var items = [curr.publisher, curr.subscriber];
		                 for (var j = items.length - 1; j >= 0; j--) {
		                     var item = items[j];
		                     item.clientRE = new RegExp("^"+item.clientName+"$");
		                     item.nameRE = new RegExp("^"+item.name+"$");
												// l(item.nameRE);
		                 };
		             };
		             return true;
		         }catch(err){
		             l("many error while parsing the config file");
		             l(err);
		         }
		     } catch(err){
		         if (expectFile){
		             l("many error while reading the config file");
		             l(err);
		         }
		     }
		     return false;
		 };
		 //auto-load config on startup
		 loadConfig(false);
		
		 
		 /**
		  * Walks all the clients and all the persistent routes, and sends a route Add message for each
		  * route that should exist.
		  */
		 var ensureConnected = function(){
		     //for each publisher, if that publisher is in the persistent routes
		     //      for each subscriber, if that subscriber is the other end of that persistent route
		     //          send the add route message

		     //for each publisher
		     for (var i = 0; i < clients.length; i++){
		         for (var j = 0; j < clients[i].publish.messages.length; j++){
		             //for each persistent route
		             for (var k = 0; k < persistentRoutes.length; k++){
		                 var currRoute = persistentRoutes[k];
		                 //if the publisher is in a persistent route
		                 if (currRoute.publisher.clientRE.test(clients[i].name) &&
		                     currRoute.publisher.nameRE.test(clients[i].publish.messages[j].name)){
		                     //for each subscriber
		                     for (var m = 0; m < clients.length; m++){
		                         for (var n = 0; n < clients[m].subscribe.messages.length; n++){
		                             if (currRoute.subscriber.clientRE.test(clients[m].name) &&
		                                 currRoute.subscriber.nameRE.test(clients[m].subscribe.messages[n].name)){
		                                 //if the pub/sub pair match the persistent route
		                                 //send route message
		                                 wsClient.send(JSON.stringify({
		                                     route:{type:'add',
		                                         publisher:{clientName:clients[i].name,
		                                                     name:clients[i].publish.messages[j].name,
		                                                     type:clients[i].publish.messages[j].type,
		                                                     remoteAddress:clients[i].remoteAddress},
		                                         subscriber:{clientName:clients[m].name,
		                                                     name:clients[m].subscribe.messages[n].name,
		                                                     type:clients[m].subscribe.messages[n].type,
		                                                     remoteAddress:clients[m].remoteAddress}}
		                                 }));
		                             }
		                         }
		                     }
		                 }
		             }
		         }
		     }
		 };

		 /**
		  * Called when we receive a message from the Server.
		  * @param  {websocket message} data The websocket message from the Server
		  */
		 var receivedMessage = function(data, flags){
		     // console.log(data);
		     if (data){
		         var json = JSON.parse(data);
		         //TODO: check if json is an array, otherwise use it as solo message
		         //when we hit a malformed message, output a warning
		         if (!handleMessage(json)){
		             for(var i = 0, end = json.length; i < end; i++){
		                 handleMessage(json[i]);
		             }
		         }
		     }
		 };

		 /**
		  * Handle the json data from the Server and forward it to the appropriate function
		  * @param  {json} json The message sent from the Server
		  * @return {boolean}      True iff the message was a recognized type
		  */
		 var handleMessage = function(json){
		     if (json.message || json.admin){
		         //do nothing
		     } else if (json.config){
		         handleConfigMessage(json);
		     } else if (json.route){
		         if (json.route.type === 'remove'){
		             handleRouteRemoveMessage(json);
		         }
		     } else if (json.remove){
		         handleClientRemoveMessage(json);
		     } else {
		         return false;
		     }
		     return true;
		 };

		 /**
		  * Handles a route remove message from the Server. If the route matches a persistent route
		  * managed by this admin. Then we will try to re-add the route
		  * @param  {json} msg The route remove message from the Server
		  */
		 var handleRouteRemoveMessage = function(msg){
		     //see if the pub client, publisher, sub client, and subscriber match a persistent route
		     //for each persistent route
		     for (var i = persistentRoutes.length - 1; i >= 0; i--) {
		         var currRoute = persistentRoutes[i];
		         if (currRoute.publisher.clientRE.test(msg.route.publisher.clientName) &&
		             currRoute.publisher.nameRE.test(msg.route.publisher.name) &&
		             currRoute.subscriber.clientRE.test(msg.route.subscriber.clientName) &&
		             currRoute.subscriber.nameRE.test(msg.route.subscriber.name)){
		             l("reversing route remove message");
		             msg.route.type = 'add';
		             wsClient.send(JSON.stringify(msg));
		             return;
		         }
		     };
		 };

		 /**
		  * Utility function for helping determine if two config objects refer to the same Client
		  * @param  {Client config} A 
		  * @param  {Client config} B 
		  * @return {boolean}   true iff the names and remote addresses match
		  */
		 var areClientsEqual = function(A, B){
		     return A.name === B.name && A.remoteAddress === B.remoteAddress; 
		 };

		 /**
		  * Handles a remove message from the Server when a Client disconnects.
		  * This function cleans up the appropriate data structures
		  * @param  {json} msg The message from the Server
		  */
		 var handleClientRemoveMessage = function(msg){
		     for (var j = msg.remove.length-1; j >= 0; j--){
		         for (var i = clients.length - 1; i >= 0; i--){
		             if (areClientsEqual(clients[i], msg.remove[j])){
		                 clients.splice(i, 1);
		                 console.log("################### removed a client");
		                 break;
		             }
		         }
		     }
		 };
		    
		 /**
		  * handles a new Config message from a Client. Will connect the new Client to 
		  * all the necessary persistent routes.
		  * @param  {json} msg The Config message from the Server from a Client
		  */
		 var handleConfigMessage = function(msg){
		     var added = false;
		     //see if we are updating a current client
		     for (var i = clients.length-1; i >= 0; i--){
		         if (areClientsEqual(clients[i], msg.config)){
		             //we are updating an existing client
		             console.log("################### updated a client");
		             clients[i] = msg.config;
		             added = true;
		         }
		     }
		     //we didn't find it
		     //add it if necessary
		     if (!added){
		         console.log("################ added a client");
		         clients.push(msg.config);
		     }

		     //************************
		     //****  FAIR WARNING  ****
		     //************************
		     //
		     //The following crazy set of loops was originally set up to go through all publishers exposed 
		     //by this client and connect them to the correct subscribers
		     //The second step was to expand it to handle the reverse case as well (connecting all appropriate
		     //publishers to this client's subscribers).
		     //For now, the variable names within the loops have been kept to reflect the original publisher to subscriber
		     //methodology because that seems easier to follow than more generic names 
		     //such as "primary", "secondary" or whatever else.
		     var items = [{'first':'publisher', 'second':'publish', 'third':'subscriber', 'fourth':'subscribe', 'primaryI':0, 'secondaryI':2},
		                  {'first':'subscriber', 'second':'subscribe', 'third':'publisher', 'fourth':'publish', 'primaryI':2, 'secondaryI':0}];
		     //see if any persistent routes affect this client
		     //for each direction
		     for (var h = 0, e = items.length; h < e; h++) {
		         var item = items[h];
		         var pI = item['primaryI'],
		             sI = item['secondaryI'];
		         //for each persistent route
		         for (var i = persistentRoutes.length - 1; i >= 0; i--) {
		             var currRoute = persistentRoutes[i];
		             //if the client matches a publisher persistent route
		             if (currRoute[item['first']].clientRE.test(msg.config.name)){
		                 //get all the publishers from this client that match this persistent route
		                 var pubMatch = msg.config[item['second']].messages.filter(function(m){
		                     return currRoute[item['first']].nameRE.test(m.name);
		                 });
		                 if (pubMatch.length == 0){
		                     continue;
		                 }
		                 //find all the subscribers that match this persistent route
		                 var subClientMatch = clients.filter(function(c){
		                     return currRoute[item['third']].clientRE.test(c.name);
		                 });
		                 //for each sub client, get a list of subscribers from that client that match this pers. route
		                 for (var j = subClientMatch.length - 1; j >= 0; j--) {
		                     var currSubClient = subClientMatch[j];
		                     var subMatch = currSubClient[item['fourth']].messages.filter(function(m){
		                         return currRoute[item['third']].nameRE.test(m.name);
		                     });
		                     //for each sub, for each pub, send an 'add route' message
		                     for (var k = subMatch.length - 1; k >= 0; k--) {
		                         for (var p = pubMatch.length - 1; p >= 0; p--) {
		                             var args = [];
		                             args[pI] = msg.config;
		                             args[pI+1] = pubMatch[p];
		                             args[sI] = currSubClient;
		                             args[sI+1] = subMatch[k];
		                             addRoute.apply(this, args);//(msg.config, pubMatch[p], currSubClient, subMatch[k]);
		                         };
		                     };
		                 };
		             };
		         };
		     };
		 };

		 /**
		  * Sends an 'add route' command to the Server.
		  * @param {Client obj} pubClient The client of the publisher involved in the new route
		  * @param {Pub obj} pub       The particular publisher exposed by pubClient involved in the new route
		  * @param {Client obj} subClient The client of the subscriber involved in the new route
		  * @param {Pub obj} sub       The particular subscriber exposed by subClient involved in the new route
		  */
		 var addRoute = function(pubClient, pub, subClient, sub){
		     if (pub.type != sub.type){
		         return;
		     }
		     wsClient.send(JSON.stringify({
		         route:{type:'add',
		             publisher:{clientName:pubClient.name,
		                         name:pub.name,
		                         type:pub.type,
		                         remoteAddress:pubClient.remoteAddress},
		             subscriber:{clientName:subClient.name,
		                         name:sub.name,
		                         type:sub.type,
		                         remoteAddress:subClient.remoteAddress}}
		     }));
		 };

		 var setupWSClient = function(){ 
		     // create the wsclient and register as an admin
		     wsClient = new WebSocketClient("ws://"+defaultHost+":"+defaultPort);
		     wsClient.on("open", function(conn){
		         console.log("persister connected");
		         var adminMsg = { "admin": [
		             {"admin": true}
		         ]};
		         wsClient.send(JSON.stringify(adminMsg));
		     });
		     wsClient.on("message", receivedMessage);
		     wsClient.on("error", function(){console.log("ERROR"); console.log(arguments);});
		     wsClient.on("close", function(){console.log("CLOSE"); console.log(arguments);});
		 }

		 // there is an Interval set up below 
		 // which will re-try the connection if it fails
		 setupWSClient();

		 /**
		  * Ready States [copied from WebSocket.js]
		  */

		 var CONNECTING = 0;
		 var OPEN = 1;
		 var CLOSING = 2;
		 var CLOSED = 3;
		 setInterval(function(){if (wsClient.readyState !== OPEN){wsClient.terminate(); setupWSClient()}}, 10000);
}