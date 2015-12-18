var bodyParser = require('body-parser');
var urlencode = require('urlencode');
var LineByLineReader = require('line-by-line');
var iconv = require('iconv-lite');
var querystring = require("querystring");
var fs = require('graceful-fs');

var request = require('request');
var CronJob = require('cron').CronJob;

var express = require('express');
var app  = express();
var http = require('http');
var server = http.createServer(app);

var HashMap = require('hashmap');
var map_key  = new HashMap();
var map_botkey  = new HashMap();
var map_grabtype  = new HashMap();

app.use(bodyParser.json());

app.use(bodyParser.urlencoded({
    extended: true
}));
//--read setting--url manager
var service = JSON.parse(fs.readFileSync('./service/url_manager'));
var apiip = service['id_serverip'];
var apiport = service['id_serverport'];
var writeidInterval = service['writeidInterval'];
var filename = service['idmanage_filename'];
var url_mapSize = service['size'];
var map_size=0;//update with url map(cronjob), using clearID function
//var apiip = "localhost";


var from_seed_idIndex=0;
var from_data_idIndex=0;
//--read data--
ReadID();
ReadBotID();
//--server process--
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
//----------------

new CronJob(writeidInterval,clearID, null, true, 'Asia/Taipei');
//----------------

/*---------for url manage--------------
 * for data bot
    - new a set of id:1123,1123....
    - delete a set of id(not yet)
    - search a set of id 
    - update a id:update/id/?q=newtime
        - q=-1:delete id
        - q='y':new id
        - q=anytime:update timestamp
--------------------------------------*/
app.get('/fbjob/:key/v1.0/:action(new|delete|search|update)/:id/',function(req,res){
    var key = req.params.key;
    if(!map_botkey.has(key)){
        res.send("illegal request");
        return;
    }
    
    var str = req.query.q;
    var action = req.params.action;
    var id = req.params.id;//only for update action
    if(typeof id =="undefined"){
        id='y';
    }
    if(action=="new"||action=="delete"||action=="update") {
        console.log("--\naction:"+action);
        manageid(str,action,id,function(status){
            res.send(action+":"+status);
        });       

    }
    else if(action=="search"){
        searchid(id,res);
    }
});
/*------insert new seed--------*/
/*
 * for seed bot
    ?q=231,1312...
    a set of id
*/
/*------insert new seed--------*/
app.get('/fbjob/:key/v1.0/insertseed/',function(req,res){
    var key = req.params.key;
    if(!map_botkey.has(key)){
        res.send("illegal request");
        return;
    }
    if(map_size>=url_mapSize){
        res.send("full");
        return;
    }
    var seeds = req.query.q;
    var result="";
    parts = seeds.split(",");
    for(i=0;i<parts.length;i++){
        if(!map_key.has(parts[i])){
            map_key.set(parts[i],"y");
            if(i!=0){
                result+=","+parts[i];
            }
            else{
                result=parts[i];
            }
            console.log("insert seed:"+result);
        }
    }
    if(parts.length==0){
        if(!map_key.has(seeds)){
            map_key.set(seeds,"y");
            result=seeds;
            console.log("insert seed:"+result);
        }
    }

    res.send(result);
});

/*------get a set of seed to crawler--------*/
/*
 * for both seed and data bot
    require [num] to cralwer<=/?q=num, default=10
    - for data bot
    - for seeds bot
*/
/*------get a set of seed to crawler--------*/
app.get('/fbjob/:key/v1.0/getseed/:type(data|seed)/',function(req,res){
    var key = req.params.key;
    var type = req.params.type;
    if(!map_botkey.has(key)){
        res.send("illegal request");
        return;
    }
    var num = req.query.q;
    var priorty = req.query.priorty;//not yet ,for data/seed priorty. Hasn't crawled first.
    if(typeof num=="undefined"||isNaN(num)){
        num=10;
    }
    num = parseInt(num);
    total_num = map_key.count();

    var result="";
    var index=0;
    var end_index=0;
    if(type=="seed"){
        if((from_seed_idIndex+num)>total_num){
            from_seed_idIndex=0;
        }
        if(num>total_num){
            num = total_num;
        }
        console.log("--\nrequest seed num:"+num);
        console.log("from index:"+from_seed_idIndex);
        end_index = from_seed_idIndex+num;
        console.log("to index:"+end_index);
    }
    
    else if(type=="data"){
        if((from_data_idIndex+num)>total_num){
            from_data_idIndex=0;
        }
        if(num>total_num){
            num = total_num;
        }
        console.log("--\nrequest data seed num:"+num);
        console.log("from index:"+from_data_idIndex);
        end_index = from_data_idIndex+num;
        console.log("to index:"+end_index);
    }

    console.log("map_key.count:"+total_num);
    if(total_num==0){
        res.send("none");
        return;
    }
    var j=0;
    map_key.forEach(function(value, key) {
            if(type=="seed"){
                if(index>=from_seed_idIndex&&value=="y"){
                    if(j!=0){
                        result+=","+key;
                    }
                    else{
                        result+=key;
                    }
                    j++;
                }
            }
            else if(type=="data"){
                if(index>=from_data_idIndex&&value=="y"){
                    if(j!=0){
                        result+=","+key;
                    }
                    else{
                        result+=key;
                    }
                    j++;
                }
            }
            index++;
            if(j==num){
                console.log("get url num = request num:"+j);
                if(type=="seed"){
                    if(index>=from_seed_idIndex){
                        from_seed_idIndex += index;
                        console.log("next index:"+from_seed_idIndex);
                    }
                }
                else if(type=="data"){
                    if(index>=from_data_idIndex){
                        from_data_idIndex += index;
                        console.log("next index:"+from_data_idIndex);
                    }
                }
                res.send(result);
                num++;
                return;
            }

    });
});
/*(not yet)for new a bot action, bot manager*/
app.get('/fbjob/:key/oceangaisbot/v1.0/newbot/',function(req,res){
    var key = req.params.key;
});

/*(not yet)temp tool, controling crawled type, ex:page,user,group*/
app.get('/fbjob/:key/grab_list/:action(search|insert|delete)/v1.0/',function(req,res){
    //group,page,user
    var key = req.params.key;
    var action = req.params.action;
    var type = req.query.q;
    if(action=="search"){
        if(map_grabtype.has(type)){
        
        }
    }
    else if(action=="insert"){
    
    }
    else if(action=="delete"){
    
    }
});

function manageid(str,action,id,fin){

    if(action=="update"){
        console.log(id+","+str+"\n--");
        if(!map_key.has(id)){
            console.log("new:"+id+","+str+"\n--");
        }
        else{
            console.log("update:"+id+","+str+"\n--");
        }
        fin("ok");
        map_key.set(id,str);
        return;
    }
    
    var datas = str.split("\n");
    var part="";
    var result="";
    if(action=="new"){
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
            fin("all exists");
        }
        else{
            fin("ok");
        }
    }
}
function searchid(str,res){
    var datas = str.split(",");
    var result="none";
    for(i=0;i<datas.length;i++){
            //result+=datas[i]+":"+map_key.has(datas[i])+"\n";
            //result+=datas[i]+","+map_key.get(datas[i])+"\n";
            if(i!=0){
                result+="\n"+map_key.get(datas[i]);
            }
            else{
                result=map_key.get(datas[i]);
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
        var part = line.split(",");
        if(part[1]!="undefined"&&typeof part[1]!="undefined"){
            map_key.set(part[0],part[1]);
            console.log("read:"+part[0]+","+part[1]);
        }
    });
    lr.on('end', function () {
        // All lines are read, file is closed now.
        
        console.log("read done");
    });

}
function ReadBotID(){
    var key="",name="";
    for(i=0;i<service["data"].length;i++){
         key = service["data"][i]["key"];
         name = service["data"][i]["name"];
         console.log("bot:"+key+" name:"+name);
         map_botkey.set(key,name);
    }
    for(i=0;i<service["grab_type"].length;i++){
         type = service["grab_type"][i]["type"];
         console.log("type:"+type);
         map_grabtype.set(type,1);//ON 1, OFF 0
    }
    

}
function clearID(){
    var result="";
    map_key.forEach(function(value, key) {
        if(value!=-1&&typeof value !="undefined") {
            //console.log(key + " : " + value);
            result+=key+","+value+"\n";
        }
        else{
            map_key.remove(key);
            //console.log("clear:"+key + " : " + value);
        }
    });
    fs.writeFile(filename,result,function(err){
        if(err) throw err;
        console.log("write to:"+filename);
    });
    map_size = map_key.count();
}

