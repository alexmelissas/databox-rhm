$(document).ready(function(){

    // Update the radio buttons to correspond to current settings
    $.ajax({
        type: 'get',
        url: './readSettings',
        complete: function(res) {
            var data = JSON.parse(res.responseJSON);

            console.log("Got ttl, filter: ",data.ttl, " ", data.filter);
            switch(data.ttl){
                case "indefinite": $(':radio[name=ttl][value="indefinite"]').prop('checked', true); break;
                case "month": $(':radio[name=ttl][value="month"]').prop('checked', true); break;
                case "week": $(':radio[name=ttl][value="week"]').prop('checked', true); break;
                default: $(':radio[name=ttl][value="indefinite"]').prop('checked', true); break;
            }
            switch(data.filter){
                case "values": $(':radio[name=filter][value="values"]').prop('checked', true); break;
                case "desc": $(':radio[name=filter][value="desc"]').prop('checked', true); break;
                default: $(':radio[name=filter][value="values"]').prop('checked', true); break;
            }
        }
    });

    // Update settings based on radio values
    $("button#saveButton").click(function(e){
        e.preventDefault();
        var ttl = $("input[name='ttl']:checked").val();
        var filter = $("input[name='filter']:checked").val();
        console.log("Got ttl:", ttl,", filter:", filter);
        $.ajax({
            type: 'post',
            url: './saveSettings',
            data: {ttl: ttl, filter: filter},
            complete: function (res) {
                console.log("Saved values ok");
            }  
        });
    });

});