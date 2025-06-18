import express from "express";
import crypto from "crypto";
const app = express();
import cors from "cors";
import bodyParser from "body-parser";
import { DataTypes, Sequelize } from "sequelize";
import passport from "passport";
const jsonParser = bodyParser.json();
const urlencodedParser = bodyParser.urlencoded({
  extended: false,
});

app.use(jsonParser);
app.use(urlencodedParser);

//authentication packages
import LocalStrategy from "passport-local";

const sequelize = new Sequelize("todo_db", "MIKE", "AfiaSarpong@55", {
  host: "localhost",
  dialect: "mysql",
});

//USER MODEL
const User = sequelize.define(
  "User",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    username: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: { isEmail: true },
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    //we are allowing null for Oauth provides, if using only the local strategy },
    provider: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    displayName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  { tableNames: "users" }
);

// create todo models
const Todo = sequelize.define(
  "Todo",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    isDone: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    //add a foreign key to link to user single todo
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: User, // refers to table name
        key: "id", // refers to column name in Users table
      },
    },
  },
  {
    tableName: "todos",
    //  timestamps: true
  }
);

//model relationships
//a user can have many todos
User.hasMany(Todo,{
  foreignKey:"UserId",
});
// a todo belongs to a user
Todo.belongsTo(User,{
  foreignKey:"UserId",
});

async function initializeDatabase() {
  try {
    await sequelize.authenticate();
    console.log("Connection has been established successfully.");

    sequelize.sync({ alter: false }); // force: true will drop the table if it already exists
  } catch (error) {
    console.error(error);
  }
}
initializeDatabase();

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json());

app.use("/todo", (req, res, next) => {
  if (req.method === "POST") {
    // some checks code
    const { authorization } = req.headers;
    if (authorization === "qwertyuiop") {
      return next();
    } else
      return res.status(401).json({ message: "You are not authenticated" });
  }
  next();
});

// Sample todo items array -> this is our db
let todoItems = [];

app.get("/", async (req, res, nextFunction) => {
  try {
    const data = await Todo.findAll();
    return res.json(data);
  } catch (error) {
    return res.status(500).json({
      message: "Error fetching todos",
      error: error.message,
    });
  }
});

app.post("/login", (req, res, nextFunction) => {
  return res.json({ token: "qwertyuiop" });
});

app.post("/todo", (req, res) => {
  try {
    const { title, description } = req.body;
    const todoItem = { title, description, isDone: false };
    //instead of pushing to the array, create using db
    Todo.create(todoItem);

    res.status(201);
    return res.json({
      message: "Todo has been added",
      isSuccessful: true,
      data: todoItem,
    });
  } catch (error) {
    console.error("error creating todo", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

app.get("/todo/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const todoItem = await Todo.findByPk(id);
    if (!todoItem) {
      throw new Error("failed to fetch todo item");
    }

    return res.status(200).json({
      message: "Successfully retrieved",
      isSuccessful: true,
      data: todoItem,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error fetching data",
      error: error.message,
    });
  }
});

app.put("/todo", async (req, res) => {
  try {
    const { id, title, description, isDone } = req.body;

    //find a todo item using findByPk in the database
    const todo = await Todo.findByPk(id);
    //if not found , then go ahead and bounce the user
    if (!todo) {
      throw new Error("Todo item not found");
    }

    //if the todo is found, go ahead and update it
    const updatedTodoItem = await todo.update({
      id,
      title,
      description,
      isDone,
    });

    res.status(200).json({
      isSuccessful: true,
      message: "Successfully updated the todo item",
      data: updatedTodoItem.dataValues,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Error updating todo item",
      error: error.message,
    });
  }
});

// app.patch("/todo", (req, res) => {
//   const { id } = req.query;
//   console.log(id);

//   let todoItem = todoItems.find((value) => value.id === id);
//   if (!todoItem) {
//     return res.status(404).json({ message: "Todo item is not found" });
//   }
//   // update the specified details of the id with a new one
//   const newItems = todoItems.map((todoItem) => {
//     if (todoItem.id === id) {
//       return { ...todoItem, ...req.body };
//     }
//   });
//   newItems.filter((item) => item !== undefined);

//   todoItems = newItems;

//   res.status(200).json({
//     message: "Successfully updated the todo item",
//     data: { ...req.body },
//   });
// });

app.delete("/todo/:id", (req, res) => {
  const { id } = req.params;
  console.log(id);
  let todoItem = todoItems.find((value) => value.id === id);
  if (!todoItem) {
    return res.status(404).json({ message: "Todo item not found" });
  }

  const newTodos = todoItems.filter((item) => item.id !== id);
  todoItems = newTodos;
  return res.status(200).json({
    message: "deleted successfully",
  });
});

app.listen("5000", (error) => {
  if (error) {
    console.error("Creation of server failed: ", error);
    return;
  }
  console.log("Server is listening on port 5000");
});
