const seedDatabase = async (db) => {
    try {
      // Verifica se os modelos foram carregados corretamente
      console.log(db.Role);  // Deve exibir algo como { name: 'Role' }
      
      // Cria algumas roles
      const adminRole = await db.Role.create({ name: 'Admin' });
      const userRole = await db.Role.create({ name: 'User' });
  
      // Cria algumas permissões
      const readPermission = await db.Permission.create({ name: 'Read' });
      const writePermission = await db.Permission.create({ name: 'Write' });
  
      // Cria um usuário
      const userAdm = await db.User.create({
        name: 'Eduardo',
        email: 'eduardo@example.com',
        password: 'password123'
      });
      const userUser = await db.User.create({
        name: 'User User',
        email: 'User@example.com',
        password: 'password123'
      });
  
      // Associa o usuário com as roles
      await userAdm.addRole(adminRole);
      await userAdm.addRole(userRole);

      await userUser.addRole(userRole);
  
      // Associa as permissões às roles
      await adminRole.addPermission(writePermission);
      await userRole.addPermission(readPermission);
  
      console.log('Banco de dados populado com sucesso!');
    } catch (error) {
      console.error('Erro ao popular o banco de dados:', error);
    }
  }
  
  module.exports = seedDatabase;
  