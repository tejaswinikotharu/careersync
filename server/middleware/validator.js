const { validationResult, check, param } = require("express-validator");

// Standard validation responses formatter middleware
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400);
        return next({
            message: "Validation Error",
            errors: errors.array().map((err) => ({
                field: err.path,
                message: err.msg,
            })),
        });
    }
    next();
};

const registerValidation = [
    check("name", "Name is required").not().isEmpty().trim(),
    check("email", "Please include a valid email").isEmail().normalizeEmail(),
    check("password", "Password must be 6 or more characters").isLength({ min: 6 }),
    check("role", "Role must be student or admin").optional().isIn(["student", "admin"]),
    validate,
];

const loginValidation = [
    check("email", "Please include a valid email").isEmail().normalizeEmail(),
    check("password", "Password is required").not().isEmpty(),
    validate,
];

const mongoIdValidation = (paramName) => [
    param(paramName, `Invalid format for ${paramName}`).isMongoId(),
    validate,
];

const companyValidation = [
    check("slug", "Slug is required").not().isEmpty().trim().toLowerCase(),
    check("name", "Company Name is required").not().isEmpty().trim(),
    check("package", "Package details are required").not().isEmpty().trim(),
    check("eligibility", "Eligibility details are required").not().isEmpty().trim(),
    check("overview", "Overview is required").not().isEmpty().trim(),
    check("headquarters", "Headquarters is required").not().isEmpty().trim(),
    validate,
];

const userCompanyValidation = [
    check("companyId", "Invalid Company ID").isMongoId(),
    check("status", "Invalid status value")
        .optional()
        .isIn(["Applied", "Active", "Completed", "Rejected", "Offer Received", "Pending"]),
    check("notes").optional().isString().trim(),
    check("currentRound").optional().isString().trim(),
    check("progress", "Progress must be a number between 0 and 100")
        .optional()
        .isInt({ min: 0, max: 100 }),
    validate,
];

module.exports = {
    registerValidation,
    loginValidation,
    mongoIdValidation,
    companyValidation,
    userCompanyValidation,
};
