const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Protect private routes via JWT verification
const protect = async (req, res, next) => {
    let token;

    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith("Bearer")
    ) {
        try {
            // Get token from header
            token = req.headers.authorization.split(" ")[1];

            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Get user from the token (exclude password)
            req.user = await User.findById(decoded.id).select("-password");

            if (!req.user) {
                res.status(401);
                throw new Error("Not authorized, user not found");
            }

            next();
        } catch (error) {
            console.error(error);
            res.status(401);
            next(new Error("Not authorized, token failed"));
        }
    }

    if (!token) {
        res.status(401);
        next(new Error("Not authorized, no token provided"));
    }
};

// Grant access based on user role authorization
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            res.status(403);
            return next(new Error(`Role (${req.user ? req.user.role : "none"}) is not authorized to access this route`));
        }
        next();
    };
};

module.exports = {
    protect,
    authorize,
};
