// routes/userRoutes.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController.js');
const auth = require('../middleware/auth');

router.get('/', auth, userController.getAllUsers);
router.post('/', userController.createUser);
router.post('/login', userController.login);

module.exports = router;
