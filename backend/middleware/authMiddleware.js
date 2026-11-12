/**
 * middleware/authMiddleware.js
 *
 * Middleware di autenticazione JWT.
 *
 * Responsabilità:
 * - leggere l'header Authorization
 * - verificare presenza e formato del token Bearer
 * - validare il JWT
 * - salvare i dati utente decodificati in req.user
 * - inoltrare gli errori al middleware globale
 */

const jwt = require("jsonwebtoken");
const AppError = require("../utils/AppError");
const { isRemoteShowcase, ADMIN, jwtVerification } = require("../utils/remoteShowcase");

/**
 * Middleware che protegge le route riservate agli utenti autenticati.
 *
 * Header atteso:
 * Authorization: Bearer <token>
 *
 * Se il token è valido, salva in req.user i dati essenziali:
 * - id
 * - username
 * - role
 */
async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    // Header Authorization assente
    if (!authHeader) {
      return next(new AppError("Token mancante", 401, "MISSING_TOKEN"));
    }

    // Deve essere nel formato: Bearer <token>
    if (!authHeader.startsWith("Bearer ")) {
      return next(
        new AppError("Formato token non valido", 401, "INVALID_TOKEN_FORMAT")
      );
    }

    // Estrae il token dalla stringa "Bearer xxx"
    const token = authHeader.slice(7).trim();

    // Token vuoto o assente dopo "Bearer "
    if (!token) {
      return next(new AppError("Token mancante", 401, "MISSING_TOKEN"));
    }

    // Verifica firma e validità del JWT
    let decoded,adminSignature=false;
    if(isRemoteShowcase()){
      try{decoded=jwt.verify(token,process.env.JWT_SECRET,jwtVerification());}
      catch(error){
        const {adminEnabled,adminSigningKey}=require("../utils/showcaseQuickLogin");
        if(error.name!=="JsonWebTokenError"||!adminEnabled())throw error;
        decoded=jwt.verify(token,adminSigningKey(),jwtVerification());adminSignature=true;
      }
    }else{decoded=jwt.verify(token,process.env.JWT_SECRET);}
    if(adminSignature&&!(decoded.showcaseQuickLogin===true&&decoded.role==="admin"&&decoded.username===ADMIN&&decoded.showcaseReadOnly===true))return next(new AppError("Sessione demo non autorizzata",401,"SHOWCASE_SESSION_REVOKED"));
    if(decoded.showcaseQuickLogin===true){
      const {enabled,adminEnabled,boundToShowcase,EMPLOYEES}=require("../utils/showcaseQuickLogin");
      const {DATABASE}=require("../utils/remoteShowcase");
      if(!isRemoteShowcase()||!enabled()||!boundToShowcase(require("mongoose").connection)||require("../models/User").db!==require("mongoose").connection||decoded.showcaseDatabase!==DATABASE||!((decoded.role==="user"&&EMPLOYEES.includes(decoded.username)&&decoded.showcaseReadOnly!==true)||(adminSignature&&decoded.role==="admin"&&decoded.username===ADMIN&&decoded.showcaseReadOnly===true&&adminEnabled())))return next(new AppError("Sessione demo non autorizzata",401,"SHOWCASE_SESSION_REVOKED"));
    }
    if (isRemoteShowcase()) {
      const User = require("../models/User");
      const current = await User.findById(decoded.id).select("username role isActive").lean();
      if (!current || current.isActive === false || current.username !== decoded.username || current.role !== decoded.role || (current.role === "admin" && current.username !== ADMIN)) return next(new AppError("Sessione non autorizzata", 401, "SHOWCASE_SESSION_REVOKED"));
    }

    const readOnly=decoded.showcaseQuickLogin===true&&decoded.role==="admin"&&decoded.showcaseReadOnly===true;
    if(readOnly){
      if(!["GET","HEAD"].includes(req.method))return next(new AppError("Admin Demo disponibile in sola consultazione",403,"SHOWCASE_ADMIN_READ_ONLY"));
      if(!require("../utils/showcaseQuickLogin").canConsultAdmin(req.originalUrl))return next(new AppError("Operazione non disponibile nella sessione dimostrativa",403,"SHOWCASE_ADMIN_READ_ONLY_ROUTE"));
    }
    // Salva solo i dati utili per le route successive
    req.user = {
      id: decoded.id,
      username: decoded.username,
      role: decoded.role,
      ...(readOnly?{readOnly:true}:{}),
    };

    return next();
  } catch (err) {
    // Token scaduto
    if (err.name === "TokenExpiredError") {
      return next(new AppError("Sessione scaduta", 401, "TOKEN_EXPIRED"));
    }

    // Token malformato, firma non valida, ecc.
    if (err.name === "JsonWebTokenError") {
      return next(new AppError("Token non valido", 401, "INVALID_TOKEN"));
    }

    // Altri errori inattesi
    return next(err);
  }
}

module.exports = { authMiddleware };