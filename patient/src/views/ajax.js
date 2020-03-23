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

    // Impose first-time check every time page opens
    $.ajax({
        type: 'get',
        url: './checkFirstTime',
        complete: function(res) {
            var data = JSON.parse(res.responseJSON);
            if(data.result==true){
                $.ajax({
                    type: 'get',
                    url: './handleFirstTime',
                    complete: function (res){
                        var data = JSON.parse(res.responseJSON);
                        if(data.userpin != null){
                            openForm(data.userpin);
                        }
                    }
                });
            }
        }
    });

    //Update HR
    $("form#pairForm").on('submit', function(e){
        e.preventDefault();
        var targetPIN = $('input[id=targetPINIn]').val();
        //age
        $.ajax({
            type: 'post',
            url: './handleForm',
            data: {targetPIN: targetPIN}, // also age
            complete: function(res){
                closeForm();
            }
        });
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

    //Update BP
    $("form#bpform").on('submit', function(e){
        e.preventDefault();
        var bpsreading = $('input[id=bpsreadingIn]').val();
        var bpdreading = $('input[id=bpdreadingIn]').val();
        if(bpsreading == '' || bpdreading == '') {
            alert('Please fill both systolic and diastolic blood pressure measurements.');
        }
        else{
           $.ajax({
            type: 'post',
            url: './setBP',
            data: {bps: bpsreading, bpd: bpdreading},
            complete: function(res){
                var json = JSON.parse(res.responseJSON);
                $("#bpDisplay").html(
                    "Last measured BP: <strong>" + json.bps + ':' + json.bpd + "</strong>");
            }
           }); 
        }
        
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
    $("button#deleteUserPINButton").click(function(e){
        e.preventDefault();
        $.ajax({
            type: 'get',
            url: './deleteUserPIN',
            complete: function(res) {
                console.log("ULTIMATE DESTRUCTION YES");
            }
        });
    });

    // Submit PIN (from string to number)
    $("form#pinform").on('submit', function(e){
        e.preventDefault();
        var str = $('input[id=pinIn]').val();
        var squashed = str.replace(/-+/g, '');
        //should be 16 but testing
        if(squashed.length < 4){
            alert("PINs must be 16 digits.");
        } 
        else {
            var number = parseInt(squashed);
            $.ajax({
                type: 'post',
                url: './readTargetPIN',
                data: {tpin: number},
                complete: function(res){}
            });
        }
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

function openForm(pin) {
    console.log("OPENING FROM FUNCTION");
    document.getElementById("loginPopup").style.display="block";
    document.getElementById('userPINIn').value = ""+pin;
    document.getElementById('userPINIn').readOnly = true;
}

function closeForm() {
    document.getElementById("loginPopup").style.display= "none";
}

// When the user clicks anywhere outside of the modal, close it
window.onclick = function(event) {
    var modal = document.getElementById('loginPopup');
    if (event.target == modal) {
        closeForm();
    }
}