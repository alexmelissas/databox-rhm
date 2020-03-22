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