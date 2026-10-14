const express = require("express");
const router = express.Router();
const {
    getUserCompanies,
    getUserCompanyByCompanyId,
    createUserCompany,
    updateUserCompany,
    deleteUserCompany,
} = require("../controllers/userCompanyController");
const { protect } = require("../middleware/auth");
const { userCompanyValidation, mongoIdValidation } = require("../middleware/validator");

router
    .route("/")
    .get(protect, getUserCompanies)
    .post(protect, userCompanyValidation, createUserCompany);

router
    .route("/:companyId")
    .get(protect, mongoIdValidation("companyId"), getUserCompanyByCompanyId);

router
    .route("/id/:id")
    .put(protect, mongoIdValidation("id"), updateUserCompany)
    .delete(protect, mongoIdValidation("id"), deleteUserCompany);

module.exports = router;
