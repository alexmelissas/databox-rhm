$(document).ready(function(){

    closeForm('add');

    $.ajax({
        type: 'post',
        url: './readDatastore',
        data: {type:'BP',page: 1},
        complete: function(res) {
            const data = JSON.parse(res.responseJSON);
            if(data.error!=undefined) {
                alert("Couldn't load data. Please try again.");
            }
            else if(data.empty!=undefined){
                alert("No data found.");
            }
            else{
                $.each(data,function(idx,obj){
                    const datetime = obj.datetime;
                    const bps = obj.bps;
                    const bpd = obj.bpd;
                    const desc = obj.desc;
                    const expiry = obj.expiry;

                    const datetimeDate = epochToDateTime(datetime);
                    
                    var expiryDate;
                    if(expiry==2147483647000) expiryDate = '-';
                    else expiryDate  = epochToDateTime(expiry);

                    if(datetime!=undefined && expiry!=undefined){
                        var row = 'empty';
                        if(bps!=undefined && bpd!=undefined){
                            row = "<tr><td>" + datetimeDate + "</td><td>" + '-' + "</td><td>"
                            + bps + "</td><td>" + bpd +"</td><td>" + expiryDate + "</td></tr>";
                        }
                        else if(desc!=undefined){
                            row = "<tr><td>" + datetimeDate + "</td><td>" + desc + "</td><td>"
                            + '-' + "</td><td>" + '-' +"</td><td>" + expiryDate + "</td></tr>";
                        }
                        if(row!='empty') $("#table").append(row);
                    }
                });
            }
        }
    });

    $("button#addPopupButton").click(function(e){
        openForm('add');
    });

    $("form#addForm").on('submit', function(e){
        e.preventDefault();
        var measurement = $('input[id=hrreadingIn]').val();
        $.ajax({
            type: 'post',
            url: './addData',
            data: {type:'HR',hr: measurement},
            complete: function(res){
                var data = JSON.parse(res.responseJSON);
                if(data.error==undefined){
                    if(data.filter=='desc'){
                        //$("#hrDisplay").html("Last measured HR: <strong>" + data.desc + "</strong>");
                    }
                    else { 
                        //$("#hrDisplay").html("Last measured HR: <strong>" + data.hr + "</strong>");
                    }
                    location.reload();
                } else alert("Error adding data:\n"+data.error);
                closeForm('add');
            }
        });
    })

});

function openForm(which) {
    if(which=='add') document.getElementById("addPopup").style.display="block";
    else if (which=='graph') document.getElementById("graphPopup").style.display="block";
}

function closeForm(which) {
    if(which=='add') document.getElementById("addPopup").style.display= "none";
    else if (which=='graph') document.getElementById("graphPopup").style.display="none";
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
    var graphModal = document.getElementById('graphPopup');
    if (event.target == addModal) closeForm('add');
    if (event.target == graphModal) closeForm('graph');
}