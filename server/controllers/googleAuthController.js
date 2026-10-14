const User = require("../models/User");
const { verifyGoogleIdToken } = require("../services/google/googleAuthService");
const generateToken = require("../utils/generateToken");

// @desc    Authenticate user via Google ID Token
// @route   POST /api/auth/google
// @access  Public
const googleAuth = async (req, res, next) => {
    try {
        const { idToken } = req.body;

        if (!idToken) {
            res.status(400);
            throw new Error("Google ID Token is required");
        }

        // Verify ID Token
        const payload = await verifyGoogleIdToken(idToken);
        const { email, name, picture, sub: googleId } = payload;

        // Try to find user by Google ID
        let user = await User.findOne({ googleId });

        if (!user) {
            // Check if user exists with the same email
            user = await User.findOne({ email });

            if (user) {
                // Link Google account to existing email user
                user.googleId = googleId;
                if (picture) user.profilePicture = picture;
                await user.save();
            } else {
                // Create a new user
                user = await User.create({
                    name,
                    email,
                    googleId,
                    profilePicture: picture || "",
                    role: "student", // default role
                });
            }
        } else {
            // Update profile details if changed
            let profileChanged = false;
            if (user.name !== name) {
                user.name = name;
                profileChanged = true;
            }
            if (picture && user.profilePicture !== picture) {
                user.profilePicture = picture;
                profileChanged = true;
            }
            if (profileChanged) {
                await user.save();
            }
        }

        res.status(200).json({
            success: true,
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            profilePicture: user.profilePicture,
            token: generateToken(user._id),
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    googleAuth,
};
