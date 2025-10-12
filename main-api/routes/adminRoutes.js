const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

// All admin routes require authentication + admin role
router.use(protect);
router.use(adminOnly);

// Dashboard overview
router.get('/stats', adminController.getSystemStats);

// Flagged items management
router.get('/flagged', adminController.getFlaggedItems);
router.put('/flagged/:flagId/resolve', adminController.resolveFlag);

// AI oversight
router.get('/ai-analytics', adminController.getAIAnalytics);
router.post('/ai-override', adminController.overrideAIDecision);

module.exports = router;
