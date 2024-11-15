const jwt = require("jsonwebtoken");
require("dotenv").config();

module.exports = async (req, res, next) => {
  const JWT_SECRET = process.env.JWT_SECRET;
  const { authorization, refresh_token } = req.headers;

  // Check if both tokens are provided (either access token or refresh token)
  if (!authorization && !refresh_token) {
    return res.status(404).send({ error: "Must be logged in" });
  }

  let accessToken = null;
  let decodedPayload = null;

  // Case 1: If Access Token is provided
  if (authorization) {
    accessToken = authorization.replace("Bearer ", "");
    try {
      // Verifying access token
      decodedPayload = await jwt.verify(accessToken, JWT_SECRET);
    } catch (err) {
      // Token expired or invalid, try to refresh it using the refresh token
      if (refresh_token) {
        try {
          // Verifying refresh token
          const payload = await jwt.verify(refresh_token, JWT_SECRET);

          // If refresh token is valid, issue a new access token
          const newAccessToken = jwt.sign(
            { userId: payload.userId }, // Include necessary user data
            JWT_SECRET,
            { expiresIn: "15m" } // Short-lived expiration for the new access token
          );

          // Send the new access token in the response (or as a header)
          res.setHeader("Authorization", `Bearer ${newAccessToken}`);

          // Optionally, send the payload
          decodedPayload = payload;
        } catch (refreshError) {
          return res.status(403).send({ error: "Invalid refresh token" });
        }
      } else {
        return res
          .status(403)
          .send({ error: "Token expired, and no refresh token provided" });
      }
    }
  }

  // Adding user information to the request object if verified
  if (decodedPayload) {
    req.admin = decodedPayload;
    return next();
  } else {
    return res.status(403).send({ error: "Unable to verify token" });
  }
};
