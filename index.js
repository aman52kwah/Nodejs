import express from "express";
const app = express();
import cors from "cors";
import bodyParser from "body-parser";
import "dotenv/config"; // Load environment variables from .env file
//dotenv is used to load environment variables from .env file
import { DataTypes, Sequelize } from "sequelize";
import passport from "passport";
import session from "express-session";
import connectSessionSequelize from "connect-session-sequelize";
const SequelizeStore = connectSessionSequelize(session.Store);
import bcrypt from "bcrypt";

//middleware
const jsonParser = bodyParser.json();
const urlencodedParser = bodyParser.urlencoded({
  extended: false,
});



//authentication packages
import LocalStrategy from "passport-local";


const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: "postgres",
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false, // This is important for self-signed certificates
    },
  },
});
console.log("DATABASE_URL:", process.env.DATABASE_URL);
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
    //test connection to the database
    await sequelize.authenticate();
    console.log("Neon postgresSQL connection established successfuly.");

    //sync the models with the database
    await sequelize.sync({ alter: true });
    console.log("Database synchronized successfully.");
    sessionStore.sync();
  } catch (error) {
    console.error(error);
  }
}
initializeDatabase();

// CORS configuration
// This allows your frontend to make requests to the backend
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://todoapp-omega-blond-72.vercel.app',
  process.env.FRONTED_URL
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps, curl, etc.)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true
  })
);



//middleware for session
app.use(express.json());
app.use(
  session({
    secret: process.env.SECRET_SESSION || 'fallbacksecret', //used to sign session cookies
    resave: false, //resave session if it is not modified
    saveUninitialized: false, //don't save uninitialized session
    store: sessionStore, //use the session store we created
    cookie: {
      secure: process.env.ENVIRONMENT === "production", //set to true if using https
      sameSite:'lax', //allow cookies to be sent with cross-site requests
      httpOnly: true, //prevent client side js from accessing the cookie
      maxAge: 24 * 60 * 60 * 1000, //set cookie to expire in 5 minutes
    },
  })
);
app.use((req, res, next) => {
  console.log('Request Origin:', req.headers.origin);
  next();
});
app.use(jsonParser);
app.use(urlencodedParser);
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
        const user = await User.findOne({
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
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
          return done(null, false, { message: "invalid email or password" });
        }
        // if success
        return done(null, user);
      } catch (error) {
        done(error);
      }
    }
  )
);

const requireAuth = (req, res, next) => {
  if (req.isAuthenticated()) {
    //passport.js method to check if user is logged in
    return next();
  }
  // user is not authenticated, return error
  res.status(401).json({ message: "Authentication required" });
};
const requireAuthAdmin = (req, res, next) => {
  if (req.isAuthenticated() && req.user.role === "admin") {
    //passport.js method to check if user is logged in
    //User is authenticated, proceed to next middleware
    return next();
  }
  //user not authenticated, return error
  res.status(401).json({ message: "Admin role required" });
};

// user registration endpoint
app.post("/auth/register", async (req, res) => {
  try {
    console.log("isAuthenticated: ", req.cookies);
    if (req.isAuthenticated()) {
      return res.status(400).json({ message: "you are already logged in" });
    }
    const { email, password, username } = req.body;

    if (!email || !password || !username) {
      return res.status(400).json({
        message: "Include all fields",
      });
    }
    //check for exsisting user
    const existingUser = await User.findOne({
      where: {
        email,
        username,
      },
    });

    if (existingUser) {
      return res.status(400).json({ message: "User already exist" });
    }
    //let hash the password before saving it in the db
    //the hgih the salting , the more computation power it needs
    const hashedPassword = await bcrypt.hash(password, 12);

    //create a new user with the hashed password
    const user = await User.create({
      email,
      username,
      password: hashedPassword,
      //role:"admin",
      provider: "local",
    });
    req.logIn(user, (error) => {
      if (error) {
        return res.status(500).json({ message: "error logging in the user" });
      }
      return res.status(201).json({
        message: "User created successfully",
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
        },
      });
    });
  } catch (error) {
    res.status(500).json({ message: "error creating user" });
  }
});
//USER LOGIN ROUTE
//passport.authenticate("local") runs our local strategy
app.post("/auth/login", passport.authenticate("local"), (req, res) => {
  //if we reach this funcion, authentication was successful
  //req.user contains the authenticated user object
  res.json({
    success: true,
    message: "Login successful",
    user: req.user,
  });
});

//USER LOGOUT ROUTE
app.post("/auth/logout", (req, res) => {
  req.session.destroy((err) => {
    //passport.js method to clear session
    if (err) {
      return res
        .status(500)
        .json({ message: "Error logging out", isSuccessful: false });
    }
    res.clearCookie("connect.sid");
    res.json({ message: "logout sucessful", isSuccessfull: true });
  });
});

//GET CURRENT USER INFO
//This route tells the frontend if a user is currently logged in
app.get("/auth/me", (req, res) => {
  if (req.isAuthenticated()) {
    res.json({
      user: {
        id: req.user.id,
        email: req.user.email,
        username: req.user.username,
        displayName: req.user.displayName,
        provider: req.user.provider,
      },
    });
  } else {
    res.status(401).json({ message: "Not authenticated" });
  }
});

// ==================================================================================
// PROTECTED TODO ROUTES
// All routes below user requireAuth middleware, meaning users must logged
// ==================================================================================

// GET ALL TODOS FOR AUTHENTICATED USER

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

app.get("/", requireAuth, async (req, res) => {
  try {
    //find all todos belonging to the current  user
    //req.user.id is available becuase of the passport deserializer
    console.log("Fetching todos for user:", req.user.id);
    console.log("=== FETCHING TODOS ===");
    console.log("User ID:", req.user.id);
    console.log("User object:", req.user);
    const data = await Todo.findAll({
      where: { userId: req.user.id },
    });
    console.log("Found todos:", Todo.length);
    return res.json(data);
  } catch (error) {
    return res.status(500).json({
      message: "Error fetching todos",
      error: error.message,
    });
  }
});

//CREATE NEW TODO
app.post("/todo", requireAuth, async (req, res) => {
  try {
    const { title, description } = req.body;
    // Create todo object with user ID from authenticated user
    const userId = req.user.id;
    const todoItem = {
      title,
      description,
      isDone: false,
      UserId: userId, // Asspoiate todo
    };
    //instead of pushing to the array, create using db
    const createdTodo = await Todo.create(todoItem);

    res.status(201);
    return res.json({
      message: "Todo has been added",
      isSuccessful: true,
      data: createdTodo,
    });
  } catch (error) {
    console.error("error creating todo", error);
    return res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
});

//GET SPECIFIC TODO BY ID

app.get("/todo/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // find todo by ID and user ID (security measure)
    // this measuer ensures users can only access their own todos
    const todoItem = await Todo.findOne({
      where: {
        id,
        userId: req.user.id, // this crucial for security
      },
    });
    if (!todoItem) {
      return res.status(404).json({
        message: "Todo item not found",
        isSuccessful: false,
      });
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

// UPDATE TODO

app.put("/todo", requireAuth, async (req, res) => {
  try {
    const { id, title, description, isDone } = req.body;

    /// update todo, but only if it belongs to the current user
    const [updatedRowsCount] = await Todo.update(
      {
        title,
        description,
        isDone,
      },
      {
        where: {
          id,
          userId: req.user.id, // security: only update users own todos
        },
      }
    );

    // if no rows were updated, either todo doesnt exist
    if (updatedRowsCount === 0) {
      return res.status(404).json({
        message: "Todo item not found or you dont have permission to update",
        isSuccessful: false,
      });
    }

    res.status(200).json({
      isSuccessful: true,
      message: "Successfully updated the todo item",
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

//DELETE TODO

app.delete("/todo/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    // delete todo, but if it belongs to a user
    const deletedRowsCount = await Todo.destroy({
      where: {
        id,
        userId: req.user.id, // security: only delete todo for a user
      },
    });

    // if no rows deleted, either todo doesnt exist
    if (deletedRowsCount === 0) {
      return res.status(404).json({
        messgae: "todo item not found or you dont have permission",
      });
    }
    return res.status(200).json({
      message: "deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting todo:", error);
    return res.status(500).json({
      message: "Error deleting todo item",
      error: error.message,
    });
  }
});

app.listen("5000", (error) => {
  if (error) {
    console.error("Creation of server failed: ", error);
    return;
  }
  console.log("Server is listening on port 5000");
});
