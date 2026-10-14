const express = require("express");
const router = express.Router();
const {
    getCompanies,
    getCompanyBySlug,
    createCompany,
    updateCompany,
    deleteCompany,
    refreshCompanyIntelligence,
    repairCompanies,
} = require("../controllers/companyController");
const { protect, authorize } = require("../middleware/auth");
const { companyValidation, mongoIdValidation } = require("../middleware/validator");

router
    .route("/")
    .get(protect, getCompanies)
    .post(protect, authorize("admin"), companyValidation, createCompany);

router
    .route("/repair")
    .post(protect, repairCompanies);

router
    .route("/:slug/refresh-intelligence")
    .post(protect, refreshCompanyIntelligence);

router
    .route("/:slug")
    .get(protect, getCompanyBySlug);

router
    .route("/id/:id")
    .put(protect, authorize("admin"), mongoIdValidation("id"), updateCompany)
    .delete(protect, authorize("admin"), mongoIdValidation("id"), deleteCompany);

module.exports = router;
