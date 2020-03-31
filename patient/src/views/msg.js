$(document).ready(function(){
    
    $.ajax({
        type: 'get',
        url: './readMSG',
        complete: function(res) {
            var data = JSON.parse(res.responseJSON);
            
            $.each(data,function(idx,obj){
                var datetime = obj.datetime;
                var subj = obj.subj;
                var txt = obj.txt;
                var expiry = obj.expiry;

                if(datetime!=undefined && subj!=undefined && txt!=undefined && expiry!=undefined){
                    var row = "<tr><td>" + datetime + "</td><td>" + subj 
                            + "</td><td>" + txt +"</td><td>" + expiry + "</td></tr>";
                    $("#table").append(row);
                }
            });
        }
    });

});

$(window).on("load",function(){
    $(".loader-wrapper").fadeOut("slow");
    $(".loader-wrapper-left").hide();
});