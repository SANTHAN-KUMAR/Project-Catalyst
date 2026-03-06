const express = require('express');
const router = express.Router();
const donationController = require('../controllers/donationController');
const { protect } = require('../middleware/authMiddleware');

router.post('/create', protect, donationController.createDonation);
router.get('/user', protect, donationController.getUserDonations);
router.get('/:id', donationController.getDonationById); // PUBLIC - for tracking

module.exports = router;
