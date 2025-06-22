import express from "express";
const app = express();
import cors from "cors";
import bodyParser from "body-parser";
import 'dotenv/config';
import { DataTypes, Sequelize } from "sequelize";
import passport from "passport";
import session from "express-session";
import connectSessionSequelize from "connect-session-sequelize";
const SequelizeStore = connectSessionSequelize(session.Store);

//middleware
const jsonParser = bodyParser.json();
const urlencodedParser = bodyParser.urlencoded({
  extended: false,
});

app.use(jsonParser);
app.use(urlencodedParser);

//authentication packages
import LocalStrategy from "passport-local";

const sequelize = new Sequelize("todo_db", 
  process.env.DB_USER, 
  process.env.DB_PASSWORD, {
  host: process.env.DB_HOST,
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
      allowNull: true,
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
User.hasMany(Todo, {
  foreignKey: "UserId",
});
// a todo belongs to a user
Todo.belongsTo(User, {
  foreignKey: "UserId",
});

//create session store that save sessions to db
//this session store will let us save our session inside db by utilizing sequelize
//it will hanlde session key expiraton automatically
const sessionStore = new SequelizeStore({
  db: sequelize,
});

//initialize db
async function initializeDatabase() {
  try {
    await sequelize.authenticate();
    console.log("Connection has been established successfully.");

    sequelize.sync({ alter: false });
    sessionStore.sync();
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

//middleware for session

app.use(
  session({
    secret: process.env.COOKIES_SECRET_KEY, //used to sign session cookies
    resave: true, //resave session if it is not modified
    saveUninitialized: true, //don't save uninitialized session
    store: sessionStore, //use the session store we created
    cookie: {
      secure:process.env.ENVIRONMENT, //set to true if using https
      httpOnly: true, //prevent client side js from accessing the cookie
      maxAge: 1000 * 60 * 5, //set cookie to expire in 5 minutes
    },
  })
);

//PASSPORT JS CONFIGURATION
app.use(passport.initialize()); //initialize passport
app.use(passport.session()); //use passport session

//serialization:what data do you want to store inside your session
//this will only run when a user logs in - we only store the user ID in the session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

//deserialzation: how are you going to retrieve user on=bject from the session data
//this will run on every request for the authentuication
passport.deserializeUser(async (id, done) => {
  //fetch full user from db based on the serialized id
  try {
    const user = await User.findByPk(id);
    done(null, user);
  } catch {
    done(error, null);
  }
});

//LOCAL STRATEGY
passport.use(
  new LocalStrategy(
    { usernameField: "email", passwordField: "password" },
    async (email, password, done) => {
      try {
        //find the user with matching email and password
        const user = await findOne({
          where: {
            email: email,
          
            provider: "local",
          },
        });
        //if no user is found
        if (!user) {
          return done(null, false, { message: "invalid email or passord" });
        }
        //if user is found, check if the password matches
       
       return done(null, user);
      } catch (error) {}
    }
  )
);






const requireAuth =(req,res,next)=>{
  if(req.isAuthenticated()){
    //passport.js method to check if user is logged in
   return next();
  } 
  // user is not authenticated, return error
  res.status(401).json({message:"Authentication required"});
};

// user registration endpoint
app.post('/auth/register', async (req, res)=>{
 try{
  const {email, password, username} =req.body;
  if(!email || !password || !username){
    return res.status(400).json(
      {message:"All fields are required"});
  }

  return res.json(req.body);
 }catch(error){

 }
})

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

app.get("/", passport.authenticate("local"), async (req, res, nextFunction) => {
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
