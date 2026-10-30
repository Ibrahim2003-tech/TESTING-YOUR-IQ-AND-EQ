import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 80,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
      select: false,
    },
    role: {
      type: String,
      enum: ["admin", "reviewer", "student", "analyst"],
      default: "student",
    },
    highestIQScore: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },
    highestEQScore: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },
    badges: {
      type: [String],
      default: [],
    },
    lastExamTaken: {
      type: Date,
      default: null,
    },
    usedIQQuestionIds: {
      type: [String],
      default: [],
      select: false,
    },
    usedEQQuestionIds: {
      type: [String],
      default: [],
      select: false,
    },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

export default User;
