$(document).ready(function(){

    // Update the link icon (top left)
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

    // Impose unlinked check every time page opens
    $.ajax({
        type: 'get',
        url: './checkUnlinked',
        complete: function(res) {
            var data = JSON.parse(res.responseJSON);
            if(data.result==true){
                $.ajax({
                    type: 'get',
                    url: './openForm',
                    complete: function (res){
                        var data = JSON.parse(res.responseJSON);
                        var targetPIN;
                        if(data.hasTargetPIN==true){
                            if(data.targetpin!=null) targetPIN = data.targetpin;
                            else targetPIN = null;
                        }
                        if(data.userpin != null) openForm(data.userpin,targetPIN);
                    }
                });
            }
            else closeForm();
        }
    });

    // Send request for pairing
    $("form#pairForm").on('submit', function(e){
        e.preventDefault();
        // var age = ....
        var str = $('input[id=targetPINIn]').val();
        var targetPIN = str.replace(/-+/g, '');
        //should be 16 but testing
        if(targetPIN.length < 4){
            alert("PINs must be 16 digits.");
        } 
        else {
            var number = parseInt(targetPIN);
            $.ajax({
                type: 'post',
                url: './handleForm',
                data: {targetPIN: targetPIN/*, age: age*/},
                complete: function(res){
                    var data = JSON.parse(res.responseJSON);
                    if(data.result==true){
                        document.getElementById('linkButton').style = 'background-color:yellow';
                        $(".loader-wrapper-left").fadeIn("slow");
                        $.ajax({
                            type: 'get',
                            url: './establish',
                            complete: function(res){
                                var data = JSON.parse(res.responseJSON);
                                $(".loader-wrapper-left").fadeOut("slow");   
                                if(data.established==false) alert("No match found.\nPlease try again.");
                                else alert("Linked to caretaker!");
                                location.reload(true);
                            }
                        });
                    }
                }
            });
        }
    });

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

function openForm(pin,targetPIN) {
    document.getElementById("loginPopup").style.display="block";
    document.getElementById('userPINIn').value = ""+pin;
    document.getElementById('userPINIn').readOnly = true;
    if(targetPIN!=null) {
        document.getElementById('targetPINIn').value = ""+targetPIN;
        document.getElementById('targetPINIn').style = "color:blue; font-size: large;";
    } else document.getElementById('targetPINIn').style = "color:black; font-size: large;";
}

function focusBlackFont(element){
    document.getElementById(element.id).style = "color:black;font-size: large;";
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

$(window).on("load",function(){
    $(".loader-wrapper").fadeOut("slow");
    $(".loader-wrapper-left").hide();
});