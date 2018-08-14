const https = require('https');

// Enter your client ID
const client_id = "DZmHOvV2GTnXzuAAGGTXvOFhG429kPOhOWjKNATZ";

// Enter your client secret
const client_secret = "9kNsxLWx8RNiSbUPwZ3dZu537pKP6CmQ1JeyMsdXNy0LFnhsuNQMFDQb9h4nbDYrDxuoex9Djx1Tyj44DU4rShbTKjOKHAXf0JN872F2XNx5JuKtbAaKeHfV72NEpS3s";

// Enter your API gateway address that hosts your lambda function
const lambda_url = "https://1wdw6c6jzj.execute-api.us-east-1.amazonaws.com/Release/DragonAPI/";

// Enter your bucket that stores the main page of your application
const main_uri = "/elasticbeanstalk-us-east-1-890723246088/test/main.html";

exports.handler = async (event, context, callback) => {
    var p
    var pathParams=[];
    
    // get the route, if it exists
    try{
        pathParams=event['pathParameters']['proxy'].split("/");
        if (pathParams.length > 0){
            p=pathParams[0];
        }
        console.log("path parameters: "+pathParams.join("/"));
    }catch(e){
        p="";
    }
    
    // route the request based on the proxy
    switch(p){
        case "codeProcess":
            await codeProcess(event,context,callback);
            break;
        case "":
        case "main":
            await main(event,context,callback);
            break;
        case "auth":
            const state = Base64.encode(guid());
        
            const response = {
              statusCode: 302,
              headers: {
                "Location": "https://sandbox.bluebutton.cms.gov/v1/o/authorize/?response_type=code&client_id="+client_id+"&state="+state+"redirect_url=https://1wdw6c6jzj.execute-api.us-east-1.amazonaws.com/Release/DragonAPI/codeProcess"
              }
            };
            callback(null, response);
            break;
        case "info":
            await infoExchange(event,context,callback,pathParams[2],pathParams[1]);
            break;
        case "token":
            await tokenRefresh(event,context,callback,pathParams[1],pathParams[0],pathParams[2]);
            break;
        case "test":
            await test(event,context,callback);
            break;
        default:
            var o="";
            for (var x=0; x<pathParams.length;x++){
                switch(x){
                    case 0:
                        o+="main: ";
                        break;
                    case 1:
                        o+="index: ";
                        break;
                    case 2:
                        o+="id: ";
                        break;
                }
                o+=pathParams[x]+" ";
            }
            const unknownResponse = {
                statusCode: 400,
                headers: {
                    "Content-Type":"text/plain"
                },
                body: "400 Unkown request: proxy: "+o
            };
            callback(null,unknownResponse);
            break;
    }
};

async function codeProcess(event, context, callback){
  var code = event["queryStringParameters"]['code'];
  var code_verifier = Base64.encode(guid());
  var b="redirect_uri="
    +lambda_url
    +"codeProcess&scope=&grant_type=authorization_code&code="
    +code
    +"&client_id="
    +client_id
    +"&client_secret="
    +client_secret
    +"&code_verifier="
    +code_verifier;

  var r = await Post("sandbox.bluebutton.cms.gov","/v1/o/token/"
                            , b
                            ,{'Content-Type': 'application/x-www-form-urlencoded',
                            'Content-Length': b.length
                            });
  r=""+r;
  console.log("r: "+r);
  var access_token=JSON.parse(r).access_token;
  var refresh_token=JSON.parse(r).refresh_token;
  var expires_in=JSON.parse(r).expires_in;
  const patient=JSON.parse(r).patient;
  
  callback(null,{statusCode:200,
                 body:"<html><head></head><body><script>window.opener.main.setAccessToken('"
                    +access_token
                    +"','"
                    +refresh_token
                    +"',"
                    +expires_in
                    +",'"
                    +patient
                    +"');</script><input type='hidden' value='"
                    +access_token
                    +"'/></body></html>",
                 headers:{
                     "Content-Type":"text/html"
                 }
  });
}

async function infoExchange(event,context,callback,access_token,dataType){
    var r = await Get("sandbox.bluebutton.cms.gov","/v1/fhir/"+dataType,{"Authorization":"Bearer "+access_token});
    console.log(r);
    callback(null, {statusCode: 200, body: r});
}

async function tokenRefresh(event,context,callback,access_token,dataType, refresh_token){
    var value="grant_type=refresh_token&refresh_token="+refresh_token
                          +"&client_id="
                          +client_id
                          +"&client_secret="
                          +client_secret;
    var r = await Post("sandbox.bluebutton.cms.gov","/v1/o/"+dataType+"/"
                        ,value
                        ,{"Authorization":"Bearer "+access_token,
                            'Content-Type': 'application/x-www-form-urlencoded',
                            'Content-Length': value.length
                            });
    r=""+r;
    console.log("r: "+r);
    access_token=JSON.parse(r).access_token;
    refresh_token=JSON.parse(r).refresh_token;
    var expires_in=JSON.parse(r).expires_in;
    callback(null, {statusCode: 200, body: r});
}

async function Post(uri,path,value,headers) {
    console.log("going to: " + uri+path);
    console.log("data: "+value);
    return new Promise(function(resolve,reject){
        var options = {
            hostname:uri,
            path: path,
            method: "POST",
            headers: headers
        };
        
        var headerValues="";
        for(var key in options.headers) {
            headerValues += ", "+key+": "+options.headers[key];
        }
        
        console.log("request headers: "+headerValues);

        const req = https.request(options, (res) => {
            console.log('statusCode:', res.statusCode);
            console.log('headers:', res.headers);
            
            res.on('data', (d) => {
                resolve(d);
            });
            
            res.on('error', (e) => {
                resolve(e);
            });
        });
        
        console.log("posting");
        req.write(value);
        req.end();
    });
}

async function Get(uri,path,headers){
    console.log("Getting file:"+uri+path);
    return new Promise(function(resolve,reject){
        var options = {
            host:uri,
            path: path,
            method: "GET",
            headers: headers
        };
        
        const req = https.request(options, (res) => {
            console.log('GET statusCode:', res.statusCode);
            console.log('GET headers:', res.headers);
            var data="";
            
            res.on('data', (d) => {
                data += d;
            });
            
            res.on('end', (d) => {
                resolve(data);
            });
            
            res.on('error', (e) => {
                resolve(e);
            });
        });
        console.log("GET uri: "+options.host+options.path);
        req.end();
    });
}

async function main(event,context,callback){
    const html= await Get("s3.amazonaws.com",main_uri,{});
    callback(null,{statusCode:200,headers: {"Content-Type":"text/html"}, body:html});
}

async function test(event,context,callback){
    console.log("test function");
    const html="<html><head></head><body><div>this is a test page</body></html>";
    callback(null,{statusCode:200,headers: {"Content-Type":"text/html"}, body:html});
}

function guid() {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  }
  return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}

/**
*
*  Base64 encode / decode
*  http://www.webtoolkit.info/
*
**/
var Base64 = {
    // private property
    _keyStr : "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",
    
    // public method for encoding
    encode : function (input) {
        var output = "";
        var chr1, chr2, chr3, enc1, enc2, enc3, enc4;
        var i = 0;
    
        input = Base64._utf8_encode(input);
    
        while (i < input.length) {
    
            chr1 = input.charCodeAt(i++);
            chr2 = input.charCodeAt(i++);
            chr3 = input.charCodeAt(i++);
    
            enc1 = chr1 >> 2;
            enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
            enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
            enc4 = chr3 & 63;
    
            if (isNaN(chr2)) {
                enc3 = enc4 = 64;
            } else if (isNaN(chr3)) {
                enc4 = 64;
            }
    
            output = output +
            this._keyStr.charAt(enc1) + this._keyStr.charAt(enc2) +
            this._keyStr.charAt(enc3) + this._keyStr.charAt(enc4);
    
        }
    
        return output;
    },
    
    // public method for decoding
    decode : function (input) {
        var output = "";
        var chr1, chr2, chr3;
        var enc1, enc2, enc3, enc4;
        var i = 0;
    
        input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");
    
        while (i < input.length) {
    
            enc1 = this._keyStr.indexOf(input.charAt(i++));
            enc2 = this._keyStr.indexOf(input.charAt(i++));
            enc3 = this._keyStr.indexOf(input.charAt(i++));
            enc4 = this._keyStr.indexOf(input.charAt(i++));
    
            chr1 = (enc1 << 2) | (enc2 >> 4);
            chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
            chr3 = ((enc3 & 3) << 6) | enc4;
    
            output = output + String.fromCharCode(chr1);
    
            if (enc3 != 64) {
                output = output + String.fromCharCode(chr2);
            }
            if (enc4 != 64) {
                output = output + String.fromCharCode(chr3);
            }
    
        }
    
        output = Base64._utf8_decode(output);
    
        return output;
    
    },
    
    // private method for UTF-8 encoding
    _utf8_encode : function (string) {
        string = string.replace(/\r\n/g,"\n");
        var utftext = "";
    
        for (var n = 0; n < string.length; n++) {
    
            var c = string.charCodeAt(n);
    
            if (c < 128) {
                utftext += String.fromCharCode(c);
            }
            else if((c > 127) && (c < 2048)) {
                utftext += String.fromCharCode((c >> 6) | 192);
                utftext += String.fromCharCode((c & 63) | 128);
            }
            else {
                utftext += String.fromCharCode((c >> 12) | 224);
                utftext += String.fromCharCode(((c >> 6) & 63) | 128);
                utftext += String.fromCharCode((c & 63) | 128);
            }
    
        }
    
        return utftext;
    },
    
    // private method for UTF-8 decoding
    _utf8_decode : function (utftext) {
        var string = "";
        var i = 0;
        var c = 0;
        var c2 = 0;
        var c3 = 0;
    
        while ( i < utftext.length ) {
    
            c = utftext.charCodeAt(i);
    
            if (c < 128) {
                string += String.fromCharCode(c);
                i++;
            }
            else if((c > 191) && (c < 224)) {
                c2 = utftext.charCodeAt(i+1);
                string += String.fromCharCode(((c & 31) << 6) | (c2 & 63));
                i += 2;
            }
            else {
                c2 = utftext.charCodeAt(i+1);
                c3 = utftext.charCodeAt(i+2);
                string += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
                i += 3;
            }
    
        }
    
        return string;
    }
};