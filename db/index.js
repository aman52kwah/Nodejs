import { Sequelize } from "sequelize";

async function setupDatabase() {
  const sequelize = new Sequelize("","MIKE","AfiaSarpong@55"
   ,
    {
      host: 'localhost',
      dialect: "mysql",
    });

  try {
    await sequelize.authenticate();
    console.log("Connection has been established successfully.");

    // create new schema
    await sequelize.query("CREATE DATABASE IF NOT EXISTS todo_db");
    console.log("Database created successfully.");
    sequelize.close();
    console.log("Connection closed successfully.");
  } catch (error) {
    console.error("Unable to connect to the databse", error);
  }
}

setupDatabase();
