// controllers/userController.js
const db = require('../models');
//const bcrypt = require('bcryptjs');
//const jwt = require('jsonwebtoken');
const User = db.User;

exports.getAllUsers = async (req, res) => {
    try {
        const userRoles = await req.user.getRoles();  // Método para obter roles do usuário

        // Verifica se o usuário tem a role necessária
        if (!userRoles.some(role => role.name === 'Admin')) {
            return res.status(403).json({ message: 'Access denied' });
        }
        const users = await User.findAll();
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ message: 'Error retrieving users', error });
    }
};

exports.createUser = async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const newUser = await User.create({ name, email, password });
        res.status(201).json(newUser);
    } catch (error) {
        res.status(500).json({ message: 'Error creating user', error });
    }
};

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');


exports.login = async (req, res) => {
    const { email, password } = req.body;
    //res.json({"oi":email});return;
    try {
        // Verificar se o usuário existe
        const user = await User.findOne({ where: { email } });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Verificar a senha
        const isMatch = password == user.password;
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credential aas' });
        }

        // Gerar o token JWT
        const token = jwt.sign(
            { userId: user.id },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );
        console.log(token);
        res.json({ token });
    } catch (error) {
        res.status(500).json({
            message: 'An error occurred during token verification',
            error: error.message,  // Inclui a mensagem do erro
            stack: error.stack,    // Inclui o stack trace para depuração
        });
    }
};

