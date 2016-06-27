'use strict'
var S = require('string');
var he = require('he');
var dateFormat = require('dateformat');
var request = require('request');
var fs = require('graceful-fs');

function storeinfo(groupid,key,end_flag,id_serverip,id_serverport,feeds,fin){
    var now = new Date();
    var date = dateFormat(now, "yyyymmdd_HHMM");
    var title,source,url,time,body,message_tag="",description="";
    var result="";
    var i=0,j=0;
    while(i<feeds.length){
        //console.log("["+i+"]created_time:"+feeds[i]["created_time"]+" end_flag:"+end_flag);
        description="";
        body="";
        if(end_flag!='y'&&end_flag!='c'){
            if(new Date(feeds[i]["created_time"]).getTime()<=new Date(end_flag).getTime()){
                console.log("["+feeds[i]["id"]+"]created_time:"+feeds[i]["created_time"]+" end_flag:"+end_flag);
                console.log("=>end");
                fin("endTONext@Gais:"+feeds[i]["id"]+"endTONext@Gais:"+result);
                break;
            }
        }
        if(feeds[i]["from"]){
            title = feeds[i]["from"].name;
            source = "fb/"+feeds[i]["from"].name;
        }
        else{
            title = feeds[i]["id"];
            source = "fb/"+feeds[i]["id"];
        }
        if(!feeds[i]["link"]){
            body="";
        }
        else{
            if(feeds[i]["name"]){
                title = feeds[i]["name"];
            }
            body = feeds[i]["link"];

        }
        url = feeds[i]["id"];
        //url = 'https://www.facebook.com/'feeds[i]["id"];
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
        result += "@description:"+description+"\n";
        i++;
    }
    fin("continueTONext@Gais:"+result);
}
exports.storeinfo = storeinfo;
