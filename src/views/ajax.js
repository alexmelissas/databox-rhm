function submitForm() {
    $.ajax({
        url: './ui/setHR',
        type: 'POST',
        headers: headers,
        data: {
            "hrlabel": $("#hrreadingIn").val()
        },
        success: function(result) {
            //append result to your html
            //Dynamic view
            $("#hrlabel").hide();
            var html = '<div>Last measured HR: <label id="hrlabel" strong>&lt; <%= hrreading %> &gt;</label strong></div>;
            $("#showValue").html(html);    
        },
        error: function (error) {
            alert('error ',error);
        }
    });
}