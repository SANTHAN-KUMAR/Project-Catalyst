const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { protect } = require('../middleware/authMiddleware');

// Import our controllers
const ngoController = require('../controllers/ngoController');
const proofController = require('../controllers/proofController');

// --- Multer Configuration ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, './uploads/'),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// === NGO ROUTES ===

// Get all verified NGOs (public route)
// GET /api/ngos
router.get('/', ngoController.getAllNgos);

// Register a new NGO with legal document verification
// POST /api/ngos/register
router.post('/register', protect, upload.single('registrationFile'), ngoController.registerNgo);

// === BLOCKCHAIN TRANSPARENCY ROUTES ===

// Get complete audit trail for a specific NGO (public transparency)
// GET /api/ngos/:ngoId/audit-trail
router.get('/:ngoId/audit-trail', ngoController.getNgoAuditTrail);

// Verify blockchain integrity for a specific NGO (public verification)
// GET /api/ngos/:ngoId/verify-chain
router.get('/:ngoId/verify-chain', ngoController.verifyNgoChainIntegrity);

// === PROOF OF EXPENDITURE ROUTES ===

// Upload proof of expenditure (invoices, bills, etc.)
// POST /api/ngos/proof
router.post('/proof', protect, upload.single('proofFile'), proofController.uploadProof);

module.exports = router;
