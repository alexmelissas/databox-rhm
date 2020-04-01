var page = 1;
var lastpage = 100000;
var userpin = null;
var targetpin = null;

var contents = [];

var run = true; 

$(document).ready(function(){

    $.ajax({
        type: 'get',
        url: './getPINs',
        complete: function(res){
            var data = JSON.parse(res.responseJSON);
            if(data.error!=undefined) {
                console.log("PINs error");
                alert("Error reading user data. \nConnect to caretaker and try again.");
                run = false;
            }
            else {
                userpin = data.userpin;
                targetpin = data.targetpin;
                run=true;
            }
        }
    });

    disablePrevious();

    if(run==true){

        loadTable();

        $("button#nextPageButton").click(function(e){
            e.preventDefault();
            if(page<lastpage){
                enablePrevious();
                if(page==lastpage-1) disableNext;
                page+=1;
                loadTable();
            }
            else disableNext();
            
        });
    
        $("button#previousPageButton").click(function(e){
            e.preventDefault();
            if(page>1) { 
                enableNext();
                if(page==2) disablePrevious();
                page-=1;
                loadTable();
            } 
            else disablePrevious();
        });
    
        $("button#addPopupButton").click(function(e){
            e.preventDefault();
            openForm('add',0);
        });
    
        $("button#replyButton").click(function(e){
            e.preventDefault();
            closeForm('read');
            openForm('add',0);
        });

        $("form#addForm").on('submit', function(e){
            e.preventDefault();
            var subject = $('input[id=subjIn]').val();
            var text = $('#txtIn').val();
            $.ajax({
                type: 'post',
                url: './addData',
                data: {type:'MSG',subj: subject, txt: text},
                complete: function(res){
                    var data = JSON.parse(res.responseJSON);
                    if(data.error==undefined) location.reload();
                    else alert("Error sending:\n"+data.error);
                    closeForm('add');
                }
            });
        })
    }
});

function loadTable(){
    $("#tableBody").empty();
    $.ajax({
        type: 'post',
        url: './readDatastore',
        data: {type:'MSG',page: page},
        complete: function(res) {
            const data = JSON.parse(res.responseJSON);
            if(data.error!=undefined) {
                disableNext();
                alert("Couldn't load data. Please try again.");
            }
            else if(data.empty!=undefined){
                disableNext();
                alert("No data found.");
            }
            else{
                enableNext();
                var arr =[];
                $.each(data,function(idx,obj){ arr.push(obj); });
                while(arr.length>10){arr.shift();};
                
                var index = 0;
                contents = [];
                $.each(arr,function(idx,obj){
                    if(obj.eof!=undefined){
                        lastpage = page;
                        disableNext();
                    }
                    else{
                        const datetime = obj.datetime;
                        const subj = obj.subj;
                        const txt = obj.txt;
                        const expiry = obj.expiry;
                        const tpin = obj.targetpin;
                        const upin = obj.userpin;
    
                        const datetimeDate = epochToDateTime(datetime);
                        
                        var expiryDate;
                        if(expiry==2147483647000) expiryDate = '-';
                        else expiryDate  = epochToDateTime(expiry);
    
                        if(datetime!=undefined && expiry!=undefined
                            &&  tpin!=undefined && upin!=undefined
                            && subj!=undefined && txt) {

                            var row = 'empty';

                            //Inbox/Sent image
                            var inout, icon;
                            if(upin==userpin && tpin==targetpin) {
                                inout = 'out';
                                icon = "<i class='far fa-comment' style='font-size:22px; "
                                        +"-webkit-transform: scaleX(-1); transform: scaleX(-1);'></i> ";
                            }
                            else if(upin==targetpin && tpin==userpin) {
                                inout = 'in';
                                icon = "<i class='fas fa-comment' style='font-size:22px;''></i> ";
                            }
                            else inout = 'neither';

                            if(inout!='neither'){
                                // Deal with long subjects and texts
                                const fullValues = JSON.stringify({subj:subj,txt:txt});
                                contents.push(fullValues);
        
                                const subject_trimmed = ""+subj.substring(0,7)+"...";
                                const text_trimmed = ""+txt.substring(0,12)+"...";

                                row = "<tr class='hoverable_tr' onclick='loadMessage("+index+")' style='cursor: pointer;'><td>" 
                                        + icon + "</td><td>" + datetimeDate + "</td><td>" + subject_trimmed 
                                        + "</td><td>" + text_trimmed +  "</td><td>" + expiryDate + "</td></tr>";

                                index+=1;
                            }

                            if(row!='empty') $("#table").append(row);
                        }
                    }
                });
            }
        }
    });
}

function loadMessage(index){
    openForm('read',index);
}

function openForm(which,index) {
    if(which=='add') { 
        document.getElementById("addPopup").style.display="block";
        document.getElementById("subjIn").value = '';
        document.getElementById("txtIn").value = '';
        document.getElementById("subjIn").focus();
    }
    else if(which=='read'){
        var message = JSON.parse(contents[index]);
        const subj = message.subj;
        const txt = message.txt;
        
        document.getElementById("readPopup").style.display='block';
        document.getElementById("subjOut").value = subj;
        document.getElementById("txtOut").value = txt;
    }
}

function closeForm(which) {
    if(which=='add') document.getElementById("addPopup").style.display= "none";
    if(which=='read') document.getElementById("readPopup").style.display= "none";
}

function epochToDateTime(epoch){
    var d = new Date(epoch);
    return d.toLocaleString();
}

$(window).on("load",function(){
    $(".loader-wrapper").fadeOut("slow");
    $(".loader-wrapper-left").hide();
});

// When the user clicks anywhere outside of the modal, close it
window.onclick = function(event) {
    var addModal = document.getElementById('addPopup');
    var readModal = document.getElementById('readPopup');
    if (event.target == addModal) closeForm('add');
    if (event.target == readModal) closeForm('readPopup');
}

function disablePrevious(){ 
    document.getElementById('previousPageButton').disabled = true;
    document.getElementById('previousPageButton').style="background-color:#0f3d58;"; 
}

function enablePrevious(){ 
    document.getElementById('previousPageButton').disabled = false;
    document.getElementById('previousPageButton').style="background-color:#4eb5f1;"; 
}

function disableNext(){ 
    document.getElementById('nextPageButton').disabled = true;
    document.getElementById('nextPageButton').style="background-color:#0f3d58;"; 
}

function enableNext(){ 
    document.getElementById('nextPageButton').disabled = false;
    document.getElementById('nextPageButton').style="background-color:#4eb5f1;"; 
}