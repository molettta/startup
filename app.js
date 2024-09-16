// app.js
const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const db = require('./models');
const userRoutes = require('./routes/userRoutes');
const seedDatabase = require('./seed.js');


// Middleware
app.use(bodyParser.json());

// Routes
app.use('/users', userRoutes);

// Sync Database
db.sequelize.sync({ force: true })
    .then(async () => {
        console.log(db.Role);  
        await seedDatabase(db);
        console.log('Database synced successfully');
    })
    .catch(err => {
        console.log('Error syncing database:', err);
    });

// Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
