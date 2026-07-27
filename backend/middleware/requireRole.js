// middleware/requireRole.js
module.exports.requireRole = (role) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: "Non autorizzato" });
  if (req.user.role !== role) return res.status(403).json({ message: "Permesso negato" });
  next();
};