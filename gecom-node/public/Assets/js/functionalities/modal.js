var GECOM = {};
GECOM.Modal = {};

GECOM.Modal.OpenLargeModal = function (title, subtitle, body, sucessbuttonlbl, closebtnlbl) {
    $("#largeHeader").text(title);
    $("#largeSubHeader").text(subtitle);
    $("#largeBody").html(body);
    $("#largeBtnClose").text(closebtnlbl);
    $("#largeBtnSave").text(sucessbuttonlbl);

    $("#btnLargeModal").click();
}