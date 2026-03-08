function requireRole(...allowedRoles) {
  return (req, res, next) => {
    const userRoles = req.user && req.user.roles;
    if (!Array.isArray(userRoles) || !userRoles.some((r) => allowedRoles.includes(r))) {
      return res.status(403).json({
        error: 'Forbidden: insufficient permissions',
        required: allowedRoles,
        yours: userRoles || [],
      });
    }
    next();
  };
}

module.exports = { requireRole };
