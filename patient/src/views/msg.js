var page = 1;
var lastpage = 100000;
var userpin = null;
var targetpin = null;

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
            openForm('add');
        });
    
        $("form#addForm").on('submit', function(e){
            e.preventDefault();
            var subject = $('input[id=subjectIn]').val();
            var text = $('input[id=textIn]').val();
            $.ajax({
                type: 'post',
                url: './addData',
                data: {type:'MSG',subj: subject, txt: text},
                complete: function(res){
                    var data = JSON.parse(res.responseJSON);
                    if(data.error==undefined) location.reload();
                    else alert("Error adding data:\n"+data.error);
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
                alert("Couldn't load data. Please try again.");
            }
            else if(data.empty!=undefined){
                alert("No data found.");
            }
            else{
                var arr =[];
                $.each(data,function(idx,obj){ arr.push(obj); });
                while(arr.length>10){arr.shift();};

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
    
                        if(datetime!=undefined && expiry!=undefined){
                            var row = 'empty';

                            var inout;
                            if(upin==userpin && tpin==targetpin) 
                                inout = "<i class='far fa-comment' style='font-size:22px; "
                                        +"-webkit-transform: scaleX(-1); transform: scaleX(-1);'></i> ";
                            else if(upin==targetpin && tpin==userpin) 
                                inout = "<i class='fas fa-comment' style='font-size:22px;''></i> ";
                            else inout = 'error';

                            if(inout!='error'){
                                row = "<tr><td>" + inout + "</td><td>" + datetimeDate + "</td><td>" + subj + "</td><td>" 
                                        + txt +  "</td><td>" + expiryDate + "</td></tr>";
                            }

                            if(row!='empty') $("#table").append(row);
                        }
                    }
                });
            }
        }
    });
}

function openForm(which) {
    if(which=='add') { 
        document.getElementById("addPopup").style.display="block";
        document.getElementById("subjectIn").value = '';
        document.getElementById("subjectIn").focus();
    }
}

function closeForm(which) {
    if(which=='add') document.getElementById("addPopup").style.display= "none";
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
    if (event.target == addModal) closeForm('add');
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