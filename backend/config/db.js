import mongoose from "mongoose";

mongoose.set("strictQuery", true);

const connectDB = async () => {
  const mongoURI = process.env.MONGO_URI;

  if (!mongoURI) {
    throw new Error("MONGO_URI is required. Set it to your MongoDB Atlas connection string.");
  }

  if (mongoURI.includes("<db_username>") || mongoURI.includes("<db_password>")) {
    throw new Error("Replace <db_username> and <db_password> in MONGO_URI with your Atlas database credentials.");
  }

  try {
    await mongoose.connect(mongoURI);
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
    throw error;
  }
};

export default connectDB;
