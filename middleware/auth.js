const jwt = require('jsonwebtoken');
const db = require('../models');

module.exports =async  (req, res, next) => {

    const token = req.header('Authorization') && req.header('Authorization').replace('Bearer ', '');

    if (!token) {
        return res.status(401).json({ message: 'No token, authorization denied' });
    }

    try {
        console.log(token, process.env.JWT_SECRET);
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await db.User.findByPk(decoded.userId);  // Supondo que você esteja usando a tabela 'User' no seu modelo

        if (!user) {
            return res.status(401).json({ message: 'User not found' });
        }

        req.user = user;
        next();
    } catch (error) {
        res.status(401).json({ message: 'Token is not valid '+token + ' '+ error});
    }
};
