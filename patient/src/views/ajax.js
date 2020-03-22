$(document).ready(function(){

    $.ajax({
        type: 'get',
        url: './linkStatus',
        complete: function(res) {
            var data = JSON.parse(res.responseJSON);
            if(data.link==1) {
                $('i#pairStatusIcon').css('color', 'green');
            }
            else {
                $('i#pairStatusIcon').css('color', 'red');
            }
        }
    });

    // $.ajax({
    //     type: 'get',
    //     url: './serverStatus',
    //     complete: function(res) {
    //         var data = JSON.parse(res.responseJSON);
    //         if(data.server==1) $('i#serverStatusIcon').css('color', 'green');
    //         else $('i#serverStatusIcon').css('color', 'red');
    //     }
    // });

    //Update HR
    $("form#hrform").on('submit', function(e){
        e.preventDefault();
        var measurement = $('input[id=hrreadingIn]').val();
        $.ajax({
            type: 'post',
            url: './setHR',
            data: {measurement: measurement},
            complete: function(res){
                var json = JSON.parse(res.responseJSON);
                $("#hrDisplay").html("Last measured HR: <strong>" + json.hrreading + "</strong>");
                $("#hrreadingIn").html(" ");
            }
        });
    });

    //Update BPL
    $("form#bplform").on('submit', function(e){
        e.preventDefault();
        var measurement = $('input[id=bplreadingIn]').val();
        $.ajax({
            type: 'post',
            url: './setBPL',
            data: {measurement: measurement},
            complete: function(res){
                var json = JSON.parse(res.responseJSON);
                $("#bplDisplay").html("Last measured BPL: <strong>" + json.bplreading + "</strong>");
                $("#bplreadingIn").html(" ");
            }
        });
    });

    //Update BPH
    $("form#bphform").on('submit', function(e){
        e.preventDefault();
        var measurement = $('input[id=bphreadingIn]').val();
        $.ajax({
            type: 'post',
            url: './setBPH',
            data: {measurement: measurement},
            complete: function(res){
                var json = JSON.parse(res.responseJSON);
                $("#bphDisplay").html("Last measured BPH: <strong>" + json.bphreading + "</strong>");
                $("#bphreadingIn").html(" ");
            }
        });
    });

    //Update settings radio values
    $("button#saveButton").click(function(e){
        e.preventDefault();
        var ttl = $("input[name='ttl']:checked").val();
        var filter = $("input[name='filter']:checked").val();
        console.log("Got ttl, filter: ",ttl, " ", filter);
        $.ajax({
            type: 'post',
            url: './ajaxSaveSettings',
            data: {ttl: ttl, filter: filter},
            complete: function (res) {
                console.log("Saved values ok");
            }  
        });
    })

    // Test connection to server - DEPRECATED
    $("button#testConnectionButton").click(function(e){
        e.preventDefault();
        $.ajax({
            type: 'get',
            url: './status',
            complete: function(res) {
                console.log("Got res:",res);
                var data = JSON.parse(res.responseJSON);

                // BAD WITH TIMEOUTS??? UI HANGS?
                if(data.server==1) $('i#serverStatusIcon').css('color', 'green');
                else $('i#serverStatusIcon').css('color', 'red');
            }
        });
    });

    // Submit PIN (from string to number)
    $("form#pinform").on('submit', function(e){
        e.preventDefault();
        var str = $('input[id=pinIn]').val();
        var squashed = str.replace(/-+/g, '');
        var number = parseInt(squashed);
        console.log("Read PIN number:",number);
        $.ajax({
            type: 'post',
            url: './readTargetPIN',
            data: {tpin: number},
            complete: function(res){
                console.log("AJAX sent target PIN successfully.");
            }
        });
    });
    
});

//https://www.encodedna.com/javascript/practice-ground/default.htm?pg=add_hyphen_every_3rd_char_using_javascript
function pinInsertFormatting(element) {
    var ele = document.getElementById(element.id);
    ele = ele.value.split('-').join('');    // Remove dash (-) if mistakenly entered.

    var string = ele.match(/.{1,4}/g).join('-');
    if (string.length > 20){
        document.getElementById(element.id).value = string.substring(0,19);
    } else{
        document.getElementById(element.id).value = string;
    }
}