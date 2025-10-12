const express = require('express');
const router = express.Router();
const proofController = require('../controllers/proofController');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/upload', authMiddleware, proofController.uploadProof);
router.post('/verify', authMiddleware, proofController.verifyProof);
router.get('/campaign/:campaignId', proofController.getCampaignProofs);

module.exports = router;
