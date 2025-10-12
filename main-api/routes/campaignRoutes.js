const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const campaignController = require('../controllers/campaignController');

// Public routes
router.get('/active', campaignController.getActiveCampaigns);
router.get('/:campaignId', campaignController.getCampaignDetails);

// Protected routes (NGO only)
router.post('/create', protect, campaignController.createCampaign);
router.get('/ngo/my-campaigns', protect, campaignController.getNGOCampaigns);

module.exports = router;
