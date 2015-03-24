var fs = require('fs');
var https = require('https');

var last;
var tick;

var instrument = "EUR_USD";

var config = {
    account_id: 326049,
    auth: "Bearer "+process.env.OANDA_ACCESS_TOKEN
}

var https_options = {
    method: 'GET',
    host: 'stream-fxpractice.oanda.com',
    path: '/v1/prices?accountId='+process.env.OANDA_ACCOUNT_ID.toString()+'&instruments='+instrument,
    headers: {"Authorization" : "Bearer "+process.env.OANDA_ACCESS_TOKEN},
};

var request = https.request(https_options, function(response){
  response.on("data", function(chunk){
    tick = chunk.toString();
    console.log(tick);
  });
  response.on("end", function(){
    console.log("Disconnected");
  });
});

request.end();