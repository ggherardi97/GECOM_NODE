const express = require("express");
const controller = require("../controllers/legalPagesController");

const router = express.Router();

router.get(["/privacy-policy", "/politica-de-privacidade"], controller.privacyPolicy);
router.get(["/terms-of-use", "/termos-de-uso"], controller.termsOfUse);
router.get(["/gecom/privacy-policy", "/gecom/politica-de-privacidade"], controller.gecomPrivacyPolicy);
router.get(["/gecom/terms-of-use", "/gecom/termos-de-uso"], controller.gecomTermsOfUse);

module.exports = router;
