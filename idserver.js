var express = require('express');
var bodyParser = require('body-parser');
var urlencode = require('urlencode');

var request = require('request');
var CronJob = require('cron').CronJob;

var app  = express();
var http = require('http');
var server = http.createServer(app);

//var apiip = "localhost";

var fs = require('fs');
var service2 = JSON.parse(fs.readFileSync('./service/shadowap'));
var apiip = service2['id_serverip'];
var apiport = service2['id_serverport'];
var writeidInterval = service2['writeidInterval'];
var filename = service2['idmanage_filename'];

var querystring = require("querystring");
var fs = require('fs');

var HashMap = require('hashmap');
var map_key  = new HashMap();
var map_botkey  = new HashMap();

var LineByLineReader = require('line-by-line');


var iconv = require('iconv-lite');

app.use(bodyParser.json());

app.use(bodyParser.urlencoded({
    extended: true
}));

ReadID();
ReadBotID();
new CronJob(writeidInterval,clearID, null, true, 'Asia/Taipei');

app.get('/fbjob/:key/v1.0/:action(new|delete|search|update)/:id/',function(req,res){
    var key = req.params.key;
    if(!map_botkey.has(key)){
        res.send("illegal request");
        return;
    }
    
    var str = req.query.q;
    var action = req.params.action;
    var id = req.params.id;//only for update action

    if(action=="new"||action=="delete"||action=="update") {
        console.log("action:"+action);
        manageid(str,action,id);       
        res.send(action+":ok");
    }
    else if(action=="search"){
        searchid(id,res);
    }
});

app.get('/fbjob/:key/v1.0/:type(data|seed)/getlist',function(req,res){
    if(!map_botkey.has(key)){
        res.send("illegal request");
        return;
    }
    var type = req.params.type;
    var key = req.params.key;
    if(type=="seed"){
    
    }
});

app.get('/fbjob/:key/oceangaisbot/v1.0/newbot/',function(req,res){
    var key = req.params.key;
});


function manageid(str,action,id){

    if(action=="update"){
        console.log(id+","+str+"\n--");
        if(!map_key.has(id)){
            console.log("new:"+id+"\n--");
            //fs.appendFile(filename,id+","+str+"\n",function(){});
        }
        else{
            console.log("has exist:"+id+","+str+"\n--");
        }
        map_key.set(id,str);
        return;
    }
    
    var datas = str.split("\n");
    var part="";
    var result="";
    if(action=="new"){
        
        fs.appendFile("./tags.test",str,function(err){
            if(err) throw err;
        });
        
        for(i=0;i<datas.length;i++){
            if(datas[i]!=""){
                part = datas[i].split(",");
                if(!map_key.has(part[0])){
                    console.log("new:"+part[0]+"\n--");
                    map_key.set(part[0],part[1]);
                    result+=part[0]+","+part[1]+"\n";
                }
                else{
                    console.log("has exist:"+part[0]+","+map_key.get(part[0])+"\n--");
                }
            }
        }
        if(result!=""){
            //fs.appendFile(filename,result,function(){});
        }
    }
}
function searchid(str,res){
    var datas = str.split(",");
    var result="";
    for(i=0;i<datas.length;i++){
            //result+=datas[i]+":"+map_key.has(datas[i])+"\n";
            //result+=datas[i]+","+map_key.get(datas[i])+"\n";
            if(i!=0){
                result+="\n"+map_key.get(datas[i]);
            }
            else{
                result+=map_key.get(datas[i]);
            }
    }
    res.send(result);
}

function ReadID(){
    var options = {
        //encoding: 'utf8',
        skipEmptyLines:false
    }
    var lr = new LineByLineReader(filename,options);
    iconv.skipDecodeWarning = true;
    lr.on('error', function (err) {
        // 'err' contains error object
        console.log("error:"+err);
    });
    lr.on('line', function (line) {
        /*
        var datas = line.split(",");
        for(i=0;i<datas.length;i++){
            map_key.set(datas[i],"new");
            console.log("read:"+datas[i]);
        }
        if(datas.length==0){
            map_key.set(line,"new");
            console.log("read:"+datas[i]);
        }
        */
        var part = line.split(",");
        map_key.set(part[0],part[1]);
        console.log("read:"+part[0]+","+part[1]);
    });
    lr.on('end', function () {
        // All lines are read, file is closed now.
        
        console.log("read done");
    });

}
function ReadBotID(){
    var service = JSON.parse(fs.readFileSync('./service/key_manage'));
    var key="",name="";
    for(i=0;i<service["data"].length;i++){
         key = service["data"][i]["key"];
         name = service["data"][i]["name"];
         console.log("bot:"+key+" name:"+name);
         map_botkey.set(key,name);
    }

}
function clearID(){
    var result="";
    map_key.forEach(function(value, key) {
        if(value!=-1) {
            console.log(key + " : " + value);
            result+=key+","+value+"\n";
        }
        else{
            console.log("clear:"+key + " : " + value);
        }
    });
    fs.writeFile(filename,result,function(err){
        if(err) throw err;
        console.log("write to:"+filename);
    });

}
//server process
process.on('SIGINT', function () {
    console.log("[Server stop] ["+new Date()+"] http stop at "+apiip+":"+apiport);
    process.exit(0);

});
process.on('SIGTERM', function () {
    console.log("[Server stop] ["+new Date()+"] http stop at "+apiip+":"+apiport);
    process.exit(0);
});
server.listen(apiport,apiip,function(){
    console.log("[Server start] ["+new Date()+"] http work at "+apiip+":"+apiport);
});
