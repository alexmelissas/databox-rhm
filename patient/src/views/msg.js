$(document).ready(function(){
    
    $.ajax({
        type: 'get',
        url: './readMSG',
        complete: function(res) {
            var data = JSON.parse(res.responseJSON);
            
            $.each(data,function(idx,obj){
                const datetime = obj.datetime;
                const subj = obj.subj;
                const txt = obj.txt;
                const expiry = obj.expiry;

                const datetimeDate = epochToDateTime(datetime);
                const expiryDate  = epochToDateTime(expiry);

                if(datetime!=undefined && subj!=undefined && txt!=undefined && expiry!=undefined){
                    var row = "<tr><td>" + datetimeDate + "</td><td>" + subj 
                            + "</td><td>" + txt +"</td><td>" + expiryDate + "</td></tr>";
                    $("#table").append(row);
                }
            });
        }
    });

});

function epochToDateTime(epoch){
    var d = new Date(epoch);
    return d.toLocaleString();
}

$(window).on("load",function(){
    $(".loader-wrapper").fadeOut("slow");
    $(".loader-wrapper-left").hide();
});