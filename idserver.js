var bodyParser = require('body-parser');
var urlencode = require('urlencode');
var LineByLineReader = require('line-by-line');
var iconv = require('iconv-lite');
var querystring = require("querystring");
var fs = require('graceful-fs');
var S = require('string');

var request = require('request');
var CronJob = require('cron').CronJob;

var express = require('express');
var app  = express();
var http = require('http');
var server = http.createServer(app);

var HashMap = require('hashmap');
var map_key  = new HashMap();//to store local(Taiwan) id
var foreign_map_key  = new HashMap();//to store others location id
var map_botkey  = new HashMap();//(not yet)
var map_grabtype  = new HashMap();//(not yet)

var map_tw_address  = new HashMap();//for insertSeed API:search Taiwan address

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
var tw_address_filename = service['tw_address'];
var map_size=0;//update with url map(cronjob), using clearID function
var foreign_map_size=0;//update with url map(cronjob), using clearID function
var all_crawled=0;
//var apiip = "localhost";


var from_seed_idIndex=0;
var from_data_idIndex=0;
var foreign_from_seed_idIndex=0;
var foreign_from_data_idIndex=0;
//--read data--
ReadTWaddress();
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
job.start();
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
    - search an id 
    - update a id:update/country/?ids=id:time
        -country default is Taiwan
        -ids ex:12345:2016....
        -notice: this API CAN't BE used to delete or insert seed
--------------------------------------*/
app.get('/fbjob/:key/v1.0/databot/:action(search|update)/:country?',function(req,res){
    var key = req.params.key;
    if(!map_botkey.has(key)){
        res.send("illegal request");
        return;
    }
    
    var action = req.params.action;
    var country = req.params.country;
    if(typeof country=="undefined"){
        country = "Taiwan";
    }
    var ids = req.query.ids;//for update/search action
    console.log("--\naction:"+action);
    if(typeof ids =="undefined"){
        res.send("must contains id");
        return;
    }
    if(action=="update") {
        datamanageid(country,action,ids,function(stat){
            res.send(stat);
        });       

    }
    else if(action=="search"){//single id
        data_bot_searchid(country,ids,function(stat){
            res.send(stat);
        });
    }
});
/*---------for url manage--------------
 * for seed bot
    - update a id:update/country/?ids=id1:c1,id2:c2...
    -country default is Taiwan
    - :"c" => reprsent "crawled"
        - if map_key(id) has a timestamp then do not update "c"
    - ids=id1:c1,id2:c2...
    -notice: this API CAN't BE used to delete or insert seed
--------------------------------------*/
app.get('/fbjob/:key/v1.0/seedbot/update/:country?',function(req,res){
    var i,j,k;
    var key = req.params.key;
    var country = req.params.country;
    if(typeof country=="undefined"){
        country = "Taiwan";
    }
    if(!map_botkey.has(key)){
        res.send("illegal request");
        return;
    }
    var ids = req.query.ids;
    if(typeof ids =="undefined"){
        res.send("must contains id");
        return;
    }
    var ids_set = ids.split(",");
    var parts,parts_id,parts_status;
    var result="";
    for(i=0;i<ids_set.length;i++){
        if(ids_set[i]==""){
            continue;
        }
        parts = ids_set[i].split(":");
        if(parts.length!=2){
            continue;
        }
        parts_id = parts[0];
        parts_status = parts[1];

        if(parts_id==""||parts_status==""){
            continue;
        }
        
        if(result==""){
            result+=ids_set[i];
        }
        else{
            result+=","+ids_set[i];
        }

        updateseedid(country,parts_status,parts_id,function(stat){
            //console.log("=>"+stat);
        });       
    }
    res.send("update seed:"+result);
});
/*------insert new seed--------*/
/*
 * for seed bot and data bot
    ?ids=231:Taipei,1312:Taiwan...
    a set of id
*/
/*------insert new seed--------*/
app.get('/fbjob/:key/v1.0/insertseed/',function(req,res){
    var i,j;
    var key = req.params.key;
    if(!map_botkey.has(key)){
        res.send("illegal request");
        return;
    }

    var seeds = req.query.ids;
    //console.log("=>insert:"+seeds);

    var result="";
    var parts = seeds.split(",");
    var loca_parts="";
    var id="";
    for(i=0;i<parts.length;i++){
        if(parts[i]==""){
            continue;
        }
        loca_parts = parts[i].split(":");
        if(loca_parts.length==1){
            id = loca_parts[0];
            loca = "none";
        }
        else if(loca_parts.length==2){
            id = loca_parts[0];
            loca = loca_parts[1];
        }
        else{
            continue;
        }

        if(id==""||loca==""||isNaN(id)){
            continue;
        }
        if(loca=="Taiwan"||loca=="none"||loca=="台灣"||loca=="臺灣"){
            if(map_size>=url_mapSize){
                console.log("map_size>=url_mapSize:"+map_size);
                res.send("full");
                return;
            }
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
            if(foreign_map_size>=url_mapSize){
                console.log("foreign_map_size>=url_mapSize:"+foreign_map_size);
                res.send("full");
                return;
            }
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
        if(loca=="Taiwan"||loca=="none"||loca=="台灣"||loca=="臺灣"){
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

/*------delete seed--------*/
/*
 * for seed bot and data bot
    ?ids=231,1312...
    a set of id
*/
/*------delete seed--------*/
app.get('/fbjob/:key/v1.0/deleteseed/',function(req,res){
    var i,j;
    var key = req.params.key;
    if(!map_botkey.has(key)){
        res.send("illegal request");
        return;
    }

    var seeds = req.query.ids;
    var result="";
    var parts = seeds.split(",");
    for(i=0;i<parts.length;i++){
        if(parts[i]==""){
            continue;
        }
        if(map_key.has(parts[i])){
            map_key.remove(parts[i]);
            if(result!=""){
                result+=","+parts[i];
            }
            else{
                result = parts[i];
            }
        }
        else if(foreign_map_key.has(parts[i])){
            foreign_map_key.remove(parts[i]);
            if(result!=""){
                result+=","+parts[i];
            }
            else{
                result = parts[i];
            }
        }
            
    }
    res.send(result);
});
/*------get a set of seed to crawler--------*/
/*
 * for both seed and data bot
    require [num] to cralwer<=/?num=number, default=10
    - for data bot
    - for seeds bot
*/
/*------get a set of seed to crawler--------*/
app.get('/fbjob/:key/v1.0/getseed/:type(databot|seedbot)/:country?',function(req,res){
    var key = req.params.key;
    var type = req.params.type;
    var country = req.params.country;
    if(typeof country=="undefined"){
        country = "Taiwan";
    }
    if(!map_botkey.has(key)){
        res.send("illegal request");
        return;
    }
    var num = req.query.num;
    console.log("1.num:"+num);
    var priorty = req.query.priorty;//not yet ,for data/seed priorty. Hasn't crawled first.
    if(typeof num=="undefined"){
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
    var jump_flag=0;
    var i,temp_index=-1;
    for(i=0;i<values.length;i++){
        /*not yet*/
        if(values[i]=="y"&&temp_index==-1){
            if(country=="Taiwan"){
                from_seed_idIndex=i;
            }
            else{
                foreign_from_seed_idIndex=i;
            }
            temp_index++;
        }
        /*not yet*/
        if(type=="databot"){
            if(country=="Taiwan"){
                if(i==from_data_idIndex&&(values[i]!="c"||values[i]!="y")){
                    jump_flag=1;
                }
            }
            else{
                if(i==foreign_from_data_idIndex&&(values[i]!="c"||values[i]!="y")){
                    jump_flag=1;
                }
            }
        }
        else if(type=="seedbot"){
            if(country=="Taiwan"){
                if(i==from_seed_idIndex&&values[i]=="c"){
                    jump_flag=1;
                }
            }
            else{
                if(i==foreign_from_seed_idIndex&&values[i]=="c"){
                    jump_flag=1;
                }
            }

        }

        if(type=="databot"){
            if(values[i]=="y"||values[i]=="c"){
                if(jump_flag==1){
                    if(country=="Taiwan"){
                        rom_data_idIndex = i;
                    }
                    else{
                        foreign_from_data_idIndex = i;
                    }
                    jump_flag=0;
                }
                nc_count++;
            }
            else{
                c_count++;
            }
        }
        if(type=="seedbot"){
            if(values[i]!="c"){
                if(jump_flag==1){
                    if(country=="Taiwan"){
                        from_seed_idIndex = i;
                    }
                    else{
                        foreign_from_seed_idIndex = i;
                    }
                    jump_flag=0;
                }
                nc_count++;
            }
            else{
                c_count++;
            }
        }
    }
    if(jump_flag==1&&nc_count!=0){
        if(country=="Taiwan"){
            from_seed_idIndex = 0;
        }
        else{
            foreign_from_seed_idIndex = 0;
        }
    }
    /*
    if(num>nc_count){
        num = nc_count;
    }
    */
    if(nc_count==0){
        all_crawled=1;
    }
    else if(nc_count!=0){
        all_crawled=0;
    }
    
    if(type=="seedbot"){
        if(country=="Taiwan"){
            if((from_seed_idIndex>=total_num)){
                from_seed_idIndex=0;
            }
            if((from_seed_idIndex+num)>=total_num){
                num = total_num-from_seed_idIndex;
                console.log("2.num:"+num+" total_num:"+total_num+" from_seed_idIndex:"+from_seed_idIndex);
            }
        }
        else{
            if((foreign_from_seed_idIndex>=total_num)){
                foreign_from_seed_idIndex=0;
            }
            if((foreign_from_seed_idIndex+num)>=total_num){
                num = total_num-foreign_from_seed_idIndex;
                console.log("3.num:"+num+" total_num:"+total_num+" foreign_from_seed_idIndex:"+foreign_from_seed_idIndex);
            }
        }
        if(num>total_num){
            num = total_num;
            console.log("4.num:"+num);
        }
        console.log("--["+country+"]--\nrequest seed num:"+num);
        if(country=="Taiwan"){
            console.log("from local index:"+from_seed_idIndex);
            end_index = from_seed_idIndex+num;
            console.log("to local index:"+end_index);
        }
        else{
            console.log("from foreign index:"+foreign_from_seed_idIndex);
            end_index = foreign_from_seed_idIndex+num;
            console.log("to foreign index:"+end_index);
        }
    }
    
    else if(type=="databot"){
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
        console.log("--["+country+"]--\nrequest data seed num:"+num);
        if(country=="Taiwan"){
            console.log("from local index:"+from_data_idIndex);
            end_index = from_data_idIndex+num;
            console.log("to local index:"+end_index);
        }
        else{
            console.log("from foreign index:"+foreign_from_data_idIndex);
            end_index = foreign_from_data_idIndex+num;
            console.log("to foreign index:"+end_index);
            
        }
    }

    console.log("["+country+"] map_key.count:"+total_num);
    if(total_num==0||num==0){
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
            if(type=="seedbot"){
                if(all_crawled==0){
                    if(index>=from_seed_idIndex&&value!="c"){
                        if(key.indexOf(" ")==-1&&key!="undefined"&&key!=""){
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
                if(all_crawled==1){
                    if(index>=from_seed_idIndex){
                        if(key.indexOf(" ")==-1&&key!="undefined"&&key!=""){
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
            }
            else if(type=="databot"){
                if(all_crawled==0){
                    if(index>=from_data_idIndex&&(value=="y"||value=="c")){
                        if(key.indexOf(" ")==-1&&key!="undefined"&&key!=""){
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
                if(all_crawled==1){
                    if(index>=from_data_idIndex){
                        if(key.indexOf(" ")==-1&&key!="undefined"&&key!=""){
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
            }
            index++;
            if(j==num){
                num=0;
                console.log("["+index+"]get url num = request num:"+j);
                if(type=="seedbot"){
                    if(index>=from_seed_idIndex){
                        from_seed_idIndex = index;
                        console.log("next index:"+from_seed_idIndex);
                    }
                }
                else if(type=="databot"){
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
                if(type=="seedbot"){
                    all_crawled=1;
                }
                else if(type=="databot"){
                    all_crawled=1;
                }
                res.send(result);
                return;
            }
            else if(index==total_num){
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
            if(type=="seedbot"){
                if(all_crawled==0){
                    //console.log("(#1)");
                    if(index>=foreign_from_seed_idIndex&&value!="c"){
                        if(key.indexOf(" ")==-1&&key!="undefined"&&key!=""){
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
                if(all_crawled==1){
                    if(index>=foreign_from_seed_idIndex){
                        if(key.indexOf(" ")==-1&&key!="undefined"&&key!=""){
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
            }
            else if(type=="databot"){
                if(all_crawled==0){
                    if(index>=foreign_from_data_idIndex&&(value=="y"||value=="c")){
                        if(key.indexOf(" ")==-1&&key!="undefined"&&key!=""){
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
                if(all_crawled==1){
                    if(index>=foreign_from_data_idIndex){
                        if(key.indexOf(" ")==-1&&key!="undefined"&&key!=""){
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
            }
            index++;
            if(j==num){
                num=0;
                console.log("["+index+"]get url num = request num:"+j);
                if(type=="seedbot"){
                    if(index>=foreign_from_seed_idIndex){
                        foreign_from_seed_idIndex = index;
                        console.log("next index:"+foreign_from_seed_idIndex);
                    }
                }
                else if(type=="databot"){
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
                if(type=="seedbot"){
                    all_crawled=1;
                }
                else if(type=="databot"){
                    all_crawled=1;
                }
                res.send(result);
                return;
            }
            else if(index==total_num){
                res.send("(#1)"+result);
                return;
            }
        });

    }
});

/*-------listing and searching url list-----------*/
/*
 * for both seed and data bot
    - search:will use ids, not use type
    - list:will use type, not use ids
*/
/*-------listing and searching url list-----------*/
app.get('/fbjob/:key/v1.0/urllist/:type(seedbot|databot)/:action(list|search)/:country?',function(req,res){
    var key = req.params.key;
    var type = req.params.type;
    var action = req.params.action;
    var country = req.params.country;
    var ids = req.query.ids;
    var i;
    if(typeof country=="undefined"){
        country = "Taiwan";
    }
    var nc_count=0,c_count=0;
    if(action=="search"){
        if(typeof ids=="undefined"){
            res.send("must contains id");
            return;
        }
        searchid(country,ids,function(stat){
            res.send(stat);
        });
    }
    else if(action=="list"){
        var values="";
        if(country=="Taiwan"){
            values = map_key.values();
        }
        else{
            values = foreign_map_key.values();
        }
        for(i=0;i<values.length;i++){
            if(type=="seedbot"){
                if(values[i]!="c"){
                    nc_count++;
                }
                else{
                    c_count++;
                }
            }
            if(type=="databot"){
                if(values[i]!="y"&&values[i]!="c"){
                    c_count++;
                }
                else{
                    nc_count++;
                }
            }
        }
        res.send("["+country+"]["+type+"] total:"+values.length+" crawled:"+c_count+" not crawled:"+nc_count);
    }
});


/*-------listing and searching Taiwan's address list-----------*/
/*
 * for both seed and data bot
    - search:search?address=location_name ex:address=Taipei  or address=臺北
    - list:list all address I have in Taiwan
*/
/*-------listing and searching url list-----------*/
app.get('/fbjob/:key/v1.0/tw_address/:action(list|search)/',function(req,res){
    var action = req.params.action;
    var i,j,k;
    if(action=="list"){
        var result="";
        map_tw_address.forEach(function(value, key) {
            if(result==""){
                result=key+","+value;
            }
            else{
                result+="\n"+key+","+value;
            }
        });
        res.send(result);
    }
    else if(action=="search"){
        var address = req.query.address;
        res.send(map_tw_address.get(address));
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

function updateseedid(country,str,id,fin){
    //console.log("process:"+id+","+str+"\n--");
    var result="";
    if(country=="Taiwan"){
        if(!map_key.has(id)){//if id not exists, then skip it, if want to insert new seed id must use /v1.0/insertseed/ api
            //console.log("not exists:"+id+","+str+"\n--");
            result = "not exists:"+id+","+str+"\n--";
        }
        else{
            if(map_key.get(id)=="y"||map_key.get(id)=="c"){//if is cralwed by data bot, couldn't update it because has timestamp
                if(str=="-1"){
                    //map_key.remove(id);
                    //console.log("delete:"+id+","+str+"\n--");
                    result = "Please use deleteseed API to delete id\n--";
                }
                else{
                    result="update:"+id+","+str+"\n--";
                    map_key.set(id,str);
                }
            }
            else{
                if(str=="-1"){
                    //result = "can't delete ["+id+"] from ["+country+"]:must using data bot api to do this because some issue(this id was crawled by data bot and has timestamp)";
                    result = "Please use deleteseed API to delete id\n--";

                }
            }
        }
    }

    else{
        if(!foreign_map_key.has(id)){//if id not exists, then skip it, if want to insert new seed id must use /v1.0/insertseed/ api
            //console.log("not exists:"+id+","+str+"\n--");
            result = "not exists:"+id+","+str+"\n--";
        }
        else{
            if(foreign_map_key.get(id)=="y"||foreign_map_key.get(id)=="c"){//if is cralwed by data bot, couldn't update it because has timestamp
                if(str=="-1"){
                    //foreign_map_key.remove(id);
                    //console.log("delete:"+id+","+str+"\n--");
                    result = "Please use deleteseed API to delete id\n--";
                }
                else{
                    result="update:"+id+","+str+"\n--";
                    foreign_map_key.set(id,str);
                }
            }
            else{
                if(str=="-1"){
                    //result = "can't delete ["+id+"] from ["+country+"]:must using data bot api to do this because some issue(this id was crawled by data bot and has timestamp)\n--";
                    result = "Please use deleteseed API to delete id\n--";
                }
            }
        }
    }
    fin(result);
    return;

}
function datamanageid(country,action,ids,fin){
    var i,j,k;
    var stat="";
    console.log(ids);
    if(action=="update"){
        console.log("update process:"+ids+"\n--");
        var ids_set = ids.split(",");
        var parts,parts_id,parts_status;
        for(i=0;i<ids_set.length;i++){
            console.log("ids_set:"+ids_set[i]);
            if(ids_set[i]==""){
                continue;
            }
            parts = ids_set[i].split("~");
            if(parts.length!=2){
                continue;
            }
            parts_id = parts[0];
            parts_status = parts[1];
            if(parts_id==""||parts_status==""){
                continue;
            }
            if(country=="Taiwan"){
                if(!map_key.has(parts_id)){//if id not exists, then skip it, if want to insert new seed id must use /v1.0/insertseed/ api
                    stat+="\nnot exist:id["+parts_id+"] to "+country;
                    continue;
                }
                else if(map_key.has(parts_id)){
                    if(parts_status=="-1"){
                        stat += "can't delete id ["+parts_id+"], please use deleteseed API to delete id\n--";
                        continue;
                    }
                    else{
                        console.log("update:"+parts_id+","+parts_status+"\n--");
                        stat+="\nupdate id["+parts_id+"] to "+country;
                    }
                }
                if(parts_status!="-1"){
                    map_key.set(parts_id,parts_status);
                }
            }
            else{
                if(!foreign_map_key.has(parts_id)){//if id not exists, then skip it, if want to insert new seed id must use /v1.0/insertseed/ api

                    stat+="\nnot exist:id["+parts_id+"] to "+country;
                    continue;
                }
                else if(foreign_map_key.has(parts_id)){
                    if(parts_status=="-1"){
                        //foreign_map_key.remove(parts_id);
                        //console.log("delete:"+parts_id+","+parts_status+"\n--");
                        //stat+="\ndelete id["+parts_id+"] to "+country;
                        stat += "can't delete id ["+parts_id+"], please use deleteseed API to delete id\n--";
                        continue;
                    }
                    else{
                        console.log("update:"+parts_id+","+parts_status+"\n--");
                        stat+="\nupdate id["+parts_id+"] to "+country;
                    }
                }
                if(parts_status!="-1"){
                    foreign_map_key.set(parts_id,parts_status);
                }
            }
        }
        fin(stat);
        return;
    }
}
function data_bot_searchid(country,id,fin){
    var result="none";
    if(country=="Taiwan"){
        result=map_key.get(id);
    }
    else{
        result=foreign_map_key.get(id);
    }
    fin(result);
}
function searchid(country,ids,fin){
    var datas = ids.split(",");
    var result="none";
    var i,j;
    for(i=0;i<datas.length;i++){
        if(datas[i]==""){
            continue;
        }
        if(i!=0){
            if(country=="Taiwan"){
                result+="\n"+datas[i]+":"+map_key.get(datas[i]);
            }
            else{
                result+="\n"+datas[i]+":"+foreign_map_key.get(datas[i]);
            }
        }
        else{
            if(country=="Taiwan"){
                result=datas[i]+":"+map_key.get(datas[i]);
            }
            else{
                result=datas[i]+":"+foreign_map_key.get(datas[i]);
            }
        }
    }
    fin(result);
}


function ReadTWaddress(){
    var options = {
        //encoding: 'utf8',
        skipEmptyLines:false
    }
    var lr = new LineByLineReader(tw_address_filename,options);
    iconv.skipDecodeWarning = true;
    lr.on('error', function (err) {
        // 'err' contains error object
        console.log("error:"+err);
    });
    lr.on('line', function (line) {
        var t_county_en,t_block_en;
        /*file format*/
        /*
        100,臺北市中正區,Zhongzheng Dist.,Taipei City
        */
        var part = line.split(",");
        /*cut chinese county*/
        var county = part[1];
        var short_county_cht,county_cht,block_cht,block_cht_temp;
        if(S(county).length<=3){
            short_county_cht = county;
        }
        else{
            short_county_cht = S(county).left(2).s;
        }
        
        county_cht = S(county).left(3).s;
        block_cht_temp = county.split(county_cht);
        block_cht = block_cht_temp[1];
        
        /*cut english county*/
        var county_en = part[3];
        var short_county_en,county_en,block_en,county_en_temp;
        block_en = part[2];

        if(typeof county_en=="undefined"){
            county_en = part[2];
        }
        
        short_county_en = county_en;
        county_en_temp = county_en.split(" County");
        county_en_temp = county_en_temp[0].split(" City");

        if(typeof county_en_temp[0]!="undefined"){
            short_county_en = county_en_temp[0];
        }

        /*record to map*/
        if(S(county).length>3){//if is special case => 290,釣魚台,Diaoyutai  then will not set to map
            map_tw_address.set(short_county_cht,short_county_en);
            map_tw_address.set(short_county_en,short_county_cht);
        }
        map_tw_address.set(county_cht,county_en);
        map_tw_address.set(county_en,county_cht);

        map_tw_address.set(block_cht,block_en);
        map_tw_address.set(block_en,block_cht);

        map_tw_address.set(county,block_en+", "+county_en);
        map_tw_address.set(block_en+", "+county_en,county);
    });
    lr.on('end', function () {
        // All lines are read, file is closed now.
        console.log("read map_tw_address done");
    });

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
        if(part[1]!="undefined"&&typeof part[1]!="undefined"&&part[0]!="undefined"&&typeof part[0]!="undefined"){
            map_key.set(part[0],part[1]);
            //console.log("read:"+part[0]+","+part[1]);
        }
    });
    lr.on('end', function () {
        // All lines are read, file is closed now.
        //job.start();
        console.log("read seed id done");
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
        if(part[1]!="undefined"&&typeof part[1]!="undefined"&&part[0]!="undefined"&&typeof part[0]!="undefined"){
            foreign_map_key.set(part[0],part[1]);
            //console.log("read foreign id:"+part[0]+","+part[1]);
        }
    });
    lr.on('end', function () {
        // All lines are read, file is closed now.
        //job.start();
        console.log("read foreign id done");
    });

}
function ReadBotID(){
    var key="",name="";
    var i;
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
        if(value!=""&&key!=""&&value!=-1&&typeof value !==undefined &&typeof key!==undefined&&key!="undefined"&&value!="undefined") {
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
        if(value!=-1&&typeof value !="undefined"&&typeof key!="undefined"&&key!="undefined"&&value!="undefined") {
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

