import express from "express";
import crypto from "crypto";
const app = express();
import cors from "cors";
import bodyParser from "body-parser";
import { DataTypes, Sequelize } from "sequelize";

const jsonParser = bodyParser.json();
const urlencodedParser = bodyParser.urlencoded({
  extended: false,
}); 

app.use(jsonParser);
app.use(urlencodedParser);

const sequelize = new Sequelize("tod_db", "MIKE", "AfiaSarpong@55",  {
  host: "localhost",
  dialect: "mysql",
});
 // create todo models
const Todo = sequelize.define("Todo",{
  id:{
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false,
  },
  title:{
    type: DataTypes.STRING,
    allowNull: false,
  },
  description:{
    type: DataTypes.STRING,
    allowNull: false,
  },
  isDone:{
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  }
},{tableName: "todos",
   timestamps: true});



 
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

app.get("/", (req, res, nextFunction) => {
  return res.json(todoItems);
});

app.post("/login", (req, res, nextFunction) => {
  return res.json({ token: "qwertyuiop" });
});

app.post("/todo", (req, res) => {
  const body = req.body;
  console.log(req.body);

  const id = crypto.randomUUID();
  const todoItem = { ...body, isDone: false, id };
  todoItems.push(todoItem);

  res.status(201);
  return res.json({
    message: "Todo has been added",
    isSuccessful: true,
    data: todoItem,
  });
});

app.get("/todo/:id", (req, res) => {
  const { id } = req.params;
  console.log(id);

  let todoItem = todoItems.find((value) => value.id === id);

  if (!todoItem) {
    return res.status(404).json({ message: "Todo item is not found" });
  }

  res.status(200).json({
    message: "Successfully retrieved",
    isSuccessful: true,
    data: todoItem,
  });
});

app.put("/todo", (req, res) => {
  const { id } = req.query;

  let todoItem = todoItems.find((value) => value.id === id);

  if (!todoItem) {
    return res.status(404).json({ message: "Todo item is not found" });
  }

  // replace the specified details of the id with a new one
  const newItems = todoItems.map((todoItem) => {
    if (todoItem.id === id) {
      return { ...req.body };
    }
    return todoItem;
  });

  todoItems = newItems;

  res.status(200).json({
    isSuccessful: true,
    message: "Successfully updated the todo item",
    data: { ...req.body },
  });
});

app.patch("/todo", (req, res) => {
  const { id } = req.query;
  console.log(id);

  let todoItem = todoItems.find((value) => value.id === id);
  if (!todoItem) {
    return res.status(404).json({ message: "Todo item is not found" });
  }
  // update the specified details of the id with a new one
  const newItems = todoItems.map((todoItem) => {
    if (todoItem.id === id) {
      return { ...todoItem, ...req.body };
    }
  });
  newItems.filter((item) => item !== undefined);

  todoItems = newItems;

  res.status(200).json({
    message: "Successfully updated the todo item",
    data: { ...req.body },
  });
});

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
