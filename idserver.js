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
var foreign_map_key  = new HashMap();
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
var foreign_filename = service['foreign_idmanage_filename'];
var url_mapSize = service['size'];
var map_size=0;//update with url map(cronjob), using clearID function
var foreign_map_size=0;//update with url map(cronjob), using clearID function
var all_crawled=0;
//var apiip = "localhost";


var from_seed_idIndex=0;
var from_data_idIndex=0;
var foreign_from_seed_idIndex=0;
var foreign_from_data_idIndex=0;
//--read data--
ReadID();
ReadForeignID();
ReadBotID();


var job = new CronJob({
    cronTime:writeidInterval,
    onTick:function(){
        clearID();
    },
    start:false,
    timeZone:'Asia/Taipei'
});
//new CronJob(writeidInterval,clearID, null, true, 'Asia/Taipei');
//--server process--
process.on('SIGINT', function () {
    console.log("[Server stop] ["+new Date()+"] http stop at "+apiip+":"+apiport);
    job.stop();
    process.exit(0);

});
process.on('SIGTERM', function () {
    console.log("[Server stop] ["+new Date()+"] http stop at "+apiip+":"+apiport);
    job.stop();
    process.exit(0);
});
server.listen(apiport,apiip,function(){
    console.log("[Server start] ["+new Date()+"] http work at "+apiip+":"+apiport);
});
//----------------


//----------------

/*---------for url manage--------------
 * for data bot
    - new a set of id:1123,1123....(Discard)
    - delete a set of id(not yet)
    - search a set of id 
    - update a id:update/id/?q=newtime
        - q=-1:delete id
        - q='y':new id
        - q=anytime:update timestamp
--------------------------------------*/
app.get('/fbjob/:key/v1.0/data/:action(new|delete|search|update)/:country',function(req,res){
    var key = req.params.key;
    if(!map_botkey.has(key)){
        res.send("illegal request");
        return;
    }
    
    var str = req.query.q;
    var action = req.params.action;
    var country = req.params.country;
    var ids = req.query.ids;//for update/search action
    if(typeof id =="undefined"){
        id='y';
    }
    if(action=="new"||action=="delete"||action=="update") {
        console.log("--\naction:"+action);
        datamanageid(country,str,action,ids,function(stat){
            res.send(action+":"+stat);
        });       

    }
    else if(action=="search"){
        searchid(country,ids,res);
    }
});
/*---------for url manage--------------
 * for seed bot
    - update a id:update/id/?q=c
    - q="c" => reprsent "crawled"
        - if map_key(id) has a timestamp then do not upate "c"
--------------------------------------*/
app.get('/fbjob/:key/v1.0/seed/update/:country',function(req,res){
    var i,j,k;
    var key = req.params.key;
    var country = req.params.country;
    if(!map_botkey.has(key)){
        res.send("illegal request");
        return;
    }
    
    var str = req.query.q;
    var ids_set = req.query.ids.split(",");
    for(i=0;i<ids_set.length;i++){
        if(ids_set[i]==""){
            continue;
        }
        seedmanageid(country,str,ids_set[i],function(stat){

        });       
    }
    res.send("update seed:"+ids_set);
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
        console.log("map_size>=url_mapSize:"+map_size);
        res.send("full");
        return;
    }
    var seeds = req.query.q;
    var result="";
    var parts = seeds.split(",");
    var loca_parts="";
    var id="";
    for(i=0;i<parts.length;i++){
        if(parts[i]==""){
            continue;
        }
        loca_parts = parts[i].split(":");
        id = loca_parts[0];
        loca = loca_parts[1];
        if(loca=="Taiwan"||loca=="none"){
            if(!map_key.has(id)){
                map_key.set(id,"y");
                if(i!=0){
                    result+=","+id;
                }
                else{
                    result=id;
                }
            }
        }
        else{
            if(!foreign_map_key.has(id)){
                foreign_map_key.set(id,"y");
                if(i!=0){
                    result+=","+id;
                }
                else{
                    result=id;
                }
            }
            
        }
    }
    if(parts.length==0){
        loca_parts = parts[i].split(":");
        id = loca_parts[0];
        loca = loca_parts[1];
        if(loca=="Taiwan"){
            if(!map_key.has(id)){
                map_key.set(id,"y");
                result=id;
                console.log("insert seed to Taiwan:"+id);
            }
        }
        else{
            if(!foreign_map_key.has(id)){
                foreign_map_key.set(id,"y");
                result=id;
                console.log("insert seed to foreign:"+result);
            }
        }
    }
    else if(i>0){
            console.log("insert seed:"+result);
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
app.get('/fbjob/:key/v1.0/getseed/:type(data|seed)/:country',function(req,res){
    var key = req.params.key;
    var type = req.params.type;
    var country = req.params.country;
    if(!map_botkey.has(key)){
        res.send("illegal request");
        return;
    }
    var num = req.query.q;
    var priorty = req.query.priorty;//not yet ,for data/seed priorty. Hasn't crawled first.
    if(typeof num=="undefined"||isNaN(num)){
        num=10;
    }
    var values="";
    num = parseInt(num);
    if(country=="Taiwan"){
       total_num = map_key.count();
       values = map_key.values();
    }
    else{
       total_num = foreign_map_key.count();
       values = foreign_map_key.values();
    }

    var result="";
    var index=0;
    var end_index=0;
    
    var nc_count=0,c_count=0;

    for(i=0;i<values.length;i++){
        if(type=="data"){
            if(values[i]=="y"||values[i]=="c"){
                nc_count++;
            }
            else{
                c_count++;
            }
        }
        if(type=="seed"){
            if(values[i]=="y"){
                nc_count++;
            }
            else{
                c_count++;
            }
        }
    }
    if(num>nc_count){
        num = nc_count;
    }
    else if(nc_count==0){
        all_crawled=1;
    }
    else if(nc_count!=0){
        all_crawled=0;
    }

    if(type=="seed"){
        if(country=="Taiwan"){
            if((from_seed_idIndex+num)>total_num){
                from_seed_idIndex=0;
            }
        }
        else{
            if((foreign_from_seed_idIndex+num)>total_num){
                foreign_from_seed_idIndex=0;
            }
        }
        if(num>total_num){
            num = total_num;
        }
        console.log("--\nrequest seed num:"+num);
        if(country=="Taiwan"){
            console.log("from index:"+from_seed_idIndex);
            end_index = from_seed_idIndex+num;
            console.log("to index:"+end_index);
        }
        else{
            console.log("from index:"+foreign_from_seed_idIndex);
            end_index = foreign_from_seed_idIndex+num;
            console.log("to index:"+end_index);
        }
    }
    
    else if(type=="data"){
        if(country=="Taiwan"){
            if((from_data_idIndex+num)>total_num){
                from_data_idIndex=0;
            }
        }
        else{
            if((foreign_from_data_idIndex+num)>total_num){
                foreign_from_data_idIndex=0;
            }
            
        }
        if(num>total_num){
            num = total_num;
        }
        console.log("--\nrequest data seed num:"+num);
        if(country=="Taiwan"){
            console.log("from index:"+from_data_idIndex);
            end_index = from_data_idIndex+num;
            console.log("to index:"+end_index);
        }
        else{
            console.log("from index:"+foreign_from_data_idIndex);
            end_index = foreign_from_data_idIndex+num;
            console.log("to index:"+end_index);
            
        }
    }

    console.log("map_key.count:"+total_num);
    if(total_num==0){
        res.send("none");
        return;
    }
    //check list status:how many url hasn't crawled

    var j=0;
    if(country=="Taiwan"){
        map_key.forEach(function(value, key) {
            if(num==0){
                return;
            }
            if(type=="seed"){
                if(all_crawled==0){
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
                if(all_crawled==1){
                    if(index>=from_seed_idIndex){
                        if(j!=0){
                            result+=","+key;
                        }
                        else{
                            result+=key;
                        }
                        j++;
                    }
                }
            }
            else if(type=="data"){
                if(all_crawled==0){
                    if(index>=from_data_idIndex&&(value=="y"||value=="c")){
                        if(j!=0){
                            result+=","+key;
                        }
                        else{
                            result+=key;
                        }
                        j++;
                    }
                }
                if(all_crawled==1){
                    if(index>=from_data_idIndex){
                        if(j!=0){
                            result+=","+key;
                        }
                        else{
                            result+=key;
                        }
                        j++;
                    }
                }
            }
            index++;
            if(j==num){
                num=0;
                console.log("["+index+"]get url num = request num:"+j);
                if(type=="seed"){
                    if(index>=from_seed_idIndex){
                        from_seed_idIndex = index;
                        console.log("next index:"+from_seed_idIndex);
                    }
                }
                else if(type=="data"){
                    if(index>=from_data_idIndex){
                        from_data_idIndex = index;
                        console.log("next index:"+from_data_idIndex);
                    }
                }
                res.send(result);
                return;
            }
            else if(j!=0&&j<num&&index==total_num){
                console.log("["+index+"]get url num != request num:"+j);
                if(type=="seed"){
                    all_crawled=1;
                }
                else if(type=="data"){
                    all_crawled=1;
                }
                res.send(result);
                return;
            }
        });

    }
    else{
        foreign_map_key.forEach(function(value, key) {
            if(num==0){
                return;
            }
            if(type=="seed"){
                if(all_crawled==0){
                    if(index>=foreign_from_seed_idIndex&&value=="y"){
                        if(j!=0){
                            result+=","+key;
                        }
                        else{
                            result+=key;
                        }
        j++;
                    }
                }
                if(all_crawled==1){
                    if(index>=foreign_from_seed_idIndex){
                        if(j!=0){
                            result+=","+key;
                        }
                        else{
                            result+=key;
                        }
                        j++;
                    }
                }
            }
            else if(type=="data"){
                if(all_crawled==0){
                    if(index>=foreign_from_data_idIndex&&(value=="y"||value=="c")){
                        if(j!=0){
                            result+=","+key;
                        }
                        else{
                            result+=key;
                        }
                        j++;
                    }
                }
                if(all_crawled==1){
                    if(index>=foreign_from_data_idIndex){
                        if(j!=0){
                            result+=","+key;
                        }
                        else{
                            result+=key;
                        }
                        j++;
                    }
                }
            }
            index++;
            if(j==num){
                num=0;
                console.log("["+index+"]get url num = request num:"+j);
                if(type=="seed"){
                    if(index>=foreign_from_seed_idIndex){
                        foreign_from_seed_idIndex = index;
                        console.log("next index:"+foreign_from_seed_idIndex);
                    }
                }
                else if(type=="data"){
                    if(index>=foreign_from_data_idIndex){
                        foreign_from_data_idIndex = index;
                        console.log("next index:"+foreign_from_data_idIndex);
                    }
                }
                res.send(result);
                return;
            }
            else if(j!=0&&j<num&&index==total_num){
                console.log("["+index+"]get url num != request num:"+j);
                if(type=="seed"){
                    all_crawled=1;
                }
                else if(type=="data"){
                    all_crawled=1;
                }
                res.send(result);
                return;
            }
        });

    }
});

//Testing:listing url list
app.get('/fbjob/:key/v1.0/urllist/:type(seed|data)/:country',function(req,res){
    var key = req.params.key;
    var type = req.params.type;
    var country = req.params.country;
    var str = req.query.q;
    var nc_count=0,c_count=0;
    if(str=="detail"){
        var values="";
        if(country=="Taiwan"){
            values = map_key.values();
        }
        else{
            values = foreign_map_key.values();
        }
        for(i=0;i<values.length;i++){
            if(type=="seed"){
                if(values[i]=="y"){
                    nc_count++;
                }
                else{
                    c_count++;
                }
            }
            if(type=="data"){
                if(values[i]!="y"&&values[i]!="c"){
                    c_count++;
                }
                else{
                    nc_count++;
                }
            }
        }
        res.send("total:"+values.length+" crawled:"+c_count+" not crawled:"+nc_count);
    }
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

function seedmanageid(country,str,id,fin){
    console.log(id+","+str+"\n--");

    if(country=="Taiwan"){
        if(!map_key.has(id)){
            //console.log("new:"+id+","+str+"\n--");
            map_key.set(id,str);
        }
        else{
            if(map_key.get(id)=="y"){//if is cralwed by data bot, couldn't update it because has timestamp
                //console.log("update:"+id+","+str+"\n--");
                map_key.set(id,str);
            }
        }
    }

    else{
        if(!foreign_map_key.has(id)){
            //console.log("new:"+id+","+str+"\n--");
            foreign_map_key.set(id,str);
        }
        else{
            if(foreign_map_key.get(id)=="y"){//if is cralwed by data bot, couldn't update it because has timestamp
                //console.log("update:"+id+","+str+"\n--");
                foreign_map_key.set(id,str);
            }
        }
        
    }
    fin(str);

    return;

}
function datamanageid(country,str,action,ids,fin){
    var i,j,k;
    if(action=="update"){
        console.log("update:"+ids);
        var ids_set = ids.split(",");
        for(i=0;i<ids_set.length;i++){
            if(ids_set[i]==""){
                continue;
            }
            if(country=="Taiwan"){
                if(!map_key.has(ids_set[i])){
                    console.log("new:"+ids_set[i]+","+str+"\n--");
                }
                else{
                    console.log("update:"+ids_set[i]+","+str+"\n--");
                }
                map_key.set(ids_set[i],str);
            }
            else{
                if(!foreign_map_key.has(ids_set[i])){
                    console.log("new:"+ids_set[i]+","+str+"\n--");
                }
                else{
                    console.log("update:"+ids_set[i]+","+str+"\n--");
                }
                foreign_map_key.set(ids_set[i],str);
                
            }
        }
        fin("ok");
        return;
    }
    /*used for format.js: add id from post message_tag, no more use now
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
    */
}
function searchid(country,str,res){
    var datas = str.split(",");
    var result="none";
    for(i=0;i<datas.length;i++){
        if(datas[i]==""){
            continue;
        }
        //result+=datas[i]+":"+map_key.has(datas[i])+"\n";
        //result+=datas[i]+","+map_key.get(datas[i])+"\n";
        if(i!=0){
            if(country=="Taiwan"){
                result+="\n"+map_key.get(datas[i]);
            }
            else{
                result+="\n"+foreign_map_key.get(datas[i]);
            }
        }
        else{
            if(country=="Taiwan"){
                result=map_key.get(datas[i]);
            }
            else{
                result=foreign_map_key.get(datas[i]);
            }
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
        job.stop();
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
        job.start();
        console.log("read done");
    });

}
function ReadForeignID(){
    var options = {
        //encoding: 'utf8',
        skipEmptyLines:false
    }
    var lr = new LineByLineReader(foreign_filename,options);
    iconv.skipDecodeWarning = true;
    lr.on('error', function (err) {
        // 'err' contains error object
        console.log("error:"+err);
        job.stop();
    });
    lr.on('line', function (line) {
        var part = line.split(",");
        if(part[1]!="undefined"&&typeof part[1]!="undefined"){
            foreign_map_key.set(part[0],part[1]);
            console.log("read foreign id:"+part[0]+","+part[1]);
        }
    });
    lr.on('end', function () {
        // All lines are read, file is closed now.
        job.start();
        console.log("read foreign id done");
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
    var foreign_result="";
    map_key.forEach(function(value, key) {
        if(value!=-1&&typeof value !="undefined"&&typeof key!="undefined") {
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



    foreign_map_key.forEach(function(value, key) {
        if(value!=-1&&typeof value !="undefined"&&typeof key!="undefined") {
            //console.log(key + " : " + value);
            foreign_result+=key+","+value+"\n";
        }
        else{
            foreign_map_key.remove(key);
            //console.log("clear:"+key + " : " + value);
        }
    });
    fs.writeFile(foreign_filename,foreign_result,function(err){
        if(err) throw err;
        console.log("write to:"+foreign_filename);
    });
    foreign_map_size = foreign_map_key.count();
}

