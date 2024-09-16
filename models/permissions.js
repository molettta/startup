//models;pemrissuins
module.exports = (sequelize, DataTypes) => {
    const Permission = sequelize.define('Permission', {
        name: {
            type: DataTypes.STRING,
            allowNull: false,
        },
    });

    Permission.associate = models => {
        Permission.belongsToMany(models.Role, { through: 'RolePermissions' });
    };

    return Permission;
};