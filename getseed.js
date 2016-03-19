var CronJob = require('cron').CronJob;
var request = require('request');
var http = require('http');
var fs = require('graceful-fs');
var iconv = require('iconv-lite');
var cheerio = require("cheerio");
var S = require('string');
var he = require('he');
var querystring = require("querystring");
var dateFormat = require('dateformat');
var LineByLineReader = require('line-by-line');
var HashMap = require('hashmap');
var map_tw_address  = new HashMap();
var now = new Date();

var graph_request = 0;
var count=0;
var socket_num=0;
/*-----------init seed, reading setting--------------*/
var service1 = JSON.parse(fs.readFileSync('./service/seeds'));
var seeds = service1['seeds'];
var version = service1['version'];
var appid = service1['id'];
var yoyo = service1['yoyo'];
var id_serverip = service1['id_serverip'];
var id_serverport = service1['id_serverport'];
var key = service1['crawlerkey'];
var country = service1['country'];
var seed_require_Interval = service1['seed_require_Interval'];

exports.service1 = service1;

//likes?fields=talking_about_count,likes
var seed_id;
var again_flag=0;
var old_check=0;
/*
   for(seed_id=0;seed_id<seeds.length;seed_id++){
   console.log("seed:"+seeds[seed_id]['id']);
   insertSeed(seeds[seed_id]['id'],function(status){
//console.log(status);
});
getSeed(seeds[seed_id]['id'],appid+"|"+yoyo,function(result){
if(result!="error"){
//console.log("get seed:"+result);
insertSeed(result,function(status){
//console.log(status);
});
}
else{
console.log("init=>getSeed:err_log");
}
});
}
*/
if(!module.parent){
    var jump_interval=8100;
    var require_num=50;
    var job = new CronJob({
        cronTime:seed_require_Interval,
        onTick:function(){
            requireSeed(require_num,jump_interval);
            jump_interval+=require_num;
            /*
            if(jump_interval>=8500){
                jump_interval = 0;
            }
            */
        },
        start:false,
        timeZone:'Asia/Taipei'
    });
    job.start();
}
//requireSeed(50);

function requireSeed(num,from_index){
    socket_num++;
    //console.log("socket_num:"+socket_num);
    request({
        uri:'http://'+id_serverip+':'+id_serverport+'/fbjob/'+key+'/v1.0/getseed/seedbot/'+country+'/?num='+num+'&from='+from_index,
        timeout: 10000
    },function(error, response, body){
        //console.log("get seed:["+body+"]");
        if(body=="none"){
            console.log("[requireSeed=>hash map is empty]");
            return;
        }
        else if(typeof body=="undefined"){
            console.log("[requireSeed=>body=undefined]");
            return;
        }
        getSeed(body,appid+"|"+yoyo,function(result){
            if(result!="error"){
                console.log("=>get seed:\n"+result+"\n");
                insertSeed(result,function(stat){
                    if(stat!="old"){
                        console.log(stat);
                    }
                });

            }
            else{
                console.log("requireSeed=>getSeed:"+body);
                if(require_num!=1){
                    require_num=1;
                    job.start();
                }
                else{
                    jump_interval=0;
                    job.start();
                    /*
                    deleteSeed(body,function(stat){
                        console.log(stat);
                        require_num=50;
                        job.start();
                    });
                    */
                }
            }
        });
    });
}

function getSeed(groupid,token,fin){
    console.log("--\nrequest:"+groupid);
    socket_num++;
    //console.log("socket_num:"+socket_num);
    //console.log("graph_reauest:"+graph_request);
    request({
        uri:"https://graph.facebook.com/"+version+"/likes/?ids="+groupid+"&access_token="+token+"&fields=location,id,name,is_community_page",
        timeout: 10000
    },function(error, response, body){
        try{
            var feeds = JSON.parse(body);
        }
        catch(e){
            console.log("getSeed:"+e);
            fin("error");
            return;
        }
        finally{
            if(feeds['error']){
                console.log("getSeed error:"+feeds['error']['message']);
                if(feeds['error']['message']=="(#4) Application request limit reached"){
                    console.log("Application request limit reached:"+graph_request);
                    if(!module.parent){
                        job.stop();
                        process.exit(0);
                    }

                }
                else if(feeds['error']['message'].indexOf("(#100)")!=-1){
                    if(!module.parent){
                        job.stop();
                    }
                }
                fin("error");
                return;
            }
            if(!module.parent){
                updateidServer(groupid,"c");
            }

            var len = Object.keys(feeds).length;
            var page_name="";
            var dot_flag=0;
            var i,j,k;
            graph_request++;
            for(j=0;j<len;j++){
                page_name = Object.keys(feeds)[j];
                if(feeds[page_name]['is_community_page']==true||feeds[page_name]['is_community_page']=="true"){
                    fs.appendFile("./"+country+"_is_community_page.record",feeds[page_name]['id']+"\n",function(){});
                    deleteSeed(feeds[page_name]['id'],function(stat){
                    });
                    continue;
                }
                if(feeds[page_name]['data'].length!=0){
                    dot_flag++;
                    var ids="";
                    for(i=0;i<feeds[page_name]['data'].length;i++){
                        var loca="Other";
                        if(dot_flag==1&&i==0){
                            if(typeof feeds[page_name]['data'][i]['location'] !=="undefined"){
                                if(typeof feeds[page_name]['data'][i]['location']['country']!== "undefined"){
                                    loca = feeds[page_name]['data'][i]['location']['country'];
                                }
                                else if(typeof feeds[page_name]['data'][i]['location']['city']!=="undefined"){
                                    loca = feeds[page_name]['data'][i]['location']['city'];

                                }

                            }
                            if(typeof feeds[page_name]['data'][i]['name']!=="undefined"){
                                var ischt = feeds[page_name]['data'][i]['name'].match(/[\u4e00-\u9fa5]/ig);//this will include chs
                                if(ischt!=null){
                                    if(loca==""||loca=="Other"){
                                        loca="Taiwan";
                                    }
                                }
                            }
                            loca = loca.replace("~","");
                            loca = loca.replace(/[0-9]/g,"");
                            loca = loca.replace(/ /g,"");
                            ids += feeds[page_name]['data'][i]['id'];
                            ids+=":"+loca;
                        }
                        else{
                            if(typeof feeds[page_name]['data'][i]['location'] !=="undefined"){
                                if(typeof feeds[page_name]['data'][i]['location']['country']!== "undefined"){
                                    loca = feeds[page_name]['data'][i]['location']['country'];
                                }
                                else if(typeof feeds[page_name]['data'][i]['location']['city']!=="undefined"){
                                    loca = feeds[page_name]['data'][i]['location']['city'];

                                }

                            }
                            if(typeof feeds[page_name]['data'][i]['name']!=="undefined"){
                                var ischt = feeds[page_name]['data'][i]['name'].match(/[\u4e00-\u9fa5]/ig);//this will include chs
                                if(ischt!=null){
                                    if(loca==""||loca=="Other"){
                                        loca="Taiwan";
                                    }
                                }
                            }
                            loca = loca.replace("~","");
                            loca = loca.replace(/[0-9]/g,"");
                            loca = loca.replace(/ /g,"");
                            ids += "~"+feeds[page_name]['data'][i]['id'];
                            ids+=":"+loca;
                        }
                    }

                }

            }
            fin(ids);
        }
    });
}
function updateidServer(ids,mark)
{
    var i,j,k
    var parts = ids.split(",")
    var ids_send="";
    for(i=0;i<parts.length;i++){
        if(parts[i]==""){continue;}
        if(ids_send!=""){
            ids_send+=","+parts[i]+":"+mark;
        }
        else{
            ids_send+=parts[i]+":"+mark;
        }
    }

    request({
        uri:'http://'+id_serverip+':'+id_serverport+'/fbjob/'+key+'/v1.0/seedbot/update/'+country+'/?ids='+ids_send,
        timeout: 10000
    },function(error, response, body){
        if(error){
            job.stop();
            if(again_flag==0){
                fs.appendFile("./err_log","--\n["+ids+"] ["+socket_num+"] updateidServer:"+error,function(){});
                console.log("["+ids+"] updateidServer:error");
                again_flag=1;
                setTimeout(function(){
                    job.start();
                    again_flag=0;
                    socket_num=0;
                },60*1000);
            }
        }                                                                                                                                      else if(body=="illegal request"){
            fs.appendFile("./err_log","--\n["+ids+"] ["+socket_num+"] updateidServer:illegal request",function(){});
            console.log("["+ids+"] updateidServer:illegal request");
            job.stop();
            process.exit(0);
        }
    });
}
function insertSeed(ids,fin){
    //console.log('http://'+id_serverip+':'+id_serverport+'/fbjob/'+key+'/v1.0/insertseed/?ids='+ids);
    socket_num++;
    //console.log("socket_num:"+socket_num);
    var temp_ids = querystring.stringify({ids:ids});
    request({
        //method:'POST',
        uri:'http://'+id_serverip+':'+id_serverport+'/fbjob/'+key+'/v1.0/insertseed/?'+temp_ids,
        //uri:'http://'+id_serverip+':'+id_serverport+'/fbjob/'+key+'/v1.0/insertseed/?ids='+ids,
        timeout: 10000
    },function(error, response, body){
        if(error){
            console.log("error:"+body);
            job.stop();
            if(again_flag==0){
                fs.appendFile("./err_log","--\n["+ids+"] ["+socket_num+"] insertSeed:"+error,function(){});
                console.log("insertSeed:"+error);
                again_flag=1;
                setTimeout(function(){
                    job.start();
                    again_flag=0;
                    socket_num=0;
                },60*1000);
            }
            fin("error");
            return;
        }
        if(body=="illegal request"){//url request error
            fs.appendFile("./err_log","--\n["+ids+"] ["+socket_num+"] insertSeed:"+body,function(){});
            console.log("insertSeed:"+body);
            job.stop();
            process.exit(0);
            fin("error");
            return;
        }
        else if(body==""){
            body=0;
            job.stop();
            console.log("old:"+old_check);
            if(old_check>1000){
                process.exit(0);
            }
            else if(country=="Taiwan"&&old_check>200){
                old_check++;
                country = "Foreign";
                console.log("--change to ["+country+"]--");
                job.start();

            }
            else{
                old_check++;
                country = "Taiwan";
                console.log("--change to ["+country+"]--");
                job.start();
            }
            fin("old");
            return;
        }
        else if(body=="full"){
            console.log("url map is full=>cronjob stop:"+body);
            job.stop();
            process.exit(0);
            fin("full");
        }
        else{
            //console.log("insertSeed=>new:"+ids+"\n--\n");
            fin("insert seed:"+body);
        }
    });
}

function getLocation(list_name,groupid,token,fin){
    request({
        uri:"https://graph.facebook.com/"+version+"/?ids="+groupid+"&access_token="+token+"&fields=location,id,name,talking_about_count,likes,were_here_count,category,is_community_page",
        timeout: 10000
    },function(error, response, body){
        try{
            var feeds = JSON.parse(body);
        }
        catch(e){
            console.log("getSeed:"+e);
            fin("error");
            return;
        }
        finally{
            if(feeds['error']){
                console.log("getSeed error:"+feeds['error']['message']+" groupid:"+groupid);
                fs.appendFile("./"+list_name+"_detectIDerror.record","getSeed error:"+feeds['error']['message']+" groupid:"+groupid+"\n",function(){});
                if(feeds['error']['message']=="(#4) Application request limit reached"){
                    console.log("Application request limit reached:"+graph_request);
                }
                else if(feeds['error']['message'].indexOf("(#100)")!=-1){
                    fs.appendFile("./"+list_name+"_deleteID.record",groupid+"\n",function(){});
                    deleteSeed(groupid,function(stat){
                    });
                    fin("continue");
                    return;
                }
                else if(feeds['error']['message'].indexOf("was migrated to page ID")!=-1){
                    fs.appendFile("./"+list_name+"_migratedID.record",feeds['error']['message']+"\n",function(){});
                    var d_seed,n_seed;
                    d_seed = S(feeds['error']['message']).between('Page ID ',' was').s;
                    n_seed = S(feeds['error']['message']).between('page ID ','.').s;
                    //console.log("delete:"+d_seed+" =>"+n_seed);
                    deleteSeed(d_seed,function(stat){
                    });
                    insertSeed4filter(n_seed,function(stat){
                        if(stat!="old"){
                            console.log(stat+":"+n_seed);
                        }
                    });
                    getLocation(n_seed,token,fin)
                    //fin("continue");
                    return;
                }
                fin("error");
                return;
            }
            var len = Object.keys(feeds).length;
            var page_name="";
            var dot_flag=0;
            var i,j,k;
            var ids="";
            graph_request++;
            for(j=0;j<len;j++){
                page_name = Object.keys(feeds)[j];
                var loca="Other";
                console.log(feeds[page_name]['name']);
                if(feeds[page_name]['is_community_page']==true||feeds[page_name]['is_community_page']=="true"){
                    fs.appendFile("./"+list_name+"_is_community_page.record",feeds[page_name]['id']+"\n",function(){});
                    deleteSeed(feeds[page_name]['id'],function(stat){
                    });
                    continue;
                }
                if(typeof feeds[page_name]['location'] !=="undefined"){
                    if(typeof feeds[page_name]['location']['country']!== "undefined"){
                        loca = feeds[page_name]['location']['country'];
                    }
                    else if(typeof feeds[page_name]['location']['city']!=="undefined"){
                        loca = feeds[page_name]['location']['city'];

                    }
                    else if(typeof feeds[page_name]['location']['street']!=="undefined"){
                        loca = feeds[page_name]['location']['street'];
                    }

                }
                var small_loca1 = S(loca).left(3).s;
                var small_loca2 = S(loca).left(2).s;
                if(typeof feeds[page_name]['name']!=="undefined"){
                    var ischt = feeds[page_name]['name'].match(/[\u4e00-\u9fa5]/ig);//this will include chs
                    //console.log(feeds[page_name]['name']);
                    //var ischt = feeds[page_name]['name'].match(/[^\x00-\xff]/ig);//Asia:japan, korea,...
                    if(ischt!=null){
                        if(loca==""||loca=="Other"){
                        //if(loca==""||loca=="Other"||(!map_tw_address.get(loca)&&!map_tw_address.get(small_loca1)&&!map_tw_address.get(small_loca2))){
                            loca="Taiwan";
                        }

                    }
                }
            
                if(map_tw_address.get(loca)||map_tw_address.get(small_loca1)||map_tw_address.get(small_loca2)){
                    var record = "@"+
                        "\n@id:"+feeds[page_name]['id']+
                            "\n@name:"+feeds[page_name]['name']+
                                "\n@location:"+loca+
                                    "\n@category:"+feeds[page_name]['category']+
                                        "\n@likes:"+feeds[page_name]['likes']+
                                            "\n@talking_about_count:"+feeds[page_name]['talking_about_count']+
                                                "\n@were_here_count:"+feeds[page_name]['were_here_count']+"\n"
                                                fs.appendFile("./"+list_name+"_groups.list",record,function(err){
                                                    if(err){
                                                        console.log(err);
                                                    }
                                                });

                }
                
                else{
                    if(list_name=="id_manage"){
                        var record = "@"+
                            "\n@id:"+feeds[page_name]['id']+
                                "\n@name:"+feeds[page_name]['name']+
                                    "\n@location:"+loca+
                                        "\n@category:"+feeds[page_name]['category']+
                                            "\n@likes:"+feeds[page_name]['likes']+
                                                "\n@talking_about_count:"+feeds[page_name]['talking_about_count']+
                                                    "\n@were_here_count:"+feeds[page_name]['were_here_count']+"\n"
                                                    fs.appendFile("./"+list_name+"_other_groups.list",record,function(err){
                                                        if(err){
                                                            console.log(err);
                                                        }
                                                    });

                    }

                }
                loca = loca.replace("~","");
                loca = loca.replace(/[0-9]/g,"");
                loca = loca.replace(/ /g,"");
                if(ids==""){
                    ids = feeds[page_name]['id'];
                    ids+=":"+loca;
                }
                else{
                    ids += "~"+feeds[page_name]['id'];
                    ids+=":"+loca;
                }

            }
            fin(ids);
        }
    });
}
function insertSeed4filter(list_name,ids,fin){
    var temp_ids = querystring.stringify({ids:ids});
    request({
        //method:'POST',
        uri:'http://'+id_serverip+':'+id_serverport+'/fbjob/'+key+'/v1.0/insertseed/?'+temp_ids,
        //uri:'http://'+id_serverip+':'+id_serverport+'/fbjob/'+key+'/v1.0/insertseed/?ids='+ids,
        timeout: 10000
    },function(error, response, body){
        if(error){
            console.log("error:"+body);
            fs.appendFile("./"+list_name+"_err_log","--\n["+ids+"] ["+socket_num+"] insertSeed:"+error,function(){});
            console.log("insertSeed:"+error);
            fin("error");
            return;
        }
        if(body=="illegal request"){//url request error
            fs.appendFile("./"+list_name+"_err_log","--\n["+ids+"] ["+socket_num+"] insertSeed:"+body,function(){});
            console.log("insertSeed:"+body);
            fin("error");
            return;
        }
        else if(body==""){
            body=0;
            //console.log("old:"+temp_ids);
            fin("old");
            return;
        }
        else if(body=="full"){
            console.log("url map is full=>cronjob stop:"+body);
            fin("full");
        }
        else{
            //console.log("insertSeed=>new:"+ids+"\n--\n");
            fin("insert seed:"+body);
        }
    });
}

function deleteSeed(ids,fin){
    socket_num++;
    //console.log("socket_num:"+socket_num);
    var temp_ids = querystring.stringify({ids:ids});
    request({
        uri:'http://'+id_serverip+':'+id_serverport+'/fbjob/'+key+'/v1.0/deleteseed/?'+temp_ids,
        timeout: 10000
    },function(error, response, body){
        if(error){
            console.log("error:"+body);
            job.stop();
            if(again_flag==0){
                fs.appendFile("./err_log","--\n["+ids+"] ["+socket_num+"] deleteSeed:"+error,function(){});
                console.log("deleteSeed:"+error);
                again_flag=1;
                setTimeout(function(){
                    job.start();
                    again_flag=0;
                    socket_num=0;
                },60000);
            }
            fin("error");
            return;
        }
        if(body=="illegal request"){//url request error
            fs.appendFile("./err_log","--\n["+ids+"] ["+socket_num+"] deleteSeed:"+body,function(){});
            console.log("deleteSeed:"+body);
            job.stop();
            process.exit(0);
            fin("error");
            return;
        }
        else if(body==""){
            body=0;
            console.log("delete seed fail");
            deleteSeed(ids,function(stat){
                console.log(stat);
            });
            return;
        }
        else{
            fin("delete seed:"+body);
        }
    });
}

function ReadTWaddress(tw_address_filename,fin){
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

        if(typeof county_en==="undefined"){
            county_en = part[2];
        }

        short_county_en = county_en;
        county_en_temp = county_en.split(" County");
        county_en_temp = county_en_temp[0].split(" City");

        if(typeof county_en_temp[0]!=="undefined"){
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
        map_tw_address.set("台灣","Taiwan");
        map_tw_address.set("臺灣","Taiwan");
        map_tw_address.set("Taiwan","臺灣");
        console.log("read map_tw_address done");
        fin("read map_tw_address done");
    });

}
exports.insertSeed4filter=insertSeed4filter;
exports.getLocation=getLocation;
exports.ReadTWaddress=ReadTWaddress;
