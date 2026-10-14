const errorHandler = (err, req, res, next) => {
    // Log stack trace in non-production
    if (process.env.NODE_ENV !== "production") {
        console.error(err.stack || err);
    }

    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
    
    res.status(statusCode).json({
        success: false,
        message: err.message || "Internal Server Error",
        errors: err.errors || [],
    });
};

module.exports = errorHandler;
