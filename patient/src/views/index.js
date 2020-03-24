$(document).ready(function(){

    // Update the link icon (top left)
    $.ajax({
        type: 'get',
        url: './linkStatus',
        complete: function(res) {
            var data = JSON.parse(res.responseJSON);
            if(data.link==1) {
                $('i#pairStatusIcon').css('color', 'green');
                $('#pairStatusText').text('Paired with caretaker');
                $.ajax({
                    type: 'get',
                    url: './refresh'
                });         
            }
            else {
                $('i#pairStatusIcon').css('color', 'red');
                $('#pairStatusText').text('Not paired');
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
        if(targetPIN.length < 16) alert("PINs must be 16 digits.");
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
                                if(data.established==false) {
                                    switch(data.err){
                                        case 'connection-error': alert("Server communication error."
                                                                 + "\nPlease check your internet connection and try again."); 
                                                                 break;
                                        case 'no match': alert("No match found.\nPlease try again."); 
                                                         break;
                                        case 'no target pin': alert("No/incorrectly formatted caretaker PIN."
                                                              + "\nPlease ensure correct entry of target PIN."); 
                                                              break;
                                        default: alert("Error in pairing.\nPlease try again.");
                                    }
                                    location.reload();
                                }
                                else {
                                    $('i#pairStatusIcon').css('color', 'green');
                                    $('#pairStatusText').text('Paired with caretaker');
                                    closeForm();
                                }
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
            url: './addMeasurement',
            data: {type:'HR',hr: measurement},
            complete: function(res){
                var data = JSON.parse(res.responseJSON);
                if(data.error==null){
                    if(data.filter=='desc'){
                        $("#hrDisplay").html("Last measured HR: <strong>" + data.desc + "</strong>");
                    }
                    else { 
                        $("#hrDisplay").html("Last measured HR: <strong>" + data.hr + "</strong>");
                    }
                    $("#hrreadingIn").value = '';
                } else alert("Error displaying data:\n"+data.error);
                
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
            url: './addMeasurement',
            data: {type:'BP',bps: bpsreading, bpd: bpdreading},
            complete: function(res){
                var data = JSON.parse(res.responseJSON);
                if(data.error==null){
                    if(data.filter=='desc'){
                        $("#bpDisplay").html(
                            "Last measured BP: <strong>" + data.desc + "</strong>");
                    }
                    else{
                        $("#bpDisplay").html(
                            "Last measured BP: <strong>" + data.bps + ':' + data.bpd + "</strong>");
                    }
                    $("#bpsreadingIn").value = '';
                    $("#bpdreadingIn").value = '';
                } else alert("Error displaying data:\n"+data.error);
            }
           }); 
        }
        
    });

    // TESTING ONLY
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