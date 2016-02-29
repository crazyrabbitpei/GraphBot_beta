'use strict'
var S = require('string');
var he = require('he');
var dateFormat = require('dateformat');
var request = require('request');
var fs = require('graceful-fs');

function storeinfo(key,now_flag,end_flag,id_serverip,id_serverport,feeds,fin){
    var now = new Date();
    var date = dateFormat(now, "yyyymmdd_HHMM");
    var title,source,url,time,body,message_tag="",description="";
    var result="";
    var i=0,j=0;
    while(i<feeds.length){
        //time compare
        //console.log("["+i+"]created_time:"+feeds[i]["created_time"]+" end_flag:"+end_flag);
        if(feeds[i]["created_time"]<=end_flag && end_flag!=0){
            console.log("["+feeds[i]["id"]+"]created_time:"+feeds[i]["created_time"]+" end_flag:"+end_flag);
            console.log("=>end");
            fin("endTONext@Gais:"+feeds[i]["id"]+"endTONext@Gais:"+result);
            return ;
        }
        //console.log("=>pass");
        title = feeds[i]["from"].name;
        if(!feeds[i]["link"]){
            body="";
        }
        else{
            if(feeds[i]["name"]){
                title = feeds[i]["name"];
            }
            body = feeds[i]["link"];

        }

        source = "fb/"+feeds[i]["from"].name;
        url = feeds[i]["id"];
        time = feeds[i]["created_time"];
        if(feeds[i]["message"]){
            body += "\n"+feeds[i]["message"];
        }
        if(feeds[i]["description"]){
            description = feeds[i]["description"];
        }
        if(result!=""){
            result += "\n@\n";
        }
        else{
            result += "@\n";
        }
        result += "@title:"+title+"\n";
        result += "@source:"+source+"\n";
        result += "@url:"+url+"\n";
        result += "@time:"+time+"\n";
        result += "@body:"+body+"\n";
        result += "@description:"+description;

        //all feeds are came from api request, not from the post
        /*
        if(feeds[i]["message_tags"]){
            message_len = feeds[i]["message_tags"].length;
            message_tag="";
            for(j=0;j<message_len;j++){
                checkType(feeds[i]["message_tags"][j]["type"],function(status){
                    if(status=="ok"){
                    
                    }
                    else{
                        
                    }
                });
                if(j!=0){
                    message_tag += "\n"+feeds[i]["message_tags"][j]["id"]+",y";
                }
                else{
                    message_tag = feeds[i]["message_tags"][j]["id"]+",y";
                }
                //console.log("i="+i+" message_len:"+message_len+" message_tag:"+message_tag);
            }
            //result +="\n@tag:"+message_tag;
        }
        */
        i++;
    }
    //fin("continue:"+feeds[i-1]["id"]);
    fin("continueTONext@Gais:"+result);
}
exports.storeinfo = storeinfo;
