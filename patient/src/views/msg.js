/*--------------------------------------------------------------------------*
|   Pages setup
---------------------------------------------------------------------------*/
var page = 1;
var lastpage = 100000;
/*--------------------------------------------------------------------------*
|   Messages setup
---------------------------------------------------------------------------*/
var userpin = null;
var targetpin = null;
var contents = [];
var noPINerror = true; 
/*--------------------------------------------------------------------------*
|   Dynamic content
---------------------------------------------------------------------------*/
$(document).ready(function(){
    // Read user and target PINs - to distinguish incoming/outgoing
    $.ajax({
        type: 'get',
        url: './getPINs',
        complete: function(res){
            var data = JSON.parse(res.responseJSON);
            if(data.error!=undefined) {
                console.log("PINs error");
                alert("Error reading user data. \nConnect to caretaker and try again.");
                noPINerror = false;
            }
            else {
                userpin = data.userpin;
                targetpin = data.targetpin;
                noPINerror=true;
            }
        }
    });

    disablePrevious();

    if(noPINerror==true){
        loadTable();

        // Load next page of table
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
    
        // Load previous page of table
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

        // Display the new message form
        $("button#addPopupButton").click(function(e){
            e.preventDefault();
            openForm('add',0);
        });
        
        // Display the new message form (from other message)
        $("button#replyButton").click(function(e){
            e.preventDefault();
            closeForm('read');
            openForm('add',0);
        });

        // Handle adding new message through form
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
/*--------------------------------------------------------------------------*
|   Helpers
---------------------------------------------------------------------------*/
// Populate table with entries
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
                console.log("No data found.");
            }
            else{
                enableNext();
                var arr =[];
                $.each(data,function(idx,obj){ 
                    arr.push(obj); 
                    console.log("<>",obj);
                });
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
        
                                var subject_trimmed;
                                if(subj.length<=11) subject_trimmed = subj;
                                else subject_trimmed = ""+subj.substring(0,7)+"...";

                                var text_trimmed;
                                if(txt.length<=16) text_trimmed = txt;
                                else text_trimmed = ""+txt.substring(0,12)+"...";

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

// Load the read message form
function loadMessage(index){
    openForm('read',index);
}

// Show specified form
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

// Hide specified form
function closeForm(which) {
    if(which=='add') document.getElementById("addPopup").style.display= "none";
    if(which=='read') document.getElementById("readPopup").style.display= "none";
}

// Convert epoch time (ms) to datetime string
function epochToDateTime(epoch){
    var d = new Date(epoch);
    return d.toLocaleString();
}

// When the user clicks anywhere outside of the modal, close it
window.onclick = function(event) {
    var addModal = document.getElementById('addPopup');
    var readModal = document.getElementById('readPopup');
    if (event.target == addModal) closeForm('add');
    if (event.target == readModal) closeForm('readPopup');
}

// At first page, so disable previous button
function disablePrevious(){ 
    document.getElementById('previousPageButton').disabled = true;
    document.getElementById('previousPageButton').style="background-color:#0f3d58;"; 
}

// Not at first page, so enable previous button
function enablePrevious(){ 
    document.getElementById('previousPageButton').disabled = false;
    document.getElementById('previousPageButton').style="background-color:#4eb5f1;"; 
}

// At last page, so disable next button
function disableNext(){ 
    document.getElementById('nextPageButton').disabled = true;
    document.getElementById('nextPageButton').style="background-color:#0f3d58;"; 
}

// Not at last page, so enable next button
function enableNext(){ 
    document.getElementById('nextPageButton').disabled = false;
    document.getElementById('nextPageButton').style="background-color:#4eb5f1;"; 
}

// Fade out the loading animation on page load
$(window).on("load",function(){
    $(".loader-wrapper").fadeOut("slow");
    $(".loader-wrapper-left").hide();
});
