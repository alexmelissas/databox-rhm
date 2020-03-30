$(document).ready(function(){
    
    $.ajax({
        type: 'get',
        url: './readMSG',
        complete: function(res) {
            var data = JSON.parse(res.responseJSON);
            
            data.each(function(record){
                var datetime = record.datetime;
                var subj = record.subj;
                var txt = record.txt;
                var expiry = record.expiry;
                var row = "<tr><td>" + datetime + "</td><td>" + subj 
                        + "</td><td>" + text +"</td><td>" + expiry + "</td></tr>";
                $("#table").append(row);
            });
        }
    });

});

$(window).on("load",function(){
    $(".loader-wrapper").fadeOut("slow");
    $(".loader-wrapper-left").hide();
});